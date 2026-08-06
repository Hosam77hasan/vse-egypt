/*
 * VS Code Egypt — model abstraction layer.
 *
 * The client (sidebar chat, Ctrl+K) only ever sees these three aliases — never a
 * vendor name. Each alias maps to a real provider here, server-side only.
 *
 * All three providers are wired through their OpenAI-compatible chat/completions
 * endpoint, which keeps chat.js's request/response handling identical regardless
 * of which one actually answers:
 *   - DeepSeek's API is natively OpenAI-compatible.
 *   - OpenRouter is natively OpenAI-compatible (and itself proxies many models,
 *     including Gemini, Claude, Llama, etc. under one key).
 *   - Gemini has its own OpenAI-compatible shim at
 *     https://generativelanguage.googleapis.com/v1beta/openai — using that
 *     instead of Gemini's native generateContent format avoids needing a
 *     second, differently-shaped streaming parser in chat.js.
 *
 * ============================== NOT LIVE-TESTED ==============================
 * Only the "driver" alias (DeepSeek) has been exercised against a real upstream
 * call in this environment — that's the only key available to test with. The
 * "leader" and "innovator" routes are wired correctly per each provider's
 * published OpenAI-compat API shape, but have NOT been verified against a real
 * Gemini or OpenRouter key. Test both with real keys before relying on them.
 * ================================================================================
 */

const MODEL_CATALOG = {
	driver: {
		label: 'السائق',
		labelEn: 'Driver',
		description: 'Fast code writing and quick edits.',
		apiBase: process.env.DRIVER_API_BASE || process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/v1',
		apiKey: process.env.DRIVER_API_KEY || process.env.DEEPSEEK_API_KEY,
		model: process.env.DRIVER_MODEL || 'deepseek-chat',
	},
	leader: {
		label: 'القائد',
		labelEn: 'Leader',
		description: 'Architecture, reasoning, and design decisions.',
		apiBase: process.env.LEADER_API_BASE || process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/v1',
		apiKey: process.env.LEADER_API_KEY || process.env.DEEPSEEK_API_KEY,
		// Defaults to DeepSeek's reasoning model (same key as "driver", no extra
		// provider account needed to get started). Point LEADER_API_BASE /
		// LEADER_API_KEY / LEADER_MODEL at Gemini's OpenAI-compat endpoint
		// instead if you want "leader" on a genuinely different provider:
		//   LEADER_API_BASE=https://generativelanguage.googleapis.com/v1beta/openai
		//   LEADER_MODEL=gemini-2.0-flash-thinking-exp
		model: process.env.LEADER_MODEL || 'deepseek-reasoner',
	},
	innovator: {
		label: 'المبتكر',
		labelEn: 'Innovator',
		description: 'Complex refactors and large structural changes.',
		apiBase: process.env.INNOVATOR_API_BASE || 'https://openrouter.ai/api/v1',
		apiKey: process.env.INNOVATOR_API_KEY,
		model: process.env.INNOVATOR_MODEL || 'google/gemini-2.0-flash-001',
	},
};

function getModelConfig(alias) {
	const config = MODEL_CATALOG[alias];
	if (!config) {
		return null;
	}
	if (!config.apiKey) {
		return { ...config, unconfigured: true };
	}
	return config;
}

/** Public catalog shape sent to the client — labels and descriptions only, never keys/URLs/vendor names. */
function getPublicCatalog() {
	return Object.fromEntries(
		Object.entries(MODEL_CATALOG).map(([alias, cfg]) => [
			alias,
			{ label: cfg.label, labelEn: cfg.labelEn, description: cfg.description },
		])
	);
}

module.exports = { MODEL_CATALOG, getModelConfig, getPublicCatalog };
