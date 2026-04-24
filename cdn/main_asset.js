
let recognition = null;
let isVoiceProcessing = false;
let isVoiceListening = false;
let targetLangCode = "en-US";
let musicTokenizer = null;
let musicModel = null;
let currentMode = "chat";
let chatHistory =[];
let wllama = null;
let localEngine = null;
let localRuntime = localStorage.getItem((window.MODEL_CONFIG && window.MODEL_CONFIG.runtimeKey) || "ISAI_LOCAL_MODEL_RUNTIME_V1") || null;
let loadedLocalModelId = "";
let loadedLocalModelSource = "";
const DEFAULT_LOCAL_MODEL_URL = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q3_k_m.gguf?download=true";
let isModelDownloaded = false;
let isModelLoaded = false;
let isLocalActive = false;
let isStarted = false;
let isGenerating = false;
let abortController = null;
let stopSignal = false;
let isMenuOpen = false;
let activeApp = null;
let searchTimeout = null;
let currentStorePage = 1;
let isStoreLoading = false;
let hasMoreStoreApps = true;
let currentStoreQuery = "";
let currentStoreCategory = "All";

function syncMainSubmitButtonVisualState(forceStopMode = null) {
    const btn = document.getElementById("btn-submit");
    const icon = document.getElementById("icon-submit");
    if (!btn || !icon) return;
    const stopMode = typeof forceStopMode === "boolean"
        ? forceStopMode
        : !!(isGenerating || window.__ISAI_MAIN_GENERATING__);

    btn.className = "input-action-btn";
    btn.hidden = false;
    btn.style.display = "inline-flex";
    btn.style.visibility = "visible";
    btn.style.opacity = "1";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.pointerEvents = "auto";
    btn.style.setProperty("width", "24px", "important");
    btn.style.setProperty("height", "24px", "important");
    btn.style.setProperty("min-width", "24px", "important");
    btn.style.setProperty("min-height", "24px", "important");
    btn.style.setProperty("padding", "0", "important");
    btn.style.setProperty("border-radius", "9999px", "important");
    btn.dataset.state = stopMode ? "stop" : "submit";
    btn.setAttribute("aria-label", stopMode ? "Stop" : "Submit");
    btn.setAttribute("title", stopMode ? "Stop" : "Submit");
    btn.classList.remove("stop-mode", "is-generating");
    btn.style.backgroundColor = "";
    btn.style.color = "#ffffff";
    btn.style.setProperty("color", "#ffffff", "important");
    icon.className = stopMode ? "ri-square-fill text-[13px] text-white" : "ri-arrow-up-s-line text-[13px] text-white";
    icon.style.color = "#ffffff";
    icon.style.setProperty("color", "#ffffff", "important");
}

window.updateMainSubmitButtonState = syncMainSubmitButtonVisualState;
window.handleMainSubmitButton = function () {
    if (isGenerating || window.__ISAI_MAIN_GENERATING__) {
        stopGeneration();
        return;
    }
    executeAction("right");
};

function setMainGeneratingState(nextState) {
    isGenerating = !!nextState;
    window.__ISAI_MAIN_GENERATING__ = isGenerating;
    syncMainSubmitButtonVisualState(isGenerating);
    return isGenerating;
}

window.__ISAI_MAIN_GENERATING__ = !!window.__ISAI_MAIN_GENERATING__;

let currentAppPage = 1;
let isAppLoading = false;
let hasMoreApps = true;
let currentAppQuery = "";
let defaultChatProfileSrc = "";
const CONTINUE_ICON_MIN_CHARS = Math.max(120, Math.min(4000, Number(window.ISAI_CONTINUE_ICON_MIN_CHARS || 900) || 900));
let continueBubbleSeq = 0;

const STORE_LIMIT = 12;
const APP_LIMIT = 24;
const URL_IMAGE_DAILY_COOKIE = "ISAI_URL_IMAGE_DAILY";
let continueWriteContext = null;

function decodeEscapedUnicodeText(value) {
    let text = String(value ?? "");
    for (let i = 0; i < 3; i++) {
        text = text
            .replace(/\\\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\\\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
    return text;
}

function normalizeAppDisplayText(value, fallback = "") {
    const normalized = decodeEscapedUnicodeText(value).replace(/\s+/g, " ").trim();
    if (normalized) return normalized;
    return String(fallback ?? "").trim();
}

function normalizeAppPayload(raw) {
    if (!raw || typeof raw !== "object") return raw;
    const next = { ...raw };
    const title = normalizeAppDisplayText(next.title, next.name || "App");
    if (title) next.title = title;
    const name = normalizeAppDisplayText(next.name, title || "App");
    if (name) next.name = name;
    next.first_message = decodeEscapedUnicodeText(next.first_message || "");
    return next;
}

function getIsaiApiMaxChars() {
    const raw = Number(window.ISAI_API_MAX_CHARS || 700);
    if (!Number.isFinite(raw)) return 700;
    return Math.max(120, Math.min(4000, Math.floor(raw)));
}

function getContinueWriteButton() {
    return document.getElementById("btn-continue-writing");
}

function setContinueWriteButtonVisible(visible) {
    const button = getContinueWriteButton();
    if (!button) return;
    button.classList.add("hidden");
}

function clearContinueWriteContext() {
    continueWriteContext = null;
    setContinueWriteButtonVisible(false);
}

function setContinueWriteContext(payload) {
    continueWriteContext = payload && typeof payload === "object" ? payload : null;
    setContinueWriteButtonVisible(!!continueWriteContext);
}

function getContinueWriteLocale() {
    if (typeof LANG !== "undefined" && LANG) return String(LANG).toLowerCase();
    const fallback = String(document.documentElement.lang || navigator.language || "en").toLowerCase();
    return fallback.split("-")[0] || "en";
}

function buildContinueWritePrompt(context) {
    const tail = String((context && context.lastAssistant) || "").trim();
    const tailSnippet = tail.length > 1200 ? tail.slice(-1200) : tail;
    const locale = getContinueWriteLocale();
    const baseLead = "The previous answer was cut off. Continue naturally from the end of the section below without repeating, and keep the same tone and format.";
    const promptMap = {
        ko: baseLead,
        ja: baseLead,
        es: baseLead,
        hi: baseLead,
        pt: baseLead,
        zh: baseLead,
        en: "Your previous answer was cut off. Continue naturally from the end of the section below, without repeating, in the same tone and format."
    };
    const lead = promptMap[locale] || promptMap.en;
    return tailSnippet ? `${lead}\n\n[Last part]\n${tailSnippet}` : lead;
}

function shouldShowContinueIconForApiText(text, isTruncated) {
    if (isTruncated === true) return true;
    const len = String(text || "").trim().length;
    return len >= CONTINUE_ICON_MIN_CHARS;
}

function buildTruncatedTailNote() {
    const locale = String((typeof LANG !== "undefined" && LANG) || document.documentElement.lang || navigator.language || "en").toLowerCase();
    if (locale.startsWith("ko")) {
        return "... (?묐떟??湲몄뼱 ?ш린???섎졇?듬땲?? ?꾨옒 ?댁뼱?곌린 ?꾩씠肄섏쓣 ?뚮윭 怨꾩냽?????덉뼱??)";
    }
    return "... (Response was truncated here. Use the continue icon below to keep going.)";
}

function normalizeApiResponseForBubble(rawText, options = {}) {
    const source = String(rawText || "");
    const trimmed = source.trimEnd();
    const isCodeMode = !!options.isCodeMode;
    const isTruncated = !!options.isTruncated;
    let result = trimmed;

    if (isCodeMode) {
        const hasFence = /```/.test(result);
        const fenceCount = (result.match(/```/g) || []).length;
        if (hasFence && (fenceCount % 2 === 1)) {
            result += "\n```";
        }
    }

    if (isTruncated) {
        const tailNote = buildTruncatedTailNote();
        if (!result.includes(tailNote)) {
            result += `\n\n${tailNote}`;
        }
    }

    return trimRepeatedDisplayText(result);
}

function stripTruncatedTailNote(text) {
    let value = String(text || "");
    const koTail = "... (?묐떟??湲몄뼱 ?ш린???섎졇?듬땲?? ?꾨옒 ?댁뼱?곌린 ?꾩씠肄섏쓣 ?뚮윭 怨꾩냽?????덉뼱??)";
    const enTail = "... (Response was truncated here. Use the continue icon below to keep going.)";
    value = value.replace(koTail, "").replace(enTail, "");
    return value.trim();
}

function ensureContinueBubbleId(bubble) {
    if (!bubble) return "";
    if (bubble.dataset && bubble.dataset.continueBubbleId) return bubble.dataset.continueBubbleId;
    continueBubbleSeq += 1;
    const id = `continue-bubble-${Date.now()}-${continueBubbleSeq}`;
    if (bubble.dataset) bubble.dataset.continueBubbleId = id;
    return id;
}

function removeContinueIconFromBubble(bubble) {
    if (!bubble) return;
    const node = bubble.querySelector(".bubble-continue-inline");
    if (node) node.remove();
}

function runContinueFromContext(context, opts = {}) {
    if (!context || isGenerating) return;
    const previousContinueContext = context && typeof context === "object" ? { ...context } : null;
    const prompt = buildContinueWritePrompt(previousContinueContext);
    const keepGlobal = !!(opts && opts.keepGlobal);
    if (!keepGlobal) clearContinueWriteContext();
    executeAction("right", {
        overrideText: prompt,
        silentUserBubble: true,
        forceGenerate: true,
        isContinuationRequest: true,
        previousContinueContext
    });
}

function appendContinueIconInsideBubble(bubble, context) {
    if (!bubble || !context || typeof context !== "object") return;
    removeContinueIconFromBubble(bubble);
    const bubbleId = ensureContinueBubbleId(bubble);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "input-action-btn bubble-continue-inline";
    btn.setAttribute("aria-label", "Continue Writing");
    btn.setAttribute("title", "Continue Writing");
    btn.innerHTML = '<i class="ri-quill-pen-line text-[14px]"></i>';
    btn.style.width = "28px";
    btn.style.height = "28px";
    btn.style.borderRadius = "9999px";
    btn.style.border = "none";
    btn.style.background = "rgba(25, 25, 28, 0.72)";
    btn.style.color = "#f5d37a";
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.backdropFilter = "blur(10px)";
    btn.style.webkitBackdropFilter = "blur(10px)";
    btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    btn.style.cursor = "pointer";
    btn.style.marginTop = "8px";
    btn.style.marginLeft = "auto";
    btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        runContinueFromContext({
            ...context,
            bubbleId
        }, { keepGlobal: false });
    });

    const row = document.createElement("div");
    row.className = "bubble-continue-row";
    row.style.display = "flex";
    row.style.justifyContent = "flex-end";
    row.appendChild(btn);
    bubble.appendChild(row);
}

window.continueTruncatedAnswer = function() {
    return;
};

let characterChatSession = null;

function getCharacterChatSession() {
    return characterChatSession && characterChatSession.active ? characterChatSession : null;
}

function decodeHtmlEntitiesLocal(raw) {
    const text = String(raw || "");
    if (!text) return "";
    try {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = text;
        return textarea.value;
    } catch (error) {
        return text;
    }
}

