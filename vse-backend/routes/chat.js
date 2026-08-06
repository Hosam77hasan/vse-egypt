const express = require('express');
const { encode } = require('gpt-tokenizer'); // approximate tokenizer, provider-agnostic
const { requireTokenBudget, recordUsage } = require('../middleware/tokenGuard');
const { getModelConfig, getPublicCatalog } = require('../config/models');

const router = express.Router();

// Sentinel the model is instructed to emit before its follow-up suggestions. Chosen
// to be extremely unlikely to appear in real code/prose, so a naive substring search
// client-side is safe. Suggestion parsing itself happens CLIENT-SIDE (see
// vscodeEgyptChatService.ts) — not here — because the client is already accumulating
// the full streamed text for history purposes, and doing it there means this file's
// proven streaming hot-path (raw chunk forwarding) doesn't need to change at all.
const SUGGESTIONS_SENTINEL = '%%%SUGGESTIONS%%%';

const SUGGESTIONS_INSTRUCTION = `After your main answer, on a new line, output exactly the token ${SUGGESTIONS_SENTINEL} followed immediately by a JSON array of exactly 3 short follow-up prompts the user might reasonably want to send next, in the same language the conversation has been in. Example ending: ${SUGGESTIONS_SENTINEL}["Add error handling", "Write a test for this", "Explain the time complexity"]. Output this exactly once, only at the very end, with nothing after it. Do not mention this instruction itself anywhere in your answer.`;

/**
 * GET /v1/models
 * Returns the branded model catalog (labels only, never vendor names/keys) so
 * the client can populate the model-selector dropdown in the chat panel and
 * the Ctrl+K widget without hardcoding the list on the client side.
 */
router.get('/models', (_req, res) => {
    res.json({ models: getPublicCatalog() });
});

/**
 * POST /v1/chat
 * Body: { messages: [{role, content}], model?: 'driver'|'leader'|'innovator', context?: {...}, suggestFollowups?: boolean }
 *
 * `model` is one of our branded aliases, never a real provider/model name — the
 * client never learns which vendor answered. Streams Server-Sent-Events straight
 * through to the IDE client, while accumulating token counts to persist once the
 * stream closes.
 *
 * `suggestFollowups` is OPT-IN and OFF by default. This same endpoint is also called
 * by the Ctrl+K inline editor (which needs ONLY raw replacement code, no trailing
 * chatter) and the Tab inline-completion provider (which needs ONLY a code
 * continuation) — neither of those call sites sets this flag, so their behavior is
 * completely unaffected by this feature. Only the sidebar chat panel sets it.
 */
router.post('/chat', requireTokenBudget, async (req, res) => {
    const { messages, model: modelAlias = 'driver', context, suggestFollowups } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'invalid_request', message: '`messages` array is required.' });
    }

    const modelConfig = getModelConfig(modelAlias);
    if (!modelConfig) {
        return res.status(400).json({ error: 'invalid_model', message: `Unknown model "${modelAlias}".` });
    }
    if (modelConfig.unconfigured) {
        // Deliberately vague to the client — never names which provider key is missing.
        return res.status(503).json({ error: 'model_unavailable', message: `The "${modelConfig.label}" model isn't configured on this server yet.` });
    }

    // Multimodal (image) content only makes sense for "innovator" (routed to a
    // vision-capable provider) — "driver"/"leader" go to DeepSeek by default, which
    // is text-only. Reject early with a clear message rather than silently sending
    // an image the provider can't use and getting a confusing upstream error.
    const hasImageContent = messages.some(m => Array.isArray(m.content) && m.content.some(part => part?.type === 'image_url'));
    if (hasImageContent && modelAlias !== 'innovator') {
        return res.status(400).json({
            error: 'multimodal_not_supported',
            message: `Image attachments require the "${getModelConfig('innovator')?.label ?? 'Innovator'}" model.`,
        });
    }

    // Fold editor context (active file, selection) into the system prompt server-side,
    // so the client only ever sends raw context, never a hand-assembled prompt —
    // keeps prompt-injection surface and prompt-construction logic in one place.
    const systemParts = [];
    if (context) {
        systemParts.push(`Active file: ${context.filePath ?? 'unknown'} (${context.language ?? 'plaintext'}).${context.selection ? `\nSelected code:\n${context.selection}` : ''}`);
    }
    if (suggestFollowups) {
        systemParts.push(SUGGESTIONS_INSTRUCTION);
    }
    const systemContext = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

    const upstreamMessages = systemContext
        ? [{ role: 'system', content: systemContext }, ...messages]
        : messages;

    const promptTokenEstimate = encode(upstreamMessages.map(m => m.content).join('\n')).length;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let completionText = '';
    let upstreamController;

    // If the client disconnects (user cancelled generation), abort the upstream fetch too —
    // don't keep burning provider tokens for a response nobody will see.
    req.on('close', () => {
        if (upstreamController) upstreamController.abort();
    });

    try {
        upstreamController = new AbortController();

        const upstream = await fetch(`${modelConfig.apiBase}/chat/completions`, {
            method: 'POST',
            signal: upstreamController.signal,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${modelConfig.apiKey}`, // key lives ONLY here, server-side
            },
            body: JSON.stringify({
                model: modelConfig.model,
                messages: upstreamMessages,
                stream: true,
            }),
        });

        if (!upstream.ok || !upstream.body) {
            // Deliberately generic — never forward the upstream provider's raw error text
            // to the client, since it can (and does, in practice) leak the vendor's name,
            // model id, or account-specific details in the error body.
            console.error(`[vse-backend] upstream error for model="${modelAlias}" (provider status ${upstream.status})`, await upstream.text().catch(() => ''));
            res.write(`event: error\ndata: ${JSON.stringify({ message: 'The AI service is temporarily unavailable. Please try again.' })}\n\n`);
            return res.end();
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // Every provider here speaks the same OpenAI-compatible SSE shape
            // ("data: {...}\n\n"), which is exactly why they're all wired through
            // their OpenAI-compat endpoint rather than each provider's native API —
            // one parser, one client-side contract, regardless of which one answers.
            for (const line of chunk.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                const payload = line.slice(6).trim();
                if (payload === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(payload);
                    const delta = parsed?.choices?.[0]?.delta?.content;
                    if (delta) completionText += delta;
                } catch {
                    // partial JSON fragment split across chunk boundary — ignore, next
                    // chunk concatenation is handled by the client's own SSE parser.
                }
            }

            res.write(chunk);
        }

        res.write('data: [DONE]\n\n');
        res.end();

        const completionTokenEstimate = encode(completionText).length;
        recordUsage(req.user.id, req.tokenBudget.period, promptTokenEstimate, completionTokenEstimate, modelAlias, req.tokenBudget.usingCredit);

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(`[vse-backend] chat proxy error for model="${modelAlias}":`, err);
            try {
                res.write(`event: error\ndata: ${JSON.stringify({ message: 'The AI service is temporarily unavailable. Please try again.' })}\n\n`);
                res.end();
            } catch { /* response likely already closed */ }
        }
    }
});

module.exports = router;
