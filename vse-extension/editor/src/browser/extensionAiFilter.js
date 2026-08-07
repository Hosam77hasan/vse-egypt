/**
 * VS Code Egypt — Extension AI Filter
 *
 * ============================ الاستراتيجية ============================
 * بنسمح بكل الإضافات العادية (ثيمات، Formatters، لغات، Git، Docker...)
 * ونمنع بس الإضافات اللي فيها ذكاء اصطناعي خارجي.
 *
 * ليه؟ لأن VS Code Egypt فيه 3 نماذج AI مدمجة (السائق، القائد، المبتكر)
 * ومش عايزين المستخدم يحمل أدوات AI خارجية تنافس النماذج بتاعتنا.
 *
 * الإضافات المسموحة: themes, formatters, linters, language support,
 *   debuggers, snippets, keymaps, icons, Git tools, Docker, databases...
 *
 * الإضافات الممنوعة: GitHub Copilot, Tabnine, Codeium, Cody, Cursor,
 *   Continue, Amazon Q, Gemini Code Assist, Claude, ChatGPT, وأي حاجة
 *   فيها AI/LLM/Copilot في الوصف أو الاسم.
 *
 * ============================ آلية العمل ============================
 * 1. قبل أي إضافة ما تتنشط (activate)، بنجيب المانيفيست بتاعها
 * 2. بنشوف الـ extension ID — لو في البلوك ليست ← ممنوع
 * 3. بنقرأ الوصف والكلمات المفتاحية — لو فيه كلمات AI ← ممنوع
 * 4. لو الإضافة عدت الفلتر ← تتنشط عادي
 * 5. لو اتمنعت ← بنظهر للمستخدم رسالة: "استخدم نماذج VS Code Egypt"
 *
 * ============================ للمطورين ============================
 * الملف ده بيتنسخ لجوه سورس VS Code في:
 *   src/vs/workbench/services/extensions/common/extensionsAiFilter.ts
 *
 * وبعدين بيتستدعى من Extension Host قبل تفعيل أي إضافة.
 */

const BLOCKED_EXTENSION_IDS = new Set([
    // ── GitHub Copilot family ──
    'github.copilot',
    'github.copilot-chat',
    'github.copilot-nightly',

    // ── Tabnine ──
    'tabnine.tabnine-vscode',
    'tabnine.tabnine-vscode-self-hosted-updater',

    // ── Codeium ──
    'codeium.codeium',
    'codeium.codeium-enterprise-updater',
    'codeium.windsurf',

    // ── Amazon ──
    'amazonwebservices.amazon-q-vscode',
    'aws.toolkit',

    // ── Continue / Cody ──
    'continue.continue',
    'sourcegraph.cody-ai',
    'sourcegraph.cody-aichat',

    // ── Google ──
    'google.geminicodeassist',
    'googlecloud.gemini-code-assist',

    // ── Claude / Anthropic ──
    'saoudrizwan.claude-dev',
    'kodu-ai.claude-coder',
    'anthropic.claude-code',

    // ── Cursor / Windsurf ──
    'cursor.cursor',

    // ── Supermaven ──
    'supercomplete.supermaven',

    // ── Blackbox ──
    'blackboxapp.blackbox',

    // ── CodeGPT / GPT wrappers ──
    'codegpt.codegpt',
    'bito.bito',
    'codesnippetsai.codesnippetsai',
    'jdinhlife.gpt-toolbox',
    'genieai.chatgpt-vscode',
    'zhang-renyang.chatgpt',
    'timkmecl.codegpt3',
    'openai.openai-chatgpt',
    'kiranshah.chatgpt-helper',
    'hey-gpt.hey-gpt',

    // ── Others ──
    'formulahendry.code-runner-ai',
    'tencent.cloudstudio-ide',
    'astica.astica-ai',
    'pieceable.pieceable',
    'aiflow.aiflow',
    'dataleap.deepcoder',
    'withfig.ai-shell',
    'gooseai.goose',
    'mintlify.document-ai',
    'pearai.pearai',
    'davidkol.foxtrot',
    'doublebot.doublebot',
    'toggler.toggler',
    'dify.dify-vscode',
    'steamory.aide-vscode',
    'wakatime.vscode-wakatime-ai',
]);

/** كلمات بتبين إن الإضافة فيها AI — لو لقينا أي كلمة من دول في
 *  extensionName او displayName او description او categories او keywords
 *  بنمنع الإضافة. بنستخدم toLowerCase() عشان الكابتل مش فارق. */