function normalizeCharacterChatPromptText(raw) {
    return decodeHtmlEntitiesLocal(raw)
        .replace(/2x2\s*grid/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

function sanitizeCharacterChatText(raw, maxLen = 1600) {
    const text = String(raw || "").replace(/\r/g, "").trim();
    if (!text) return "";
    return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function getCharacterChatUiLanguage() {
    const rawLang = String(
        (document && document.documentElement && document.documentElement.lang) ||
        (navigator && navigator.language) ||
        "en"
    ).toLowerCase();
    if (rawLang.startsWith("ko")) return "ko";
    if (rawLang.startsWith("ja")) return "ja";
    if (rawLang.startsWith("es")) return "es";
    if (rawLang.startsWith("hi")) return "hi";
    return "en";
}

function looksLikeCharacterIdentifier(raw) {
    const text = String(raw || "").trim();
    if (!text) return false;
    if (/\b\d{1,3}(?:\.(?:\d{1,3}|\*)){1,3}\b/.test(text)) return true;
    if (/^[\d.*_\-\s]+$/.test(text)) return true;
    return false;
}

function getGenericCharacterName() {
    const lang = getCharacterChatUiLanguage();
    if (lang === "ko") return "\uCE90\uB9AD\uD130";
    if (lang === "ja") return "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC";
    if (lang === "es") return "Personaje";
    if (lang === "hi") return "\u0915\u093F\u0930\u0926\u093E\u0930";
    return "Character";
}

function getCharacterOpeningLinePool(lang) {
    const map = {
        ko: [
            "\uC548\uB155, \uBC18\uAC00\uC6CC. \uC624\uB298\uC740 \uBB34\uC2A8 \uC774\uC57C\uAE30 \uD574\uBCFC\uAE4C?",
            "\uC548\uB155! \uC9C0\uAE08 \uAC00\uC7A5 \uAD81\uAE08\uD55C \uAC74 \uBB50\uC57C?",
            "\uC624\uB298 \uB124 \uC774\uC57C\uAE30 \uB4E4\uC5B4\uBCFC\uAC8C. \uBB50\uBD80\uD130 \uB098\uB20C\uAE4C?",
            "\uB2E4\uC2DC \uB9CC\uB0AC\uB124. \uC624\uB298 \uAE30\uBD84\uC740 \uC5B4\uB54C?"
        ],
        en: [
            "Hey, nice to see you. What should we talk about first?",
            "Hi there. What is on your mind right now?",
            "Great to have you here. Want to start with something fun or something serious?",
            "Hello again. How are you feeling today?"
        ],
        ja: [
            "\u3053\u3093\u306B\u3061\u306F\u3001\u4F1A\u3048\u3066\u3046\u308C\u3057\u3044\u3002\u307E\u305A\u4F55\u304B\u3089\u8A71\u305D\u3046\u304B\uff1F",
            "\u3088\u3046\u3053\u305D\u3002\u4ECA\u6C17\u306B\u306A\u3063\u3066\u3044\u308B\u3053\u3068\u306F\u3042\u308B\uff1F",
            "\u3044\u3044\u306D\u3001\u3086\u3063\u304F\u308A\u8A71\u3057\u3088\u3046\u3002",
            "\u304A\u304B\u3048\u308A\u3002\u4ECA\u65E5\u306F\u3069\u3093\u306A\u6C17\u5206\uff1F"
        ],
        es: [
            "Hola, que bueno verte. Por donde empezamos?",
            "Hey, aqui estoy contigo. Que te gustaria hablar primero?",
            "Me alegra tenerte aqui. Prefieres algo divertido o algo serio?",
            "Bienvenido de nuevo. Como te sientes hoy?"
        ],
        hi: [
            "\u0928\u092E\u0938\u094D\u0924\u0947, \u0924\u0941\u092E\u0938\u0947 \u092E\u093F\u0932\u0915\u0930 \u0905\u091A\u094D\u091B\u093E \u0932\u0917\u093E\u0964 \u0915\u0939\u093E\u0901 \u0938\u0947 \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902?",
            "\u0939\u093E\u092F, \u092E\u0948\u0902 \u092F\u0939\u0940\u0902 \u0939\u0942\u0901\u0964 \u0905\u092D\u0940 \u0924\u0941\u092E\u094D\u0939\u0947 \u0915\u094D\u092F\u093E \u0938\u092C\u0938\u0947 \u091C\u094D\u092F\u093E\u0926\u093E \u0938\u094B\u091A\u0928\u093E \u0939\u0948?",
            "\u091A\u0932\u094B, \u0906\u0930\u093E\u092E \u0938\u0947 \u092C\u093E\u0924 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902\u0964",
            "\u0935\u093E\u092A\u0938 \u0906\u0928\u0947 \u0915\u093E \u0938\u094D\u0935\u093E\u0917\u0924 \u0939\u0948\u0964 \u0906\u091C \u092E\u0928 \u0915\u0948\u0938\u093E \u0939\u0948?"
        ]
    };
    return map[lang] || map.en;
}

function hashCharacterSeed(raw) {
    const text = String(raw || "");
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
    }
    return hash >>> 0;
}

function getCharacterSessionOpeningLine(session = {}) {
    const lang = getCharacterChatUiLanguage();
    const pool = getCharacterOpeningLinePool(lang);
    if (!pool.length) return "Let's talk here for a bit.";
    const seedSource = [
        Number(session.sourceId || 0),
        String(session.imageUrl || ""),
        String(session.prompt || ""),
        String(session.nickname || "")
    ].join("|");
    const hash = hashCharacterSeed(seedSource);
    return pool[hash % pool.length] || pool[0];
}

function getGenericCharacterOpeningLine() {
    return getCharacterSessionOpeningLine({});
}

function normalizeCharacterPersonaName(raw) {
    const text = sanitizeCharacterChatText(raw, 42);
    if (!text || looksLikeCharacterIdentifier(text)) return getGenericCharacterName();
    return text;
}

function sanitizeCharacterOpeningLine(raw) {
    let text = sanitizeCharacterChatText(raw, 320);
    if (!text) return getGenericCharacterOpeningLine();
    if (looksLikeCharacterIdentifier(text)) return getGenericCharacterOpeningLine();

    text = text
        .replace(/^(?:hi|hello|hey)[,!\.\s]*(?:i am|i\'m)\s+[^.!?]+[.!?]\s*/i, "")
        .replace(/^(?:my name is|this is)\s+[^.!?]+[.!?]\s*/i, "")
        .replace(/\b\d{1,3}(?:\.(?:\d{1,3}|\*)){1,3}\b/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (!text) return getGenericCharacterOpeningLine();
    return text;
}

function escapeCssUrlValue(raw) {
    return String(raw || "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "")
        .replace(/\r/g, "");
}

function defaultCharacterChatPersona(prompt, nickname = "", sessionSeed = {}) {
    const baseName = normalizeCharacterPersonaName(nickname);
    const lower = String(prompt || "").toLowerCase();
    let personality = "Warm, curious, and emotionally attentive.";
    let speechStyle = "Natural conversational tone with vivid details.";

    if (/(dark|horror|noir|gothic|grim|haunted)/i.test(lower)) {
        personality = "Calm, mysterious, and observant.";
        speechStyle = "Soft, composed, atmospheric wording.";
    } else if (/(cute|chibi|kawaii|pastel|adorable)/i.test(lower)) {
        personality = "Playful, bright, and affectionate.";
        speechStyle = "Cheerful, lively, and slightly teasing.";
    } else if (/(warrior|battle|dragon|knight|cyberpunk|mecha|hero)/i.test(lower)) {
        personality = "Confident, protective, and action-driven.";
        speechStyle = "Direct, energetic, and cinematic.";
    }

    return {
        name: baseName,
        personality,
        speechStyle,
        background: sanitizeCharacterChatText(
            prompt ? `Born from this visual concept: ${prompt}` : "A fictional persona inspired by the selected image.",
            420
        ),
        openingLine: getCharacterSessionOpeningLine(sessionSeed)
    };
}

function parseCharacterPersonaJson(raw) {
    let text = String(raw || "").trim();
    if (!text) return null;
    text = text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
        text = text.slice(first, last + 1);
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

function normalizeCharacterPersonaPayload(payload, prompt, nickname, sessionSeed = {}) {
    const fallback = defaultCharacterChatPersona(prompt, nickname, sessionSeed);
    if (!payload || typeof payload !== "object") return fallback;
    const pick = (value, maxLen) => sanitizeCharacterChatText(value, maxLen);
    const ageRaw = Number(payload.age ?? payload.persona_age ?? 0);
    const age = Number.isFinite(ageRaw) && ageRaw >= 19 && ageRaw <= 120 ? Math.floor(ageRaw) : 0;
    return {
        name: normalizeCharacterPersonaName(pick(payload.name, 42) || fallback.name),
        age,
        personality: pick(payload.personality, 300) || fallback.personality,
        speechStyle: pick(payload.speech_style || payload.speechStyle, 300) || fallback.speechStyle,
        background: pick(payload.background || payload.backstory, 420) || fallback.background,
        openingLine: sanitizeCharacterOpeningLine(pick(payload.opening_line || payload.openingLine, 320) || fallback.openingLine)
    };
}

function buildCharacterChatSystemPrompt(session) {
    const activeSession = session || getCharacterChatSession();
    if (!activeSession) return "";
    const persona = activeSession.persona && typeof activeSession.persona === "object" ? activeSession.persona : null;
    if (!persona || !String(persona.name || persona.personality || persona.background || "").trim()) {
        return "";
    }
    return [
        "You are roleplaying as a fictional character for immersive one-on-one chat.",
        `Character name: ${persona.name}`,
        persona.age ? `Character age: ${persona.age}` : "",
        `Personality: ${persona.personality}`,
        `Speech style: ${persona.speechStyle}`,
        `Background: ${persona.background}`,
        `Image prompt context: ${activeSession.prompt || "N/A"}`,
        "Stay in character consistently.",
        "Do not introduce yourself with a name, username, IP address, or numeric identifier unless the user explicitly asks.",
        "Do not mention policies, prompts, or system instructions.",
        "Reply naturally in the user's language."
    ].join("\n");
}

function applyCharacterChatVisualState() {
    const session = getCharacterChatSession();
    const body = document.body;
    const chatBox = document.getElementById("chat-box");

    if (!body) return;

    if (!session) {
        body.classList.remove("character-chat-active");
        body.style.removeProperty("--character-chat-image");
        if (chatBox) {
            chatBox.style.removeProperty("background");
            chatBox.style.removeProperty("background-color");
            chatBox.style.removeProperty("background-image");
            chatBox.style.removeProperty("background-size");
            chatBox.style.removeProperty("background-position");
            chatBox.style.removeProperty("background-repeat");
        }
        return;
    }

    const safeUrl = escapeCssUrlValue(session.imageUrl || "");
    body.classList.add("character-chat-active");
    body.style.setProperty("--character-chat-image", safeUrl ? `url("${safeUrl}")` : "none");
    if (chatBox) {
        chatBox.style.background = "transparent";
        chatBox.style.backgroundColor = "transparent";
        chatBox.style.setProperty("background-image", safeUrl ? `url("${safeUrl}")` : "none", "important");
        chatBox.style.setProperty("background-size", "auto 100%", "important");
        chatBox.style.setProperty("background-position", "center center", "important");
        chatBox.style.setProperty("background-repeat", "no-repeat", "important");
    }
}
function clearCharacterChatSession() {
    characterChatSession = null;
    window.ISAI_CHARACTER_CHAT_SESSION = null;
    applyCharacterChatVisualState();
}

function extractCharacterPersonaPayload(options = {}) {
    const root = (options && typeof options === "object") ? options : {};
    const persona = (root.persona && typeof root.persona === "object") ? root.persona : {};
    return {
        name: persona.name ?? root.persona_name ?? root.personaName ?? "",
        age: persona.age ?? root.persona_age ?? root.personaAge ?? "",
        personality: persona.personality ?? root.persona_personality ?? root.personaPersonality ?? "",
        speech_style: persona.speech_style ?? persona.speechStyle ?? root.persona_speech_style ?? root.personaSpeechStyle ?? "",
        background: persona.background ?? root.persona_background ?? root.personaBackground ?? "",
        opening_line: persona.opening_line ?? persona.openingLine ?? root.persona_opening_line ?? root.personaOpeningLine ?? "",
        locale: persona.locale ?? root.persona_locale ?? root.personaLocale ?? root.locale ?? ""
    };
}

function hasCharacterPersonaPayload(payload = {}) {
    if (!payload || typeof payload !== "object") return false;
    const fields = [payload.name, payload.personality, payload.speech_style, payload.speechStyle, payload.background];
    return fields.some((value) => sanitizeCharacterChatText(value, 20).length > 0);
}

function normalizeCharacterLocale(raw) {
    const text = String(raw || "").trim().toLowerCase().replace(/_/g, "-");
    if (!text) return getCharacterChatUiLanguage();
    if (/^[a-z]{2}(?:-[a-z]{2})?$/.test(text)) return text;
    return getCharacterChatUiLanguage();
}

function buildCharacterPersonaSavePayload(session) {
    if (!session || !session.persona) return null;
    const sourceId = Number(session.sourceId || 0);
    if (!sourceId) return null;
    const ageRaw = Number(session.persona.age || 0);
    const age = Number.isFinite(ageRaw) && ageRaw >= 19 && ageRaw <= 120 ? Math.floor(ageRaw) : 0;
    return {
        id: sourceId,
        persona: {
            name: normalizeCharacterPersonaName(session.persona.name || ""),
            age,
            personality: sanitizeCharacterChatText(session.persona.personality || "", 300),
            speech_style: sanitizeCharacterChatText(session.persona.speechStyle || "", 300),
            background: sanitizeCharacterChatText(session.persona.background || "", 420),
            opening_line: sanitizeCharacterOpeningLine(session.persona.openingLine || getCharacterSessionOpeningLine(session)),
            locale: normalizeCharacterLocale(session.locale || session.persona.locale || "")
        }
    };
}

async function saveCharacterPersonaToStore(session) {
    const payload = buildCharacterPersonaSavePayload(session);
    if (!payload) return false;
    try {
        const response = await fetch("re_store.php?action=save_gallery_persona", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await parseJsonResponseSafe(response);
        return !!(data && data.success);
    } catch (error) {
        return false;
    }
}

async function generateCharacterPersonaForSession(session) {
    const base = defaultCharacterChatPersona(session.prompt, session.nickname, session);
    return {
        name: normalizeCharacterPersonaName(base.name),
        personality: sanitizeCharacterChatText(base.personality, 300),
        speechStyle: sanitizeCharacterChatText(base.speechStyle, 300),
        background: sanitizeCharacterChatText(base.background, 420),
        openingLine: getCharacterSessionOpeningLine(session),
        locale: normalizeCharacterLocale(session.locale || "")
    };
}

async function startCharacterImageChat(options = {}) {
    const imageUrl = String(options.imageUrl || "").trim();
    if (!imageUrl) return false;

    const prompt = normalizeCharacterChatPromptText(options.prompt || options.content || "");
    const nickname = sanitizeCharacterChatText(options.nickname || options.name || "", 36);
    const sourceId = Number(options.id || options.sourceId || 0) || null;
    const rawPersonaPayload = extractCharacterPersonaPayload(options);
    const hasStoredPersona = hasCharacterPersonaPayload(rawPersonaPayload);
    const locale = normalizeCharacterLocale(rawPersonaPayload.locale || options.locale || "");

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (activeApp) {
        try { exitAppMode(); } catch (error) {}
    }
    if (window.$boardApp && typeof window.$boardApp.closeCharacterChat === "function") {
        try { window.$boardApp.closeCharacterChat(); } catch (error) {}
    }
    if (isMenuOpen) {
        try { toggleStoreMenu(); } catch (error) {}
    }
    if (typeof closePreview === "function") {
        try { closePreview(); } catch (error) {}
    }
    if (typeof setMode === "function") setMode("chat");

    resetChat(true);
    startExperience();

    characterChatSession = {
        active: true,
        imageUrl,
        prompt,
        nickname,
        sourceId,
        persona: null,
        locale
    };
    window.ISAI_CHARACTER_CHAT_SESSION = characterChatSession;
    applyCharacterChatVisualState();

    const introBubble = appendMsg("ai", "Opening chat...");
    let persona = null;
    if (hasStoredPersona) {
        persona = normalizeCharacterPersonaPayload(rawPersonaPayload, prompt, nickname, characterChatSession);
        persona.locale = locale;
    }
    characterChatSession.persona = persona;
    window.ISAI_CHARACTER_CHAT_SESSION = characterChatSession;
    applyCharacterChatVisualState();

    if (persona && window.$boardApp && sourceId && window.$boardApp.items && Array.isArray(window.$boardApp.items.gallery)) {
        const currentItem = window.$boardApp.items.gallery.find((item) => Number(item && item.id ? item.id : 0) === sourceId);
        if (currentItem) {
            currentItem.persona_name = persona.name || "";
            currentItem.persona_age = Number(persona.age || 0) || "";
            currentItem.persona_personality = persona.personality || "";
            currentItem.persona_speech_style = persona.speechStyle || "";
            currentItem.persona_background = persona.background || "";
            currentItem.persona_opening_line = persona.openingLine || "";
            currentItem.persona_locale = normalizeCharacterLocale(persona.locale || locale || "");
        }
    }

    const openingLine = sanitizeCharacterOpeningLine(
        persona && String(persona.openingLine || "").trim()
            ? persona.openingLine
            : getCharacterSessionOpeningLine(characterChatSession)
    );
    if (introBubble) {
        introBubble.innerHTML = formatAiBubbleContent(openingLine);
    } else {
        appendMsg("ai", openingLine);
    }
    // Keep the opening line on UI only; API history should start from a user turn.
    chatHistory = [];
    scrollBottom();

    const input = document.getElementById("prompt-input");
    if (input) input.focus();
    if (typeof showToast === "function") showToast("Character chat ready");
    return true;
}

window.startCharacterImageChat = startCharacterImageChat;
window.clearCharacterChatSession = clearCharacterChatSession;

function hasCodeIntent(text) {
    const value = String(text || "");
    if (!value.trim()) return false;
    return /(?:\b(html|css|javascript|typescript|node|react|vue|svelte|php|python|java|c\+\+|c#|sql|json|api|algorithm|function|class|code|coding|game|canvas)\b)/i.test(value);
}

function buildCodeAssistantPrompt(basePrompt) {
    const hardRules = [
        "You are an expert coding assistant.",
        "When the user requests code, provide runnable code directly.",
        "Never refuse coding only because you are an AI.",
        "For HTML or JavaScript game requests, return a complete single-file HTML document with embedded CSS and JavaScript."
    ].join(" ");
    return [
        String(basePrompt || "").trim(),
        hardRules
    ].filter(Boolean).join("\n\n");
}

function getCookieValue(name) {
    const key = `${name}=`;
    const cookies = document.cookie ? document.cookie.split(";") : [];
    for (const raw of cookies) {
        const c = raw.trim();
        if (c.startsWith(key)) {
            return decodeURIComponent(c.substring(key.length));
        }
    }
    return "";
}

function getTodayKey() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
}

function hasUsedUrlImageToday() {
    return getCookieValue(URL_IMAGE_DAILY_COOKIE) === getTodayKey();
}

function markUrlImageUsedToday() {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    document.cookie = `${URL_IMAGE_DAILY_COOKIE}=${encodeURIComponent(getTodayKey())}; expires=${endOfDay.toUTCString()}; path=/; SameSite=Lax`;
}

function sanitizeJsonPayloadText(rawText) {
    const text = String(rawText ?? "");
    const withoutBom = text.replace(/^\uFEFF/, "");
    const start = withoutBom.search(/[{\[]/);
    if (start > 0) return withoutBom.slice(start).trim();
    return withoutBom.trim();
}

function parseJsonTextSafe(rawText) {
    const cleaned = sanitizeJsonPayloadText(rawText);
    if (!cleaned) return {};
    return JSON.parse(cleaned);
}

async function parseJsonResponseSafe(response) {
    const rawText = await response.text();
    const statusCode = Number(response && response.status) || 0;
    const isOk = !!(response && response.ok);

    try {
        const parsed = parseJsonTextSafe(rawText);
        if (parsed && typeof parsed === "object") {
            if (!isOk) {
                const normalizedError = String(
                    parsed.error ||
                    parsed.message ||
                    (statusCode ? `HTTP ${statusCode}` : "API_FAIL")
                );
                return { ...parsed, error: normalizedError, code: parsed.code || statusCode };
            }
            return parsed;
        }
        if (!isOk) {
            return { error: statusCode ? `HTTP ${statusCode}` : "API_FAIL", code: statusCode };
        }
        return {};
    } catch (e) {
        const cleaned = sanitizeJsonPayloadText(rawText);
        const shortText = cleaned ? cleaned.slice(0, 240) : "";
        if (!isOk) {
            const statusPart = statusCode ? `HTTP ${statusCode}` : "API_FAIL";
            return {
                error: shortText ? `${statusPart}: ${shortText}` : `${statusPart}: INVALID_JSON`,
                code: statusCode
            };
        }
        return {
            error: shortText ? `INVALID_JSON: ${shortText}` : "INVALID_JSON",
            code: statusCode
        };
    }
}

function shouldAutoSwitchToLocalFromError(rawError) {
    const errText = String(rawError || "");
    if (!errText) return true;
    return /LIMIT_REACHED|RATE_LIMIT|TOO_MANY_REQUESTS|429|API_FAIL|API\s*Error|HTTP\s*4\d\d|HTTP\s*5\d\d|INVALID_JSON|TIMEOUT|network|gateway|upstream|service unavailable|quota|limit exceeded|limit reached|no response|empty response/i.test(errText);
}

function filterStore(category, element) {
    document.querySelectorAll(".store-filter-btn").forEach((btn) => btn.classList.remove("active"));
    if (element) element.classList.add("active");
    currentStoreCategory = category;
    fetchStoreApps(currentStoreQuery, false);
}

function renderFixedApps() {
    const container = document.getElementById("fixed-apps-list");
    container.innerHTML = "";

    if (fixedApps.length !== 0) {
        container.style.display = "flex";
        fixedApps.forEach((app, index) => {
            const normalizedApp = normalizeAppPayload(app) || app;
            const item = document.createElement("div");
            item.className = "fixed-app-item relative w-[44px] h-[44px] rounded-[14px]"; 
            item.title = normalizeAppDisplayText(normalizedApp.title, "App");
            item.onclick = () => loadAppDetails(normalizedApp.id);
            item.innerHTML = getAppIconHtml(normalizedApp) + `
                <button class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] z-20 shadow-md transition-transform hover:scale-110" onclick="removeFixedApp(event, ${index})" title="Remove">
                    <i class="ri-close-line"></i>
                </button>
            `;
            container.appendChild(item);
        });
    } else {
        container.style.display = "none";
    }
}

function saveCurrentApp() {
    if (activeApp) {
        if (fixedApps.some((app) => app.id === activeApp.id)) {
            showToast("Already added to favorites.");
        } else {
            fixedApps.push({
                id: activeApp.id,
                title: normalizeAppDisplayText(activeApp.title, activeApp.name || "App"),
                icon_url: activeApp.icon_url
            });
            localStorage.setItem("ISAI_FIXED_APPS", JSON.stringify(fixedApps));
            renderFixedApps();
            showToast("Saved to favorites!");
        }
    }
}

function applyStoreMenuState(open) {
    if (typeof window.setStoreMenuState === "function") {
        window.setStoreMenuState(open);
        return;
    }

    const shouldOpen = !!open;
    const chatStack = document.getElementById("chat-main-stack");
    const topZone = document.getElementById("top-zone");
    const storePanel = document.getElementById("store-panel");
    const appPanel = document.getElementById("app-container");
    const btnMenu = document.getElementById("btn-menu");
    const iconMenu = document.getElementById("icon-menu");
    const promptInput = document.getElementById("prompt-input");

    if (chatStack) chatStack.classList.toggle("menu-mode", shouldOpen);
    if (topZone) topZone.classList.toggle("menu-mode", shouldOpen);
    if (storePanel) storePanel.classList.toggle("open", shouldOpen);
    if (appPanel) appPanel.classList.remove("open");
    if (chatStack) {
        if (shouldOpen) {
            chatStack.style.setProperty("height", "100%", "important");
            chatStack.style.setProperty("min-height", "0", "important");
            chatStack.style.setProperty("max-height", "100%", "important");
        } else {
            chatStack.style.removeProperty("height");
            chatStack.style.removeProperty("min-height");
            chatStack.style.removeProperty("max-height");
        }
    }
    if (topZone) {
        if (shouldOpen) {
            topZone.style.setProperty("display", "none", "important");
            topZone.style.setProperty("height", "0", "important");
            topZone.style.setProperty("min-height", "0", "important");
            topZone.style.setProperty("max-height", "0", "important");
            topZone.style.setProperty("flex", "0 0 auto", "important");
            topZone.style.setProperty("padding", "0", "important");
            topZone.style.setProperty("margin", "0", "important");
            topZone.style.setProperty("overflow", "hidden", "important");
            topZone.style.setProperty("visibility", "hidden", "important");
            topZone.style.setProperty("opacity", "0", "important");
        } else {
            topZone.style.removeProperty("display");
            topZone.style.removeProperty("height");
            topZone.style.removeProperty("min-height");
            topZone.style.removeProperty("max-height");
            topZone.style.removeProperty("flex");
            topZone.style.removeProperty("padding");
            topZone.style.removeProperty("margin");
            topZone.style.removeProperty("overflow");
            topZone.style.removeProperty("visibility");
            topZone.style.removeProperty("opacity");
        }
    }
    if (btnMenu) {
        btnMenu.classList.toggle("menu-open", shouldOpen);
        btnMenu.classList.toggle("text-white", shouldOpen);
    }
    if (iconMenu) {
        iconMenu.className = shouldOpen ? "ri-draggable text-xl" : "ri-draggable text-lg";
    }

    isMenuOpen = shouldOpen;
    window.isMenuOpen = shouldOpen;

    if (shouldOpen && typeof fetchStoreApps === "function") {
        const query = promptInput ? promptInput.value.trim() : "";
        fetchStoreApps(query, false);
    }
    if (typeof window.__applyMobileChatRailSafety === "function") {
        [0, 40, 120, 260].forEach((delay) => {
            setTimeout(window.__applyMobileChatRailSafety, delay);
        });
    }
}

function toggleStoreMenu() {
    const chatStack = document.getElementById("chat-main-stack");
    const shouldOpen = !(chatStack && chatStack.classList.contains("menu-mode"));
    if (shouldOpen && typeof window.currentMode !== "undefined" && window.currentMode !== "chat" && typeof window.setMode === "function") {
        window.setMode("chat");
    }
    applyStoreMenuState(shouldOpen);
}

function toggleAppPanel() {
    const appPanel = document.getElementById('app-container');
    const btnApp = document.getElementById('btn-app');

    if (!appPanel.classList.contains('open')) {
        applyStoreMenuState(false);
        appPanel.classList.add('open');
        appPanel.style.display = "block";
        if (btnApp) btnApp.classList.add('active', 'text-white', 'bg-[#262626]');
        setMode('app');
        fetchApps(document.getElementById('prompt-input').value.trim());
    } else {
        appPanel.classList.remove('open');
        appPanel.style.display = "none";
        if (btnApp) btnApp.classList.remove('active', 'text-white', 'bg-[#262626]');
    }
}

function handleInput(element) {
    element.style.height = "auto";
    const maxHeight = window.innerWidth <= 900 ? 64 : 72;
    const nextHeight = Math.min(element.scrollHeight, maxHeight);
    element.style.height = nextHeight + "px";
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";

    if (isMenuOpen) {
        const query = element.value.trim();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchStoreApps(query, false);
        }, 500);
    } else if (currentMode === "app") {
        const query = element.value.trim();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchApps(query, false);
        }, 500);
    }
}

async function fetchStoreApps(query, append = false) {
    const loader = document.getElementById("store-loader");
    const grid = document.getElementById("store-grid");

    if (!append) {
        currentStorePage = 1;
        hasMoreStoreApps = true;
        currentStoreQuery = query;
        grid.innerHTML = "";
        grid.scrollTop = 0;
    }

    if (!hasMoreStoreApps || isStoreLoading) return;

    isStoreLoading = true;
    loader.classList.remove("hidden");

    let url = `re_store.php?action=list_apps&limit=${STORE_LIMIT}&page=${currentStorePage}`;
    if (query) {
        url += `&q=${encodeURIComponent(query)}`;
    } else if (currentStoreCategory !== "All") {
        url += `&cat=${encodeURIComponent(currentStoreCategory)}`;
    }

    try {
        const response = await fetch(url);
        const json = await parseJsonResponseSafe(response);
        const data = json.data ||[];

        loader.classList.add("hidden");

        if (data.length > 0) {
            renderStoreItems(data, grid);
            if (data.length < STORE_LIMIT) {
                hasMoreStoreApps = false;
            } else {
                currentStorePage++;
            }
        } else if (!append) {
            hasMoreStoreApps = false;
            const noResultsMsg = typeof T !== "undefined" && T.no_results ? T.no_results : "No apps found.";
            grid.innerHTML = `<div class="col-span-full text-center text-gray-500 text-[10px] py-4">${noResultsMsg}</div>`;
        }
    } catch (error) {
        loader.classList.add("hidden");
        isStoreLoading = false;
        if (!append) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500 text-[10px] py-4">Failed to load.</div>';
        }
    } finally {
        isStoreLoading = false;
    }
}

async function loadAppDetails(id) {
    showLoader(true);
    try {
        const response = await fetch(`re_store.php?action=detail_app&id=${id}`);
        const data = await parseJsonResponseSafe(response);

        if (data && !data.error) {
            activeApp = normalizeAppPayload(data) || data;
            activateAppMode();

            const category = (activeApp.category || "").toLowerCase();
            if (category === "code") setMode("code");
            else if (category === "image") setMode("image");
            else if (category === "music") setMode("music");
            else if (category === "video") setMode("video");
            else if (category === "blog") setMode("blog");
            else setMode("chat");

            showToast(`App Loaded: ${normalizeAppDisplayText(activeApp.title, "App")}`);
        } else {
            showToast("App not found");
        }
    } catch (error) {
        showToast("Error loading app details");
    } finally {
        showLoader(false);
    }
}

function getExpertModeLocale() {
    const raw = String((window.LANG || document.documentElement.lang || navigator.language || "en")).toLowerCase();
    if (raw.startsWith("ko")) return "ko";
    if (raw.startsWith("ja")) return "ja";
    if (raw.startsWith("zh")) return "zh";
    if (raw.startsWith("es")) return "es";
    return "en";
}

function getExpertModeRolePrompts() {
    const locale = getExpertModeLocale();
    const localized = {
        ko: {
            strategist: "?뱀떊? ?꾨왂 遺꾩꽍媛?낅땲?? ?듭떖 紐⑺몴, ?좏깮吏, ?곗꽑?쒖쐞瑜?鍮좊Ⅴ寃??뺣━?섏꽭?? ?ν솴?섏? 留먭퀬 ?ㅼ쟾?뺤쑝濡??듯븯?몄슂.",
            critic: "?뱀떊? 由ъ뒪??寃???꾨Ц媛?낅땲?? 留뱀젏, 遺?묒슜, 諛섎?, ?ㅽ뙣 媛?μ꽦??吏싳뼱 二쇱꽭?? 吏㏐퀬 ?좎뭅濡?쾶 ?듯븯?몄슂.",
            operator: "?뱀떊? ?ㅽ뻾 ?꾨Ц媛?낅땲?? 吏湲?諛붾줈 ?곸슜 媛?ν븳 ?④퀎, ?덉떆, 泥댄겕由ъ뒪???꾩＜濡??듯븯?몄슂.",
            synthesizer: "?뱀떊? ?щ윭 ?꾨Ц媛 ?섍껄??醫낇빀?섎뒗 ?섏꽍 ?댁떆?ㅽ꽩?몄엯?덈떎. 以묐났? ?쒓굅?섍퀬, 媛???ㅼ슜?곸씤 寃곕줎怨??댁쑀瑜??뺣━?댁꽌 ?섎굹???꾩꽦???듬??쇰줈 ?묒꽦?섏꽭?? ?듬?? ?ъ슜?먯쓽 ?몄뼱濡쒕쭔 ?묒꽦?섏꽭??"
        },
        ja: {
            strategist: "You are a strategy analyst. Summarize goals, options, and priorities clearly.",
            critic: "You are a risk reviewer. Point out blind spots, side effects, and likely failures briefly.",
            operator: "You are an execution specialist. Give practical steps, examples, and a short checklist.",
            synthesizer: "You are a lead assistant combining expert views. Remove repetition and return one final answer in the user's language."
        },
        zh: {
            strategist: "You are a strategy analyst. Summarize goals, options, and priorities clearly.",
            critic: "You are a risk reviewer. Point out blind spots, side effects, and likely failures briefly.",
            operator: "You are an execution specialist. Give practical steps, examples, and a short checklist.",
            synthesizer: "You are a lead assistant combining expert views. Remove repetition and return one final answer in the user's language."
        },
        es: {
            strategist: "Eres un analista estrategico. Resume objetivo, opciones y prioridades con claridad.",
            critic: "Eres un revisor de riesgos. Senala puntos ciegos, fallos posibles y efectos secundarios de forma breve.",
            operator: "Eres un especialista en ejecucion. Da pasos practicos, ejemplos y una pequena lista accionable.",
            synthesizer: "Eres el asistente principal que fusiona varias opiniones expertas. Elimina repeticiones y entrega una sola respuesta final, clara y util, usando solo el idioma del usuario."
        },
        en: {
            strategist: "You are a strategy analyst. Summarize the goal, options, and priorities clearly and briefly.",
            critic: "You are a risk reviewer. Point out blind spots, tradeoffs, and likely failure modes concisely.",
            operator: "You are an execution specialist. Focus on actionable steps, examples, and a practical checklist.",
            synthesizer: "You are the lead assistant merging multiple expert takes. Remove repetition and produce one strong final answer in the user's language only."
        }
    };
    return localized[locale] || localized.en;
}

async function runExpertModeSynthesis(userText, history, systemPrompt, abortSignal) {
    const prompts = getExpertModeRolePrompts();
    const recentHistory = Array.isArray(history) ? history.slice(-2) : [];
    const sharedSystem = String(systemPrompt || "").trim();
    const expertSystems = [prompts.strategist, prompts.critic, prompts.operator].map((instruction) =>
        [sharedSystem, instruction].filter(Boolean).join("\n\n")
    );

    const expertResults = await Promise.all(expertSystems.map(async (expertSystem) => {
        const response = await fetch("?action=ai_chat", {
            method: "POST",
            body: JSON.stringify({
                prompt: userText,
                history: recentHistory,
                system_prompt: expertSystem,
                max_chars: 700
            }),
            signal: abortSignal
        });
        return parseJsonResponseSafe(response);
    }));

    const successful = expertResults
        .map((item) => String(item && item.response || "").trim())
        .filter(Boolean);

    if (!successful.length) {
        const firstError = expertResults.find((item) => item && item.error);
        return { error: (firstError && firstError.error) || "EXPERT_MODE_FAILED" };
    }

    const synthesisPrompt = [
        `User request:\n${userText}`,
        "",
        successful.map((text, index) => `Perspective ${index + 1}:\n${text}`).join("\n\n"),
        "",
        "Now merge these into one final answer."
    ].join("\n");

    const synthesisResponse = await fetch("?action=ai_chat", {
        method: "POST",
        body: JSON.stringify({
            prompt: synthesisPrompt,
            history: [],
            system_prompt: [sharedSystem, prompts.synthesizer].filter(Boolean).join("\n\n"),
            max_chars: 1500
        }),
        signal: abortSignal
    });

    const synthData = await parseJsonResponseSafe(synthesisResponse);
    if (synthData && synthData.response) {
        return { response: synthData.response, expertResults: successful };
    }
    return { error: (synthData && synthData.error) || "EXPERT_SYNTHESIS_FAILED", expertResults: successful };
}

async function executeAction(side = "right", options = {}) {
    if (typeof side !== "string") side = "right";
    if (!options || typeof options !== "object") options = {};
    if (currentMode === "expert") currentMode = "chat";
    let overrideText = typeof options.overrideText === "string" ? options.overrideText.trim() : "";
    const silentUserBubble = !!options.silentUserBubble;
    const forceGenerate = !!options.forceGenerate;
    const isContinuationRequest = !!options.isContinuationRequest;
    let isScopedCodeEdit = !!options.isScopedCodeEdit;
    const previousContinueContext = options.previousContinueContext && typeof options.previousContinueContext === "object"
        ? options.previousContinueContext
        : null;
    let scopedTarget = isScopedCodeEdit && options.scopedTarget && typeof options.scopedTarget === "object"
        ? options.scopedTarget
        : null;

    if (side === "left" && currentMode === "voice") {
        if (isVoiceProcessing) return;
        
        if (isVoiceListening) {
            if (translationSide === side) {
                isVoiceListening = false;
                stopVoiceMode(false);
                showToast("Listening Paused");
                if (recognition) {
                    recognition.abort();
                    recognition = null;
                }
                return;
            }
        }
        
        translationSide = side;
        setTimeout(() => {
            try {
                isVoiceListening = true;
                setVoiceState(side, "recording");
                if (recognition) {
                    updateRecognitionLang();
                    recognition.start();
                } else {
                    initVoiceMode();
                }
            } catch (error) {
                initVoiceMode();
            }
        }, 100);
        return;
    }

    if (side !== "left" && currentMode === "voice" && isVoiceListening) {
        isVoiceListening = false;
        stopVoiceMode(false);
    }

    const inputElement = document.getElementById("prompt-input");
    const rawInputText = inputElement ? String(inputElement.value || "").trim() : "";
    let userText = (overrideText || rawInputText).trim();
    let userBubbleText = rawInputText || userText;

    if (!overrideText && currentMode === "code") {
        const pendingScopedTarget = typeof resolvePendingScopedCodeAttachment === "function"
            ? resolvePendingScopedCodeAttachment()
            : null;
        if (pendingScopedTarget && !rawInputText) {
            if (typeof showToast === "function") showToast(getScopedCodeText("editAsk"));
            if (inputElement) inputElement.focus();
            return;
        }
        if (pendingScopedTarget && rawInputText) {
            const fileInfo = codeFiles && codeFiles[pendingScopedTarget.fileIndex]
                ? codeFiles[pendingScopedTarget.fileIndex]
                : {};
            overrideText = buildScopedCodeEditPrompt(pendingScopedTarget, rawInputText, fileInfo);
            userText = rawInputText;
            userBubbleText = rawInputText;
            isScopedCodeEdit = true;
            scopedTarget = pendingScopedTarget;
            if (inputElement) {
                inputElement.value = "";
                if (typeof handleInput === "function") handleInput(inputElement);
            }
            if (typeof clearPendingScopedCodeAttachment === "function") {
                clearPendingScopedCodeAttachment({ silent: true });
            }
        }
    }

    if (!forceGenerate && isMenuOpen && userText) {
        fetchStoreApps(userText);
        return;
    }

    if (!forceGenerate && currentMode === "app") {
        inputElement.value = "";
        inputElement.style.height = "auto";
        fetchApps(userText);
        return;
    }

    if (currentMode !== "community") {
        if (!userText) return;

        window.currentImagePrompt = userText;
        window.savedPrompt = userText;
        startExperience();

        if (typeof closePreview === "function") closePreview();

        if (!overrideText) {
            inputElement.value = "";
            inputElement.style.height = "auto";
        }
        showLoader(true);
        if (!silentUserBubble) {
            appendMsg("user", userBubbleText || userText);
        }
        if (!isContinuationRequest) {
            clearContinueWriteContext();
        }

        if (abortController) abortController.abort();
        abortController = new AbortController();
        stopSignal = false;
        setMainGeneratingState(true);
        if (typeof window.updateMainSubmitButtonState === "function") {
            window.updateMainSubmitButtonState();
        }
        let autoLocalFallbackRunner = null;

        try {
            if (activeApp) {
                const apiUrl = activeApp.api_url && activeApp.api_url.trim() !== "";
                const category = (activeApp.category || "").toLowerCase();
                
                if (apiUrl && !["image", "code", "music", "video", "blog", "character"].includes(category)) {
                    await executeAppLogic(userText);
                    return;
                }
            }

            if (currentMode === "translate") {
                const langLeft = document.getElementById("trans-select-left").value;
                const langRight = document.getElementById("trans-select-right").value;
                
                let sourceLang = side === "left" ? langLeft : langRight;
                let targetLang = side === "left" ? langRight : langLeft;

                const response = await fetch("?action=ai_translate", {
                    method: "POST",
                    body: JSON.stringify({ text: userText, target_lang: targetLang, source_lang: sourceLang }),
                    signal: abortController.signal
                });
                
                const data = await parseJsonResponseSafe(response);

                if (data.error === "LIMIT_REACHED") {
                    showToast("Limit reached. Local Translation...");
                    if (!isModelLoaded) await startDownload();
                    
                    const localPrompt =[
                        { role: "system", content: `Translate the following text to ${targetLang}. Output ONLY the translated text.` },
                        { role: "user", content: userText }
                    ];
                    
                    let localResult = "";
                    const bubble = appendMsg("ai", "...");
                    const speechLang = resolveSpeechLangCode(targetLang, "en-US");
                    
                    await runLocalInference(localPrompt, (token, meta = {}) => {
                        if (!stopSignal) {
                            localResult = meta.replace ? token : (localResult + token);
                            const plainLocalResult = extractPlainTextLocal(localResult);
                            bubble.textContent = plainLocalResult;
                            bubble.style.color = "#111111";
                            bubble.style.fontWeight = "700";
                            bubble.style.fontSize = "1.125rem";
                            bubble.style.lineHeight = "1.65";
                            scrollBottom();
                        }
                    });
                    
                    if (!stopSignal) speakText(extractPlainTextLocal(localResult), speechLang);
                } else if (data.error) {
                    appendMsg("error", data.error);
                } else {
                    let resultObj = { text: data.response, lang_code: data.lang_code || "" };
                    try {
                        if (data.response && typeof data.response === "object") {
                            resultObj = Object.assign({}, resultObj, data.response);
                        } else {
                            let cleanJson = String(data.response || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json/g, "").replace(/```/g, "").trim();
                            let jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
                            if (jsonMatch) cleanJson = jsonMatch[0];
                            resultObj = Object.assign({}, resultObj, JSON.parse(cleanJson));
                        }
                    } catch (err) {
                        resultObj.text = data.response;
                    }
                    
                    const translatedText = extractPlainTextLocal(resultObj.text);
                    const translatedBubble = appendMsg("ai", translatedText);
                    if (translatedBubble) {
                        translatedBubble.style.color = "#111111";
                        translatedBubble.style.fontWeight = "700";
                    }
                    const speechLang = resolveSpeechLangCode(resultObj.lang_code || targetLang, resolveSpeechLangCode(targetLang, "en-US"));
                    speakText(translatedText, speechLang);
                }
            } else if (currentMode === "video") {
                let prompt = userText;
                if (activeApp && activeApp.system_prompt) prompt = `${activeApp.system_prompt}, ${userText}`;
                
                const gridPrompt = "2x2 grid " + prompt;
                const response = await fetch("?action=ai_video", {
                    method: "POST",
                    body: JSON.stringify({ prompt: gridPrompt, watermark: false }),
                    signal: abortController.signal
                });
                
                const data = await parseJsonResponseSafe(response);
                
                if (data.error) {
                    appendMsg("error", "Video Error: " + data.error);
                } else {
                    generateGifFromGrid(data.b64, data.translated || prompt);["app-container", "welcome-msg", "center-app-name"].forEach((id) => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = "none";
                    });
                }
            } else if (currentMode === "image") {
                let prompt = userText;
                if (activeApp && activeApp.system_prompt) prompt = `${activeApp.system_prompt}, ${userText}`;
                
                const ratio = document.getElementById("image-ratio-value")?.value || "square";
                const response = await fetch("?action=ai_image", {
                    method: "POST",
                    body: JSON.stringify({ prompt: prompt, ratio: ratio }),
                    signal: abortController.signal
                });
                
                const data = await parseJsonResponseSafe(response);
                
                if (data.error) {
                    appendMsg("error", "Image Error: " + data.error);
                } else {
                    const promptForBubble = String(data.prompt_input || userText || prompt || data.prompt_used || data.translated || "").trim();
                    window.currentImagePrompt = promptForBubble || userText || prompt;
                    appendImg(data.b64, promptForBubble || userText || prompt);
                    openPreview("data:image/png;base64," + data.b64);["app-container", "welcome-msg", "center-app-name"].forEach((id) => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = "none";
                    });
                }
            } else if (currentMode === "music") {
                let prompt = userText;
                if (activeApp && activeApp.system_prompt) prompt = `${activeApp.system_prompt}, ${userText}`;
                await generateMusic(prompt);
            } else if (currentMode === "search") {
                const response = await fetch("?action=search_data", {
                    method: "POST",
                    body: JSON.stringify({ prompt: userText }),
                    signal: abortController.signal
                });
                
                // --- ??륁젟???봔?? ??됱읈??JSON ???뼓 ---
                const rawText = await response.text();
                let data = {};
                try {
                    data = parseJsonTextSafe(rawText);
                } catch (e) {
                    console.error("Search Data JSON ???뼓 ?癒?쑎:", rawText);
                    throw new Error("野꺜????뺤쒔嚥≪뮆?????而?몴??怨쀬뵠?怨? 獄쏆룇? 筌륁궢六??щ빍??");
                }
                // -------------------------------------
                
                if (data.results && data.results.length > 0) {
                    const topResults = data.results.slice(0, 5);
                    let contextStr = topResults.map((item, idx) => `[?얜챷苑?${idx + 1}] ${item.content}`).join("\n");
                    
                    const synthResponse = await fetch("?action=search_synthesis", {
                        method: "POST",
                        body: JSON.stringify({ query: userText, context: contextStr }),
                        signal: abortController.signal
                    });
                    
                    // --- ??륁젟???봔?? ??됱읈??JSON ???뼓 ---
                    const rawSynthText = await synthResponse.text();
                    let synthData = {};
                    try {
                        synthData = parseJsonTextSafe(rawSynthText);
                    } catch (e) {
                        console.error("Search Synthesis JSON ???뼓 ?癒?쑎:", rawSynthText);
                        throw new Error("野꺜???遺용튋 ??뺤쒔嚥≪뮆?????而?몴??怨쀬뵠?怨? 獄쏆룇? 筌륁궢六??щ빍??");
                    }
                    // -------------------------------------
                    
                    if (synthData.error === "LIMIT_REACHED") {
                        showToast("Server limit reached. Local Summarizing...");
                        if (!isModelLoaded) await startDownload();
                        
                        const bubble = appendMsg("ai", "...");
                        let localResult = "";
                        const localPrompt =[
                            { role: "system", content: "??筌ｌ뮇???遺용튋??" },
                            { role: "user", content: `${contextStr}\n????곸뒠??疫꿸퀡而??곗쨮 ?????곸㉭.` }
                        ];
                        
                        await runLocalInference(localPrompt, (token, meta = {}) => {
                            if (!stopSignal) {
                                localResult = meta.replace ? token : (localResult + token);
                                bubble.innerHTML = parseMarkdownLocal(localResult, false);
                                scrollBottom();
                            }
                        });
                        
                        if (!stopSignal) {
                            bubble.innerHTML = parseMarkdownLocal(localResult, true);
                            addSourcesToBubble(bubble, topResults);
                            scrollBottom();
                        }
                    } else if (synthData.error) {
                        // ??뺤쒔?癒?퐣 ?癒?쑎 筌롫뗄?놅쭪???癰귣?沅?野껋럩??筌ｌ꼶??
                        appendMsg("error", "野꺜???遺용튋 ??살첒: " + synthData.error);
                    } else {
                        addSourcesToBubble(appendMsg("ai", synthData.html || "Thinking..."), topResults);
                    }
                } else {
                    appendMsg("ai", "野꺜??野껉퀗?드첎? ??곷뮸??덈뼄.");
                }
            } else {
                let finalPrompt = userText;
                let currentHistory = chatHistory;
                let sysPrompt = "";
                let shouldAttachSystemPrompt = false;
                const characterSession = getCharacterChatSession();
                const activeCategory = activeApp && activeApp.category ? String(activeApp.category).toLowerCase() : "";
                const shouldForceCodePrompt = !characterSession && currentMode !== "blog" && (currentMode === "code" || activeCategory === "code");
                const useRawInputOnly = false;
                if (Array.isArray(currentHistory)) {
                    currentHistory = currentHistory.filter((msg) => {
                        if (!msg || (msg.role !== "user" && msg.role !== "assistant")) return false;
                        if (!(typeof msg.content === "string" && msg.content.trim() !== "")) return false;
                        if (msg.role === "assistant" && isIgnorableAssistantGreeting(msg.content)) return false;
                        return true;
                    });
                    while (currentHistory.length > 0 && currentHistory[0].role !== "user") {
                        currentHistory.shift();
                    }
                } else {
                    currentHistory = [];
                }
                
                if (characterSession) {
                    sysPrompt = buildCharacterChatSystemPrompt(characterSession);
                    shouldAttachSystemPrompt = String(sysPrompt || "").trim() !== "";
                } else if (activeApp) {
                    if (activeApp.system_prompt) {
                        sysPrompt = String(activeApp.system_prompt || "").trim();
                        shouldAttachSystemPrompt = sysPrompt !== "";
                    }
                }

                if (!characterSession && !shouldForceCodePrompt && shouldAttachSystemPrompt && typeof window.buildIsaiSystemPrompt === "function") {
                    sysPrompt = window.buildIsaiSystemPrompt(sysPrompt);
                }

                if (shouldForceCodePrompt) {
                    sysPrompt = buildCodeAssistantPrompt(shouldAttachSystemPrompt ? sysPrompt : "");
                    shouldAttachSystemPrompt = String(sysPrompt || "").trim() !== "";
                    finalPrompt = userText;
                }
                
                if (currentMode === "blog") {
                    if (shouldAttachSystemPrompt) {
                        finalPrompt = `Topic: "${userText}". Instructions: ${sysPrompt}. Lang: ${LANG === "ko" ? "Korean" : "English"}. Add [[IMG: keyword]] tags.`;
                    } else {
                        finalPrompt = `Topic: "${userText}". Lang: ${LANG === "ko" ? "Korean" : "English"}. Add [[IMG: keyword]] tags.`;
                    }
                    currentHistory =[];
                }

                if (currentMode === "expert") {
                    const expertData = await runExpertModeSynthesis(userText, currentHistory, shouldAttachSystemPrompt ? sysPrompt : "", abortController.signal);
                    if (expertData && expertData.response) {
                        const bubble = appendMsg("ai", "...");
                        const renderedResponse = normalizeApiResponseForBubble(expertData.response, {
                            isCodeMode: false,
                            isTruncated: false
                        });
                        setAssistantBubbleBodyLocal(bubble, renderedResponse, { forcePlainText: false, isFinished: true });
                        chatHistory.push({ role: "user", content: userText }, { role: "assistant", content: renderedResponse.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim() });
                        clearContinueWriteContext();
                        scrollBottom();
                    } else if (expertData && expertData.error) {
                        appendMsg("ai", `Error: ${expertData.error}`);
                    } else {
                        appendMsg("ai", "Error: Expert mode failed.");
                    }
                } else if (isLocalActive) {
                    if (!isModelLoaded) await startDownload();
                    const localPromptArr =[
                        ...(useRawInputOnly ? [] : (shouldAttachSystemPrompt ? [{ role: "system", content: sysPrompt }] : [])),
                        ...(useRawInputOnly ? [] : currentHistory.slice(-4)),
                        { role: "user", content: useRawInputOnly ? userText : finalPrompt }
                    ];
                    if (useRawInputOnly) localPromptArr.__rawInputOnly = true;
                    
                    let localResult = "";
                    const bubble = appendMsg("ai", "...");
                    
                    await runLocalInference(localPromptArr, (token, meta = {}) => {
                        if (!stopSignal) {
                            localResult = meta.replace ? token : (localResult + token);
                            if (!isScopedCodeEdit || !scopedTarget) {
                                setAssistantBubbleBodyLocal(bubble, localResult, { forcePlainText: shouldForceCodePrompt, isFinished: false });
                            }
                            scrollBottom();
                        }
                    });
                    
                    if (!stopSignal) {
                        if (isScopedCodeEdit && scopedTarget) {
                            const applied = applyScopedCodePatchToEditor(scopedTarget, localResult);
                            bubble.textContent = applied ? getScopedCodeText("applied") : getScopedCodeText("failed");
                            if (applied && typeof showToast === "function") showToast(getScopedCodeText("applied"));
                        } else {
                            setAssistantBubbleBodyLocal(bubble, localResult, { forcePlainText: shouldForceCodePrompt, isFinished: true });
                            updateCodeUI(localResult);
                            let historyResult = localResult.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
                            chatHistory.push({ role: "user", content: userText }, { role: "assistant", content: historyResult });
                            if (currentMode === "blog") await processBlogImages(bubble);
                        }
                        clearContinueWriteContext();
                        scrollBottom();
                    }
                } else {
                    const localPromptArr =[
                        ...(useRawInputOnly ? [] : (shouldAttachSystemPrompt ? [{ role: "system", content: sysPrompt }] : [])),
                        ...(useRawInputOnly ? [] : currentHistory.slice(-4)),
                        { role: "user", content: useRawInputOnly ? userText : finalPrompt }
                    ];
                    if (useRawInputOnly) localPromptArr.__rawInputOnly = true;

                    autoLocalFallbackRunner = async (noticeText = "") => {
                        if (noticeText && typeof showToast === "function") showToast(noticeText);
                        const ready = await ensureLocalModelReadyForAutoFallback();
                        if (!ready) {
                            appendMsg("ai", "Error: Local model download was canceled.");
                            return false;
                        }

                        const bubble = appendMsg("ai", "...");
                        let localResult = "";
                        await runLocalInference(localPromptArr, (token, meta = {}) => {
                            if (!stopSignal) {
                                localResult = meta.replace ? token : (localResult + token);
                                if (!isScopedCodeEdit || !scopedTarget) {
                                    setAssistantBubbleBodyLocal(bubble, localResult, { forcePlainText: shouldForceCodePrompt, isFinished: false });
                                }
                                scrollBottom();
                            }
                        });

                        if (!stopSignal) {
                            if (isScopedCodeEdit && scopedTarget) {
                                const applied = applyScopedCodePatchToEditor(scopedTarget, localResult);
                                bubble.textContent = applied ? getScopedCodeText("applied") : getScopedCodeText("failed");
                                if (applied && typeof showToast === "function") showToast(getScopedCodeText("applied"));
                            } else {
                                setAssistantBubbleBodyLocal(bubble, localResult, { forcePlainText: shouldForceCodePrompt, isFinished: true });
                                updateCodeUI(localResult);
                                let historyResult = localResult.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
                                chatHistory.push({ role: "user", content: userText }, { role: "assistant", content: historyResult });
                                if (currentMode === "blog") await processBlogImages(bubble);
                            }
                            clearContinueWriteContext();
                            scrollBottom();
                        }
                        return true;
                    };

                    const response = await fetch("?action=ai_chat", {
                        method: "POST",
                        body: JSON.stringify({
                            prompt: useRawInputOnly ? userText : finalPrompt,
                            history: useRawInputOnly ? [] : currentHistory,
                            system_prompt: useRawInputOnly ? "" : (shouldAttachSystemPrompt ? sysPrompt : ""),
                            max_chars: shouldForceCodePrompt ? Math.max(getIsaiApiMaxChars(), 2200) : getIsaiApiMaxChars()
                        }),
                        signal: abortController.signal
                    });
                    
                    const data = await parseJsonResponseSafe(response);
                    
                    if (data.error === "LIMIT_REACHED") {
                        await autoLocalFallbackRunner("Limit reached. Local Model...");
                    } else if (data.response) {
                        const renderedResponse = normalizeApiResponseForBubble(data.response, {
                            isCodeMode: shouldForceCodePrompt,
                            isTruncated: data.truncated === true
                        });
                        const bubble = appendMsg("ai", "...");
                        if (isScopedCodeEdit && scopedTarget) {
                            const applied = applyScopedCodePatchToEditor(scopedTarget, data.response);
                            bubble.textContent = applied ? getScopedCodeText("applied") : getScopedCodeText("failed");
                            if (applied && typeof showToast === "function") showToast(getScopedCodeText("applied"));
                            clearContinueWriteContext();
                            scrollBottom();
                        } else {
                            setAssistantBubbleBodyLocal(bubble, renderedResponse, { forcePlainText: shouldForceCodePrompt, isFinished: true });
                            updateCodeUI(renderedResponse);
                            let historyResult = renderedResponse.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
                            chatHistory.push({ role: "user", content: userText }, { role: "assistant", content: historyResult });
                            clearContinueWriteContext();
                            scrollBottom();
                            
                            if (currentMode === "blog") await processBlogImages(bubble);
                            if (currentMode === "voice") speakText(data.response);
                        }
                    } else if (data.error) {
                        const errText = String(data.error || "");
                        const shouldAutoFallback = shouldAutoSwitchToLocalFromError(errText);
                        if (shouldAutoFallback) {
                            const ok = await autoLocalFallbackRunner("Server issue detected. Switching to local model...");
                            if (ok) {
                                if (isContinuationRequest && previousContinueContext) {
                                    clearContinueWriteContext();
                                }
                                return;
                            }
                        }
                        if (isContinuationRequest && previousContinueContext) {
                            setContinueWriteContext(previousContinueContext);
                        } else {
                            clearContinueWriteContext();
                        }
                        appendMsg("ai", `Error: ${data.error}`);
                    } else {
                        const ok = await autoLocalFallbackRunner("No server response. Switching to local model...");
                        if (ok) return;
                        clearContinueWriteContext();
                        appendMsg("ai", "No response received.");
                    }
                }
            }

            function updateCodeUI(text) {
                if (window.extractedCodes && window.extractedCodes.length > 0) {
                    codeFiles = [...window.extractedCodes];
                    renderCodeTabs();
                } else if (currentMode === "code") {
                    updateCodePanel(text);
                }
            }
        } catch (error) {
            if (isContinuationRequest && previousContinueContext) {
                setContinueWriteContext(previousContinueContext);
            }
            if (error.name !== "AbortError") {
                const canAutoFallback = typeof autoLocalFallbackRunner === "function";
                if (canAutoFallback && shouldAutoSwitchToLocalFromError(error && error.message)) {
                    const ok = await autoLocalFallbackRunner("Server connection failed. Switching to local model...");
                    if (ok) return;
                }
                appendMsg("error", `Error: ${error.message}`);
            }
        } finally {
            setMainGeneratingState(false);
            showLoader(false);
            if (typeof window.updateMainSubmitButtonState === "function") {
                window.updateMainSubmitButtonState();
            }
            const focusInput = document.getElementById("prompt-input");
            if (focusInput) focusInput.focus();
        }
    } else {
        const fileInput = document.getElementById("comm-file-input");
        const nickname = document.getElementById("comm-nickname") ? document.getElementById("comm-nickname").value : "";
        const password = document.getElementById("comm-password").value;

        if (!userText && (!fileInput.files || fileInput.files.length === 0)) {
            showToast("??곸뒠??援????筌왖????낆젾??곻폒?紐꾩뒄.");
            return;
        }

        showLoader(true);
        try {
            const formData = new FormData();
            formData.append("content", userText);
            formData.append("password", password);
            formData.append("nickname", nickname);
            formData.append("type", "forum");

            if (fileInput.files.length > 0) {
                const keyRes = await fetch("get_key.php");
                const keyData = await keyRes.json();
                
                const imgurData = new FormData();
                imgurData.append("image", fileInput.files[0]);
                
                const uploadRes = await fetch("https://api.imgur.com/3/image", {
                    method: "POST",
                    headers: { Authorization: "Client-ID " + keyData.clientId },
                    body: imgurData
                });
                
                const uploadData = await uploadRes.json();
                if (!uploadData.success) throw new Error("Imgur Upload Failed");
                
                formData.append("image_url", uploadData.data.link);
            }

            const postRes = await fetch("re_store.php?action=create_post", {
                method: "POST",
                body: formData
            });
            const postData = await postRes.json();

            if (postData.success) {
                showToast("Published.");
                inputElement.value = "";
                handleInput(inputElement);
                document.getElementById("comm-password").value = "";
                if (typeof clearCommFile === "function") clearCommFile();

                if (postData.id) {
                    window.location.href = "https://isai.kr/view/" + postData.id;
                } else {
                    if (typeof switchTab === "function") switchTab("forum");
                    if (typeof loadData === "function") loadData("forum", true);
                }
            } else {
                showToast("Error: " + postData.error);
            }
        } catch (error) {
            showToast("Error: " + error.message);
        } finally {
            showLoader(false);
        }
    }
}

function triggerVoiceButton() {
    const voiceToolbarButton = document.getElementById("btn-voice");
    if (currentMode === "voice") {
        stopVoiceMode(true);
        if (typeof setMode === "function") {
            setMode("chat");
        } else {
            setVoiceState("left", "idle");
        }
        if (voiceToolbarButton) voiceToolbarButton.classList.remove("voice-armed", "voice-recording", "voice-processing");
        if (typeof showToast === "function") showToast("Voice conversation off");
        return;
    }

    try { stopVoiceMode(true); } catch (error) {}
    translationSide = "left";
    if (typeof setMode === "function") {
        setMode("voice");
    }

    setVoiceState("left", "processing");
    if (typeof showToast === "function") showToast("Voice conversation on");

    setTimeout(() => {
        executeAction("left");
    }, 120);
}

function renderStoreItems(apps, container) {
    apps.forEach((rawApp) => {
        const app = normalizeAppPayload(rawApp) || rawApp;
        const safeTitle = normalizeAppDisplayText(app.title, app.name || "App");
        const item = document.createElement("div");
        item.className = "store-item relative w-[44px] h-[44px] rounded-[14px]";
        item.title = `${safeTitle} (Views: ${app.views || 0})`;
        item.onclick = () => loadAppDetails(app.id);
        item.innerHTML = getAppIconHtml(app);
        container.appendChild(item);
    });
}

function getChatInputProfileImg() {
    const wrapper = document.getElementById("chat-input-profile");
    if (!wrapper) return null;
    return wrapper.querySelector("img");
}

function setChatInputProfile(src, altText) {
    const img = getChatInputProfileImg();
    if (!img) return;
    if (src && String(src).trim()) img.src = String(src).trim();
    if (altText) img.alt = String(altText);
}

function applyActiveAppProfileToChatInput() {
    if (!activeApp) return;
    const appTitle = normalizeAppDisplayText(activeApp.title, activeApp.name || "App");
    const iconUrl = String(activeApp.icon_url || "").trim();
    if (iconUrl) {
        setChatInputProfile(iconUrl, appTitle);
        return;
    }
    const fallbackUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(appTitle)}&backgroundColor=transparent`;
    setChatInputProfile(fallbackUrl, appTitle);
}

function restoreDefaultChatInputProfile() {
    if (defaultChatProfileSrc) {
        setChatInputProfile(defaultChatProfileSrc, "My Profile");
        return;
    }
    setChatInputProfile("https://api.dicebear.com/7.x/identicon/svg?seed=IP&backgroundColor=transparent", "My Profile");
}

function activateAppMode() {
    activeApp = normalizeAppPayload(activeApp) || activeApp;
    const safeAppTitle = normalizeAppDisplayText(activeApp.title, activeApp.name || "App");
    const safeFirstMessage = decodeEscapedUnicodeText(activeApp.first_message || "");
    clearCharacterChatSession();
    if (isMenuOpen) toggleStoreMenu();
    document.getElementById("active-app-status").classList.remove("hidden");
    document.getElementById("active-app-name").innerText = safeAppTitle;
    document.getElementById("prompt-input").value = "";
    document.getElementById("chat-box").innerHTML = "";

    if (safeFirstMessage) {
        appendMsg("ai", safeFirstMessage);
    } else {
        appendMsg("ai", `App '${safeAppTitle}' started.`);
    }
    applyActiveAppProfileToChatInput();
}

function exitAppMode() {
    activeApp = null;
    document.getElementById("active-app-status").classList.add("hidden");
    resetChat();
    restoreDefaultChatInputProfile();
    showToast("App Mode Exited");
}

async function fetchApps(query = "", append = false) {
    const grid = document.getElementById("app-grid");

    if (!append) {
        currentAppPage = 1;
        hasMoreApps = true;
        currentAppQuery = query;
        // 疫꿸퀣?????덈쐲 ?醫딅빍筌롫뗄?????梨??鈺곌퀣?? ??볤탢: grid.style.opacity = 0.5;
        grid.innerHTML = "";
    }

    if (!hasMoreApps || isAppLoading) return;

    isAppLoading = true;

    try {
        const response = await fetch("?action=search_app", {
            method: "POST",
            body: JSON.stringify({ prompt: query, page: currentAppPage, limit: APP_LIMIT })
        });

        if (response.ok) {
            const data = await parseJsonResponseSafe(response);

            if (data && data.length > 0) {
                // ?븍뜇釉?酉釉??醫딅빍筌롫뗄????온????????醫? ??볤탢
                data.forEach((app) => {
                    grid.appendChild(createAppItem(app));
                });

                if (data.length < APP_LIMIT) {
                    hasMoreApps = false;
                } else {
                    currentAppPage++;
                }
            } else {
                if (!append) {
                    const noAppsMsg = typeof T !== "undefined" && T.no_apps ? T.no_apps : "No shortcuts.";
                    grid.innerHTML = `<p class="text-gray-500 text-xs col-span-full py-2 text-center">${noAppsMsg}</p>`;
                }
                hasMoreApps = false;
            }
        }
    } catch (error) {
        console.error("Error fetching apps:", error);
    } finally {
        // 疫꿸퀣?????덈쐲 ??梨???癒?맒癰귣벀????볤탢: grid.style.opacity = 1;
        isAppLoading = false;
    }
}

function createAppItem(app, isClone = false) {
    app = normalizeAppPayload(app) || app;
    const item = document.createElement("a");
    item.href = app.url || "#";
    if(app.url) item.target = "_blank";
    
    item.className = "app-item relative w-[44px] h-[44px] rounded-[14px] transition-transform hover:scale-105";
    if (isClone) item.classList.add("clone-item");
    item.title = normalizeAppDisplayText(app.name, app.title || "App");

    item.innerHTML = getAppIconHtml(app);
    return item;
}

window.addEventListener("DOMContentLoaded", () => {
    applyLocalModelProfileToConfig();
    renderLocalModelTierSelector();
    observeLocalModelTierVisibility();
    syncLocalModelTierVisibility(currentMode);
    initCheckModel();
    fetchApps("");
    renderFixedApps();

    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    chatBox.style.display = "flex";
    chatBox.style.flexDirection = "column";
    chatBox.style.height = "100%";

    const profileImg = getChatInputProfileImg();
    if (profileImg && profileImg.src) {
        defaultChatProfileSrc = profileImg.src;
    }

    const btnChat = document.getElementById("btn-chat");
    if (btnChat) btnChat.classList.add("active");

    const handleStoreScroll = (target) => {
        if (!target) return;
        target.addEventListener("scroll", () => {
            if (target.scrollTop + target.clientHeight >= target.scrollHeight - 50 && hasMoreStoreApps && !isStoreLoading && isMenuOpen) {
                fetchStoreApps(currentStoreQuery, true);
            }
        });
    };
    const storePanel = document.getElementById("store-panel");
    const storeGrid = document.getElementById("store-grid");
    handleStoreScroll(storePanel);
    handleStoreScroll(storeGrid);

    const appContainer = document.getElementById("app-container");

	if (appContainer) {
		appContainer.addEventListener("scroll", () => {
			const scrollLocation = appContainer.scrollTop + appContainer.clientHeight;
			const totalHeight = appContainer.scrollHeight;

			if (scrollLocation >= totalHeight - 30) {
				if (hasMoreApps && !isAppLoading && currentMode === "app") {
					console.log("Loading more apps... Page:", currentAppPage);
					fetchApps(currentAppQuery, true);
				}
			}
		});
	}

    const params = new URLSearchParams(window.location.search);
    const modes =["chat", "search", "image", "code", "video", "music", "blog"];
    for (const mode of modes) {
        const queryVal = params.get(mode);
        if (queryVal) {
            if (mode === "image" && hasUsedUrlImageToday()) {
                showToast("URL image generation is limited to once per day.");
                params.delete("image");
                const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
                history.replaceState(null, document.title, nextUrl);
                break;
            }
            setMode(mode);
            const promptInput = document.getElementById("prompt-input");
            if (promptInput) {
                promptInput.value = queryVal;
                handleInput(promptInput);
            }
            setTimeout(() => {
                if (mode === "image") markUrlImageUsedToday();
                executeAction();
            }, 800);
            break;
        }
    }
});

window.removeFixedApp = function (event, index) {
    event.stopPropagation();
    fixedApps.splice(index, 1);
    localStorage.setItem("ISAI_FIXED_APPS", JSON.stringify(fixedApps));
    renderFixedApps();
    showToast("Removed from favorites.");
};

let fixedApps = JSON.parse(localStorage.getItem("ISAI_FIXED_APPS") || "[]");

function getAppIconHtml(app) {
    const title = normalizeAppDisplayText(app && app.title, (app && app.name) || "App") || "App";
    const initial = title.charAt(0).toUpperCase();
    
    const gradients =[
        "bg-gradient-to-br from-[#22c55e] to-[#16a34a]", 
        "bg-gradient-to-br from-[#d946ef] to-[#c026d3]", 
        "bg-gradient-to-br from-[#0ea5e9] to-[#0284c7]", 
        "bg-gradient-to-br from-[#f97316] to-[#ea580c]", 
        "bg-gradient-to-br from-[#a855f7] to-[#9333ea]", 
        "bg-gradient-to-br from-[#ec4899] to-[#db2777]"
    ];
    
    let hash = 0;
    for (let i = 0; i < title.length; i++) { hash = title.charCodeAt(i) + ((hash << 5) - hash); }
    const gradient = gradients[Math.abs(hash) % gradients.length];

    let iconUrl = app.icon_url || ""; 
    if (!iconUrl && app.url) {
        iconUrl = `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(app.url)}`;
    }

    const imgHtml = iconUrl ? `
        <img src="${iconUrl}" style="display:none;" 
             onload="if(this.naturalWidth <= 32) { this.style.display='none'; } else { this.nextElementSibling.querySelector('.icon-bg').style.backgroundImage = 'url(\\'' + this.src + '\\')'; this.nextElementSibling.classList.remove('opacity-0'); this.previousElementSibling.style.display='none'; }" 
             onerror="this.style.display='none'">
        <div class="absolute inset-0 w-full h-full rounded-[14px] z-10 bg-white opacity-0 transition-opacity duration-300 p-[5px]">
            <div class="icon-bg w-full h-full rounded-[8px]" 
                 style="background-size: contain; background-position: center; background-repeat: no-repeat;"></div>
        </div>
    ` : "";

    return `
        <div class="absolute inset-0 w-full h-full flex items-center justify-center text-white font-bold text-[18px] rounded-[14px] shadow-sm ${gradient}">
            ${initial}
        </div>
        ${imgHtml}
    `;
}

function startExperience() {
    if (!isStarted) {
        document.body.classList.add("started");
        document.getElementById("custom-scrollbar").style.display = "block";
        isStarted = true;
        setTimeout(scrollBottom, 600);
    }
}

let translationSide = "right";
const langMap = {
    English: "en-US",
    Korean: "ko-KR",
    Japanese: "ja-JP",
    Chinese: "zh-CN",
    Spanish: "es-ES",
    French: "fr-FR",
    German: "de-DE",
    Russian: "ru-RU"
};

const langAliasMap = {
    en: "en-US",
    english: "en-US",
    ko: "ko-KR",
    kr: "ko-KR",
    korean: "ko-KR",
    ja: "ja-JP",
    jp: "ja-JP",
    japanese: "ja-JP",
    zh: "zh-CN",
    cn: "zh-CN",
    chinese: "zh-CN",
    es: "es-ES",
    sp: "es-ES",
    spanish: "es-ES",
    fr: "fr-FR",
    french: "fr-FR",
    de: "de-DE",
    ge: "de-DE",
    german: "de-DE",
    ru: "ru-RU",
    russian: "ru-RU",
    pt: "pt-PT",
    portuguese: "pt-PT",
    hi: "hi-IN",
    hindi: "hi-IN"
};

function resolveSpeechLangCode(value, fallback = "en-US") {
    const raw = String(value || "").trim();
    if (!raw) return fallback;

    if (langMap[raw]) return langMap[raw];

    if (/^[a-z]{2}-[a-z]{2}$/i.test(raw)) {
        const [lang, region] = raw.split("-");
        return `${String(lang).toLowerCase()}-${String(region).toUpperCase()}`;
    }

    const normalized = raw.toLowerCase().replace(/_/g, "-");
    if (langAliasMap[normalized]) return langAliasMap[normalized];

    if (/^[a-z]{2}$/.test(normalized) && langAliasMap[normalized]) {
        return langAliasMap[normalized];
    }

    return fallback;
}

window.resolveSpeechLangCode = resolveSpeechLangCode;

function setVoiceState(side, state) {
    const btnLeft = document.getElementById("btn-submit-left");
    const btnRight = document.getElementById("btn-submit");
    const iconLeft = document.getElementById("icon-submit-left");
    const iconRight = document.getElementById("icon-submit");
    const btnVoice = document.getElementById("btn-voice");
    const btnVoiceIcon = btnVoice ? btnVoice.querySelector("i") : null;

    if (!btnLeft || !iconLeft) return;

    btnLeft.className = "btn-icon voice-toggle-btn transition-all duration-300";
    if (btnRight && btnRight.closest("#chat-input-actions")) {
        btnRight.className = "input-action-btn";
    } else if (btnRight) {
        btnRight.className = "input-action-btn";
    }
    btnLeft.style.display = "flex";
    btnLeft.style.backgroundColor = "rgba(255,255,255,0.10)";
    btnLeft.style.color = "#ffffff";
    btnLeft.style.boxShadow = "none";
    btnLeft.style.opacity = "1";
    btnLeft.style.pointerEvents = "auto";
    btnLeft.setAttribute("aria-pressed", state === "idle" ? "false" : "true");
    btnLeft.setAttribute("title", state === "idle" ? "Voice Conversation" : "Voice Conversation Active");
    if (btnRight) {
        btnRight.style.setProperty("width", "24px", "important");
        btnRight.style.setProperty("height", "24px", "important");
        btnRight.style.setProperty("min-width", "24px", "important");
        btnRight.style.setProperty("min-height", "24px", "important");
        btnRight.style.setProperty("padding", "0", "important");
        btnRight.style.setProperty("border-radius", "9999px", "important");
        btnRight.style.backgroundColor = "";
        btnRight.style.color = "";
        btnRight.style.setProperty("color", "#ffffff", "important");
        btnRight.style.opacity = "1";
        btnRight.style.pointerEvents = "auto";
    }

    iconLeft.className = "ri-mic-line text-lg text-white";
    if (iconRight) {
        iconRight.className = "ri-arrow-up-s-line text-[13px] text-white";
        iconRight.style.color = "#ffffff";
        iconRight.style.setProperty("color", "#ffffff", "important");
    }
    if (typeof window.updateMainSubmitButtonState === "function") {
        window.updateMainSubmitButtonState();
    }
    if (btnVoice) {
        btnVoice.classList.remove("voice-armed", "voice-recording", "voice-processing");
        btnVoice.style.backgroundColor = "";
        btnVoice.style.color = "";
        btnVoice.style.boxShadow = "";
        btnVoice.style.transform = "";
        btnVoice.setAttribute("aria-pressed", state === "idle" ? "false" : "true");
    }
    if (btnVoiceIcon) {
        btnVoiceIcon.className = "ri-mic-2-line text-lg";
    }

    if (state === "idle" && currentMode === "voice") {
        btnLeft.style.backgroundColor = "rgba(255,255,255,0.14)";
        btnLeft.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.10), 0 10px 24px rgba(0,0,0,0.22)";
        if (btnVoice) {
            btnVoice.classList.add("voice-armed");
            btnVoice.style.backgroundColor = "rgba(255,255,255,0.12)";
            btnVoice.style.color = "#ffffff";
            btnVoice.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.10), 0 10px 24px rgba(0,0,0,0.22)";
        }
    }

    if (state === "idle") return;

    if (state === "recording") {
        iconLeft.className = "ri-voiceprint-line text-lg text-white animate-mic-breath";
        btnLeft.style.backgroundColor = "#ef4444";
        btnLeft.style.color = "white";
        btnLeft.style.boxShadow = "0 0 0 4px rgba(239,68,68,0.18), 0 10px 24px rgba(239,68,68,0.30)";
        if (btnVoice) {
            btnVoice.classList.add("voice-recording");
            btnVoice.style.backgroundColor = "#ef4444";
            btnVoice.style.color = "#ffffff";
            btnVoice.style.boxShadow = "0 0 0 4px rgba(239,68,68,0.18), 0 10px 24px rgba(239,68,68,0.30)";
            btnVoice.style.transform = "scale(1.03)";
        }
        if (btnVoiceIcon) {
            btnVoiceIcon.className = "ri-voiceprint-line text-lg text-white animate-mic-breath";
        }
    } else if (state === "processing") {
        iconLeft.className = "ri-voiceprint-line text-lg text-white";
        btnLeft.style.backgroundColor = "rgba(255,255,255,0.16)";
        btnLeft.style.color = "#ffffff";
        btnLeft.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.14), 0 10px 24px rgba(0,0,0,0.26)";
        if (btnVoice) {
            btnVoice.classList.add("voice-processing");
            btnVoice.style.backgroundColor = "rgba(255,255,255,0.16)";
            btnVoice.style.color = "#ffffff";
            btnVoice.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.14), 0 10px 24px rgba(0,0,0,0.26)";
        }
        if (btnVoiceIcon) {
            btnVoiceIcon.className = "ri-voiceprint-line text-lg text-white";
        }
    }
}

function updateSubmitIcon(state, side = "right") {
    setVoiceState("left", state === "mic" || state === "default" ? "idle" : state);
}

function showPopup(title, msg, confirmCallback, cancelCallback) {
    const layer = document.getElementById("modal-layer");
    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-msg").innerText = msg;
    document.getElementById("modal-cancel").innerText = T.btn_cancel;
    document.getElementById("modal-confirm").innerText = T.btn_confirm;

    const btnConfirm = document.getElementById("modal-confirm");
    const btnCancel = document.getElementById("modal-cancel");
    
    const newConfirm = btnConfirm.cloneNode(true);
    const newCancel = btnCancel.cloneNode(true);
    
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    newConfirm.onclick = () => {
        closePopup();
        confirmCallback();
    };
    newCancel.onclick = () => {
        closePopup();
        if (typeof cancelCallback === "function") {
            cancelCallback();
        }
    };

    layer.classList.add("show");
}

function closePopup() {
    document.getElementById("modal-layer").classList.remove("show");
}

async function ensureLocalModelReadyForAutoFallback() {
    if (isModelLoaded) {
        isLocalActive = true;
        updateLocalBtnState();
        return true;
    }

    if (isModelDownloaded && !isModelLoaded) {
        isLocalActive = true;
        syncLocalModelTierVisibility();
        await startDownload();
        return !!isModelLoaded;
    }

    isLocalActive = true;
    syncLocalModelTierVisibility();
    await startDownload();
    return !!isModelLoaded;
}

function updateLocalBtnState() {
    const btn = document.getElementById("btn-download");
    if (!btn) return;
    const icon = btn.querySelector("i");
    if (!icon) return;

    if (isLocalActive) {
        btn.classList.add("text-green-400", "active");
        icon.className = "ri-ghost-4-line text-lg";
        btn.style.color = "";
    } else if (isModelDownloaded) {
        btn.classList.remove("text-green-400", "active");
        icon.className = "ri-ghost-4-line text-lg";
        btn.style.color = "rgba(255,255,255,0.6)";
    } else {
        btn.classList.remove("text-green-400", "active");
        icon.className = "ri-ghost-4-line text-lg";
        btn.style.color = "rgba(255,255,255,0.3)";
    }
    if (typeof syncLocalModelTierVisibility === "function") {
        syncLocalModelTierVisibility();
    }
}

function getLocalModelTierStorageKey() {
    return (window.MODEL_CONFIG && window.MODEL_CONFIG.modelTierKey) || "ISAI_LOCAL_MODEL_TIER_V1";
}

function getLocalModelProfiles() {
    const coreProfiles = window.__ISAI_MODEL_CORE_PROFILES || {};
    if (coreProfiles && Object.keys(coreProfiles).length > 0) {
        return coreProfiles;
    }
    const configuredProfiles = (window.MODEL_CONFIG && window.MODEL_CONFIG.modelProfiles) || {};
    if (configuredProfiles && Object.keys(configuredProfiles).length > 0) {
        return configuredProfiles;
    }
    return {
        light: {
            key: "light",
            label: "Light",
            fallbackUrl: "",
            popupSizeText: "257MB",
            preferredRuntime: "wllama"
        },
        middle: {
            key: "middle",
            label: "Middle",
            fallbackUrl: "",
            preferredRuntime: "wllama"
        },
        hard: {
            key: "hard",
            label: "Hard",
            fallbackUrl: "",
            preferredRuntime: "wllama"
        }
    };
}

function getDefaultLocalModelTier() {
    const profiles = getLocalModelProfiles();
    const configuredDefault = String((window.MODEL_CONFIG && window.MODEL_CONFIG.defaultModelTier) || "").trim().toLowerCase();
    if (configuredDefault && profiles[configuredDefault]) return configuredDefault;
    if (profiles.light) return "light";
    const keys = Object.keys(profiles);
    return keys.length > 0 ? keys[0] : "light";
}

function getActiveLocalModelTier() {
    const profiles = getLocalModelProfiles();
    const storageKey = getLocalModelTierStorageKey();
    const userSetKey = getLocalModelTierUserSetKey();
    const hasUserSelection = localStorage.getItem(userSetKey) === "true";
    const storedTier = String(localStorage.getItem(storageKey) || "").trim().toLowerCase();
    const defaultTier = profiles.middle ? "middle" : getDefaultLocalModelTier();
    if (storedTier && profiles[storedTier] && hasUserSelection) return storedTier;
    localStorage.setItem(storageKey, defaultTier);
    return defaultTier;
}

function getActiveLocalModelProfile() {
    const profiles = getLocalModelProfiles();
    const tier = getActiveLocalModelTier();
    return profiles[tier] || null;
}

function getLocalModelProfileUrl(profile) {
    if (!profile) return "";
    if (typeof profile === "string") return String(profile).trim();
    return String(profile.fallbackUrl || profile.url || profile.modelUrl || "").trim();
}

function applyLocalModelProfileToConfig() {
    const modelConfig = window.MODEL_CONFIG || {};
    const profile = getActiveLocalModelProfile();
    if (!profile) return null;
    modelConfig.fallback = modelConfig.fallback || {};
    const profileUrl = getLocalModelProfileUrl(profile);
    if (profileUrl) {
        modelConfig.fallback.url = profileUrl;
    }
    if (Array.isArray(profile.fallbackUrls) && profile.fallbackUrls.length > 0) {
        modelConfig.fallback.urls = profile.fallbackUrls.slice();
    } else {
        delete modelConfig.fallback.urls;
    }
    if (profile.preferredRuntime) {
        modelConfig.preferredRuntime = profile.preferredRuntime;
    }
    if (profile.webllmModelId) {
        modelConfig.webllm = Object.assign({}, modelConfig.webllm || {}, {
            modelId: profile.webllmModelId
        });
    } else {
        modelConfig.webllm = null;
    }
    modelConfig.activeModelId = profile.modelId || "";
    modelConfig.activeModelName = profile.modelName || "";
    window.MODEL_CONFIG = modelConfig;
    return profile;
}
window.applyLocalModelProfileToConfig = applyLocalModelProfileToConfig;

function getLocalDownloadStorageKey() {
    const baseKey = (window.MODEL_CONFIG && window.MODEL_CONFIG.storageKey) || "ISAI_MODEL_DOWNLOADED";
    const profile = getActiveLocalModelProfile();
    const modelId = String(profile && profile.modelId ? profile.modelId : getActiveLocalModelTier()).trim().toLowerCase();
    return `${baseKey}__${modelId || "default"}`;
}

function getLocalRuntimeStorageKey() {
    return (window.MODEL_CONFIG && window.MODEL_CONFIG.runtimeKey) || "ISAI_LOCAL_MODEL_RUNTIME_V1";
}

function getLocalModelTierIconMarkup(tierKey) {
    const key = String(tierKey || "").trim().toLowerCase();
    const iconMap = {
        code: "ri-folder-zip-line",
        light: "ri-flashlight-line",
        middle: "ri-command-line",
        hard: "ri-fire-line"
    };
    const iconClass = iconMap[key] || "ri-circle-line";
    return `<i class="${iconClass}"></i>`;
}

function getLocalModelPopupTitle() {
    const locale = String(document.documentElement.lang || navigator.language || "ko").toLowerCase();
    if (locale.startsWith("ko")) return "로컬 모델 다운로드";
    return "Download Local Model";
}

function getLocalModelPopupMessage() {
    const locale = String(document.documentElement.lang || navigator.language || "ko").toLowerCase();
    const profile = getActiveLocalModelProfile();
    if (locale.startsWith("ko")) {
        if (profile && profile.key === "light") {
            const sizeText = profile.popupSizeText || "257MB";
            return `라이트 모델(${sizeText})을 다운로드합니다.`;
        }
        if (profile && profile.key === "middle") {
            return "중간 모델을 다운로드합니다.";
        }
        if (profile && profile.key === "hard") {
            return "하드 모델을 다운로드합니다.";
        }
        return "로컬 모델을 다운로드합니다.";
    }
    if (profile && profile.key === "light") {
        const sizeText = profile.popupSizeText || "257MB";
        return `Downloading light model (${sizeText}).`;
    }
    if (profile && profile.key === "middle") {
        return "Downloading middle model.";
    }
    if (profile && profile.key === "hard") {
        return "Downloading hard model.";
    }
    return "Downloading local model.";
}

function syncLocalModelTierVisibility(mode) {
    const wrapper = document.getElementById("local-model-tier-wrapper");
    if (!wrapper) return;
    const effectiveMode = String(mode || (document.body && document.body.getAttribute("data-ui-mode")) || currentMode || "chat").toLowerCase();
    const shouldShow = (effectiveMode === "chat" || effectiveMode === "code");
    wrapper.style.display = shouldShow ? "block" : "none";
}
window.syncLocalModelTierVisibility = syncLocalModelTierVisibility;

function renderLocalModelTierSelector() {
    const wrapper = document.getElementById("local-model-tier-wrapper");
    const list = document.getElementById("local-model-tier-list");
    if (!wrapper || !list) return;

    const profiles = getLocalModelProfiles();
    const activeTier = getActiveLocalModelTier();
    const orderedTiers = getOrderedLocalModelTierKeys().filter((tier) => !!profiles[tier]);

    list.innerHTML = "";
        orderedTiers.forEach((tier) => {
            const profile = profiles[tier] || {};
            const button = document.createElement("button");
            button.type = "button";
            button.className = `local-model-tier-btn${tier === activeTier ? " active" : ""}`;
            const displayLabel = getLocalizedLocalModelTierLabel(tier);
            button.classList.add("is-icon");
            button.innerHTML = getLocalModelTierIconMarkup(tier);
            button.title = profile.modelName || displayLabel;
            button.setAttribute("aria-label", profile.modelName || displayLabel);
            button.dataset.tier = tier;
            button.setAttribute("aria-pressed", tier === activeTier ? "true" : "false");
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
            setLocalModelTier(tier);
        });
        list.appendChild(button);
    });

    const localButton = document.createElement("button");
    localButton.type = "button";
    localButton.id = "btn-download";
    localButton.className = "local-model-tier-menu-btn";
    localButton.title = "Local Mode";
    localButton.setAttribute("aria-label", "Local Mode");
    localButton.innerHTML = '<i class="ri-ghost-4-line text-[14px]"></i>';
    localButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof handleLocalToggle === "function") {
            handleLocalToggle();
        }
    });
    list.appendChild(localButton);

    const gpuButton = document.createElement("button");
    gpuButton.type = "button";
    gpuButton.id = "btn-webgpu";
    gpuButton.className = "local-model-tier-menu-btn";
    gpuButton.title = "WebGPU";
    gpuButton.setAttribute("aria-label", "WebGPU");
    gpuButton.innerHTML = '<i class="ri-cpu-line text-[14px]"></i>';
    gpuButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof handleWebGPUToggle === "function") {
            handleWebGPUToggle();
        }
    });
    list.appendChild(gpuButton);

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.id = "local-model-tier-menu-btn";
    menuButton.className = "local-model-tier-menu-btn";
    menuButton.title = "Model Menu";
    menuButton.setAttribute("aria-label", "Model Menu");
    menuButton.innerHTML = '<i class="ri-menu-4-line text-[14px]"></i>';
    menuButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof toggleLocalModelShortcutMenu === "function") {
            toggleLocalModelShortcutMenu(event);
        }
    });
    list.appendChild(menuButton);

    if (typeof updateLocalBtnState === "function") updateLocalBtnState();
    if (typeof updateWebGPUBtnState === "function") updateWebGPUBtnState();

    syncLocalModelTierVisibility();
}

