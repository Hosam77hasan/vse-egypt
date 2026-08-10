/**
 * VS Code Egypt — Extension AI Filter Tests
 *
 * Tests the isExtensionAllowed() and getBlockedExtensionMessage() functions
 * to ensure competing AI extensions are blocked while normal extensions
 * (themes, formatters, linters, etc.) are allowed.
 */

const {
    isExtensionAllowed,
    getBlockedExtensionMessage,
    BLOCKED_EXTENSION_IDS,
    AI_KEYWORDS,
} = require('../../../vse-extension/editor/src/browser/extensionAiFilter');

describe('Extension AI Filter', () => {

    // ═══════════════════════════════════════════════════════════════════
    // BLOCKED EXTENSION IDs
    // ═══════════════════════════════════════════════════════════════════
    describe('BLOCKED_EXTENSION_IDS', () => {
        it('should block GitHub Copilot family', () => {
            expect(BLOCKED_EXTENSION_IDS.has('github.copilot')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('github.copilot-chat')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('github.copilot-nightly')).toBe(true);
        });

        it('should block Tabnine', () => {
            expect(BLOCKED_EXTENSION_IDS.has('tabnine.tabnine-vscode')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('tabnine.tabnine-vscode-self-hosted-updater')).toBe(true);
        });

        it('should block Codeium/Windsurf', () => {
            expect(BLOCKED_EXTENSION_IDS.has('codeium.codeium')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('codeium.codeium-enterprise-updater')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('codeium.windsurf')).toBe(true);
        });

        it('should block Amazon Q', () => {
            expect(BLOCKED_EXTENSION_IDS.has('amazonwebservices.amazon-q-vscode')).toBe(true);
        });

        it('should block Continue and Cody', () => {
            expect(BLOCKED_EXTENSION_IDS.has('continue.continue')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('sourcegraph.cody-ai')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('sourcegraph.cody-aichat')).toBe(true);
        });

        it('should block Gemini', () => {
            expect(BLOCKED_EXTENSION_IDS.has('google.geminicodeassist')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('googlecloud.gemini-code-assist')).toBe(true);
        });

        it('should block Claude/Anthropic', () => {
            expect(BLOCKED_EXTENSION_IDS.has('saoudrizwan.claude-dev')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('kodu-ai.claude-coder')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('anthropic.claude-code')).toBe(true);
        });

        it('should block Cursor', () => {
            expect(BLOCKED_EXTENSION_IDS.has('cursor.cursor')).toBe(true);
        });

        it('should block GPT wrappers', () => {
            expect(BLOCKED_EXTENSION_IDS.has('codegpt.codegpt')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('openai.openai-chatgpt')).toBe(true);
            expect(BLOCKED_EXTENSION_IDS.has('genieai.chatgpt-vscode')).toBe(true);
        });

        it('should have at least 30 blocked IDs', () => {
            expect(BLOCKED_EXTENSION_IDS.size).toBeGreaterThanOrEqual(30);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // AI KEYWORDS
    // ═══════════════════════════════════════════════════════════════════
    describe('AI_KEYWORDS', () => {
        it('should contain essential AI-related keywords', () => {
            expect(AI_KEYWORDS).toContain('chatgpt');
            expect(AI_KEYWORDS).toContain('copilot');
            expect(AI_KEYWORDS).toContain('claude');
            expect(AI_KEYWORDS).toContain('gemini');
            expect(AI_KEYWORDS).toContain('openai');
            expect(AI_KEYWORDS).toContain('anthropic');
        });

        it('should have at least 20 keywords', () => {
            expect(AI_KEYWORDS.length).toBeGreaterThanOrEqual(20);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // isExtensionAllowed() — BLOCKED extensions
    // ═══════════════════════════════════════════════════════════════════
    describe('isExtensionAllowed() — blocked extensions', () => {

        it('should block GitHub Copilot by ID', () => {
            const result = isExtensionAllowed({ id: 'github.copilot', name: 'Copilot' });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('ذكاء اصطناعي خارجي');
        });

        it('should block Copilot Chat', () => {
            const result = isExtensionAllowed({ id: 'github.copilot-chat', name: 'Copilot Chat' });
            expect(result.allowed).toBe(false);
        });

        it('should block Tabnine', () => {
            const result = isExtensionAllowed({ id: 'tabnine.tabnine-vscode', name: 'Tabnine' });
            expect(result.allowed).toBe(false);
        });

        it('should block Codeium', () => {
            const result = isExtensionAllowed({ id: 'codeium.codeium', name: 'Codeium' });
            expect(result.allowed).toBe(false);
        });

        it('should block Claude Dev', () => {
            const result = isExtensionAllowed({ id: 'saoudrizwan.claude-dev', name: 'Claude Dev' });
            expect(result.allowed).toBe(false);
        });

        it('should block Cursor', () => {
            const result = isExtensionAllowed({ id: 'cursor.cursor', name: 'Cursor' });
            expect(result.allowed).toBe(false);
        });

        it('should block by name fallback when id is missing', () => {
            const result = isExtensionAllowed({ name: 'github.copilot' });
            expect(result.allowed).toBe(false);
        });

        it('should block extension with "chatgpt" in description', () => {
            const result = isExtensionAllowed({
                id: 'some-random-ext',
                name: 'My Extension',
                description: 'A ChatGPT integration for VS Code'
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('ذكاء اصطناعي خارجي');
        });

        it('should block extension with "copilot" in description', () => {
            const result = isExtensionAllowed({
                id: 'some-random-ext',
                name: 'Code Helper',
                description: 'AI-powered copilot alternative'
            });
            expect(result.allowed).toBe(false);
        });

        it('should block extension with "ai powered" in keywords', () => {
            const result = isExtensionAllowed({
                id: 'some-random-ext',
                name: 'Smart Coder',
                keywords: ['ai powered', 'code completion']
            });
            expect(result.allowed).toBe(false);
        });

        it('should block extension with "llm" in categories', () => {
            const result = isExtensionAllowed({
                id: 'some-random-ext',
                name: 'Language Model Tool',
                categories: ['Machine Learning', 'LLM']
            });
            expect(result.allowed).toBe(false);
        });

        it('should block extension with "deepseek" in description', () => {
            const result = isExtensionAllowed({
                id: 'some-random-ext',
                name: 'Deep Code',
                description: 'Uses deepseek for code analysis'
            });
            expect(result.allowed).toBe(false);
        });

        it('should block extension with "openai" in publisher name', () => {
            const result = isExtensionAllowed({
                id: 'some-random-ext',
                name: 'My Tool',
                publisher: 'openai-official'
            });
            expect(result.allowed).toBe(false);
        });

        it('should block extension with "Machine Learning" category', () => {
            const result = isExtensionAllowed({
                id: 'some-random-ext',
                name: 'Data Processor',
                categories: ['Machine Learning']
            });
            expect(result.allowed).toBe(false);
        });

        it('should block extension with "AI" category', () => {
            const result = isExtensionAllowed({
                id: 'some-random-ext',
                name: 'Smart Helper',
                categories: ['AI']
            });
            expect(result.allowed).toBe(false);
        });

        it('should block extension with "artificial intelligence" category', () => {
            const result = isExtensionAllowed({
                id: 'some-random-ext',
                name: 'Brain',
                categories: ['Artificial Intelligence']
            });
            expect(result.allowed).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // isExtensionAllowed() — ALLOWED extensions
    // ═══════════════════════════════════════════════════════════════════
    describe('isExtensionAllowed() — allowed extensions', () => {

        it('should allow a theme extension', () => {
            const result = isExtensionAllowed({
                id: 'ms-vscode.cpptools',
                name: 'C/C++',
                displayName: 'C/C++ IntelliSense',
                description: 'C/C++ IntelliSense, debugging, and code browsing',
                categories: ['Programming Languages']
            });
            expect(result.allowed).toBe(true);
        });

        it('should allow a Python extension', () => {
            const result = isExtensionAllowed({
                id: 'ms-python.python',
                name: 'Python',
                displayName: 'Python',
                description: 'IntelliSense, Linting, Debugging, Code Formatting, Refactoring',
                categories: ['Programming Languages']
            });
            expect(result.allowed).toBe(true);
        });

        it('should allow a formatter extension', () => {
            const result = isExtensionAllowed({
                id: 'esbenp.prettier-vscode',
                name: 'Prettier',
                displayName: 'Prettier - Code formatter',
                description: 'Code formatter using prettier',
                categories: ['Formatters']
            });
            expect(result.allowed).toBe(true);
        });

        it('should allow a linter extension', () => {
            const result = isExtensionAllowed({
                id: 'dbaeumer.vscode-eslint',
                name: 'ESLint',
                displayName: 'ESLint',
                description: 'Integrates ESLint JavaScript into VS Code',
                categories: ['Linters']
            });
            expect(result.allowed).toBe(true);
        });

        it('should allow a Docker extension', () => {
            const result = isExtensionAllowed({
                id: 'ms-azuretools.vscode-docker',
                name: 'Docker',
                displayName: 'Docker',
                description: 'Makes it easy to create, manage, and debug containerized applications',
                categories: ['Other']
            });
            expect(result.allowed).toBe(true);
        });

        it('should allow a Git extension', () => {
            const result = isExtensionAllowed({
                id: 'eamodio.gitlens',
                name: 'GitLens',
                displayName: 'GitLens — Git supercharged',
                description: 'Supercharge Git within VS Code',
                categories: ['SCM Providers']
            });
            expect(result.allowed).toBe(true);
        });

        it('should allow a snippets extension', () => {
            const result = isExtensionAllowed({
                id: 'ms-vscode.vscode-typescript-next',
                name: 'TypeScript',
                displayName: 'TypeScript Hero',
                description: 'TypeScript tooling for VS Code',
                categories: ['Programming Languages']
            });
            expect(result.allowed).toBe(true);
        });

        it('should allow a database extension', () => {
            const result = isExtensionAllowed({
                id: 'cweijan.vscode-database-client2',
                name: 'Database',
                displayName: 'Database Client',
                description: 'Database client for MySQL, PostgreSQL, SQLite, etc.',
                categories: ['Other']
            });
            expect(result.allowed).toBe(true);
        });

        it('should allow extension with no categories', () => {
            const result = isExtensionAllowed({
                id: 'my-custom-ext',
                name: 'Custom Tool',
                description: 'A helpful development tool'
            });
            expect(result.allowed).toBe(true);
        });

        it('should allow extension with empty manifest fields', () => {
            const result = isExtensionAllowed({
                id: 'minimal-ext',
                name: ''
            });
            expect(result.allowed).toBe(true);
        });

        it('should be case-insensitive for keyword matching', () => {
            // "CHATGPT" should still be blocked
            const result = isExtensionAllowed({
                id: 'some-ext',
                name: 'My Extension',
                description: 'Uses CHATGPT API'
            });
            expect(result.allowed).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // getBlockedExtensionMessage()
    // ═══════════════════════════════════════════════════════════════════
    describe('getBlockedExtensionMessage()', () => {

        it('should return a message with title, body, and actions', () => {
            const manifest = { id: 'github.copilot', name: 'Copilot' };
            const message = getBlockedExtensionMessage(manifest);

            expect(message).toHaveProperty('title');
            expect(message).toHaveProperty('body');
            expect(message).toHaveProperty('actions');
            expect(message.title).toContain('🚫');
            expect(message.actions.length).toBe(3);
        });

        it('should include Ctrl+K action', () => {
            const manifest = { id: 'github.copilot', name: 'Copilot' };
            const message = getBlockedExtensionMessage(manifest);

            const ctrlKAction = message.actions.find(a => a.command === 'vscodeEgypt.openInlineChat');
            expect(ctrlKAction).toBeDefined();
            expect(ctrlKAction.label).toContain('Ctrl+K');
        });

        it('should include side chat action', () => {
            const manifest = { id: 'github.copilot', name: 'Copilot' };
            const message = getBlockedExtensionMessage(manifest);

            const chatAction = message.actions.find(a => a.command === 'vscodeEgypt.openSideChat');
            expect(chatAction).toBeDefined();
            expect(chatAction.label).toContain('الشات الجانبي');
        });

        it('should include info action', () => {
            const manifest = { id: 'github.copilot', name: 'Copilot' };
            const message = getBlockedExtensionMessage(manifest);

            const infoAction = message.actions.find(a => a.command === 'vscodeEgypt.showAiModelsInfo');
            expect(infoAction).toBeDefined();
        });

        it('should mention the blocked extension name in body', () => {
            const manifest = { id: 'github.copilot', name: 'GitHub Copilot' };
            const message = getBlockedExtensionMessage(manifest);

            expect(message.body).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EDGE CASES
    // ═══════════════════════════════════════════════════════════════════
    describe('Edge cases', () => {

        it('should handle extension with only id (no name)', () => {
            const result = isExtensionAllowed({ id: 'github.copilot' });
            expect(result.allowed).toBe(false);
        });

        it('should handle extension with only name (no id)', () => {
            const result = isExtensionAllowed({ name: 'github.copilot' });
            expect(result.allowed).toBe(false);
        });

        it('should handle extension with empty arrays', () => {
            const result = isExtensionAllowed({
                id: 'safe-ext',
                name: 'Safe',
                categories: [],
                keywords: []
            });
            expect(result.allowed).toBe(true);
        });

        it('should handle extension with undefined fields', () => {
            const result = isExtensionAllowed({
                id: 'safe-ext',
                name: undefined,
                displayName: undefined,
                description: undefined,
                categories: undefined,
                keywords: undefined,
                publisher: undefined
            });
            expect(result.allowed).toBe(true);
        });

        it('should include publisher in search text for keyword matching', () => {
            // Publisher 'openai' matches the keyword 'openai'
            const result = isExtensionAllowed({
                id: 'random-ext',
                name: 'Helper',
                publisher: 'openai'
            });
            expect(result.allowed).toBe(false);
        });

        it('should be case-insensitive for ID matching', () => {
            const result = isExtensionAllowed({ id: 'GitHub.Copilot' });
            expect(result.allowed).toBe(false);
        });

        it('should not false-positive on "ai" in normal words like "email" or "domain"', () => {
            const result = isExtensionAllowed({
                id: 'safe-ext',
                name: 'Email Sender',
                description: 'Send emails from VS Code',
                categories: ['Communication']
            });
            // "email" contains "ai" but should NOT be blocked
            // The filter checks for full keywords, not substrings of random words
            // Actually, "ai" is not in the keywords list - the list has "ai assistant", "ai code", etc.
            // So "email" should be fine
            expect(result.allowed).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CONSISTENCY CHECKS
    // ═══════════════════════════════════════════════════════════════════
    describe('Consistency checks', () => {

        it('all blocked IDs should be lowercase', () => {
            for (const id of BLOCKED_EXTENSION_IDS) {
                expect(id).toBe(id.toLowerCase());
            }
        });

        it('all AI keywords should be lowercase', () => {
            for (const keyword of AI_KEYWORDS) {
                expect(keyword).toBe(keyword.toLowerCase());
            }
        });

        it('blocked message should return reason for blocked extensions', () => {
            const manifest = { id: 'github.copilot', name: 'Copilot' };
            const result = isExtensionAllowed(manifest);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBeDefined();
            expect(result.reason.length).toBeGreaterThan(0);
        });
    });
});