const AI_KEYWORDS = [
    'chatgpt', 'copilot', 'codeium', 'tabnine', 'claude', 'gemini',
    'ai assistant', 'ai code', 'ai powered', 'ai-driven',
    'gpt-4', 'gpt-3', 'llm', 'large language model',
    'code generation ai', 'ai autocomplete', 'ai completion',
    'artificial intelligence', 'openai', 'anthropic',
    'code assistant ai', 'ai pair programmer', 'ai copilot',
    'blackbox ai', 'code whisperer',
    'deepseek',  // نمنع DeepSeek الخارجي — احنا بنوفره مدمج
    'cursor ai',
];

/**
 * يشوف إذا كانت الإضافة مسموح بيها ولا لأ.
 *
 * @param {{ id: string, name: string, displayName?: string,
 *          description?: string, categories?: string[],
 *          keywords?: string[], publisher?: string }} manifest
 * @returns {{ allowed: boolean, reason?: string }}
 */
function isExtensionAllowed(manifest) {
    // 1. فحص الـ ID — لو في البلوك ليست يبقى ممنوع مباشرة
    const extId = (manifest.id || manifest.name || '').toLowerCase();
    if (BLOCKED_EXTENSION_IDS.has(extId)) {
        return {
            allowed: false,
            reason: 'الإضافة دي بتستخدم ذكاء اصطناعي خارجي. ' +
                    'VS Code Egypt فيه 3 نماذج AI مدمجة: السائق، القائد، والمبتكر — ' +
                    'استخدم Ctrl+K أو الشات الجانبي بدل الإضافة دي.'
        };
    }

    // 2. نجمع كل النصوص اللي هندور فيها على كلمات AI
    const searchText = [
        manifest.name || '',
        manifest.displayName || '',
        manifest.description || '',
        (manifest.categories || []).join(' '),
        (manifest.keywords || []).join(' '),
        manifest.publisher || '',
    ].join(' ').toLowerCase();

    // 3. فحص الكلمات المفتاحية
    for (const keyword of AI_KEYWORDS) {
        if (searchText.includes(keyword)) {
            return {
                allowed: false,
                reason: `الإضافة "${manifest.displayName || manifest.name}" ` +
                        'بتحتوي على مميزات ذكاء اصطناعي خارجي. ' +
                        'VS Code Egypt جواه 3 نماذج AI مدمجة (السائق، القائد، المبتكر). ' +
                        'جرب Ctrl+K للكتابة السريعة أو الشات الجانبي للتحليل العميق.'
            };
        }
    }

    // 4. فحص الكاتيجوري — لو "Machine Learning" أو "AI" → ممنوع
    const categories = (manifest.categories || []).map(c => c.toLowerCase());
    const blockedCategories = [
        'machine learning', 'ai', 'artificial intelligence',
        'chat', 'copilot', 'coding assistance', 'llm'
    ];
    for (const cat of categories) {
        for (const blocked of blockedCategories) {
            if (cat.includes(blocked)) {
                return {
                    allowed: false,
                    reason: 'الإضافة دي في فئة الذكاء الاصطناعي. نماذج VS Code Egypt ' +
                            'المدمجة (السائق، القائد، المبتكر) توفرلك كل اللي محتاجه من غير إضافات.'
                };
            }
        }
    }

    // 5. الإضافة مسموح بيها ✅
    return { allowed: true };
}

/**
 * رسالة للمستخدم لما يحاول يثبت إضافة AI ممنوعة.
 * بنعرضها في Notification أو Dialog.
 */
function getBlockedExtensionMessage(manifest) {
    return {
        title: '🚫 الإضافة مش متوافقة مع VS Code Egypt',
        body: isExtensionAllowed(manifest).reason || 'الإضافة دي مش مسموح بيها.',
        actions: [
            {
                label: '🟢 استخدم Ctrl+K (السائق)',
                command: 'vscodeEgypt.openInlineChat'
            },
            {
                label: '💬 افتح الشات الجانبي',
                command: 'vscodeEgypt.openSideChat'
            },
            {
                label: '📖 اعرف أكتر عن نماذج AI',
                command: 'vscodeEgypt.showAiModelsInfo'
            }
        ]
    };
}

// ═══════════════════════════════════════════════════════════════════
// For Node.js / CommonJS usage (when loaded as a module in VS Code)
// ═══════════════════════════════════════════════════════════════════
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isExtensionAllowed, getBlockedExtensionMessage, BLOCKED_EXTENSION_IDS, AI_KEYWORDS };
}