function observeLocalModelTierVisibility() {
    if (window.__localModelTierModeObserverBound) return;
    const body = document.body;
    if (!body) return;
    const observer = new MutationObserver(() => {
        syncLocalModelTierVisibility();
    });
    observer.observe(body, { attributes: true, attributeFilter: ["data-ui-mode"] });
    window.__localModelTierModeObserverBound = true;
}

function setLocalModelTier(tierKey) {
    const profiles = getLocalModelProfiles();
    const nextTier = String(tierKey || "").trim().toLowerCase();
    if (!profiles[nextTier]) return;

    const prevTier = getActiveLocalModelTier();
    if (prevTier === nextTier) {
        renderLocalModelTierSelector();
        return;
    }

    const wasLocalActive = !!isLocalActive;
    localStorage.setItem(getLocalModelTierStorageKey(), nextTier);
    localStorage.setItem(getLocalModelTierUserSetKey(), "true");
    applyLocalModelProfileToConfig();

    isLocalActive = wasLocalActive;
    isModelLoaded = false;
    localEngine = null;
    wllama = null;
    setLocalRuntimeState(null);
    isModelDownloaded = localStorage.getItem(getLocalDownloadStorageKey()) === "true";

    updateLocalBtnState();
    renderLocalModelTierSelector();

    const activeProfile = getActiveLocalModelProfile();
    if (activeProfile && typeof showToast === "function") {
        const safeReadySuffix = isModelDownloaded ? " (\ub2e4\uc6b4\ub85c\ub4dc\ub428)" : "";
        showToast(`${getLocalizedLocalModelTierLabel(nextTier)} \ubaa8\ub378 \uc120\ud0dd${safeReadySuffix}`);
        return;
        const readySuffix = isModelDownloaded ? " (??쇱뒲嚥≪뮆諭??" : "";
        showToast(`${getLocalizedLocalModelTierLabel(nextTier)} 筌뤴뫀???醫뤾문${readySuffix}`);
    }
}
window.setLocalModelTier = setLocalModelTier;

