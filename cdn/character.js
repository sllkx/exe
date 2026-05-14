// extracted from main_asset.js: character chat
let characterChatSession = null;

function getCharacterChatSession() {
    if (characterChatSession && characterChatSession.active) return characterChatSession;
    const externalSession = window.ISAI_CHARACTER_CHAT_SESSION;
    if (externalSession && externalSession.active) {
        characterChatSession = externalSession;
        return characterChatSession;
    }
    return null;
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

function isCorruptedCharacterText(raw) {
    const text = String(raw || "");
    if (!text) return false;
    if (/\uFFFD/.test(text)) return true;
    const questionMarks = (text.match(/\?/g) || []).length;
    const nonAscii = /[^\x00-\x7F]/.test(text);
    if (nonAscii && questionMarks >= Math.max(3, Math.floor(text.length / 5))) return true;
    return false;
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
    if (lang === "ko") return "\uce90\ub9ad\ud130";
    if (lang === "ja") return "\u30ad\u30e3\u30e9\u30af\u30bf\u30fc";
    if (lang === "es") return "Personaje";
    if (lang === "hi") return "Character";
    return "Character";
}

function getCharacterOpeningLinePool(lang) {
    const map = {
        ko: [
            "\uc548\ub155, \uc774\uc81c \uc5ec\uae30\uc11c \uc774\uc57c\uae30\ud574\ubcf4\uc790.",
            "\uae30\ub2e4\ub838\uc5b4. \uc624\ub298\uc740 \ubb50\ubd80\ud130 \ub9d0\ud574\uc904\uae4c?",
            "\uc88b\uc544, \uc624\ub298\uc740 \ub0b4\uac00 \ub124 \uc606\uc5d0 \uc788\uc744\uac8c.",
            "\ub2e4\uc2dc \ub9cc\ub098\uc11c \ubc18\uac00\uc6cc. \ud3b8\ud558\uac8c \ub9d0\ud574\uc918."
        ],
        en: [
            "Hey, nice to see you. What should we talk about first?",
            "Hi there. What is on your mind right now?",
            "Great to have you here. Want to start with something fun or something serious?",
            "Hello again. How are you feeling today?"
        ],
        ja: [
            "Hello. I am here with you now.",
            "Good to see you again. What should we talk about first?",
            "I was waiting. Tell me what is on your mind.",
            "Let us take it slowly. I am listening."
        ],
        es: [
            "Hola, me alegra verte. Por donde empezamos?",
            "Estoy aqui contigo. Que quieres contarme primero?",
            "Me alegra tenerte aqui. Prefieres algo divertido o algo serio?",
            "Bienvenido de nuevo. Como te sientes hoy?"
        ],
        hi: [
            "Hello, I am here with you now.",
            "Good to see you. What should we talk about first?",
            "Tell me what is on your mind.",
            "Let us talk comfortably."
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
    if (!text || looksLikeCharacterIdentifier(text) || isCorruptedCharacterText(text)) return getGenericCharacterName();
    return text;
}

function sanitizeCharacterOpeningLine(raw) {
    let text = sanitizeCharacterChatText(raw, 320);
    if (!text) return getGenericCharacterOpeningLine();
    if (looksLikeCharacterIdentifier(text) || isCorruptedCharacterText(text)) return getGenericCharacterOpeningLine();

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
    const pick = (value, maxLen) => {
        const text = sanitizeCharacterChatText(value, maxLen);
        return isCorruptedCharacterText(text) ? "" : text;
    };
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
        "You are roleplaying as a character",
        `name: ${persona.name}`,
        persona.age ? `age: ${persona.age}` : "",
        `Personality: ${persona.personality}`,
        `style: ${persona.speechStyle}`,
        `Background: ${persona.background}`,
        `context: ${activeSession.prompt || "N/A"}`
    ].join("\n");
}

