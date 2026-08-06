const express = require('express');
const { requireTokenBudget, recordUsage } = require('../middleware/tokenGuard');
const { getModelConfig } = require('../config/models');

const router = express.Router();

const PLAN_SYSTEM_PROMPT = `You are a coding agent that plans multi-file changes to a codebase.
Given a goal and optional file context, respond with ONLY a single JSON object (no markdown fences, no explanation) matching exactly this shape:
{
  "summary": "one sentence describing the plan",
  "files": [ { "path": "relative/path.ext", "action": "create" | "edit", "content": "full new file content" } ],
  "terminalCommands": [ { "command": "shell command", "description": "why this command is needed" } ]
}
Rules:
- "files" must contain the FULL resulting content of each file, not a diff or partial snippet.
- Only include files that actually need to change or be created.
- Only suggest terminalCommands that are genuinely necessary (installing a new dependency, running a migration, etc) — do not suggest commands like "git commit" or anything destructive.
- If the goal doesn't require any file changes, return an empty "files" array.
- Respond with ONLY the JSON object. No text before or after it.`;

function tryParsePlan(raw) {
	// Models sometimes wrap JSON in markdown fences despite instructions not to —
	// strip those defensively before parsing rather than failing on something this
	// easy to recover from.
	const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
	try {
		const parsed = JSON.parse(cleaned);
		if (!Array.isArray(parsed.files) || !Array.isArray(parsed.terminalCommands)) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/**
 * POST /v1/agent/plan
 * Body: { goal: string, model?: 'driver'|'leader'|'innovator', contextFiles?: [{path, content}] }
 *
 * Non-streaming by design — an agent plan is consumed as one structured unit (the
 * review UI needs the whole file list before it can render anything useful), unlike
 * /v1/chat's token-by-token prose which benefits from streaming.
 */
router.post('/plan', requireTokenBudget, async (req, res) => {
	const { goal, model: modelAlias = 'leader', contextFiles } = req.body || {};

	if (!goal || typeof goal !== 'string') {
		return res.status(400).json({ error: 'invalid_request', message: '`goal` is required.' });
	}

	const modelConfig = getModelConfig(modelAlias);
	if (!modelConfig) {
		return res.status(400).json({ error: 'invalid_model' });
	}
	if (modelConfig.unconfigured) {
		return res.status(503).json({ error: 'model_unavailable', message: `The "${modelConfig.label}" model isn't configured on this server yet.` });
	}

	const contextText = Array.isArray(contextFiles) && contextFiles.length > 0
		? contextFiles.map(f => `File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
		: '';

	const userMessage = contextText ? `${contextText}\n\nGoal: ${goal}` : `Goal: ${goal}`;

	async function callModel(retryReminder) {
		const messages = [
			{ role: 'system', content: PLAN_SYSTEM_PROMPT },
			{ role: 'user', content: userMessage },
		];
		if (retryReminder) {
			messages.push({ role: 'user', content: 'Your previous response was not valid JSON matching the required shape. Respond again with ONLY the JSON object, nothing else.' });
		}

		const upstream = await fetch(`${modelConfig.apiBase}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${modelConfig.apiKey}` },
			body: JSON.stringify({ model: modelConfig.model, messages, stream: false }),
		});

		if (!upstream.ok) {
			const errText = await upstream.text().catch(() => '');
			console.error(`[vse-backend] agent plan upstream error for model="${modelAlias}" (status ${upstream.status})`, errText);
			throw new Error('upstream_error');
		}

		const data = await upstream.json();
		const content = data?.choices?.[0]?.message?.content ?? '';
		const usage = data?.usage ?? {};
		return { content, promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0 };
	}

	try {
		let { content, promptTokens, completionTokens } = await callModel(false);
		let plan = tryParsePlan(content);

		if (!plan) {
			// One retry with an explicit reminder — model JSON-formatting slips are
			// common enough on the first attempt to be worth a single automatic retry
			// before surfacing an error to the user.
			const retry = await callModel(true);
			promptTokens += retry.promptTokens;
			completionTokens += retry.completionTokens;
			plan = tryParsePlan(retry.content);
		}

		recordUsage(req.user.id, req.tokenBudget.period, promptTokens, completionTokens, modelAlias, req.tokenBudget.usingCredit);

		if (!plan) {
			return res.status(502).json({ error: 'plan_parse_failed', message: 'The AI service returned a plan in an unexpected format. Please try rephrasing your goal.' });
		}

		res.json({ plan });
	} catch (err) {
		console.error('[vse-backend] agent plan error:', err);
		res.status(502).json({ error: 'plan_failed', message: 'The AI service is temporarily unavailable. Please try again.' });
	}
});

module.exports = router;