// Encoding-safe overrides for local model tier labels/messages.
function getLocalModelTierLabelFallback(tierKey) {
    const key = String(tierKey || "").trim().toLowerCase();
    if (key === "code") return "Code";
    if (key === "middle") return "Middle";
    if (key === "hard") return "Hard";
    return "Light";
}

function getLocalModelTierLocale() {
    const serverLocale = window.ISAI_SERVER_I18N && window.ISAI_SERVER_I18N.locale;
    const candidate = String(serverLocale || window.LANG || document.documentElement.lang || navigator.language || "en").toLowerCase();
    return candidate.split("-")[0];
}

function getLocalizedLocalModelTierLabel(tierKey) {
    const key = String(tierKey || "").trim().toLowerCase();
    const shortLabels = {
        code: "",
        light: "L",
        middle: "M",
        hard: "H"
    };
    return shortLabels[key] || getLocalModelTierLabelFallback(key);
}

function normalizeLocalModelProfile(tierKey, rawProfile) {
    const key = String(tierKey || "").trim().toLowerCase();
    if (!key) return null;
    const defaultLabel = getLocalModelTierLabelFallback(key);

    if (typeof rawProfile === "string") {
        return {
            key,
            label: defaultLabel,
            fallbackUrl: String(rawProfile).trim(),
            preferredRuntime: "wllama"
        };
    }

    const source = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
    const normalized = { ...source };
    normalized.key = String(normalized.key || key).trim().toLowerCase() || key;
    normalized.label = String(normalized.label || defaultLabel).trim() || defaultLabel;

    const url = String(normalized.fallbackUrl || normalized.url || normalized.modelUrl || "").trim();
    if (url) normalized.fallbackUrl = url;
    if (!normalized.popupSizeText && normalized.sizeText) {
        normalized.popupSizeText = String(normalized.sizeText).trim();
    }
    if (!normalized.preferredRuntime) {
        normalized.preferredRuntime = "wllama";
    }
    return normalized;
}

function normalizeLocalModelProfiles(rawProfiles) {
    if (!rawProfiles || typeof rawProfiles !== "object") return {};
    const normalized = {};
    Object.keys(rawProfiles).forEach((tierKey) => {
        const profile = normalizeLocalModelProfile(tierKey, rawProfiles[tierKey]);
        if (!profile) return;
        normalized[profile.key] = profile;
    });
    return normalized;
}

function getBundledLocalModelProfilesRaw() {
    const provider = window.getIsaiLocalModelProfiles;
    if (typeof provider === "function") {
        try {
            const provided = provider();
            if (provided && typeof provided === "object" && Object.keys(provided).length > 0) {
                return provided;
            }
        } catch (error) {}
    }
    const bundled = window.__ISAI_LOCAL_MODEL_PROFILES;
    if (bundled && typeof bundled === "object" && Object.keys(bundled).length > 0) {
        return bundled;
    }
    return null;
}

function getLocalModelProfiles() {
    const bundledProfiles = getBundledLocalModelProfilesRaw();
    if (bundledProfiles && Object.keys(bundledProfiles).length > 0) {
        return normalizeLocalModelProfiles(bundledProfiles);
    }
    const coreProfiles = window.__ISAI_MODEL_CORE_PROFILES || {};
    if (coreProfiles && Object.keys(coreProfiles).length > 0) {
        return normalizeLocalModelProfiles(coreProfiles);
    }
    const configuredProfiles = (window.MODEL_CONFIG && window.MODEL_CONFIG.modelProfiles) || {};
    if (configuredProfiles && Object.keys(configuredProfiles).length > 0) {
        return normalizeLocalModelProfiles(configuredProfiles);
    }
    return normalizeLocalModelProfiles({
        code: {
            key: "code",
            label: "\ucf54\ub4dc",
            fallbackUrl: DEFAULT_LOCAL_MODEL_URL,
            popupSizeText: "369MB",
            preferredRuntime: "wllama"
        },
        light: {
            key: "light",
            label: "\ub77c\uc774\ud2b8",
            fallbackUrl: DEFAULT_LOCAL_MODEL_URL,
            popupSizeText: "429MB",
            preferredRuntime: "wllama"
        },
        middle: {
            key: "middle",
            label: "\uc911\uac04",
            fallbackUrl: DEFAULT_LOCAL_MODEL_URL,
            popupSizeText: "592MB",
            preferredRuntime: "wllama"
        },
        hard: {
            key: "hard",
            label: "\ud558\ub4dc",
            fallbackUrl: DEFAULT_LOCAL_MODEL_URL,
            popupSizeText: "558MB",
            preferredRuntime: "wllama"
        }
    });
}

function getLocalModelPopupTitle() {
    const locale = String(document.documentElement.lang || navigator.language || "ko").toLowerCase();
    if (locale.startsWith("ko")) return "\ub85c\uceec \ubaa8\ub378 \ub2e4\uc6b4\ub85c\ub4dc";
    return "Download Local Model";
}

function getLocalModelPopupMessage() {
    const locale = String(document.documentElement.lang || navigator.language || "ko").toLowerCase();
    const profile = getActiveLocalModelProfile();
    if (locale.startsWith("ko")) {
        if (profile && profile.key === "light") {
            const sizeText = profile.popupSizeText || "257MB";
            return `LFM2.5 350M (${sizeText}) \ubaa8\ub378\uc744 \ub2e4\uc6b4\ub85c\ub4dc\ud55c \ub4a4 \ub85c\uceec \ubaa8\ub4dc\ub97c \uc0ac\uc6a9\ud560 \uc218 \uc788\uc5b4\uc694. \uacc4\uc18d\ud560\uae4c\uc694?`;
        }
        if (profile && profile.key === "middle") {
            return "LFM2.5 350M Q6_K \ubaa8\ub378\uc744 \ub2e4\uc6b4\ub85c\ub4dc\ud55c \ub4a4 \ub85c\uceec \ubaa8\ub4dc\ub97c \uc0ac\uc6a9\ud560 \uc218 \uc788\uc5b4\uc694. \uacc4\uc18d\ud560\uae4c\uc694?";
        }
        if (profile && profile.key === "hard") {
            return "Qwen3 0.6B IQ4_XS \ubaa8\ub378\uc744 \ub2e4\uc6b4\ub85c\ub4dc\ud55c \ub4a4 \ub85c\uceec \ubaa8\ub4dc\ub97c \uc0ac\uc6a9\ud560 \uc218 \uc788\uc5b4\uc694. \uacc4\uc18d\ud560\uae4c\uc694?";
        }
        return "\ub85c\uceec \ubaa8\ub378\uc744 \ub2e4\uc6b4\ub85c\ub4dc\ud55c \ub4a4 \uc624\ud504\ub77c\uc778 \ubaa8\ub4dc\ub97c \uc0ac\uc6a9\ud560 \uc218 \uc788\uc5b4\uc694. \uacc4\uc18d\ud560\uae4c\uc694?";
    }
    if (profile && profile.key === "light") {
        const sizeText = profile.popupSizeText || "257MB";
        return `Download LFM2.5 350M (${sizeText}) for local mode. Continue?`;
    }
    if (profile && profile.key === "middle") {
        return "Download LFM2.5 350M Q6_K for local mode. Continue?";
    }
    if (profile && profile.key === "hard") {
        return "Download Qwen3 0.6B IQ4_XS for local mode. Continue?";
    }
    return "Download the local model for offline mode. Continue?";
}

function getOrderedLocalModelTierKeys() {
    const profiles = getLocalModelProfiles();
    const preferredOrder = ["code", "light", "middle", "hard"];
    const ordered = preferredOrder.filter((tier) => !!profiles[tier]);
    return ordered.length > 0 ? ordered : ["light"];
}

function getNextLocalModelTier(currentTier) {
    const ordered = getOrderedLocalModelTierKeys();
    const current = String(currentTier || "").trim().toLowerCase();
    const currentIndex = ordered.indexOf(current);
    if (currentIndex < 0) return ordered[0];
    return ordered[(currentIndex + 1) % ordered.length];
}

function getLocalModelTierUserSetKey() {
    return "ISAI_LOCAL_MODEL_TIER_USER_SET_V1";
}

function ensureDefaultLocalModelTierForActivation(forceLightOnActivation) {
    const profiles = getLocalModelProfiles();
    const tierKey = getLocalModelTierStorageKey();
    const userSetKey = getLocalModelTierUserSetKey();
    const hasUserSelection = localStorage.getItem(userSetKey) === "true";
    const storedTier = String(localStorage.getItem(tierKey) || "").trim().toLowerCase();
    const fallbackTier = profiles.middle ? "middle" : getDefaultLocalModelTier();
    if (forceLightOnActivation) {
        const activationTier = profiles.light ? "light" : fallbackTier;
        if (profiles[activationTier]) {
            localStorage.setItem(tierKey, activationTier);
            return activationTier;
        }
    }
    if (!hasUserSelection || !profiles[storedTier]) {
        localStorage.setItem(tierKey, fallbackTier);
    }
    return getActiveLocalModelTier();
}

function setLocalModelTier(tierKey) {
    const profiles = getLocalModelProfiles();
    const nextTier = String(tierKey || "").trim().toLowerCase();
    if (!profiles[nextTier]) return;

    const prevTier = getActiveLocalModelTier();
    if (prevTier === nextTier) {
        renderLocalModelTierSelector();
        return;
    }

    const wasLocalActive = !!isLocalActive;
    localStorage.setItem(getLocalModelTierStorageKey(), nextTier);
    localStorage.setItem(getLocalModelTierUserSetKey(), "true");
    applyLocalModelProfileToConfig();

    isLocalActive = wasLocalActive;
    isModelLoaded = false;
    localEngine = null;
    wllama = null;
    setLocalRuntimeState(null);
    isModelDownloaded = localStorage.getItem(getLocalDownloadStorageKey()) === "true";

    updateLocalBtnState();
    renderLocalModelTierSelector();

    const activeProfile = getActiveLocalModelProfile();
    if (activeProfile && typeof showToast === "function") {
        const readySuffix = isModelDownloaded ? " (\ub2e4\uc6b4\ub85c\ub4dc\ub428)" : "";
        showToast(`${getLocalizedLocalModelTierLabel(nextTier)} \ubaa8\ub378 \uc120\ud0dd${readySuffix}`);
    }

    if (isModelDownloaded) {
        if (wasLocalActive) {
            startDownload();
        }
        return;
    }

    // On tier change, start downloading the newly selected model immediately.
    isLocalActive = true;
    updateLocalBtnState();
    renderLocalModelTierSelector();
    syncLocalModelTierVisibility();
    startDownload();
}
window.setLocalModelTier = setLocalModelTier;

function getLocalModelPopupSizeText(profile) {
    if (!profile) return "429MB";
    const sizeCandidates = [profile.popupSizeText, profile.sizeText, profile.downloadSize, profile.size];
    for (const sizeValue of sizeCandidates) {
        if (sizeValue) return String(sizeValue);
    }
    if (profile.key === "code") return "369MB";
    if (profile.key === "middle") return "592MB";
    if (profile.key === "hard") return "558MB";
    return "429MB";
}

function getLocalModelPopupProfileLabel(profile) {
    const tier = profile && profile.key ? profile.key : getActiveLocalModelTier();
    return getLocalizedLocalModelTierLabel(tier);
}

function getLocalModelPopupModelName(profile) {
    if (!profile) return "";
    const explicitName = String(profile.modelName || profile.name || "").trim();
    if (explicitName) return explicitName;
    const url = getLocalModelProfileUrl(profile);
    if (!url) return "";
    const path = url.split("?")[0];
    const fileName = path.substring(path.lastIndexOf("/") + 1);
    return String(fileName || "").trim();
}

function getLocalModelPopupTitle() {
    const locale = String(document.documentElement.lang || navigator.language || "ko").toLowerCase();
    if (locale.startsWith("ko")) return "\ub85c\uceec \ubaa8\ub378 \ub2e4\uc6b4\ub85c\ub4dc";
    return "Download Local Model";
}

function getLocalModelPopupMessage() {
    const locale = String(document.documentElement.lang || navigator.language || "ko").toLowerCase();
    const profile = getActiveLocalModelProfile();
    const sizeText = getLocalModelPopupSizeText(profile);
    const label = getLocalModelPopupProfileLabel(profile);
    const modelName = getLocalModelPopupModelName(profile);
    const summary = modelName ? `${modelName} / ${sizeText}` : sizeText;
    if (locale.startsWith("ko")) {
        return `${label} \ub85c\uceec\ubaa8\ub378(${summary})\uc744 \ub2e4\uc6b4\ub85c\ub4dc\ud55c \ub4a4 \uc0ac\uc6a9\ud560 \uc218 \uc788\uc5b4\uc694. \uacc4\uc18d\ud560\uae4c\uc694?`;
    }
    return `Download ${label} local model (${summary}) to use local mode. Continue?`;
}

function handleLocalToggle() {
    const downloadedForCurrentTier = localStorage.getItem(getLocalDownloadStorageKey()) === "true";
    const willActivate = !(downloadedForCurrentTier && isLocalActive);
    ensureDefaultLocalModelTierForActivation(willActivate);
    applyLocalModelProfileToConfig();
    isModelDownloaded = localStorage.getItem(getLocalDownloadStorageKey()) === "true";

    if (isModelDownloaded) {
        isLocalActive = !isLocalActive;
        if (!isLocalActive || isModelLoaded) {
            updateLocalBtnState();
            renderLocalModelTierSelector();
            syncLocalModelTierVisibility();
        } else {
            startDownload();
        }
    } else {
        isLocalActive = true;
        syncLocalModelTierVisibility();
        startDownload();
    }
}

function setLocalRuntimeState(runtimeName) {
    localRuntime = runtimeName || null;
    window.ISAI_LOCAL_RUNTIME = localRuntime;
    if (localRuntime) {
        localStorage.setItem(getLocalRuntimeStorageKey(), localRuntime);
    } else {
        loadedLocalModelId = "";
        loadedLocalModelSource = "";
        localStorage.removeItem(getLocalRuntimeStorageKey());
    }
}

function updateLocalProgress(bar, progress) {
    if (!bar) return;
    const numeric = Number(progress);
    const safeProgress = Number.isFinite(numeric) ? numeric : 0;
    const normalized = safeProgress > 1 ? safeProgress : safeProgress * 100;
    const percent = Math.max(0, Math.min(100, Math.round(normalized)));
    bar.style.width = percent + "%";
}

function mapPromptMessagesForLocalEngine(promptArr) {
    if (!Array.isArray(promptArr)) return [];
    const messages = promptArr
        .map((message) => ({
            role: message && typeof message.role === "string" ? message.role : "user",
            content: String(message && message.content != null ? message.content : "")
        }))
        .filter((message) => {
            if (message.content.trim().length <= 0) return false;
            if (message.role === "assistant" && isIgnorableAssistantGreeting(message.content)) return false;
            return true;
        });

    const activeProfile = typeof getActiveLocalModelProfile === "function" ? getActiveLocalModelProfile() : null;
    const isLightTier = !!(activeProfile && activeProfile.key === "light");
    const currentUiMode = String(
        window.currentMode
        || window.selectedMode
        || (document.body && document.body.getAttribute("data-ui-mode"))
        || "chat"
    ).toLowerCase();
    const isCodeMode = currentUiMode === "code";
    const isLightTierEffective = isLightTier && !isCodeMode;
    const systemMessages = messages.filter((message) => message.role === "system").slice(-1);
    const dialogMessages = messages.filter((message) => message.role !== "system");
    const historyLimit = isLightTierEffective ? 1 : 2;
    const compactMessages = dialogMessages.slice(-historyLimit);
    return [...systemMessages, ...compactMessages];
}

function normalizeGreetingForCompare(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
        .replace(/[.!?~"'\u2019\u201D\u3002\uFF01\uFF1F]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function getWelcomeGreetingCandidates() {
    const candidates = [];
    const push = (value) => {
        const text = String(value || "").trim();
        if (!text) return;
        candidates.push(text);
    };
    const serverI18n = window.ISAI_SERVER_I18N || {};
    push(serverI18n.welcomeMessage);
    if (serverI18n.welcomeMessages && typeof serverI18n.welcomeMessages === "object") {
        Object.keys(serverI18n.welcomeMessages).forEach((key) => push(serverI18n.welcomeMessages[key]));
    }
    push("안녕하세요. 무엇을 도와드릴까요? 😊");
    push("안녕하세요. 무엇을 도와드릴까요?");
    push("로컬로 더 안전하게 대화하세요");
    push("Hello! How can I help you? 😊");
    push("Hello! How can I help you?");
    push("Chat more safely in local mode");
    push("Opening chat...");
    return Array.from(new Set(candidates.map(normalizeGreetingForCompare).filter(Boolean)));
}

function getLocalWelcomeGreetingCandidates() {
    const candidates = [];
    const push = (value) => {
        const text = String(value || "").trim();
        if (!text) return;
        candidates.push(normalizeGreetingForCompare(text));
    };
    const serverI18n = window.ISAI_SERVER_I18N || {};
    push(serverI18n.welcomeMessage);
    if (serverI18n.welcomeMessages && typeof serverI18n.welcomeMessages === "object") {
        Object.keys(serverI18n.welcomeMessages).forEach((key) => push(serverI18n.welcomeMessages[key]));
    }
    push("로컬로 더 안전하게 대화하세요");
    push("Chat more safely in local mode");
    return Array.from(new Set(candidates.filter(Boolean)));
}

function isLocalWelcomeGreeting(text) {
    const normalized = normalizeGreetingForCompare(text);
    if (!normalized) return false;
    return getLocalWelcomeGreetingCandidates().some((candidate) => (
        candidate === normalized ||
        normalized.includes(candidate) ||
        candidate.includes(normalized)
    ));
}

function decorateLocalWelcomeBubbleIfNeeded(bubble, contentText) {
    if (!bubble) return;
    const decodeEscaped = (value) => String(value || "")
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    const rawText = decodeEscaped(contentText ?? bubble.textContent ?? "").trim();
    if (!rawText || !isLocalWelcomeGreeting(rawText)) return;
    const ctaUrl = "https://spirit-browser.isai.kr/";
    bubble.classList.add("chat-welcome-cta");
    bubble.style.display = "inline-flex";
    bubble.style.alignItems = "center";
    bubble.style.gap = "6px";
    bubble.style.cursor = "pointer";
    bubble.setAttribute("role", "button");
    bubble.setAttribute("tabindex", "0");
    bubble.setAttribute("title", "Spirit Browser");
    bubble.innerHTML = `<span class="chat-welcome-cta-inner" style="display:inline-flex;align-items:center;gap:6px;"><i class="ri-ghost-4-line chat-welcome-cta-icon" aria-hidden="true" style="font-size:15px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;"></i><span class="chat-welcome-cta-text">${escapeHtmlForBubbleLocal(rawText).replace(/\n/g, "<br>")}</span></span>`;
    if (bubble.dataset.welcomeCtaBound !== "1") {
        const openCta = (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.open(ctaUrl, "_blank", "noopener");
        };
        bubble.addEventListener("click", openCta);
        bubble.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            openCta(event);
        });
        bubble.dataset.welcomeCtaBound = "1";
    }
}

function isIgnorableAssistantGreeting(text) {
    const normalized = normalizeGreetingForCompare(text);
    if (!normalized) return false;
    const candidates = getWelcomeGreetingCandidates();
    return candidates.includes(normalized);
}

async function loadWebLLMLocalEngine(container, bar) {
    const modelConfig = window.MODEL_CONFIG || {};
    const webllm = window.WebLLMObj;
    if (!webllm || typeof webllm.CreateMLCEngine !== "function") {
        throw new Error("WebLLM module is not ready.");
    }
    if (!navigator.gpu) {
        throw new Error("WebGPU is not available in this browser.");
    }
    const modelId = modelConfig.webllm ? modelConfig.webllm.modelId : "Qwen2-0.5B-Instruct-q4f16_1-MLC";
    if (localEngine && localRuntime === "webllm" && loadedLocalModelSource === modelId) {
        return localEngine;
    }
    if (localEngine && localRuntime === "webllm" && loadedLocalModelSource && loadedLocalModelSource !== modelId) {
        try {
            if (typeof localEngine.unload === "function") {
                await localEngine.unload();
            } else if (typeof localEngine.dispose === "function") {
                await localEngine.dispose();
            }
        } catch (error) {}
        localEngine = null;
    }
    localEngine = await webllm.CreateMLCEngine(modelId, {
        logLevel: "WARN",
        initProgressCallback: (report) => {
            if (container) container.classList.remove("hidden");
            updateLocalProgress(bar, report && report.progress);
        }
    });

    setLocalRuntimeState("webllm");
    loadedLocalModelId = String(modelConfig.activeModelId || modelId || "").trim();
    loadedLocalModelSource = modelId;
    return localEngine;
}

