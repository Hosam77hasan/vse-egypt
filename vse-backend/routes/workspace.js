const express = require('express');
const { indexWorkspace, searchWorkspace, getWorkspaceStatus } = require('../services/indexer');

const router = express.Router();

const MAX_FILES_PER_REQUEST = 5000; // sanity cap — a workspace this large needs a different architecture anyway

/**
 * POST /v1/workspace/index
 * Body: { workspaceKey: string, files: [{path, content}] }
 * `workspaceKey` is a stable client-computed identifier for the workspace (e.g. a hash of
 * the root folder path) — this service has no concept of the user's filesystem beyond that.
 */
router.post('/index', (req, res) => {
	const { workspaceKey, files } = req.body || {};

	if (!workspaceKey || typeof workspaceKey !== 'string') {
		return res.status(400).json({ error: 'invalid_request', message: '`workspaceKey` is required.' });
	}
	if (!Array.isArray(files)) {
		return res.status(400).json({ error: 'invalid_request', message: '`files` array is required.' });
	}
	if (files.length > MAX_FILES_PER_REQUEST) {
		return res.status(413).json({ error: 'too_many_files', message: `Max ${MAX_FILES_PER_REQUEST} files per index request.` });
	}

	try {
		const result = indexWorkspace(req.user.id, workspaceKey, files);
		res.json({ indexed: true, ...result });
	} catch (err) {
		console.error('[vse-backend] indexWorkspace error:', err);
		res.status(500).json({ error: 'index_failed' });
	}
});

/**
 * GET /v1/workspace/status?workspaceKey=...
 */
router.get('/status', (req, res) => {
	const { workspaceKey } = req.query;
	if (!workspaceKey) {
		return res.status(400).json({ error: 'invalid_request' });
	}
	const status = getWorkspaceStatus(req.user.id, String(workspaceKey));
	res.json({ indexed: !!status, ...status });
});

/**
 * POST /v1/workspace/search
 * Body: { workspaceKey: string, query: string, topK?: number }
 * Powers @Codebase (broad query search) and the retrieval half of @Folder (query scoped
 * client-side by prefix-filtering results by path — see the IDE-side context resolver).
 */
router.post('/search', (req, res) => {
	const { workspaceKey, query, topK } = req.body || {};
	if (!workspaceKey || !query) {
		return res.status(400).json({ error: 'invalid_request', message: '`workspaceKey` and `query` are required.' });
	}

	try {
		const results = searchWorkspace(req.user.id, workspaceKey, query, Math.min(topK || 8, 20));
		res.json({ results });
	} catch (err) {
		console.error('[vse-backend] searchWorkspace error:', err);
		res.status(500).json({ error: 'search_failed' });
	}
});

module.exports = router;