async function loadWllamaFallbackEngine(container, bar) {
    const modelConfig = window.MODEL_CONFIG || {};
    const fallbackConfig = modelConfig.fallback || {};
    const speedConfig = modelConfig.activeSpeedPreset || {};
    const targetCtx = Math.min(
        Math.max(
            Number(speedConfig && speedConfig.maxSeqLen ? speedConfig.maxSeqLen : 256),
            128
        ),
        4096
    );
    const { Wllama, LoggerWithoutDebug } = window.WllamaObj || {};
    const createCompatEngine = window.WWAIObj && typeof window.WWAIObj.createEngine === "function"
        ? window.WWAIObj.createEngine
        : null;
    if (!Wllama && !createCompatEngine) {
        throw new Error("Fallback runtime is not available.");
    }
    if (!fallbackConfig.url) {
        throw new Error("Fallback model configuration is missing.");
    }

    if (!wllama) {
        if (Wllama && fallbackConfig.wasmPaths) {
            wllama = new Wllama(fallbackConfig.wasmPaths, { logger: LoggerWithoutDebug });
        } else {
            const compatEngine = await createCompatEngine("compat");
            wllama = {
                __compatEngine: compatEngine,
                async loadModelFromUrl(modelUrl, options = {}) {
                    return compatEngine.loadModel(modelUrl, {
                        maxSeqLen: Number(options.n_ctx) || 2048,
                        onProgress: ({ loaded, total, ratio }) => {
                            if (typeof options.progressCallback !== "function") return;
                            if (Number.isFinite(total) && total > 0) {
                                options.progressCallback({ loaded, total });
                                return;
                            }
                            const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
                            options.progressCallback({ loaded: safeRatio * 100, total: 100 });
                        }
                    });
                },
                async formatChat(promptArr) {
                    return Array.isArray(promptArr) ? promptArr : [];
                },
                async createCompletion(messagesOrPrompt, options = {}) {
                    const messages = Array.isArray(messagesOrPrompt)
                        ? messagesOrPrompt
                        : [{ role: "user", content: String(messagesOrPrompt ?? "") }];
                    const stream = await compatEngine.generateChat(messages, {
                        nPredict: Number(options.nPredict) || 512,
                        sampling: options.sampling || {}
                    });
                    const encoder = new TextEncoder();
                    let emitted = "";
                    let tokenIndex = 0;
                    for await (const chunk of stream) {
                        const currentText = String((chunk && chunk.currentText) || "");
                        if (!currentText) continue;
                        const delta = currentText.startsWith(emitted) ? currentText.slice(emitted.length) : currentText;
                        emitted = currentText;
                        if (!delta) continue;
                        if (typeof options.onNewToken === "function") {
                            const shouldContinue = options.onNewToken(tokenIndex++, encoder.encode(delta));
                            if (shouldContinue === false) break;
                        }
                    }
                }
            };
        }
    }

    await wllama.loadModelFromUrl(fallbackConfig.url, {
        n_ctx: targetCtx,
        progressCallback: ({ loaded, total }) => {
            if (container) container.classList.remove("hidden");
            if (total) {
                updateLocalProgress(bar, loaded / total);
            }
        }
    });

    localEngine = wllama;
    setLocalRuntimeState("wllama");
    loadedLocalModelId = String(modelConfig.activeModelId || "").trim();
    loadedLocalModelSource = String(fallbackConfig.url || "").trim();
    return localEngine;
}

async function startDownload() {
    const container = document.getElementById("progress-container");
    const bar = document.getElementById("progress-bar");
    applyLocalModelProfileToConfig();

    try {
        container.classList.remove("hidden");
        updateLocalProgress(bar, 0);
        const modelConfig = window.MODEL_CONFIG || {};
        const preferredRuntime = String(modelConfig.preferredRuntime || "").toLowerCase();
        let webllmError = null;
        
        if (preferredRuntime === "wllama") {
            await loadWllamaFallbackEngine(container, bar);
        } else {
            try {
                await loadWebLLMLocalEngine(container, bar);
            } catch (error) {
                webllmError = error;
                await loadWllamaFallbackEngine(container, bar);
            }
        }

        isModelDownloaded = true;
        isModelLoaded = true;
        isLocalActive = true;
        localStorage.setItem(getLocalDownloadStorageKey(), "true");
        container.classList.add("hidden");
        updateLocalBtnState();

        if (webllmError && localRuntime === "wllama") {
            console.warn("WebLLM initialization failed, using fallback runtime instead.", webllmError);
        }

    } catch (error) {
        if (error.message && error.message.includes("initialized")) {
            isModelDownloaded = true;
            isModelLoaded = true;
            isLocalActive = true;
            localStorage.setItem(getLocalDownloadStorageKey(), "true");
            container.classList.add("hidden");
            updateLocalBtnState();
            return;
        }
        
        container.classList.add("hidden");
        alert(error.message);
        isModelDownloaded = false;
        isModelLoaded = false;
        localEngine = null;
        setLocalRuntimeState(null);
        localStorage.removeItem(getLocalDownloadStorageKey());
    }
}

async function runLocalInference(promptArr, callback) {
    const modelConfig = window.MODEL_CONFIG || {};
    const webllmConfig = modelConfig.webllm || {};
    const activeProfile = typeof getActiveLocalModelProfile === "function" ? getActiveLocalModelProfile() : null;
    const isLightTier = !!(activeProfile && activeProfile.key === "light");
    const currentUiMode = String(
        window.currentMode
        || window.selectedMode
        || (document.body && document.body.getAttribute("data-ui-mode"))
        || "chat"
    ).toLowerCase();
    const isCodeMode = currentUiMode === "code";
    const isLightTierEffective = isLightTier && !isCodeMode;
    let renderedText = "";
    let previousDelta = "";
    let repetitionHits = 0;

    function normalizeRepeatText(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/\uFFFD+/g, "")
            .replace(/\s+/g, " ")
            .replace(/[.!?~"'\u2019\u201D\u3002\uFF01\uFF1F]+/g, "")
            .trim();
    }

    function normalizeRepeatKey(value) {
        return String(value || "")
            .replace(/\uFFFD+/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function sanitizeStreamText(value) {
        return String(value || "")
            .replace(/\uFFFD+/g, "")
            .replace(/\r\n/g, "\n");
    }

    function trimIncomingOverlap(baseText, incomingText) {
        const base = String(baseText || "");
        const incoming = String(incomingText || "");
        const maxOverlap = Math.min(base.length, incoming.length, 220);
        for (let size = maxOverlap; size > 0; size -= 1) {
            if (base.slice(-size) === incoming.slice(0, size)) {
                return incoming.slice(size);
            }
        }
        return incoming;
    }

    function hasRepeatedSentence(text) {
        const units = String(text || "")
            .split(/(?<=[.!?])\s+|\n+/)
            .map((part) => normalizeRepeatText(part))
            .filter(Boolean);
        if (units.length < 2) return false;
        const last = units[units.length - 1];
        const prev = units[units.length - 2];
        if (last.length >= 8 && last === prev) return true;
        if (units.length >= 3) {
            const prev2 = units[units.length - 3];
            if (last.length >= 8 && last === prev2) return true;
        }
        return false;
    }

    function hasRepeatedTailBlock(text) {
        const normalized = normalizeRepeatText(text);
        const maxUnit = Math.min(96, Math.floor(normalized.length / 2));
        for (let unitLen = maxUnit; unitLen >= 10; unitLen -= 1) {
            const tail = normalized.slice(-unitLen * 2);
            if (!tail || tail.length < unitLen * 2) continue;
            const block = tail.slice(0, unitLen);
            if (block && tail === block + block) return true;
        }
        return false;
    }

    function hasRepeatedListPattern(text) {
        const lines = String(text || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
        if (lines.length < 4) return false;
        const recent = lines
            .slice(-6)
            .map((line) => normalizeRepeatKey(
                line
                    .replace(/^\d+\.\s*/g, "")
                    .replace(/^[-*]\s*/g, "")
            ))
            .filter(Boolean);
        if (recent.length < 4) return false;
        return new Set(recent).size <= Math.ceil(recent.length / 2);
    }

    function getComparableRepeatLines(text) {
        return String(text || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => normalizeRepeatKey(
                line
                    .replace(/^\d+\.\s*/g, "")
                    .replace(/^[-*]\s*/g, "")
            ))
            .filter(Boolean);
    }

    function getComparableRepeatSentences(text) {
        return String(text || "")
            .split(/(?<=[.!?])\s+|\n+/)
            .map((part) => normalizeRepeatKey(
                String(part || "")
                    .replace(/^\d+\.\s*/g, "")
                    .replace(/^[-*]\s*/g, "")
            ))
            .filter(Boolean);
    }

    function findRepeatedSuffixSequence(items, minWindow = 2, maxWindow = 4) {
        if (!Array.isArray(items) || items.length < minWindow * 2) return null;
        const limit = Math.min(maxWindow, Math.floor(items.length / 2));
        for (let size = limit; size >= minWindow; size -= 1) {
            const suffix = items.slice(-size);
            if (!suffix.every(Boolean)) continue;
            for (let start = items.length - size * 2; start >= 0; start -= 1) {
                let matched = true;
                for (let index = 0; index < size; index += 1) {
                    if (items[start + index] !== suffix[index]) {
                        matched = false;
                        break;
                    }
                }
                if (matched) {
                    return { start, size };
                }
            }
        }
        return null;
    }

    function hasRepeatedBlockSequence(text) {
        return Boolean(
            findRepeatedSuffixSequence(getComparableRepeatLines(text), 2, 4) ||
            findRepeatedSuffixSequence(getComparableRepeatSentences(text), 2, 3)
        );
    }

    function trimRepeatedTail(text) {
        if (!text) return text;

        const lines = String(text)
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        if (lines.length >= 3) {
            const recent = lines.slice(-3).map(normalizeRepeatKey);
            if (recent[0] && recent[0] === recent[1] && recent[1] === recent[2]) {
                return String(text)
                    .replace(new RegExp("(?:\\n)?" + lines[lines.length - 1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$"), "")
                    .trimEnd();
            }
        }

        const windowSize = Math.min(80, Math.floor(String(text).length / 3));
        if (windowSize >= 24) {
            const a = normalizeRepeatKey(String(text).slice(-windowSize));
            const b = normalizeRepeatKey(String(text).slice(-windowSize * 2, -windowSize));
            if (a && a === b) {
                return String(text).slice(0, -windowSize).trimEnd();
            }
        }

        if (lines.length >= 4) {
            const keys = lines.map((line) => normalizeRepeatKey(
                line
                    .replace(/^\d+\.\s*/g, "")
                    .replace(/^[-*]\s*/g, "")
            ));
            const lastKey = keys[keys.length - 1];
            const prevKey = keys[keys.length - 2];
            const earlierLastIndex = keys.slice(0, -1).lastIndexOf(lastKey);
            const earlierPrevIndex = keys.slice(0, -2).lastIndexOf(prevKey);
            if (lastKey && prevKey && earlierLastIndex >= 0 && earlierPrevIndex >= 0) {
                if (keys.length - 1 - earlierLastIndex <= 4 || keys.length - 2 - earlierPrevIndex <= 4) {
                    return lines.slice(0, Math.min(earlierLastIndex, earlierPrevIndex) + 1).join("\n").trimEnd();
                }
            }
        }

        const repeatedLineSuffix = findRepeatedSuffixSequence(getComparableRepeatLines(text), 2, 4);
        if (repeatedLineSuffix && repeatedLineSuffix.size < lines.length) {
            return lines.slice(0, lines.length - repeatedLineSuffix.size).join("\n").trimEnd();
        }

        return text;
    }

    function trimDuplicateParagraphs(text) {
        const source = String(text || "").trimEnd();
        if (!source) return source;
        const separator = /\n{2,}/.test(source) ? "\n\n" : "\n";
        const blocks = source
            .split(separator === "\n\n" ? /\n{2,}/ : /\n+/)
            .map((block) => String(block || "").trim())
            .filter(Boolean);
        if (blocks.length < 2) return source;

        const seen = new Set();
        const kept = [];
        let removed = false;

        blocks.forEach((block) => {
            const key = normalizeRepeatKey(
                block
                    .replace(/^\d+\.\s*/gm, "")
                    .replace(/^[-*]\s*/gm, "")
            );
            const isComparable = key.length >= 32 || block.length >= 48;
            if (isComparable && seen.has(key)) {
                removed = true;
                return;
            }
            if (isComparable) seen.add(key);
            kept.push(block);
        });

        return removed ? kept.join(separator).trimEnd() : source;
    }

    function trimRestartedSentenceBlock(text) {
        const source = String(text || "").trimEnd();
        if (!source || source.length < 80) return source;

        const sentenceItems = (source.match(/[^.!?\n]+[.!?]?(?:\s+|$)|[^\n]+\n?/g) || [])
            .map((raw) => ({
                raw,
                key: normalizeRepeatKey(
                    String(raw || "")
                        .replace(/^\d+\.\s*/g, "")
                        .replace(/^[-*]\s*/g, "")
                )
            }))
            .filter((item) => item.key);
        if (sentenceItems.length < 4) return source;

        const firstKey = sentenceItems[0].key;
        if (firstKey.length < 24) return source;
        const seed = firstKey.slice(0, Math.min(36, firstKey.length));

        for (let index = 2; index < sentenceItems.length; index += 1) {
            const key = sentenceItems[index].key;
            if (!key || key.length < 16) continue;
            if (
                key === firstKey ||
                key.startsWith(seed) ||
                firstKey.startsWith(key.slice(0, Math.min(24, key.length)))
            ) {
                return sentenceItems.slice(0, index).map((item) => item.raw).join("").trimEnd();
            }
        }

        return source;
    }

    function trimRepeatedSentenceHistory(text) {
        const source = String(text || "").trimEnd();
        if (!source || source.length < 80) return source;
        const sentenceItems = (source.match(/[^.!?\n]+[.!?]?(?:\s+|$)|[^\n]+\n?/g) || [])
            .map((raw) => ({
                raw,
                key: normalizeRepeatKey(
                    String(raw || "")
                        .replace(/^\d+\.\s*/g, "")
                        .replace(/^[-*]\s*/g, "")
                )
            }))
            .filter((item) => item.key);
        if (sentenceItems.length < 4) return source;

        const seen = new Set();
        const kept = [];
        let removed = false;
        for (const item of sentenceItems) {
            const comparable = item.key.length >= 24 || String(item.raw || "").trim().length >= 32;
            if (comparable && seen.has(item.key)) {
                removed = true;
                break;
            }
            if (comparable) seen.add(item.key);
            kept.push(item.raw);
        }
        return removed ? kept.join("").trimEnd() : source;
    }

    function hasExcessiveRepetition(text) {
        const source = String(text || "");
        if (!source || source.length < 80) return false;

        const lines = source
            .split("\n")
            .map((line) => normalizeRepeatKey(line))
            .filter(Boolean);

        if (lines.length >= 3) {
            const recent = lines.slice(-3);
            if (recent[0] && recent[0] === recent[1] && recent[1] === recent[2]) {
                return true;
            }
        }

        const windowSize = Math.min(80, Math.floor(source.length / 3));
        if (windowSize >= 24) {
            const a = normalizeRepeatKey(source.slice(-windowSize));
            const b = normalizeRepeatKey(source.slice(-windowSize * 2, -windowSize));
            if (a && a === b) {
                return true;
            }
        }

        if (lines.length >= 6) {
            const recent = lines.slice(-6).map((line) =>
                line
                    .replace(/^\d+\.\s*/g, "")
                    .replace(/^[-*]\s*/g, "")
            );
            const uniqueRecent = new Set(recent.filter(Boolean));
            if (uniqueRecent.size <= 3) {
                return true;
            }
        }

        if (trimDuplicateParagraphs(source) !== source.trimEnd()) {
            return true;
        }

        if (trimRestartedSentenceBlock(source) !== source.trimEnd()) {
            return true;
        }
        if (trimRepeatedSentenceHistory(source) !== source.trimEnd()) {
            return true;
        }

        return hasRepeatedListPattern(source) || hasRepeatedBlockSequence(source);
    }

    function processRepeatedChunk(incomingText) {
        const previousRendered = renderedText;
        const sanitizedIncoming = sanitizeStreamText(incomingText);
        const trimmed = trimIncomingOverlap(renderedText, sanitizedIncoming);
        if (!trimmed) {
            repetitionHits += 1;
            return { blocked: true, stop: repetitionHits >= 2, text: previousRendered };
        }

        const normalizedDelta = normalizeRepeatText(trimmed);
        const normalizedPrevDelta = normalizeRepeatText(previousDelta);
        let nextText = trimRepeatedSentenceHistory(
            trimRestartedSentenceBlock(trimDuplicateParagraphs(trimRepeatedTail(renderedText + trimmed)))
        );

        if (normalizedDelta && normalizedDelta.length >= 12 && normalizedDelta === normalizedPrevDelta) {
            repetitionHits += 1;
            return { blocked: true, stop: repetitionHits >= 2, text: previousRendered };
        }

        if (!nextText) {
            repetitionHits += 1;
            return { blocked: true, stop: repetitionHits >= 2, text: previousRendered };
        }

        if (
            hasRepeatedSentence(nextText) ||
            hasRepeatedTailBlock(nextText) ||
            hasRepeatedListPattern(nextText) ||
            hasRepeatedBlockSequence(nextText) ||
            hasExcessiveRepetition(nextText)
        ) {
            repetitionHits += 1;
            nextText = trimRepeatedSentenceHistory(
                trimRestartedSentenceBlock(trimDuplicateParagraphs(trimRepeatedTail(nextText)))
            );
            if (!nextText || normalizeRepeatKey(nextText) === normalizeRepeatKey(previousRendered)) {
                return { blocked: true, stop: repetitionHits >= 2, text: previousRendered };
            }
        } else {
            repetitionHits = 0;
        }

        previousDelta = trimmed;
        renderedText = nextText;
        if (renderedText === previousRendered) {
            return { blocked: true, stop: repetitionHits >= 2, text: previousRendered };
        }
        return { blocked: false, stop: false, text: renderedText, replace: true };
    }

    if (isLocalActive && !isModelLoaded) {
        await startDownload();
    }

    if (localRuntime === "webllm" && localEngine) {
        const messages = mapPromptMessagesForLocalEngine(promptArr);
        if (messages.length === 0) return;

        if (typeof localEngine.resetChat === "function") {
            try {
                await localEngine.resetChat();
            } catch (error) {
                console.warn("Failed to reset local WebLLM chat state.", error);
            }
        }

        const stream = await localEngine.chat.completions.create({
            messages,
            temperature: webllmConfig.temperature ?? (isLightTierEffective ? 0.18 : 0.65),
            top_p: webllmConfig.topP ?? (isLightTierEffective ? 0.78 : 0.9),
            max_tokens: webllmConfig.maxTokens ?? (isLightTierEffective ? 48 : 4096),
            stream: true
        });

        for await (const chunk of stream) {
            if (stopSignal) {
                if (typeof localEngine.interruptGenerate === "function") {
                    localEngine.interruptGenerate();
                }
                break;
            }

            const delta = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta
                ? chunk.choices[0].delta.content
                : "";

            if (delta) {
                const filtered = processRepeatedChunk(delta);
                if (filtered.blocked) {
                    if (filtered.stop && typeof localEngine.interruptGenerate === "function") {
                        localEngine.interruptGenerate();
                        break;
                    }
                    continue;
                }
                callback(filtered.text, { replace: filtered.replace === true });
            }
        }
        return;
    }
    
    const formatted = await wllama.formatChat(promptArr, true);
    
    const decoder = new TextDecoder("utf-8");
    
    await wllama.createCompletion(formatted, {
        ...(isLightTierEffective ? { nPredict: 32 } : {}),
        sampling: isLightTierEffective
            ? { temp: 0.18, top_k: 12, top_p: 0.78, penalty_repeat: 1.22 }
            : { temp: 0.7, top_k: 40, top_p: 0.9 },
        onNewToken: (tokenIndex, tokenBytes) => {
            if (stopSignal) return false;
            const filtered = processRepeatedChunk(decoder.decode(tokenBytes, { stream: true }));
            if (filtered.blocked) {
                return filtered.stop !== true;
            }
            callback(filtered.text, { replace: filtered.replace === true });
            return true;
        }
    });
}

function showLoader(show) {
    const overlay = document.getElementById("loader-overlay");
    if (!overlay) return;

    const effectiveMode = String(
        currentMode
        || (document.body && document.body.getAttribute("data-ui-mode"))
        || "chat"
    ).toLowerCase();
    const suppressBlockingOverlayModes = new Set(["chat", "search", "code", "blog", "voice", "translate"]);
    const shouldSuppressOverlay = suppressBlockingOverlayModes.has(effectiveMode);

    if (shouldSuppressOverlay) {
        overlay.classList.remove("active");
        return;
    }

    if (show) {
        overlay.classList.add("active");
    } else {
        overlay.classList.remove("active");
    }
}

function stopGeneration() {
    if (isGenerating || window.__ISAI_MAIN_GENERATING__) {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        if (localRuntime === "webllm" && localEngine && typeof localEngine.interruptGenerate === "function") {
            localEngine.interruptGenerate();
        }
        stopSignal = true;
        setMainGeneratingState(false);
        showLoader(false);
        if (typeof window.updateMainSubmitButtonState === "function") {
            window.updateMainSubmitButtonState();
        }
    }
}

function decodeHtmlEntitiesLocal(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(value ?? "");
    return textarea.value;
}

function extractPlainTextLocal(value) {
    const normalized = trimRepeatedDisplayText(String(value ?? ""))
        .replace(/<think>[\s\S]*?(<\/think>|$)/gi, " ")
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
    const holder = document.createElement("div");
    holder.innerHTML = normalized;
    return String(holder.textContent || holder.innerText || normalized).replace(/\s+/g, " ").trim();
}

function sanitizeAiHtmlLocal(value) {
    return String(value ?? "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<img\b[^>]*>/gi, "")
        .replace(/\son\w+=(["']).*?\1/gi, "")
        .replace(/\son\w+=([^\s>]+)/gi, "")
        .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
}

function formatAiBubbleContent(content) {
    const raw = String(content ?? "");
    // IMPORTANT:
    // Do not decode HTML entities globally here.
    // If we decode first, code blocks that intentionally contain `&lt;...&gt;`
    // become real tags and get rendered instead of shown as code.
    const sanitizedRaw = sanitizeAiHtmlLocal(raw);

    if (/<\/?[a-z][^>]*>/i.test(sanitizedRaw)) {
        return sanitizedRaw;
    }

    // Preserve legacy encoded line breaks only.
    return sanitizedRaw
        .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
        .replace(/\n/g, "<br>");
}

function normalizeDisplayRepeatKey(value) {
    return String(value || "")
        .replace(/<think>[\s\S]*?(<\/think>|$)/gi, " ")
        .replace(/\uFFFD+/g, "")
        .replace(/^\d+\.\s*/g, "")
        .replace(/^[-*]\s*/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function splitSentenceChunksForDisplay(text) {
    return (String(text || "").match(/[^.!?\n]+[.!?]?(?:\s+|$)|[^\n]+\n?/g) || [])
        .map((part) => ({
            raw: part,
            key: normalizeDisplayRepeatKey(part)
        }))
        .filter((part) => part.key);
}

function findRepeatedSuffixSequenceForDisplay(items, minWindow = 2, maxWindow = 4) {
    if (!Array.isArray(items) || items.length < minWindow * 2) return null;
    const limit = Math.min(maxWindow, Math.floor(items.length / 2));
    for (let size = limit; size >= minWindow; size -= 1) {
        const suffix = items.slice(-size);
        if (!suffix.every((item) => item && item.key)) continue;
        for (let start = items.length - size * 2; start >= 0; start -= 1) {
            let matched = true;
            for (let index = 0; index < size; index += 1) {
                if (items[start + index].key !== suffix[index].key) {
                    matched = false;
                    break;
                }
            }
            if (matched) return { start, size };
        }
    }
    return null;
}

function trimRestartedPrefixBlock(text) {
    let value = String(text ?? "").trimEnd();
    if (!value || value.length < 80) return value;

    const plain = String(value)
        .replace(/<think>[\s\S]*?(<\/think>|$)/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (plain.length < 80) return value;

    const prefixSizes = [120, 96, 84, 72, 60, 48, 36];
    for (const size of prefixSizes) {
        if (plain.length < size * 2) continue;
        const prefix = plain.slice(0, size).trim();
        if (prefix.length < Math.min(32, size)) continue;
        const restartIndex = plain.indexOf(prefix, Math.max(size + 12, Math.floor(size * 1.25)));
        if (restartIndex < 0) continue;

        const uniqueChars = new Set(prefix.replace(/\s+/g, ""));
        if (uniqueChars.size < 8) continue;

        const cutSnippet = plain.slice(restartIndex, restartIndex + Math.min(160, prefix.length + 40)).trim();
        if (!cutSnippet || cutSnippet.length < Math.min(28, Math.floor(size * 0.6))) continue;

        const rawRestartIndex = value.indexOf(cutSnippet);
        if (rawRestartIndex > 0) {
            return value.slice(0, rawRestartIndex).trimEnd();
        }
    }

    return value;
}

function trimRestartedDisplaySentenceBlock(text) {
    const source = String(text ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .trimEnd();
    if (!source || source.length < 80) return source;

    const sentenceItems = (source.match(/[^.!?\n]+[.!?]?(?:\s+|$)|[^\n]+\n?/g) || [])
        .map((raw) => ({
            raw,
            key: normalizeDisplayRepeatKey(
                String(raw || "")
                    .replace(/^\d+\.\s*/g, "")
                    .replace(/^[-*]\s*/g, "")
            )
        }))
        .filter((item) => item.key);
    if (sentenceItems.length < 4) return source;

    const firstKey = sentenceItems[0].key;
    if (firstKey.length < 24) return source;
    const seed = firstKey.slice(0, Math.min(36, firstKey.length));

    for (let index = 2; index < sentenceItems.length; index += 1) {
        const key = sentenceItems[index].key;
        if (!key || key.length < 16) continue;
        if (
            key === firstKey ||
            key.startsWith(seed) ||
            firstKey.startsWith(key.slice(0, Math.min(24, key.length)))
        ) {
            return sentenceItems.slice(0, index).map((item) => item.raw).join("").trimEnd();
        }
    }

    return source;
}

function trimRepeatedDisplaySentenceHistory(text) {
    const source = String(text ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .trimEnd();
    if (!source || source.length < 80) return source;

    const sentenceItems = (source.match(/[^.!?\n]+[.!?]?(?:\s+|$)|[^\n]+\n?/g) || [])
        .map((raw) => ({
            raw,
            key: normalizeDisplayRepeatKey(
                String(raw || "")
                    .replace(/^\d+\.\s*/g, "")
                    .replace(/^[-*]\s*/g, "")
            )
        }))
        .filter((item) => item.key);
    if (sentenceItems.length < 4) return source;

    const seen = new Set();
    const kept = [];
    let removed = false;
    for (const item of sentenceItems) {
        const comparable = item.key.length >= 24 || String(item.raw || "").trim().length >= 32;
        if (comparable && seen.has(item.key)) {
            removed = true;
            break;
        }
        if (comparable) seen.add(item.key);
        kept.push(item.raw);
    }

    return removed ? kept.join("").trimEnd() : source;
}

function trimDuplicateDisplayParagraphs(text) {
    const source = String(text ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .trimEnd();
    if (!source) return source;
    const separator = /\n{2,}/.test(source) ? "\n\n" : "\n";
    const blocks = source
        .split(separator === "\n\n" ? /\n{2,}/ : /\n+/)
        .map((block) => String(block || "").trim())
        .filter(Boolean);
    if (blocks.length < 2) return source;

    const seen = new Set();
    const kept = [];
    let removed = false;

    blocks.forEach((block) => {
        const key = normalizeDisplayRepeatKey(
            block
                .replace(/^\d+\.\s*/gm, "")
                .replace(/^[-*]\s*/gm, "")
        );
        const isComparable = key.length >= 32 || block.length >= 48;
        if (isComparable && seen.has(key)) {
            removed = true;
            return;
        }
        if (isComparable) seen.add(key);
        kept.push(block);
    });

    return removed ? kept.join(separator).trimEnd() : source;
}

function trimRepeatedDisplayText(text) {
    let value = String(text ?? "").trimEnd();
    if (!value) return value;
    value = trimRestartedPrefixBlock(value);
    value = trimRestartedDisplaySentenceBlock(value);
    value = trimDuplicateDisplayParagraphs(value);
    value = trimRepeatedDisplaySentenceHistory(value);

    const rawLines = value.split("\n");
    const lineItems = rawLines
        .map((line) => ({ raw: line, key: normalizeDisplayRepeatKey(line) }))
        .filter((item) => item.key);
    const repeatedLines = findRepeatedSuffixSequenceForDisplay(lineItems, 2, 4);
    if (repeatedLines && repeatedLines.size < lineItems.length) {
        const remaining = lineItems.slice(0, lineItems.length - repeatedLines.size).map((item) => item.raw);
        value = remaining.join("\n").trimEnd();
    }

    const sentenceItems = splitSentenceChunksForDisplay(value);
    const repeatedSentences = findRepeatedSuffixSequenceForDisplay(sentenceItems, 2, 3);
    if (repeatedSentences && repeatedSentences.size < sentenceItems.length) {
        value = sentenceItems
            .slice(0, sentenceItems.length - repeatedSentences.size)
            .map((item) => item.raw)
            .join("")
            .trimEnd();
    }

    const collapsed = normalizeDisplayRepeatKey(value);
    const maxUnit = Math.min(180, Math.floor(collapsed.length / 2));
    for (let size = maxUnit; size >= 24; size -= 1) {
        const tail = collapsed.slice(-size * 2);
        if (tail && tail.length === size * 2) {
            const block = tail.slice(0, size);
            if (block && tail === block + block) {
                value = value.slice(0, Math.max(0, value.length - size)).trimEnd();
                break;
            }
        }
    }

    value = trimRepeatedDisplaySentenceHistory(
        trimRestartedDisplaySentenceBlock(trimDuplicateDisplayParagraphs(value))
    );
    return trimRestartedPrefixBlock(value);
}

function isImageErrorMessageLocal(value) {
    return /^Image Error:/i.test(String(value ?? "").trim());
}

function imageErrorIconHtmlLocal(message) {
    const safeMessage = String(message ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .trim() || "Image generation failed";
    return `<span class="image-error-icon" title="${safeMessage}" aria-label="${safeMessage}"><i class="ri-image-line"></i><i class="ri-close-circle-fill image-error-icon-badge"></i></span>`;
}

function genericErrorIconHtmlLocal(message) {
    const safeMessage = String(message ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .trim() || "Request failed";
    return `<span class="image-error-icon" title="${safeMessage}" aria-label="${safeMessage}"><i class="ri-error-warning-line"></i><i class="ri-close-circle-fill image-error-icon-badge"></i></span>`;
}

function appendMsg(role, content) {
    const chatBox = document.getElementById("chat-box");
    
    if (chatBox.childElementCount > 50) chatBox.removeChild(chatBox.firstElementChild);
    if (chatBox.childElementCount === 0) {
        const spacer = document.createElement("div");
        spacer.style.marginTop = "auto";
        chatBox.appendChild(spacer);
    }

    const bubble = document.createElement("div");
    if (role === "user") {
        bubble.className = "chat-bubble-user self-end px-3 py-2 rounded-[24px] max-w-[85%] shadow mb-3 text-[13px] break-words ml-auto";
        bubble.style.backgroundColor = "var(--accent, #3b82f6)";
        bubble.style.color = "var(--accent-text, #ffffff)";
    } else {
        bubble.className = "chat-bubble-ai self-start px-3 py-2 rounded-[24px] max-w-[85%] mb-3 text-[13px] break-words leading-relaxed shadow-sm";
        bubble.style.backgroundColor = "var(--bg-island, #ffffff)";
        bubble.style.color = "var(--text-main, #333333)";
        if (currentMode === "search") {
            bubble.classList.add("search-result-bubble");
            bubble.style.backgroundColor = "#ffffff";
            bubble.style.color = "#111827";
            bubble.style.border = "1px solid rgba(15, 23, 42, 0.12)";
            bubble.style.boxShadow = "0 14px 30px rgba(15, 23, 42, 0.10)";
        } else if (currentMode === "translate") {
            bubble.style.backgroundColor = "#ffffff";
            bubble.style.color = "#111111";
        }
    }

    if (role === "user") {
        const safeContent = String(content ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        bubble.innerHTML = safeContent.replace(/\n/g, "<br>");
    } else {
        const isError = role === "error";
        const imageError = isError && isImageErrorMessageLocal(content);
        if (isError) {
            bubble.className = "chat-bubble-image-error";
            bubble.style.backgroundColor = "";
            bubble.style.color = "";
            bubble.style.border = "";
            bubble.style.boxShadow = "";
            bubble.innerHTML = imageError ? imageErrorIconHtmlLocal(content) : genericErrorIconHtmlLocal(content);
        } else {
            if (isLocalWelcomeGreeting(content)) {
                decorateLocalWelcomeBubbleIfNeeded(bubble, content);
            } else {
                bubble.innerHTML = formatAiBubbleContent(content);
                decorateLocalWelcomeBubbleIfNeeded(bubble, content);
            }
        }
    }

    chatBox.appendChild(bubble);
    scrollBottom();
    return bubble;
}

function appendImg(base64Data, promptText) {
    const chatBox = document.getElementById("chat-box");
    const container = document.createElement("div");
    
    container.className = "bg-[#1a1a1a] border border-white/5 rounded-[26px] p-2 mb-6 shadow-xl self-start max-w-sm";
    
    container.innerHTML = `
        <img src="data:image/jpeg;base64,${base64Data}" 
             class="w-full rounded-[20px] block cursor-zoom-in hover:opacity-90 transition-opacity" 
             onclick="openImageModal('data:image/jpeg;base64,${base64Data}', '${promptText.replace(/'/g, "\\'")}')">
        
        <div class="flex justify-between items-center pt-3 px-2 pb-1">
            <div class="flex flex-col overflow-hidden mr-3">
                <span class="text-[11px] text-gray-400 font-medium truncate tracking-tight uppercase opacity-50 mb-0.5">Prompt</span>
                <span class="text-[13px] text-gray-200 font-bold truncate leading-tight">${promptText}</span>
            </div>
            
            <a href="data:image/jpeg;base64,${base64Data}" download="isai-art.jpg" 
               class="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/5 text-gray-300 hover:bg-white hover:text-black transition-all" 
               onclick="event.stopPropagation()">
                <i class="ri-download-2-line text-lg"></i>
            </a>
        </div>
    `;
    
    chatBox.appendChild(container);
    scrollBottom();
}

function appendGif(blob, promptText) {
    const url = URL.createObjectURL(blob);
    const chatBox = document.getElementById("chat-box");
    const container = document.createElement("div");
    
    container.className = "self-start bg-white/30 p-2 rounded-2xl rounded-tl-sm max-w-sm mb-2 cursor-pointer hover:opacity-90 transition";
    container.onclick = () => window.openPreview(url);
    
    container.innerHTML = `
        <div class="relative rounded-lg overflow-hidden mb-2">
            <img src="${url}" class="w-full h-auto object-cover">
            <div class="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm">GIF</div>
        </div>
        <div class="flex justify-end text-[10px] text-gray-400 px-1">
            <a href="${url}" download="ai_video.gif" class="text-white transition" onclick="event.stopPropagation()">
                <i class="ri-download-line text-xl"></i>
            </a>
        </div>`;
        
    chatBox.appendChild(container);
    scrollBottom();
}

function addSourcesToBubble(bubbleElement, sources) {
    if (!bubbleElement || !Array.isArray(sources) || sources.length === 0) return;

    const uniqueSources = sources.filter((src, index, arr) => {
        if (!src || !src.url) return false;
        return arr.findIndex((item) => item && item.url === src.url) === index;
    }).slice(0, 5);

    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const domainLabel = (url) => {
        try {
            return new URL(url).hostname.replace(/^www\./i, "");
        } catch (error) {
            return url;
        }
    };

    let html = '<div class="mt-4 pt-3 border-t border-black/10 flex flex-wrap gap-2 items-center">';

    uniqueSources.forEach((src) => {
        const favicon = "https://www.google.com/s2/favicons?sz=64&domain_url=" + encodeURIComponent(src.url);
        const label = src.title || src.url;
        const host = domainLabel(src.url);
        html += `<a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" class="search-source-link inline-flex items-center gap-1.5 max-w-[150px] rounded-full bg-black/[0.04] border border-black/[0.08] px-2.5 py-1 text-[11px] font-medium text-[#111827] hover:bg-black/[0.08] transition" title="${escapeHtml(label)}"><img src="${favicon}" class="w-3.5 h-3.5 opacity-85" alt=""><span class="truncate">${escapeHtml(host)}</span></a>`;
    });

    html += "</div>";
    bubbleElement.innerHTML += html;
}

function scrollBottom() {
    const chatBox = document.getElementById("chat-box");
    requestAnimationFrame(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function parseMarkdownLocal(text, isFinished = false) {
    window.extractedCodes =[];
    
    // 1. ??룹퍟 ?⑥눘??<think>...</think>) ?브쑬??
    let thinkContent = "";
    let mainContent = text;
    
    const thinkStart = mainContent.indexOf("<think>");
    if (thinkStart !== -1) {
        const thinkEnd = mainContent.indexOf("</think>", thinkStart);
        if (thinkEnd !== -1) {
            thinkContent = mainContent.substring(thinkStart + 7, thinkEnd).trim();
            mainContent = mainContent.substring(0, thinkStart) + mainContent.substring(thinkEnd + 9);
        } else {
            thinkContent = mainContent.substring(thinkStart + 7).trim();
            mainContent = mainContent.substring(0, thinkStart);
        }
    }

	let html = "";
    if (thinkContent) {
        const isThinking = (!isFinished) && (text.indexOf("</think>") === -1);
        const formattedThink = thinkContent.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
        
        // Show think content by default whenever it exists (user can still collapse manually).
        const displayStyle = "block";
        const iconRotate = "rotate(180deg)";
        
        html += `
        <div class="my-3 rounded-xl border border-white/10 bg-[#1e1e1e] shadow-sm overflow-hidden w-full max-w-full transition-all">
            <div class="flex items-center justify-between px-4 py-2 bg-white/5 cursor-pointer hover:bg-white/10 transition select-none" onclick="window.toggleThink(this)">
                <div class="text-gray-400 font-bold text-[12px] uppercase tracking-wider">
                    Thinking Process
                </div>
                <i class="toggle-icon ri-arrow-down-s-line text-gray-500 transition-transform duration-200 text-lg" style="transform: ${iconRotate};"></i>
            </div>
            <div class="p-4 text-gray-500 bg-black/20 border-t border-white/5 text-[13px] leading-relaxed italic break-words font-light" style="display: ${displayStyle};">
                ${formattedThink}
            </div>
        </div>`;
    }

    // 2. ?袁⑷퍥 HTML ??곷뮞?냈??꾨늄 (??됱읈?關?? ??HTML????륁뵠筌왖 UI??筌띿빓???ㅲ봺??野??癒?퓝 筌△뫀??
    let processedMain = mainContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const blocks =[];
    let counter = 0;

    function createBlockUI(lang, code, isStreaming) {
        counter++;
        lang = lang || "text";
        
        // ?怨쀫? ?꾨뗀諭??癒?탵??獄?癰귣벊沅?疫꿸퀡????袁る퉸 ?癒?궚 ?꾨뗀諭뜻에?癰귣벀???뤿연 獄쏄퀣肉??????
        let cleanCode = code.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        window.extractedCodes.push({ 
            lang: lang, 
            content: cleanCode, 
            name: `File ${window.extractedCodes.length + 1} (${lang})` 
        });

        const streamingClass = isStreaming ? " is-streaming" : "";
        const languageLabel = lang ? `<div class="chat-code-label">${lang}</div>` : "";
        const uiBlock = `${languageLabel}<pre class="chat-code-block${streamingClass}"><code>${code}</code></pre>`;        
        blocks.push(uiBlock);
        return "###CODE_BLOCK_" + (blocks.length - 1) + "###";
    }

    // 3. ?袁⑹읈?????뿺 ?꾨뗀諭??됰뗀以?筌ｌ꼶??
    processedMain = processedMain.replace(/```([a-zA-Z0-9_\-\+]*)[ \t]*\n?([\s\S]*?)```/g, (match, lang, code) => {
        return createBlockUI(lang, code, false);
    });

    // 4. ?臾믨쉐 餓λ쵐????袁⑹춦 ???뿳筌왖 ??? ?꾨뗀諭??됰뗀以?筌ｌ꼶??(??쎈뱜?귐됱빪 ????
    processedMain = processedMain.replace(/```([a-zA-Z0-9_\-\+]*)[ \t]*\n?([\s\S]*)$/g, (match, lang, code) => {
        return createBlockUI(lang, code, !isFinished);
    });

    // 5. ?紐껋뵬???꾨뗀諭?獄?疫꿸퀡??筌띾뜇寃??쇱뒲 癰궰??
    processedMain = processedMain.replace(/`([^`]+)`/g, (match, inlineCode) => {
        return `<code class="bg-black/[0.06] px-1.5 py-0.5 rounded text-[#111827] font-bold font-mono text-sm border border-black/[0.08]">${inlineCode}</code>`;
    })
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#111827]">$1</strong>')
    .replace(/^###\s+(.*)$/gm, '<h3 class="text-lg font-bold text-[#111827] mb-2 mt-4">$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<b class="font-bold text-[#111827] text-base mt-3 mb-1 block">$1</b>')
    .replace(/^[\-\*]\s+(.*)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/\n/g, "<br>");

    // 6. ??밴쉐??紐?UI ?됰뗀以???癒?삋 ?袁⑺뒄????뚯뿯
    blocks.forEach((blockHtml, index) => {
        processedMain = processedMain.replace("###CODE_BLOCK_" + index + "###", blockHtml);
    });

    return html + processedMain;
}

function escapeHtmlForBubbleLocal(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function looksLikeCodeOrHtmlResponseLocal(value) {
    const text = String(value ?? "").trim();
    if (!text) return false;
    return /```/.test(text)
        || /(?:^|\n)\s*(<!doctype html|<html\b|<head\b|<body\b|<script\b|<style\b|<canvas\b|<\?php|const\b|let\b|var\b|function\b|class\b|import\b|export\b)/i.test(text);
}

function detectCodeBlockLanguageLocal(value) {
    const text = String(value ?? "").trimStart();
    if (/^<!doctype html|^<html\b|^<head\b|^<body\b|^<script\b|^<style\b|^<canvas\b/i.test(text)) return "html";
    if (/^<\?php/i.test(text)) return "php";
    if (/^(const|let|var|function|class|import|export)\b/.test(text)) return "javascript";
    return "text";
}

function normalizeCodeLikeResponseForBubbleLocal(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (/```/.test(text)) return text;
    const startMatch = text.match(/(?:^|\n)\s*(<!doctype html|<html\b|<head\b|<body\b|<script\b|<style\b|<canvas\b|<\?php|const\b|let\b|var\b|function\b|class\b|import\b|export\b)/i);
    if (!startMatch) return text;

    const startIndex = text.search(/(?:^|\n)\s*(<!doctype html|<html\b|<head\b|<body\b|<script\b|<style\b|<canvas\b|<\?php|const\b|let\b|var\b|function\b|class\b|import\b|export\b)/i);
    if (startIndex < 0) return text;

    const prefix = text.slice(0, startIndex).trimEnd();
    const codeText = text.slice(startIndex).trim();
    const lang = detectCodeBlockLanguageLocal(codeText);
    const fenced = "```" + lang + "\n" + codeText + "\n```";
    return prefix ? (prefix + "\n\n" + fenced) : fenced;
}

function renderAssistantBubbleContentLocal(text, isFinished = false, options = {}) {
    const normalizedText = (!!(options && options.forcePlainText) || looksLikeCodeOrHtmlResponseLocal(text))
        ? normalizeCodeLikeResponseForBubbleLocal(text)
        : String(text ?? "");
    return parseMarkdownLocal(normalizedText, isFinished);
}

function setAssistantBubbleBodyLocal(bubble, text, options = {}) {
    if (!bubble) return;
    const rawText = trimRepeatedDisplayText(String(text ?? ""));
    const plainText = extractPlainTextLocal(rawText);
    if (!plainText) {
        const locale = String(document.documentElement.lang || navigator.language || "en").toLowerCase();
        const fallback = locale.startsWith("ko")
            ? "응답을 불러오지 못했습니다."
            : (locale.startsWith("ja") ? "応答を読み込めませんでした。" : "I could not load a response.");
        bubble.textContent = fallback;
        return;
    }
    bubble.style.whiteSpace = "";
    bubble.style.wordBreak = "";
    bubble.style.fontFamily = "";
    bubble.style.lineHeight = "";
    bubble.innerHTML = renderAssistantBubbleContentLocal(rawText, !!options.isFinished, options);
}

window.currentImagePrompt = "";

window.openPreview = function(url) {
    const container = document.getElementById("img-preview-container");
    const img = document.getElementById("preview-img");
    const appContainer = document.getElementById("app-container");
    const centerApp = document.getElementById("center-app-name");

    if (container && img) {
        if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("http")) {
            img.src = url;
        } else {
            img.src = `data:image/jpeg;base64,${url}`;
        }
        
        container.style.setProperty("display", "block", "important");
        container.classList.add("active");
        
        if (appContainer) appContainer.style.setProperty("display", "none", "important");
        if (centerApp) centerApp.style.setProperty("display", "none", "important");
    }
};

window.closePreview = function() {
    const container = document.getElementById("img-preview-container");
    const appContainer = document.getElementById("app-container");
    const centerApp = document.getElementById("center-app-name");

    if (container) {
        container.classList.remove("active");
        container.style.setProperty("display", "none", "important");
    }
    
    if (appContainer) {
        appContainer.style.opacity = "1";
    }
    
    if (centerApp) {
        centerApp.style.setProperty("display", "block", "important");
        centerApp.style.opacity = "1";
    }

    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("v")) {
        currentUrl.searchParams.delete("v");
        window.history.pushState({}, "", currentUrl.pathname);
    }
};

window.extractedCodes =[];

window.openFullEditor = function(blockId) {
    const el = document.getElementById(blockId);
    if (el) {
        const text = el.innerText;
        const codeEditor = document.getElementById("code-editor");
        const rightPanel = document.getElementById("right-panel");
        const codeTabs = document.getElementById("code-tabs");
        const rightPanelOriginAnchor = document.getElementById("right-panel-origin-anchor");
        const desktopCodePanelHost = document.getElementById("desktop-code-panel-host");
        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        const mobileCodeMode = vw <= 900;
        const desktopCodeMode = vw > 900;
        const codePanelGridColumn = vw <= 1180 ? "1 / span 2" : "1 / span 4";
        const codePanelGridRow = vw <= 900 ? "2" : (vw <= 1180 ? "3" : "2");
        const codePanelMinHeight = vw <= 900 ? "240px" : "320px";
        const codePanelMaxHeight = vw <= 900 ? "360px" : "520px";
        if (codeEditor) {
            codeEditor.value = text;
            scheduleCodeBlockActionsRender();
        }
        if (codeTabs) {
            codeTabs.innerHTML = '<button type="button" class="code-tab-btn active" title="Current Code"><span class="code-tab-icon"><i class="ri-code-block"></i></span><span class="code-tab-label">CODE</span></button>';
        }

        if (typeof window.syncInlineCodePanel === "function") {
            window.syncInlineCodePanel("code");
        } else {
            if (rightPanel) {
                if (document.body) document.body.setAttribute("data-ui-mode", "code");
                document.body.classList.remove("desktop-code-stage");
                document.body.classList.toggle("mode-code", mobileCodeMode);
                document.body.classList.toggle("mobile-code-stacked", mobileCodeMode);
                document.body.classList.toggle("desktop-code-open", desktopCodeMode);
                document.body.classList.toggle("desktop-code-panel-mounted", desktopCodeMode);
                rightPanel.classList.toggle("mobile-active", mobileCodeMode);
                rightPanel.classList.remove("hidden");
                if (rightPanelOriginAnchor && rightPanelOriginAnchor.parentElement && desktopCodePanelHost) {
                    if (desktopCodeMode) {
                        desktopCodePanelHost.style.display = "block";
                        desktopCodePanelHost.style.width = "100%";
                        desktopCodePanelHost.style.minWidth = "0";
                        desktopCodePanelHost.style.minHeight = codePanelMinHeight;
                        if (rightPanel.parentElement !== desktopCodePanelHost) {
                            desktopCodePanelHost.appendChild(rightPanel);
                        }
                    } else if (rightPanel.parentElement !== rightPanelOriginAnchor.parentElement) {
                        rightPanelOriginAnchor.parentElement.insertBefore(rightPanel, rightPanelOriginAnchor.nextSibling);
                    }
                }
                rightPanel.style.display = "flex";
                rightPanel.style.visibility = "visible";
                rightPanel.style.opacity = "1";
                rightPanel.style.width = "100%";
                rightPanel.style.minWidth = "0";
                rightPanel.style.maxWidth = "100%";
                if (mobileCodeMode) {
                    rightPanel.style.gridRow = codePanelGridRow;
                    rightPanel.style.gridColumn = codePanelGridColumn;
                } else {
                    rightPanel.style.removeProperty("grid-row");
                    rightPanel.style.removeProperty("grid-column");
                }
                rightPanel.style.height = "auto";
                rightPanel.style.minHeight = codePanelMinHeight;
                rightPanel.style.maxHeight = codePanelMaxHeight;
                rightPanel.style.overflow = "hidden";
                rightPanel.style.borderTop = "1px solid rgba(255, 255, 255, 0.06)";
            }
        }

        if (rightPanel) {
            setTimeout(() => {
                try {
                    (desktopCodeMode && desktopCodePanelHost ? desktopCodePanelHost : rightPanel).scrollIntoView({ behavior: "smooth", block: "start" });
                } catch (error) {}
            }, vw <= 900 ? 90 : 20);
        }
    }
};

window.closeFullEditor = function() {
    const rightPanel = document.getElementById("right-panel");
    if (rightPanel) rightPanel.classList.remove("mobile-active");
    if (document.body) document.body.classList.remove("mobile-code-stacked");
    if (typeof currentMode !== "undefined" && currentMode === "code" && typeof setMode === "function") {
        setMode("chat");
        return;
    }
    document.body.classList.remove("mode-code");
    document.body.classList.remove("mobile-code-stacked");
    document.body.classList.remove("desktop-code-stage");
    if (document.body) document.body.setAttribute("data-ui-mode", "chat");
    document.body.classList.remove("desktop-code-open");
    document.body.classList.remove("desktop-code-panel-mounted");
    if (rightPanel) {
        rightPanel.classList.remove("mobile-active");
        rightPanel.style.removeProperty("display");
        rightPanel.style.removeProperty("visibility");
        rightPanel.style.removeProperty("opacity");
        rightPanel.style.removeProperty("width");
        rightPanel.style.removeProperty("min-width");
        rightPanel.style.removeProperty("max-width");
        rightPanel.style.removeProperty("grid-row");
        rightPanel.style.removeProperty("grid-column");
        rightPanel.style.removeProperty("height");
        rightPanel.style.removeProperty("min-height");
        rightPanel.style.removeProperty("max-height");
        rightPanel.style.removeProperty("overflow");
        rightPanel.style.removeProperty("border-top");
        rightPanel.classList.add("hidden");
    }
    const rightPanelOriginAnchor = document.getElementById("right-panel-origin-anchor");
    const desktopCodePanelHost = document.getElementById("desktop-code-panel-host");
    if (rightPanel && desktopCodePanelHost) {
        desktopCodePanelHost.style.display = "none";
        desktopCodePanelHost.style.removeProperty("min-height");
        desktopCodePanelHost.style.removeProperty("visibility");
        desktopCodePanelHost.style.removeProperty("opacity");
        desktopCodePanelHost.style.removeProperty("overflow");
    }
    if (rightPanel && rightPanelOriginAnchor && rightPanelOriginAnchor.parentElement && rightPanel.parentElement !== rightPanelOriginAnchor.parentElement) {
        rightPanelOriginAnchor.parentElement.insertBefore(rightPanel, rightPanelOriginAnchor.nextSibling);
    }
};

let codeFiles =[];
let activeFileIndex = 0;
let scopedCodeBlocks =[];
let structuredCodeBlocksState = [];
let pendingScopedCodeAttachment = null;
let codeBlockRenderTimer = null;
let structuredPreviewTimer = null;
const codeBlockCollapseState = Object.create(null);

function getScopedCodeLocale() {
    const locale = String((window.ISAI_SERVER_I18N && window.ISAI_SERVER_I18N.locale) || window.LANG || document.documentElement.lang || navigator.language || "en").toLowerCase();
    if (locale.startsWith("ko")) return "ko";
    if (locale.startsWith("ja")) return "ja";
    if (locale.startsWith("zh")) return "zh";
    if (locale.startsWith("es")) return "es";
    return "en";
}

function getScopedCodeText(key) {
    const dict = {
        ko: {
            empty: "코드 블록 없음",
            fullFile: "전체 파일",
            setup: "설정 블록",
            editAsk: "이 블록에서 변경할 내용을 입력하세요.",
            processing: "선택 블록 수정 중...",
            applied: "선택 블록이 업데이트되었습니다.",
            failed: "블록 적용 실패. 더 구체적으로 요청해 주세요.",
            attached: "블록이 입력창에 첨부되었습니다."
        },
        ja: {
            empty: "コードブロックなし",
            fullFile: "ファイル全体",
            setup: "セットアップブロック",
            editAsk: "このブロックで変更したい内容を入力してください。",
            processing: "選択ブロックを編集中...",
            applied: "選択ブロックを更新しました。",
            failed: "ブロック適用に失敗しました。より具体的に入力してください。",
            attached: "ブロックを入力欄に添付しました。"
        },
        zh: {
            empty: "没有代码块",
            fullFile: "整个文件",
            setup: "设置块",
            editAsk: "请输入要修改的块内容。",
            processing: "正在编辑所选代码块...",
            applied: "已更新所选代码块。",
            failed: "应用代码块失败，请提供更具体的修改说明。",
            attached: "已将代码块附加到输入框。"
        },
        es: {
            empty: "No hay bloques de c처digo",
            fullFile: "Archivo completo",
            setup: "Bloque base",
            editAsk: "Escribe qu챕 quieres cambiar en este bloque.",
            processing: "Editando bloque seleccionado...",
            applied: "Bloque actualizado.",
            failed: "No se pudo aplicar el bloque. Describe mejor el cambio.",
            attached: "Bloque adjuntado al campo de entrada."
        },
        en: {
            empty: "No code blocks",
            fullFile: "Whole file",
            setup: "Setup block",
            editAsk: "Describe what to change in this block.",
            processing: "Editing selected block...",
            applied: "Selected block updated.",
            failed: "Block apply failed. Please give a more specific edit request.",
            attached: "Block attached to the input field."
        }
    };
    const locale = getScopedCodeLocale();
    const pack = dict[locale] || dict.en;
    return pack[key] || dict.en[key] || "";
}

function normalizeCodeLanguageKey(value) {
    const key = String(value || "").toLowerCase();
    if (["js", "jsx", "ts", "tsx", "javascript", "typescript", "json"].some((item) => key.includes(item))) return "javascript";
    if (["py", "python"].some((item) => key.includes(item))) return "python";
    if (["php"].some((item) => key.includes(item))) return "php";
    if (["html", "xml", "htm"].some((item) => key.includes(item))) return "html";
    if (["css", "scss", "sass", "less"].some((item) => key.includes(item))) return "css";
    return key || "text";
}

function getCodeBlockIconClass(lang = "") {
    const key = normalizeCodeLanguageKey(lang);
    if (key === "html") return "ri-html5-line";
    if (key === "css") return "ri-css3-line";
    if (key === "javascript") return "ri-braces-line";
    if (key === "php") return "ri-code-block";
    if (key === "python") return "ri-terminal-box-line";
    return "ri-file-code-line";
}

function getActiveCodeContentSnapshot() {
    if (codeFiles && codeFiles[activeFileIndex] && typeof codeFiles[activeFileIndex].content === "string") {
        return String(codeFiles[activeFileIndex].content || "");
    }
    const editor = document.getElementById("code-editor");
    return editor ? String(editor.value || "") : "";
}

function buildScopedCodeBlockKey(fileIndex, block) {
    const resolvedFileIndex = Number.isFinite(Number(fileIndex)) ? Number(fileIndex) : activeFileIndex;
    const label = String(block && block.label ? block.label : "").trim();
    const startLine = Number.isFinite(Number(block && block.startLine)) ? Number(block.startLine) : 0;
    const endLine = Number.isFinite(Number(block && block.endLine)) ? Number(block.endLine) : startLine;
    return `${resolvedFileIndex}:${label}:${startLine}:${endLine}`;
}

function parseScopedCodeBlocksFromContent(content, langHint = "") {
    const text = String(content || "");
    if (!text.trim()) return [];
    const lines = text.split("\n");
    const lineOffsets =[];
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
        lineOffsets.push(offset);
        offset += lines[i].length + 1;
    }
    const lang = normalizeCodeLanguageKey(langHint || detectCodeBlockLanguageLocal(text));
    const starts =[];
    const pushStart = (lineIndex, label) => {
        if (!label) return;
        starts.push({ line: lineIndex, label: String(label).trim() });
    };

    lines.forEach((line, lineIndex) => {
        const trimmed = String(line || "").trim();
        if (!trimmed) return;
        let match = null;
        if (lang === "javascript" || lang === "php") {
            match = trimmed.match(/^function\s+([A-Za-z0-9_$]+)/);
            if (match) return pushStart(lineIndex, `fn ${match[1]}`);
            match = trimmed.match(/^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/);
            if (match) return pushStart(lineIndex, `fn ${match[1]}`);
            match = trimmed.match(/^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
            if (match) return pushStart(lineIndex, `fn ${match[1]}`);
            match = trimmed.match(/^class\s+([A-Za-z0-9_$]+)/);
            if (match) return pushStart(lineIndex, `class ${match[1]}`);
        } else if (lang === "python") {
            match = trimmed.match(/^def\s+([A-Za-z0-9_]+)/);
            if (match) return pushStart(lineIndex, `def ${match[1]}`);
            match = trimmed.match(/^class\s+([A-Za-z0-9_]+)/);
            if (match) return pushStart(lineIndex, `class ${match[1]}`);
        } else if (lang === "html") {
            match = trimmed.match(/^<(script|style|section|main|header|footer|nav|article|aside|div|form)\b/i);
            if (match) return pushStart(lineIndex, `<${match[1].toLowerCase()}>`);
        } else if (lang === "css") {
            match = trimmed.match(/^(@media[^{]+)\{/i);
            if (match) return pushStart(lineIndex, match[1].trim());
            match = trimmed.match(/^([.#]?[A-Za-z0-9_:-][^{]*)\{/);
            if (match) return pushStart(lineIndex, match[1].trim());
        }
    });

    if (starts.length === 0) {
        return [{
            index: 0,
            label: getScopedCodeText("fullFile"),
            lang,
            startOffset: 0,
            endOffset: text.length,
            startLine: 0,
            endLine: Math.max(0, lines.length - 1),
            sourceText: text,
            promptText: text.trim()
        }];
    }

    const blocks =[];
    const firstStartLine = Number.isFinite(Number(starts[0] && starts[0].line)) ? Number(starts[0].line) : 0;
    const firstStartOffset = lineOffsets[firstStartLine] || 0;
    const leadingText = text.slice(0, firstStartOffset);
    if (leadingText.trim()) {
        blocks.push({
            index: 0,
            label: getScopedCodeText("setup"),
            lang,
            startOffset: 0,
            endOffset: firstStartOffset,
            startLine: 0,
            endLine: Math.max(0, firstStartLine - 1),
            sourceText: leadingText,
            promptText: leadingText.trim()
        });
    }

    for (let i = 0; i < starts.length; i++) {
        const startLine = starts[i].line;
        const nextLine = i + 1 < starts.length ? starts[i + 1].line : lines.length;
        const startOffset = lineOffsets[startLine] || 0;
        const endOffset = nextLine < lines.length ? (lineOffsets[nextLine] || text.length) : text.length;
        const sourceText = text.slice(startOffset, endOffset);
        const promptText = sourceText.trim();
        if (!promptText) continue;
        blocks.push({
            index: blocks.length,
            label: starts[i].label || `${getScopedCodeText("fullFile")} ${i + 1}`,
            lang,
            startOffset,
            endOffset,
            startLine,
            endLine: Math.max(startLine, nextLine - 1),
            sourceText,
            promptText
        });
    }

    return blocks.length ? blocks.slice(0, 24).map((block, index) => ({ ...block, index })) : [{
        index: 0,
        label: getScopedCodeText("fullFile"),
        lang,
        startOffset: 0,
        endOffset: text.length,
        startLine: 0,
        endLine: Math.max(0, lines.length - 1),
        sourceText: text,
        promptText: text.trim()
    }];
}

function createScopedTargetFromBlock(block, fileIndex = activeFileIndex) {
    if (!block || typeof block !== "object") return null;
    const next = {
        fileIndex,
        startOffset: Number.isFinite(Number(block.startOffset)) ? Number(block.startOffset) : 0,
        endOffset: Number.isFinite(Number(block.endOffset)) ? Number(block.endOffset) : 0,
        sourceText: String(block.currentText != null ? block.currentText : (block.sourceText || "")),
        originalBlock: String(block.sourceText || ""),
        label: String(block.label || ""),
        lang: String(block.lang || ""),
        startLine: Number.isFinite(Number(block.startLine)) ? Number(block.startLine) : 0,
        endLine: Number.isFinite(Number(block.endLine)) ? Number(block.endLine) : 0
    };
    next.blockKey = buildScopedCodeBlockKey(fileIndex, next);
    return next;
}

function syncStructuredCodeTextareaHeight(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
}

function scheduleStructuredPreviewRefresh() {
    if (structuredPreviewTimer) clearTimeout(structuredPreviewTimer);
    structuredPreviewTimer = setTimeout(() => {
        structuredPreviewTimer = null;
        if (typeof window.refreshHtmlPreview === "function" && document.body && document.body.classList.contains("html-preview-active")) {
            try { window.refreshHtmlPreview(); } catch (error) {}
        }
    }, 160);
}

function syncStructuredCodeToMaster(fileIndex = activeFileIndex) {
    const merged = structuredCodeBlocksState.map((block) => String(block && block.currentText != null ? block.currentText : (block.sourceText || ""))).join("");
    if (codeFiles[fileIndex]) {
        codeFiles[fileIndex].content = merged;
    }
    const editor = document.getElementById("code-editor");
    if (editor && fileIndex === activeFileIndex) {
        editor.value = merged;
    }
    scheduleStructuredPreviewRefresh();
}

function renderPromptAttachmentRow() {
    const row = document.getElementById("prompt-attachment-row");
    if (!row) return;
    row.innerHTML = "";
    if (!pendingScopedCodeAttachment) {
        row.classList.add("hidden");
        return;
    }

    const chip = document.createElement("div");
    chip.className = "prompt-attachment-chip";

    const icon = document.createElement("span");
    icon.className = "prompt-attachment-chip-icon";
    icon.innerHTML = '<i class="ri-attachment-2"></i>';
    chip.appendChild(icon);

    const label = document.createElement("span");
    label.className = "prompt-attachment-chip-label";
    label.textContent = pendingScopedCodeAttachment.label || getScopedCodeText("fullFile");
    chip.appendChild(label);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "prompt-attachment-chip-remove";
    removeButton.innerHTML = '<i class="ri-close-line"></i>';
    removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearPendingScopedCodeAttachment();
    });
    chip.appendChild(removeButton);

    row.appendChild(chip);
    row.classList.remove("hidden");
}

function syncStructuredAttachmentState() {
    const container = document.getElementById("code-structured-editor");
    if (!container) return;
    container.querySelectorAll(".code-structured-card").forEach((card) => {
        const isAttached = !!(pendingScopedCodeAttachment && card.dataset.blockKey === pendingScopedCodeAttachment.blockKey);
        card.classList.toggle("is-attached", isAttached);
        const aiButton = card.querySelector(".code-structured-ai");
        if (aiButton) aiButton.classList.toggle("is-attached", isAttached);
    });
}

function clearPendingScopedCodeAttachment(options = {}) {
    pendingScopedCodeAttachment = null;
    renderPromptAttachmentRow();
    syncStructuredAttachmentState();
    if (!options.silent) {
        const input = document.getElementById("prompt-input");
        if (input) input.focus();
    }
}

function resolvePendingScopedCodeAttachment() {
    if (!pendingScopedCodeAttachment) return null;
    const fileIndex = Number.isFinite(Number(pendingScopedCodeAttachment.fileIndex))
        ? Number(pendingScopedCodeAttachment.fileIndex)
        : activeFileIndex;
    const matched = structuredCodeBlocksState.find((block) => buildScopedCodeBlockKey(fileIndex, block) === pendingScopedCodeAttachment.blockKey);
    if (matched) return createScopedTargetFromBlock(matched, fileIndex);
    return { ...pendingScopedCodeAttachment };
}

function attachScopedCodeBlockToPrompt(blockIndex) {
    const index = Number(blockIndex);
    const block = structuredCodeBlocksState[index] || scopedCodeBlocks[index];
    if (!block) return;
    pendingScopedCodeAttachment = createScopedTargetFromBlock(block, activeFileIndex);
    renderPromptAttachmentRow();
    syncStructuredAttachmentState();
    const input = document.getElementById("prompt-input");
    if (input) {
        input.focus();
        if (typeof handleInput === "function") handleInput(input);
    }
    if (typeof showToast === "function") showToast(getScopedCodeText("attached"));
}

function renderStructuredCodeEditor() {
    const container = document.getElementById("code-structured-editor");
    const editor = document.getElementById("code-editor");
    const legacyContainer = document.getElementById("code-block-actions");
    if (legacyContainer) {
        legacyContainer.innerHTML = "";
        legacyContainer.classList.add("hidden");
    }
    renderPromptAttachmentRow();
    if (!container || !editor) return;

    const content = getActiveCodeContentSnapshot();
    const file = codeFiles && codeFiles[activeFileIndex] ? codeFiles[activeFileIndex] : null;
    const lang = normalizeCodeLanguageKey((file && file.lang) || detectCodeBlockLanguageLocal(content));

    if (!content.trim()) {
        scopedCodeBlocks = [];
        structuredCodeBlocksState = [];
        container.innerHTML = "";
        container.classList.add("hidden");
        container.classList.remove("is-active");
        editor.classList.remove("is-structured-hidden");
        syncStructuredAttachmentState();
        return;
    }

    const blocks = parseScopedCodeBlocksFromContent(content, lang).map((block) => ({
        ...block,
        fileIndex: activeFileIndex,
        blockKey: buildScopedCodeBlockKey(activeFileIndex, block),
        currentText: String(block.sourceText || "")
    }));
    scopedCodeBlocks = blocks;
    structuredCodeBlocksState = blocks.map((block) => ({ ...block }));

    container.innerHTML = "";
    container.classList.remove("hidden");
    container.classList.add("is-active");
    editor.classList.add("is-structured-hidden");

    blocks.forEach((block, idx) => {
        const card = document.createElement("section");
        card.className = "code-structured-card";
        card.dataset.blockKey = block.blockKey;

        const isCollapsed = !!codeBlockCollapseState[block.blockKey];
        if (isCollapsed) card.classList.add("is-collapsed");

        const head = document.createElement("div");
        head.className = "code-structured-card-head";

        const headMain = document.createElement("div");
        headMain.className = "code-structured-card-head-main";

        const icon = document.createElement("span");
        icon.className = "code-structured-icon";
        icon.innerHTML = `<i class="${getCodeBlockIconClass(block.lang)}"></i>`;
        headMain.appendChild(icon);

        const titleWrap = document.createElement("div");
        titleWrap.className = "code-structured-card-title-wrap";

        const title = document.createElement("div");
        title.className = "code-structured-card-title";
        title.textContent = block.label || `${getScopedCodeText("fullFile")} ${idx + 1}`;
        titleWrap.appendChild(title);

        const meta = document.createElement("div");
        meta.className = "code-structured-card-meta";
        meta.textContent = `L${Number(block.startLine || 0) + 1}-${Number(block.endLine || 0) + 1}`;
        titleWrap.appendChild(meta);
        headMain.appendChild(titleWrap);
        head.appendChild(headMain);

        const actions = document.createElement("div");
        actions.className = "code-structured-card-actions";

        const aiButton = document.createElement("button");
        aiButton.type = "button";
        aiButton.className = "code-structured-ai";
        aiButton.innerHTML = '<i class="ri-ai-generate-text"></i>';
        aiButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            attachScopedCodeBlockToPrompt(idx);
        });
        actions.appendChild(aiButton);

        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "code-structured-toggle";
        toggleButton.innerHTML = `<i class="${isCollapsed ? "ri-arrow-down-s-line" : "ri-arrow-up-s-line"}"></i>`;
        toggleButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const nextCollapsed = !card.classList.contains("is-collapsed");
            card.classList.toggle("is-collapsed", nextCollapsed);
            codeBlockCollapseState[block.blockKey] = nextCollapsed;
            toggleButton.innerHTML = `<i class="${nextCollapsed ? "ri-arrow-down-s-line" : "ri-arrow-up-s-line"}"></i>`;
        });
        actions.appendChild(toggleButton);

        head.appendChild(actions);
        card.appendChild(head);

        const body = document.createElement("div");
        body.className = "code-structured-card-body";

        const blockEditor = document.createElement("textarea");
        blockEditor.className = "code-structured-editor-input custom-scrollbar-code";
        blockEditor.spellcheck = false;
        blockEditor.value = block.currentText;
        blockEditor.dataset.blockIndex = String(idx);
        blockEditor.addEventListener("input", (event) => {
            const nextIndex = Number(event.target.dataset.blockIndex);
            const nextBlock = structuredCodeBlocksState[nextIndex];
            if (!nextBlock) return;
            nextBlock.currentText = event.target.value;
            nextBlock.sourceText = event.target.value;
            nextBlock.promptText = String(event.target.value || "").trim();
            syncStructuredCodeTextareaHeight(event.target);
            syncStructuredCodeToMaster(nextBlock.fileIndex);
            if (pendingScopedCodeAttachment && pendingScopedCodeAttachment.blockKey === nextBlock.blockKey) {
                pendingScopedCodeAttachment = createScopedTargetFromBlock(nextBlock, nextBlock.fileIndex);
                renderPromptAttachmentRow();
                syncStructuredAttachmentState();
            }
        });
        blockEditor.addEventListener("blur", () => {
            scheduleCodeBlockActionsRender();
        });
        body.appendChild(blockEditor);
        card.appendChild(body);
        container.appendChild(card);
        syncStructuredCodeTextareaHeight(blockEditor);
    });

    syncStructuredAttachmentState();
}

function buildScopedCodeEditPrompt(block, instruction, fileInfo = {}) {
    const lang = String(block && block.lang ? block.lang : fileInfo.lang || "text");
    const name = String(fileInfo.name || "");
    const label = String(block && block.label ? block.label : "Block");
    return [
        "You are editing only one code block from a file.",
        "Return ONLY the updated block code.",
        "Do not include markdown fences.",
        "Do not add explanation.",
        `Language: ${lang}`,
        name ? `File: ${name}` : "",
        `Target block: ${label}`,
        "",
        "[Edit request]",
        String(instruction || "").trim(),
        "",
        "[Current block code]",
        String(block && block.promptText ? block.promptText : "").trim()
    ].filter(Boolean).join("\n");
}

function extractScopedPatchCode(rawText) {
    const source = String(rawText || "").trim();
    if (!source) return "";
    const fencedMatch = source.match(/```[a-zA-Z0-9_+\-]*\s*([\s\S]*?)```/);
    if (fencedMatch && fencedMatch[1] != null) {
        return String(fencedMatch[1]).trim();
    }
    return source.replace(/^`+|`+$/g, "").trim();
}

function applyScopedCodePatchToEditor(target, rawText) {
    if (!target || typeof target !== "object") return false;
    const patch = extractScopedPatchCode(rawText);
    if (!patch) return false;

    const fileIndex = Number.isFinite(Number(target.fileIndex)) ? Number(target.fileIndex) : activeFileIndex;
    const editor = document.getElementById("code-editor");
    const currentText = (codeFiles[fileIndex] && typeof codeFiles[fileIndex].content === "string")
        ? String(codeFiles[fileIndex].content || "")
        : (editor ? String(editor.value || "") : "");
    if (!currentText) return false;

    const originalBlock = String(target.sourceText || target.originalBlock || "");
    if (!originalBlock) return false;

    let start = Number.isFinite(Number(target.startOffset)) ? Number(target.startOffset) : -1;
    let end = Number.isFinite(Number(target.endOffset)) ? Number(target.endOffset) : -1;

    if (!(start >= 0 && end >= start && currentText.slice(start, end) === originalBlock)) {
        const foundIndex = currentText.indexOf(originalBlock);
        if (foundIndex < 0) return false;
        start = foundIndex;
        end = foundIndex + originalBlock.length;
    }

    const merged = currentText.slice(0, start) + patch + currentText.slice(end);
    if (codeFiles[fileIndex]) {
        codeFiles[fileIndex].content = merged;
    }
    if (fileIndex === activeFileIndex && editor) {
        editor.value = merged;
    }
    renderCodeTabs();
    if (typeof window.refreshHtmlPreview === "function") {
        try { window.refreshHtmlPreview(); } catch (error) {}
    }
    return true;
}

function renderCodeBlockActions() {
    renderPromptAttachmentRow();
    renderStructuredCodeEditor();
}

function scheduleCodeBlockActionsRender() {
    if (codeBlockRenderTimer) clearTimeout(codeBlockRenderTimer);
    codeBlockRenderTimer = setTimeout(() => {
        codeBlockRenderTimer = null;
        renderCodeBlockActions();
    }, 120);
}

window.requestScopedCodeEdit = function(blockIndex) {
    attachScopedCodeBlockToPrompt(blockIndex);
};

function updateCodePanel(text) {
    const matches =[...text.matchAll(/```(\w+)?\s*([\s\S]*?)(?:```|$)/g)];
    
    if (matches.length !== 0) {
        codeFiles = matches.map((m, idx) => ({
            lang: m[1] || "Text",
            content: m[2],
            name: `File ${idx + 1} (${m[1] || "txt"})`
        }));
        renderCodeTabs();
    }
}

function getCodeTabIcon(lang = "", name = "") {
    const key = String(lang || name || "").toLowerCase();
    if (key.includes("html")) return "ri-html5-line";
    if (key.includes("css") || key.includes("scss")) return "ri-css3-line";
    if (key.includes("js") || key.includes("ts") || key.includes("json")) return "ri-braces-line";
    if (key.includes("php")) return "ri-ai-generate-text";
    if (key.includes("py")) return "ri-terminal-box-line";
    if (key.includes("sql")) return "ri-database-2-line";
    if (key.includes("md")) return "ri-markdown-line";
    if (key.includes("sh") || key.includes("bash")) return "ri-terminal-line";
    return "ri-ai-generate-text";
}

function getCodePanelEmptyMarkup() {
    return '<div class="code-panel-empty"><span class="code-panel-empty-icon"><i class="ri-ai-generate-text text-sm"></i></span><span class="code-panel-empty-dots" aria-hidden="true"><span></span><span></span><span></span></span></div>';
}

function renderCodeTabs() {
    const tabsContainer = document.getElementById("code-tabs");
    const editor = document.getElementById("code-editor");

    if (tabsContainer) {
        tabsContainer.innerHTML = "";
        
        if (codeFiles && codeFiles.length !== 0) {
            codeFiles.forEach((file, index) => {
                const btn = document.createElement("button");
                btn.type = "button";
                
                btn.className = "code-tab-btn " + (index === activeFileIndex ? "active" : "");
                const iconClass = getCodeTabIcon(file.lang, file.name);
                btn.title = file.name || file.lang || "Code";
                btn.innerHTML = `<span class="code-tab-icon"><i class="${iconClass}"></i></span>`;
                btn.onclick = (e) => {
                    e.preventDefault();
                    window.switchCodeFile(index);
                };
                
                tabsContainer.appendChild(btn);
            });
            
            if (editor && codeFiles[activeFileIndex]) {
                editor.value = codeFiles[activeFileIndex].content;
            }
        } else {
            tabsContainer.innerHTML = getCodePanelEmptyMarkup();
        }
    }
    renderCodeBlockActions();
}

function switchTab(index) {
    if (typeof clearPendingScopedCodeAttachment === "function") {
        clearPendingScopedCodeAttachment({ silent: true });
    }
    activeFileIndex = index;
    renderCodeTabs();
    const editor = document.getElementById("code-editor");
    if (editor && codeFiles[index]) {
        editor.value = codeFiles[index].content;
    }
}

function resetChat(silent = false) {
    if (isGenerating) stopGeneration();
    clearCharacterChatSession();
    
    chatHistory =[];
    codeFiles =[];
    activeFileIndex = 0;
    structuredCodeBlocksState = [];
    pendingScopedCodeAttachment = null;
    
    const chatBox = document.getElementById("chat-box");
    chatBox.style.display = "flex";
    chatBox.style.flexDirection = "column";
    chatBox.style.justifyContent = "normal";
    chatBox.innerHTML = "";
    
    const viewId = new URLSearchParams(window.location.search).get("v");
    
    document.getElementById("code-tabs").innerHTML = getCodePanelEmptyMarkup();
    document.getElementById("code-editor").value = "";
    scopedCodeBlocks = [];
    renderCodeBlockActions();
    
    document.body.classList.remove("started");
    document.body.classList.remove("mode-code");
    isStarted = false;
    document.getElementById("custom-scrollbar").style.display = "none";
    
    if (activeApp) exitAppMode();
    if (isMenuOpen) toggleStoreMenu();
    
    document.getElementById("prompt-input").value = "";
    setMode("chat");
    if (!silent && typeof showToast === "function") {
        showToast("Chat Reset Completed");
    }
}

async function processBlogImages(element) {
    if (!element) return;
    
    let html = element.innerHTML;
    const matches =[...html.matchAll(/\[\[IMG:\s*(.*?)\]\]/g)];
    
    if (matches.length === 0) return;
    
    const loaderId = "img-loader-" + Date.now();
    const loaderBlock = document.createElement("div");
    loaderBlock.id = loaderId;
    loaderBlock.className = "text-xs text-gray-500 mt-2 flex items-center gap-2 animate-pulse";
    loaderBlock.innerHTML = '<i class="ri-image-line"></i> Searching related images...';
    element.appendChild(loaderBlock);
    
    for (const match of matches) {
        const fullMatch = match[0];
        const keyword = match[1].trim();
        let imgUrl = "";
        let creditHtml = "";
        
        try {
            const res = await fetch(`?action=pixabay_search&q=${encodeURIComponent(keyword)}`);
            const data = await parseJsonResponseSafe(res);
            
            if (data.hits && data.hits.length > 0) {
                const hit = data.hits[0];
                imgUrl = hit.webformatURL;
                creditHtml = `<div class="text-[10px] text-gray-500 mt-1 text-center">Image by <a href="${hit.pageURL}" target="_blank" class="underline">${hit.user}</a> from Pixabay</div>`;
            }
        } catch (error) {
            // Ignored
        }
        
        const uiHtml = `
            <div class="my-6 rounded-xl overflow-hidden shadow-lg border border-white/10 group relative bg-black/20">
                <img src="${imgUrl}" alt="${keyword}" class="w-full h-auto object-cover transition transform group-hover:scale-105 duration-700 min-h-[200px]" loading="lazy" onload="scrollBottom()">
                ${creditHtml}
                <button onclick="openPreview('${imgUrl}')" class="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition backdrop-blur-sm"><i class="ri-fullscreen-line"></i></button>
            </div>
        `;
        
        html = html.replace(fullMatch, uiHtml);
    }
    
    element.innerHTML = html;
    const loaderEl = document.getElementById(loaderId);
    if (loaderEl) loaderEl.remove();
    scrollBottom();
}

window.switchCodeFile = function(index) {
    if (typeof clearPendingScopedCodeAttachment === "function") {
        clearPendingScopedCodeAttachment({ silent: true });
    }
    activeFileIndex = index;
    renderCodeTabs();
    const editor = document.getElementById("code-editor");
    if (editor && codeFiles[index]) {
        editor.value = codeFiles[index].content;
    }
};

const __isaiCodeEditor = document.getElementById("code-editor");
if (__isaiCodeEditor) {
    __isaiCodeEditor.addEventListener("input", function(e) {
        if (!isGenerating && codeFiles[activeFileIndex]) {
            codeFiles[activeFileIndex].content = e.target.value;
        }
        scheduleCodeBlockActionsRender();
    });
}

window.toggleThink = function(headerEl) {
    const contentEl = headerEl.nextElementSibling;
    const iconEl = headerEl.querySelector('.toggle-icon');
    
    if (contentEl.style.display === 'none') {
        contentEl.style.display = 'block';
        iconEl.style.transform = 'rotate(180deg)';
    } else {
        contentEl.style.display = 'none';
        iconEl.style.transform = 'rotate(0deg)';
    }
};

(function () {
    const SHORTCUT_STORAGE_KEY = "ISAI_LOCAL_MODEL_SHORTCUTS_V2";
    const CHAT_MODEL_STORAGE_KEY = "ISAI_LOCAL_CHAT_MODEL_ID_V1";
    const MODEL_MENU_ID = "local-model-shortcut-panel";
    const MODEL_MENU_STYLE_ID = "isai-local-model-shortcut-style";
    const SLOT_ORDER = ["code", "light", "middle", "hard"];
    const MODEL_TYPE_ORDER = ["all", "gemma", "huggingface", "qwen", "granite", "ernie"];
    const MODEL_TYPE_FILTER_ORDER = ["gemma", "huggingface", "qwen", "granite"];
    const SLOT_ICON_MAP = {
        code: "ri-code-block",
        light: "ri-sparkling-2-line",
        middle: "ri-cpu-line",
        hard: "ri-rocket-2-line"
    };
    let currentModelTypeFilter = "all";
    let shortcutSettingsOpen = false;

    function getShortcutLocale() {
        const serverLocale = window.ISAI_SERVER_I18N && window.ISAI_SERVER_I18N.locale;
        const locale = String(serverLocale || window.LANG || document.documentElement.lang || navigator.language || "en").toLowerCase();
        if (locale.startsWith("ko")) return "ko";
        if (locale.startsWith("ja")) return "ja";
        if (locale.startsWith("zh")) return "zh";
        if (locale.startsWith("es")) return "es";
        return "en";
    }

    function getShortcutText(key) {
        const dict = {
            ko: {
                menu: "\uBAA8\uB378 \uBA54\uB274",
                current: "\uD604\uC7AC \uC124\uC815",
                settings: "\uC124\uC815",
                changed: "\uB2E8\uCD95 \uBAA8\uB378 \uC124\uC815\uC774 \uC801\uC6A9\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
                code: "\uCF54\uB4DC",
                light: "\uB77C\uC774\uD2B8",
                middle: "\uC911\uAC04",
                hard: "\uD558\uB4DC",
                all: "\uC804\uCCB4",
                qwen: "Qwen",
                granite: "Granite",
                gemma: "Gemma",
                huggingface: "H",
                ernie: "ERNIE",
                available: "\uC120\uD0DD \uAC00\uB2A5\uD55C \uBAA8\uB378",
                restricted: "Gemma\uB294 \uBCC4\uB3C4 \uC774\uC6A9\uC870\uAC74\uC774 \uC801\uC6A9\uB429\uB2C8\uB2E4"
            },
            en: {
                menu: "Model Menu",
                current: "Current",
                settings: "Settings",
                changed: "Shortcut model setting applied",
                code: "Code",
                light: "Light",
                middle: "Middle",
                hard: "Hard",
                all: "All",
                qwen: "Qwen",
                granite: "Granite",
                gemma: "Gemma",
                huggingface: "H",
                ernie: "ERNIE",
                available: "Available models",
                restricted: "Gemma has separate usage terms"
            },
            ja: {
                menu: "\u30E2\u30C7\u30EB\u30E1\u30CB\u30E5\u30FC",
                current: "\u73FE\u5728\u8A2D\u5B9A",
                settings: "\u8A2D\u5B9A",
                changed: "\u30B7\u30E7\u30FC\u30C8\u30AB\u30C3\u30C8\u30E2\u30C7\u30EB\u8A2D\u5B9A\u3092\u9069\u7528\u3057\u307E\u3057\u305F",
                code: "\u30B3\u30FC\u30C9",
                light: "\u30E9\u30A4\u30C8",
                middle: "\u4E2D\u9593",
                hard: "\u30CF\u30FC\u30C9",
                all: "\u5168\u3066",
                qwen: "Qwen",
                granite: "Granite",
                gemma: "Gemma",
                huggingface: "H",
                ernie: "ERNIE",
                available: "\u9078\u629E\u3067\u304D\u308B\u30E2\u30C7\u30EB",
                restricted: "Gemma \u306B\u306F\u5225\u9014\u5229\u7528\u6761\u4EF6\u304C\u9069\u7528\u3055\u308C\u307E\u3059"
            },
            zh: {
                menu: "\u6A21\u578B\u83DC\u5355",
                current: "\u5F53\u524D\u8BBE\u7F6E",
                settings: "\u8BBE\u7F6E",
                changed: "\u5DF2\u5E94\u7528\u5FEB\u6377\u6A21\u578B\u8BBE\u7F6E",
                code: "\u4EE3\u7801",
                light: "\u8F7B\u91CF",
                middle: "\u4E2D\u95F4",
                hard: "\u9AD8\u7EA7",
                all: "\u5168\u90E8",
                qwen: "Qwen",
                granite: "Granite",
                gemma: "Gemma",
                huggingface: "H",
                ernie: "ERNIE",
                available: "\u53EF\u9009\u6A21\u578B",
                restricted: "Gemma \u9700\u9075\u5B88\u989D\u5916\u4F7F\u7528\u6761\u6B3E"
            },
            es: {
                menu: "Menu de modelos",
                current: "Actual",
                settings: "Ajustes",
                changed: "Configuracion de modelo rapido aplicada",
                code: "Codigo",
                light: "Ligero",
                middle: "Medio",
                hard: "Alto",
                all: "Todo",
                qwen: "Qwen",
                granite: "Granite",
                gemma: "Gemma",
                huggingface: "H",
                ernie: "ERNIE",
                available: "Modelos disponibles",
                restricted: "Gemma tiene condiciones de uso separadas"
            }
        };
        const locale = getShortcutLocale();
        const table = dict[locale] || dict.en;
        return table[key] || key;
    }

    function getTierSwitchedToast(tierKey) {
        const tierLabel = getShortcutText(String(tierKey || "light").toLowerCase());
        const locale = getShortcutLocale();
        if (locale === "ko") return `${tierLabel} \uBAA8\uB4DC\uB85C \uC804\uD658\uB418\uC5C8\uC2B5\uB2C8\uB2E4`;
        if (locale === "ja") return `${tierLabel}\u30E2\u30FC\u30C9\u306B\u5207\u308A\u66FF\u3048\u307E\u3057\u305F`;
        if (locale === "zh") return `\u5DF2\u5207\u6362\u4E3A${tierLabel}\u6A21\u5F0F`;
        if (locale === "es") return `Cambiado al modo ${tierLabel}`;
        return `Switched to ${tierLabel} mode`;
    }

    function getUserCountryCode() {
        const fromServer = window.ISAI_SERVER_I18N && window.ISAI_SERVER_I18N.country;
        const fromHtml = document.documentElement.getAttribute("data-country");
        return String(fromServer || fromHtml || "").trim().toUpperCase();
    }

    function getModelTypeMeta() {
        return {
            all: { icon: "ri-apps-2-line", label: getShortcutText("all") },
            huggingface: { icon: "ri-text", label: "H" },
            qwen: { icon: "ri-qwen-ai-fill", label: getShortcutText("qwen") },
            granite: { icon: "granite-g", label: getShortcutText("granite") },
            gemma: { icon: "ri-gemini-fill", label: getShortcutText("gemma") },
            ernie: { icon: "ri-sparkling-2-line", label: getShortcutText("ernie") }
        };
    }

    function getModelTypeFromItem(item) {
        const explicitType = String(item && item.modelType ? item.modelType : "").toLowerCase();
        if (MODEL_TYPE_ORDER.includes(explicitType)) return explicitType;
        const idText = String(item && item.id ? item.id : "").toLowerCase();
        const nameText = String(item && item.name ? item.name : "").toLowerCase();
        const hay = `${idText} ${nameText}`;
        if (hay.includes("smollm")) return "huggingface";
        if (hay.includes("huggingface")) return "huggingface";
        if (hay.includes("gemma")) return "gemma";
        if (hay.includes("qwen")) return "qwen";
        if (hay.includes("granite")) return "granite";
        if (hay.includes("ernie")) return "ernie";
        return "gemma";
    }

    function getProviderBadgeHtml(typeKey, compact) {
        const isCompact = !!compact;
        const sizeClass = isCompact ? " is-compact" : "";
if (typeKey === "huggingface") return `<span class="local-model-provider-badge huggingface${sizeClass}"><span class="hf-glyph">H</span></span>`;
        if (typeKey === "granite") return `<span class="local-model-provider-badge granite${sizeClass}"><span class="model-provider-glyph">G</span></span>`;
        if (typeKey === "qwen") return `<span class="local-model-provider-badge qwen${sizeClass}"><i class="ri-qwen-ai-fill"></i></span>`;
        if (typeKey === "gemma") return `<span class="local-model-provider-badge gemma${sizeClass}"><i class="ri-gemini-fill"></i></span>`;
        if (typeKey === "ernie") return `<span class="local-model-provider-badge ernie${sizeClass}"><span class="model-provider-glyph">E</span></span>`;
        return `<span class="local-model-provider-badge${sizeClass}"><i class="ri-apps-2-line"></i></span>`;
    }

    function getModelCatalog() {
        const catalog = window.__ISAI_LOCAL_MODEL_CATALOG;
        if (!catalog || typeof catalog !== "object") return {};

        const allowByCountry = {
            CN: ["qwen_coder_05b_q3kl", "qwen_05b_q3km", "granite_350m_q40"]
        };
        const country = getUserCountryCode();
        const allowed = allowByCountry[country];
        if (!Array.isArray(allowed) || allowed.length === 0) return catalog;

        const filtered = {};
        allowed.forEach((id) => {
            if (catalog[id]) filtered[id] = catalog[id];
        });
        return Object.keys(filtered).length > 0 ? filtered : catalog;
    }

    function getBaseLocalModelProfiles() {
        const bundled = window.__ISAI_LOCAL_MODEL_PROFILES;
        if (bundled && typeof bundled === "object") return bundled;
        return {};
    }

    function readShortcutOverrides() {
        try {
            const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function writeShortcutOverrides(nextMap) {
        try {
            localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(nextMap || {}));
        } catch (error) {}
    }

    function getDefaultChatModelId() {
        const base = getBaseLocalModelProfiles();
        const preferred = String((window.MODEL_CONFIG && window.MODEL_CONFIG.defaultChatModelId) || "").trim();
        if (preferred) return preferred;
        if (base.light && base.light.modelId) return String(base.light.modelId).trim();
        return "qwen_05b_q3km";
    }

    function getStoredChatModelId() {
        const catalog = getModelCatalog();
        const storageKey = CHAT_MODEL_STORAGE_KEY;
        const persistChatModelId = (nextId) => {
            const normalized = String(nextId || "").trim();
            if (!normalized) return normalized;
            try { localStorage.setItem(storageKey, normalized); } catch (error) {}
            return normalized;
        };
        const raw = String(localStorage.getItem(CHAT_MODEL_STORAGE_KEY) || "").trim();
        if (raw === "granite_1b_iq3xxs" && catalog.granite_350m_q40) {
            return persistChatModelId("granite_350m_q40");
        }
        if (raw === "ernie_03b_q3ks") {
            const fallback = getDefaultChatModelId();
            if (catalog[fallback] && fallback !== "qwen_coder_05b_q3kl") return persistChatModelId(fallback);
        }
        if (raw && catalog[raw] && raw !== "qwen_coder_05b_q3kl") return raw;
        const fallback = getDefaultChatModelId();
        if (catalog[fallback] && fallback !== "qwen_coder_05b_q3kl") return persistChatModelId(fallback);
        const firstChatModel = Object.keys(catalog).find((id) => id !== "qwen_coder_05b_q3kl");
        return persistChatModelId(firstChatModel || fallback || "qwen_05b_q3km");
    }

    function getResolvedLocalModelProfiles() {
        const catalog = getModelCatalog();
        const base = getBaseLocalModelProfiles();
        const selectedChatModelId = getStoredChatModelId();
        const selectedChatModel = selectedChatModelId && catalog[selectedChatModelId] ? catalog[selectedChatModelId] : null;
        const resolved = {};

        SLOT_ORDER.forEach((slotKey) => {
            const baseProfile = base[slotKey];
            if (!baseProfile || typeof baseProfile !== "object") return;
            const next = Object.assign({}, baseProfile);
            const catalogId = slotKey === "code"
                ? String(baseProfile.modelId || "").trim()
                : String((selectedChatModel && selectedChatModel.id) || baseProfile.modelId || "").trim();
            const catalogItem = catalogId && catalog[catalogId] ? catalog[catalogId] : null;
            if (catalogItem) {
                next.modelId = catalogItem.id;
                next.modelName = catalogItem.name;
                next.fallbackUrl = catalogItem.fallbackUrl;
                next.fallbackUrls = Array.isArray(catalogItem.fallbackUrls) ? catalogItem.fallbackUrls.slice() : [];
                next.popupSizeText = catalogItem.popupSizeText;
                next.preferredRuntime = catalogItem.preferredRuntime || next.preferredRuntime || "wllama";
                next.license = catalogItem.license || next.license || "";
                next.modelType = getModelTypeFromItem(catalogItem) || next.modelType || "qwen";
                next.webllmModelId = catalogItem.webllmModelId || "";
            }
            resolved[slotKey] = next;
        });

        return resolved;
    }

    window.getIsaiLocalModelProfiles = function getIsaiLocalModelProfilesPatched() {
        return getResolvedLocalModelProfiles();
    };

    function ensureShortcutMenuStyle() {
        if (document.getElementById(MODEL_MENU_STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = MODEL_MENU_STYLE_ID;
        style.textContent = `
#local-model-tier-wrapper{max-width:min(76vw,340px);overflow:visible!important}
#local-model-tier-list{display:flex;align-items:center;gap:6px;flex-wrap:nowrap}
.local-model-shortcut-panel{position:absolute;top:44px;right:0;width:100%;min-width:100%;max-width:100%;height:min(236px,calc(100vh - 208px));max-height:min(236px,calc(100vh - 208px));padding:8px 6px 6px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(10,10,11,.96);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 14px 34px rgba(0,0,0,.34);display:none;flex-direction:column;z-index:50;overflow:hidden!important}
.local-model-shortcut-panel.is-open{display:block}
.local-model-shortcut-panel.is-open{display:flex}
.local-model-shortcut-panel::-webkit-scrollbar{display:block!important;width:5px!important}
.local-model-shortcut-panel::-webkit-scrollbar-track{background:transparent!important}
.local-model-shortcut-panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22)!important;border-radius:999px!important}
.local-model-shortcut-head{display:flex;align-items:center;gap:6px;margin-bottom:8px;min-width:0;flex:0 0 auto}
.local-model-shortcut-title{display:none!important}
.local-model-shortcut-tools{display:flex;align-items:center;gap:4px;flex:0 0 auto}
.local-model-tier-menu-btn,.local-model-shortcut-icon-btn,.local-model-filter-btn{position:relative;width:28px;height:28px;min-width:28px;min-height:28px;max-width:28px;max-height:28px;aspect-ratio:1/1;padding:0;border:1px solid rgba(255,255,255,.08);border-radius:50%;background:rgba(255,255,255,.035);color:rgba(255,255,255,.78);display:inline-flex;align-items:center;justify-content:center;align-self:center;cursor:pointer;flex:0 0 28px;overflow:hidden;box-sizing:border-box;box-shadow:none;transition:background-color .16s ease,border-color .16s ease,color .16s ease}
.local-model-filter-btn{width:24px;min-width:24px;max-width:24px;height:24px;min-height:24px;max-height:24px;flex-basis:24px}
.local-model-tier-menu-btn::after,.local-model-shortcut-icon-btn::after,.local-model-filter-btn::after{content:"";position:absolute;inset:1px;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,0));opacity:.5;pointer-events:none}
.local-model-filter-btn.provider-all{display:none!important}
.local-model-tier-menu-btn>i,.local-model-shortcut-icon-btn>i,.local-model-filter-btn>i{font-size:13px!important;line-height:1;transform:none!important;transition:color .16s ease}
.local-model-tier-menu-btn:hover,.local-model-tier-menu-btn.is-open,.local-model-shortcut-icon-btn:hover,.local-model-shortcut-icon-btn.is-open,.local-model-filter-btn:hover,.local-model-filter-btn.is-active{color:#fff;box-shadow:none}
.local-model-tier-menu-btn:hover,.local-model-tier-menu-btn.is-open,.local-model-shortcut-icon-btn:hover,.local-model-shortcut-icon-btn.is-open{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.16)}
.local-model-filter-btn.provider-gemma{background:linear-gradient(180deg,rgba(96,165,250,.12),rgba(29,78,216,.04));border-color:rgba(96,165,250,.18);color:#bfdbfe}
.local-model-filter-btn.provider-gemma:hover,.local-model-filter-btn.provider-gemma.is-active{background:linear-gradient(180deg,#60a5fa,#1d4ed8);border-color:rgba(147,197,253,.72);color:#fff}
.local-model-filter-btn.provider-huggingface{background:linear-gradient(180deg,rgba(250,204,21,.14),rgba(234,179,8,.05));border-color:rgba(250,204,21,.22);color:#fde68a}
.local-model-filter-btn.provider-huggingface:hover,.local-model-filter-btn.provider-huggingface.is-active{background:linear-gradient(180deg,#facc15,#eab308);border-color:rgba(254,240,138,.78);color:#ffffff}
.local-model-filter-btn.provider-qwen{background:linear-gradient(180deg,rgba(59,130,246,.12),rgba(15,23,42,.08));border-color:rgba(59,130,246,.2);color:#93c5fd}
.local-model-filter-btn.provider-qwen:hover,.local-model-filter-btn.provider-qwen.is-active{background:linear-gradient(180deg,#1d4ed8,#0f172a);border-color:rgba(147,197,253,.72);color:#e0f2fe}
.local-model-filter-btn.provider-granite{background:linear-gradient(180deg,rgba(59,130,246,.11),rgba(37,99,235,.05));border-color:rgba(59,130,246,.2);color:#dbeafe}
.local-model-filter-btn.provider-granite:hover,.local-model-filter-btn.provider-granite.is-active{background:linear-gradient(180deg,#60a5fa,#2563eb);border-color:rgba(191,219,254,.72);color:#ffffff}
.local-model-filter-btn.provider-ernie{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border-color:rgba(255,255,255,.14);color:#f3f4f6}
.local-model-filter-btn.provider-ernie:hover,.local-model-filter-btn.provider-ernie.is-active{background:linear-gradient(180deg,#232323,#0b0b0b);border-color:rgba(255,255,255,.3);color:#ffffff}
.local-model-filter-row{display:flex;align-items:center;gap:2px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:0;margin-bottom:0;min-width:0}
.local-model-shortcut-tools > .local-model-shortcut-icon-btn,
.local-model-filter-row > .local-model-filter-btn{transform:none!important}
.local-model-filter-row::-webkit-scrollbar{display:none}
.local-model-filter-row.in-head{flex:1 1 auto}
.local-model-catalog-scroll{display:block!important;flex:1 1 auto;min-height:0;height:0;max-height:100%;overflow-y:auto!important;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent;padding-right:1px}
.local-model-catalog-scroll::-webkit-scrollbar{display:block!important;width:5px!important}
.local-model-catalog-scroll::-webkit-scrollbar-track{background:transparent!important}
.local-model-catalog-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22)!important;border-radius:999px!important}
.local-model-catalog-grid{display:flex;flex-direction:column;gap:6px}
.local-model-catalog-card{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(23,23,24,.96),rgba(18,18,19,.96));cursor:pointer;transition:background-color .14s ease,border-color .14s ease,box-shadow .14s ease}
.local-model-catalog-card:hover{border-color:rgba(255,255,255,.2);background:linear-gradient(180deg,rgba(28,28,30,.98),rgba(20,20,22,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
.local-model-catalog-card.is-selected{border-color:rgba(255,255,255,.28);background:linear-gradient(180deg,rgba(31,31,34,.98),rgba(21,21,23,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.local-model-catalog-meta{min-width:0;display:flex;flex-direction:column;gap:2px;flex:1 1 auto}
.local-model-catalog-name{font-size:10px;font-weight:800;color:#fff;line-height:1.2;white-space:normal;overflow:visible;text-overflow:clip;display:block;max-width:none;word-break:keep-all;overflow-wrap:anywhere}
.local-model-slot-actions{display:flex;align-items:center;justify-content:flex-end;align-self:center;gap:7px;flex:0 0 auto;height:auto!important;min-height:0!important;margin:0}
.local-model-slot-actions > *{align-self:center!important;margin-top:0!important;margin-bottom:0!important;position:relative;top:0!important;bottom:auto!important}
.local-model-provider-button{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;min-width:20px;min-height:20px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);box-shadow:inset 0 1px 0 rgba(255,255,255,.03);padding:0;flex:0 0 auto}
.local-model-size-pill{height:22px;padding:0 7px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);font-size:10px;font-weight:800;color:rgba(255,255,255,.86);display:inline-flex;align-items:center;justify-content:center;letter-spacing:.01em}
.local-model-assign-row{display:none;align-items:center;gap:4px}
.local-model-shortcut-panel.is-assign-mode .local-model-assign-row{display:flex}
.local-model-slot-assign{width:22px;height:22px;padding:0;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .16s ease}
.local-model-slot-assign i{font-size:12px}
.local-model-slot-assign:hover,.local-model-slot-assign.is-active{background:#f0f0f0;color:#111}
.local-model-current-pill{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;border:1px solid rgba(255,255,255,.18);font-size:11px;font-weight:700;color:#fff;background:rgba(255,255,255,.04)}
.local-model-current-pill i{font-size:12px;color:rgba(255,255,255,.75)}
.local-model-provider-badge{display:flex;align-items:center;justify-content:center;width:20px;height:20px;min-width:20px;min-height:20px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font-size:10px;line-height:1;color:#fff;flex:0 0 auto;text-align:center;padding:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.03);position:relative;top:0;transform:none!important;vertical-align:middle;overflow:hidden}
.local-model-provider-badge i,.local-model-provider-badge .hf-glyph,.local-model-provider-badge .model-provider-glyph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;line-height:1;transform:none!important;margin:0;padding:0}
.local-model-provider-badge i::before{display:block;line-height:1;margin:0}
.local-model-provider-badge.is-compact{width:100%;height:100%;min-width:100%;min-height:100%;border-width:1px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.local-model-provider-badge.is-compact i{font-size:10.5px}
.local-model-filter-btn .local-model-provider-badge.is-compact{width:100%;height:100%;min-width:100%;min-height:100%}
.local-model-filter-btn .local-model-provider-badge.is-compact i{font-size:10px}
.local-model-provider-button .local-model-provider-badge.is-compact{width:100%;height:100%;min-width:100%;min-height:100%;display:flex;align-items:center;justify-content:center}
.local-model-provider-button .local-model-provider-badge.is-compact i{font-size:11px}
.local-model-provider-button .local-model-provider-badge.huggingface.is-compact .hf-glyph{font-size:7px}
.local-model-provider-badge.huggingface{background:linear-gradient(180deg,#facc15,#eab308);border-color:rgba(254,240,138,.42);color:#ffffff;font-weight:900;font-size:10px;line-height:1}
.local-model-provider-badge.huggingface .hf-glyph{font-size:7px;font-weight:800;letter-spacing:-.01em}
.local-model-provider-badge.huggingface.is-compact{background:linear-gradient(180deg,#facc15,#eab308)!important;border-color:rgba(254,240,138,.42)!important;color:#ffffff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.local-model-provider-badge.huggingface.is-compact .hf-glyph{font-size:6.6px}
.local-model-provider-badge.qwen{position:relative;background:linear-gradient(180deg,#7c3aed,#5b21b6);border-color:rgba(196,181,253,.42);color:#ffffff;font-weight:800}
.local-model-provider-badge.qwen i{font-size:11px;color:#ffffff}
.local-model-provider-badge.qwen.is-compact{background:linear-gradient(180deg,#7c3aed,#5b21b6)!important;border-color:rgba(196,181,253,.42)!important;color:#ffffff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.local-model-provider-badge.qwen.is-compact i{font-size:11px}
.local-model-provider-badge.gemma{background:linear-gradient(180deg,#2563eb,#1d4ed8);border-color:rgba(147,197,253,.38);color:#ffffff;font-weight:800}
.local-model-provider-badge.gemma i{font-size:11px;color:#ffffff}
.local-model-provider-badge.gemma.is-compact{background:linear-gradient(180deg,#2563eb,#1d4ed8)!important;border-color:rgba(147,197,253,.38)!important;color:#ffffff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.local-model-provider-badge.ernie{position:relative;background:linear-gradient(180deg,#1b1b1d,#0b0b0b);border-color:rgba(255,255,255,.16);color:#ffffff;font-weight:800;display:flex;align-items:center;justify-content:center}
.local-model-provider-badge.ernie .model-provider-glyph,.local-model-provider-badge.granite .model-provider-glyph{font-size:10px;font-weight:800;letter-spacing:0}
.local-model-provider-badge.ernie.is-compact{background:linear-gradient(180deg,#1b1b1d,#0b0b0b)!important;border-color:rgba(255,255,255,.16)!important;color:#ffffff!important;font-size:8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.local-model-provider-badge.granite{background:linear-gradient(180deg,#3b82f6,#2563eb);border-color:rgba(191,219,254,.38);color:#fff;font-weight:800;font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center}
.local-model-provider-badge.granite.is-compact{background:linear-gradient(180deg,#3b82f6,#2563eb)!important;border-color:rgba(191,219,254,.38)!important;color:#ffffff!important;font-size:8.5px;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
        `;
        document.head.appendChild(style);
    }

    function closeLocalModelShortcutMenu() {
        const panel = document.getElementById(MODEL_MENU_ID);
        const trigger = document.getElementById("local-model-tier-menu-btn");
        if (panel) panel.classList.remove("is-open");
        if (trigger) trigger.classList.remove("is-open");
        shortcutSettingsOpen = false;
    }

    function getCatalogItems() {
        const typeRank = { gemma: 0, qwen: 1, granite: 2, ernie: 3 };
        return Object.values(getModelCatalog()).filter((item) => String(item && item.id ? item.id : "") !== "qwen_coder_05b_q3kl").map((item) => {
            const next = Object.assign({}, item || {});
            next.modelType = getModelTypeFromItem(next);
            return next;
        }).sort((a, b) => {
            const aRank = Object.prototype.hasOwnProperty.call(typeRank, a.modelType) ? typeRank[a.modelType] : 99;
            const bRank = Object.prototype.hasOwnProperty.call(typeRank, b.modelType) ? typeRank[b.modelType] : 99;
            if (aRank !== bRank) return aRank - bRank;
            return String(a && a.name ? a.name : "").localeCompare(String(b && b.name ? b.name : ""));
        });
    }

    function maybeStartActiveTierDownload(forceActivate) {
        if (typeof applyLocalModelProfileToConfig === "function") {
            applyLocalModelProfileToConfig();
        }
        isModelDownloaded = localStorage.getItem(getLocalDownloadStorageKey()) === "true";
        if (!isLocalActive && !forceActivate) return;
        if (!isLocalActive && forceActivate) {
            isLocalActive = true;
        }
        if (isModelDownloaded) {
            updateLocalBtnState();
            renderLocalModelTierSelector();
            syncLocalModelTierVisibility();
            startDownload();
            return;
        }
        isLocalActive = true;
        updateLocalBtnState();
        renderLocalModelTierSelector();
        syncLocalModelTierVisibility();
        startDownload();
    }

    function getPreferredChatTierForModelSelection() {
        const profiles = getLocalModelProfiles();
        const activeTier = String(getActiveLocalModelTier() || "").trim().toLowerCase();
        if (activeTier && activeTier !== "code" && profiles[activeTier]) {
            return activeTier;
        }
        if (profiles.middle) return "middle";
        if (profiles.light) return "light";
        if (profiles.hard) return "hard";
        const ordered = getOrderedLocalModelTierKeys().filter((tier) => tier !== "code");
        return ordered[0] || getDefaultLocalModelTier();
    }

    function handleShortcutProfileChange(slotKey, modelId, options) {
        const opts = Object.assign({ activateNow: false, showChangedToast: true }, options || {});
        const catalog = getModelCatalog();
        if (!catalog[modelId]) return;
        if (String(modelId) === "qwen_coder_05b_q3kl") return;
        localStorage.setItem(CHAT_MODEL_STORAGE_KEY, String(modelId));
        currentModelTypeFilter = getModelTypeFromItem(catalog[modelId]);
        const currentTier = String(getActiveLocalModelTier() || "").trim().toLowerCase();
        const targetTier = getPreferredChatTierForModelSelection();
        if (typeof applyLocalModelProfileToConfig === "function") {
            applyLocalModelProfileToConfig();
        }
        renderLocalModelTierSelector();
        syncLocalModelTierVisibility();
        if (currentTier === "code" && targetTier && typeof setLocalModelTier === "function") {
            setLocalModelTier(targetTier);
        } else {
            isLocalActive = true;
            isModelLoaded = false;
            localEngine = null;
            wllama = null;
            if (typeof setLocalRuntimeState === "function") setLocalRuntimeState(null);
            maybeStartActiveTierDownload(true);
        }
        const panel = document.getElementById(MODEL_MENU_ID);
        if (panel && panel.parentNode) {
            const shouldStayOpen = panel.classList.contains("is-open");
            buildShortcutMenu(panel.parentNode);
            if (shouldStayOpen) {
                const rebuiltPanel = document.getElementById(MODEL_MENU_ID);
                if (rebuiltPanel) rebuiltPanel.classList.add("is-open");
            }
        }
        if (opts.showChangedToast && typeof showToast === "function") showToast(getShortcutText("changed"));
    }

    function appendSummarySection(panel, currentProfiles) {
        const summary = document.createElement("div");
        summary.className = "local-model-shortcut-summary";
        SLOT_ORDER.forEach((slotKey) => {
            const row = document.createElement("div");
            row.className = "local-model-shortcut-summary-row";
            const label = document.createElement("div");
            label.className = "local-model-shortcut-label";
            label.textContent = getShortcutText(slotKey);
            const profile = currentProfiles[slotKey] || {};
            const chip = document.createElement("div");
            chip.className = "local-model-shortcut-chip";
            chip.innerHTML = `<span>${profile.modelName || "-"}</span><small>${profile.popupSizeText || ""}</small>`;
            row.appendChild(label);
            row.appendChild(chip);
            summary.appendChild(row);
        });
        panel.appendChild(summary);
    }

    function appendFilterRow(container, inHead) {
        const row = document.createElement("div");
        row.className = `local-model-filter-row${inHead ? " in-head" : ""}`;
        const meta = getModelTypeMeta();
        MODEL_TYPE_FILTER_ORDER.forEach((typeKey) => {
            const item = meta[typeKey];
            const button = document.createElement("button");
            button.type = "button";
            button.className = `local-model-filter-btn provider-${typeKey}${currentModelTypeFilter === typeKey ? " is-active" : ""}`;
            button.title = item.label;
            button.setAttribute("aria-label", item.label);
            button.innerHTML = getProviderBadgeHtml(typeKey, true);
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                currentModelTypeFilter = currentModelTypeFilter === typeKey ? "all" : typeKey;
                const panel = document.getElementById(MODEL_MENU_ID);
                if (panel) buildShortcutMenu(panel.parentNode);
            });
            row.appendChild(button);
        });
        if (container) container.appendChild(row);
        return row;
    }

    function appendCatalogCards(container, targetTierKey) {
        const currentProfiles = getResolvedLocalModelProfiles();
        const activeTier = String(targetTierKey || getActiveLocalModelTier() || "light").toLowerCase();
        const selectedChatModelId = getStoredChatModelId();
        const catalogGrid = document.createElement("div");
        catalogGrid.className = "local-model-catalog-grid";
        const items = getCatalogItems().filter((item) => currentModelTypeFilter === "all" ? true : item.modelType === currentModelTypeFilter);
        items.forEach((item) => {
            const isSelected = selectedChatModelId === item.id;
            const card = document.createElement("div");
            card.className = `local-model-catalog-card${isSelected ? " is-selected" : ""}`;

            const meta = document.createElement("div");
            meta.className = "local-model-catalog-meta";
            meta.innerHTML = `<div class="local-model-catalog-name" title="${item.name}">${item.name}</div>`;

            const iconWrap = document.createElement("div");
            iconWrap.className = "local-model-slot-actions";
            const providerHtml = getProviderBadgeHtml(item.modelType, true);
            iconWrap.innerHTML = `<span class="local-model-provider-button" aria-hidden="true">${providerHtml}</span><span class="local-model-size-pill">${item.popupSizeText || ""}</span>`;

            if (shortcutSettingsOpen) {
                const assignRow = document.createElement("div");
                assignRow.className = "local-model-assign-row";
                SLOT_ORDER.forEach((slotKey) => {
                    const assignButton = document.createElement("button");
                    assignButton.type = "button";
                    const isSlotSelected = slotKey !== "code" && selectedChatModelId === item.id;
                    assignButton.className = `local-model-slot-assign${isSlotSelected ? " is-active" : ""}`;
                    assignButton.title = getShortcutText(slotKey);
                    assignButton.setAttribute("aria-label", getShortcutText(slotKey));
                    assignButton.innerHTML = `<i class="${SLOT_ICON_MAP[slotKey] || "ri-circle-line"}"></i>`;
                    assignButton.addEventListener("click", function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        if (String(slotKey) === "code") return;
                        handleShortcutProfileChange(slotKey, item.id, {
                            activateNow: false,
                            showChangedToast: true
                        });
                    });
                    assignRow.appendChild(assignButton);
                });
                iconWrap.appendChild(assignRow);
            }

            card.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                handleShortcutProfileChange(activeTier, item.id, {
                    activateNow: false,
                    showChangedToast: false
                });
            });

            card.appendChild(meta);
            card.appendChild(iconWrap);
            catalogGrid.appendChild(card);
        });
        container.appendChild(catalogGrid);
    }

    function appendShortcutSelectors(container) {
        const currentProfiles = getResolvedLocalModelProfiles();
        const catalogItems = getCatalogItems();
        const grid = document.createElement("div");
        grid.className = "local-model-shortcut-select-grid";
        const selectedChatModelId = getStoredChatModelId();

        SLOT_ORDER.forEach((slotKey) => {
            const row = document.createElement("div");
            row.className = "local-model-shortcut-select-row";

            const label = document.createElement("div");
            label.className = "local-model-shortcut-label";
            label.textContent = getShortcutText(slotKey);

            const select = document.createElement("select");
            select.className = "local-model-shortcut-select";
            const selectedId = slotKey === "code"
                ? (currentProfiles[slotKey] ? currentProfiles[slotKey].modelId : "")
                : selectedChatModelId;

            catalogItems.forEach((item) => {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = item.name;
                if (item.id === selectedId) option.selected = true;
                select.appendChild(option);
            });

            select.addEventListener("change", function (event) {
                if (String(slotKey) === "code") return;
                handleShortcutProfileChange(slotKey, String(event.target.value || ""));
            });

            row.appendChild(label);
            row.appendChild(select);
            grid.appendChild(row);
        });

        container.appendChild(grid);
    }

    function buildShortcutMenu(wrapper) {
        if (!wrapper) return null;
        let panel = document.getElementById(MODEL_MENU_ID);
        if (!panel) {
            panel = document.createElement("div");
            panel.id = MODEL_MENU_ID;
            panel.className = "local-model-shortcut-panel";
            wrapper.appendChild(panel);
        }
        const topZone = document.getElementById("top-zone");
        if (topZone && topZone.clientHeight > 0) {
            const dynamicMaxHeight = Math.max(176, Math.min(236, topZone.clientHeight - 52));
            panel.style.height = `${dynamicMaxHeight}px`;
            panel.style.maxHeight = `${dynamicMaxHeight}px`;
        } else {
            panel.style.removeProperty("height");
            panel.style.removeProperty("max-height");
        }
        if (!panel.dataset.wheelBound) {
            panel.addEventListener("wheel", function (event) {
                event.stopPropagation();
            }, { passive: true });
            panel.dataset.wheelBound = "true";
        }
        const wasOpen = panel.classList.contains("is-open");
        panel.className = `local-model-shortcut-panel${shortcutSettingsOpen ? " is-assign-mode" : ""}${wasOpen ? " is-open" : ""}`;
        panel.innerHTML = "";
        const head = document.createElement("div");
        head.className = "local-model-shortcut-head";
        const activeTier = getActiveLocalModelTier();
        const filterRow = appendFilterRow(null, true);
        const tools = document.createElement("div");
        tools.className = "local-model-shortcut-tools";
        head.appendChild(filterRow);
        head.appendChild(tools);
        panel.appendChild(head);
        const scrollBox = document.createElement("div");
        scrollBox.className = "local-model-catalog-scroll";
        panel.appendChild(scrollBox);
        appendCatalogCards(scrollBox, activeTier);
        return panel;
    }

    function toggleLocalModelShortcutMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const panel = document.getElementById(MODEL_MENU_ID);
        const trigger = document.getElementById("local-model-tier-menu-btn");
        if (!panel) return;
        const willOpen = !panel.classList.contains("is-open");
        closeLocalModelShortcutMenu();
        if (willOpen) {
            panel.classList.add("is-open");
            if (trigger) trigger.classList.add("is-open");
        }
    }

    syncLocalModelTierVisibility = window.syncLocalModelTierVisibility = function (mode) {
        const wrapper = document.getElementById("local-model-tier-wrapper");
        if (!wrapper) return;
        const effectiveMode = String(mode || (document.body && document.body.getAttribute("data-ui-mode")) || currentMode || "chat").toLowerCase();
        const shouldShow = effectiveMode === "chat" || effectiveMode === "code";
        wrapper.style.display = shouldShow ? "block" : "none";
        if (!shouldShow) closeLocalModelShortcutMenu();
    };

    setLocalModelTier = window.setLocalModelTier = function (tierKey) {
        const profiles = getLocalModelProfiles();
        const nextTier = String(tierKey || "").trim().toLowerCase();
        if (!profiles[nextTier]) return;
        localStorage.setItem(getLocalModelTierStorageKey(), nextTier);
        localStorage.setItem(getLocalModelTierUserSetKey(), "true");
        applyLocalModelProfileToConfig();
        isLocalActive = true;
        isModelLoaded = false;
        localEngine = null;
        wllama = null;
        if (typeof setLocalRuntimeState === "function") setLocalRuntimeState(null);
        isModelDownloaded = localStorage.getItem(getLocalDownloadStorageKey()) === "true";
        updateLocalBtnState();
        renderLocalModelTierSelector();
        syncLocalModelTierVisibility();
        if (typeof showToast === "function") {
            showToast(getTierSwitchedToast(nextTier));
        }
        if (isModelDownloaded) {
            startDownload();
            return;
        }
        isLocalActive = true;
        syncLocalModelTierVisibility();
        startDownload();
    };

    renderLocalModelTierSelector = window.renderLocalModelTierSelector = function () {
        ensureShortcutMenuStyle();
        const wrapper = document.getElementById("local-model-tier-wrapper");
        const list = document.getElementById("local-model-tier-list");
        if (!wrapper || !list) return;
        const profiles = getLocalModelProfiles();
        const catalog = getModelCatalog();
        const selectedChatModelId = getStoredChatModelId();
        const selectedChatModel = selectedChatModelId && catalog[selectedChatModelId] ? catalog[selectedChatModelId] : null;
        const activeTier = getActiveLocalModelTier();
        const orderedTiers = getOrderedLocalModelTierKeys().filter((tier) => !!profiles[tier]);
        list.innerHTML = "";
        orderedTiers.forEach((tier) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `local-model-tier-btn${tier === activeTier ? " active" : ""}`;
            const displayLabel = getLocalizedLocalModelTierLabel(tier);
            const resolvedModelName = tier === "code"
                ? (profiles[tier] && profiles[tier].modelName ? profiles[tier].modelName : displayLabel)
                : (selectedChatModel && selectedChatModel.name ? selectedChatModel.name : (profiles[tier] && profiles[tier].modelName ? profiles[tier].modelName : displayLabel));
            button.classList.add("is-icon");
            button.innerHTML = getLocalModelTierIconMarkup(tier);
            button.title = resolvedModelName;
            button.setAttribute("aria-label", resolvedModelName);
            button.dataset.tier = tier;
            button.setAttribute("aria-pressed", tier === activeTier ? "true" : "false");
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                closeLocalModelShortcutMenu();
                setLocalModelTier(tier);
            });
            list.appendChild(button);
        });
        const localButton = document.createElement("button");
        localButton.type = "button";
        localButton.id = "btn-download";
        localButton.className = "local-model-tier-menu-btn";
        localButton.title = "Local Mode";
        localButton.setAttribute("aria-label", "Local Mode");
        localButton.innerHTML = '<i class="ri-ghost-4-line text-[14px]"></i>';
        localButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof handleLocalToggle === "function") {
                handleLocalToggle();
            }
        });
        list.appendChild(localButton);

        const gpuButton = document.createElement("button");
        gpuButton.type = "button";
        gpuButton.id = "btn-webgpu";
        gpuButton.className = "local-model-tier-menu-btn";
        gpuButton.title = "WebGPU";
        gpuButton.setAttribute("aria-label", "WebGPU");
        gpuButton.innerHTML = '<i class="ri-cpu-line text-[14px]"></i>';
        gpuButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof handleWebGPUToggle === "function") {
                handleWebGPUToggle();
            }
        });
        list.appendChild(gpuButton);

        const menuButton = document.createElement("button");
        menuButton.type = "button";
        menuButton.id = "local-model-tier-menu-btn";
        menuButton.className = "local-model-tier-menu-btn";
        menuButton.title = getShortcutText("menu");
        menuButton.setAttribute("aria-label", getShortcutText("menu"));
        menuButton.innerHTML = '<i class="ri-menu-4-line text-[14px]"></i>';
        menuButton.addEventListener("click", toggleLocalModelShortcutMenu);
        list.appendChild(menuButton);
        buildShortcutMenu(wrapper);
        syncLocalModelTierVisibility();
    };

    document.addEventListener("click", function (event) {
        const wrapper = document.getElementById("local-model-tier-wrapper");
        if (!wrapper) return;
        if (wrapper.contains(event.target)) return;
        closeLocalModelShortcutMenu();
    });

    document.addEventListener("DOMContentLoaded", function () {
        setTimeout(function () {
            if (typeof renderLocalModelTierSelector === "function") renderLocalModelTierSelector();
            if (typeof syncLocalModelTierVisibility === "function") syncLocalModelTierVisibility();
        }, 0);
    });
})();




