
let recognition = null;
let isVoiceProcessing = false;
let isVoiceListening = false;
let targetLangCode = "en-US";
let musicTokenizer = null;
let musicModel = null;
let currentMode = "chat";
let chatHistory =[];
let localWasmEngine = null;
let localRuntime = localStorage.getItem((window.MODEL_CONFIG && window.MODEL_CONFIG.runtimeKey) || "ISAI_LOCAL_MODEL_RUNTIME_V1") || null;
if (localRuntime === "wllama") localRuntime = "wasm";
const DEFAULT_LOCAL_MODEL_URL = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q3_k_m.gguf?download=true";
const LOCAL_WASM_VERSION = String(window.LOCAL_WASM_VERSION || "2.3.7");
const LOCAL_WASM_BASE_URL = String(
    window.LOCAL_WASM_BASE_URL
    || "/cdn/vendor/local-wasm/esm"
);
const DEFAULT_LOCAL_WASM_PATHS = (window.LOCAL_WASM_PATHS && typeof window.LOCAL_WASM_PATHS === "object")
    ? window.LOCAL_WASM_PATHS
    : {
        "single-thread/wllama.wasm": `${LOCAL_WASM_BASE_URL}/single-thread/local.wasm`,
        "multi-thread/wllama.wasm": `${LOCAL_WASM_BASE_URL}/multi-thread/local.wasm`
    };
const WAITING_DOTS_SVG_URL = "https://cdn.jsdelivr.net/gh/sllkx/icons@main/icon/3-dots-bounce.svg";
let isModelDownloaded = false;
let isModelLoaded = false;
let isLocalActive = false;
let isStarted = false;
let isGenerating = false;
let abortController = null;
let stopSignal = false;
let activeGenerationToken = Number(window.__ISAI_MAIN_GENERATION_TOKEN__ || 0) || 0;
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
window.__ISAI_MAIN_GENERATION_TOKEN__ = activeGenerationToken;

function beginGenerationToken() {
    activeGenerationToken += 1;
    window.__ISAI_MAIN_GENERATION_TOKEN__ = activeGenerationToken;
    return activeGenerationToken;
}

function isGenerationTokenCurrent(token) {
    return Number(token) > 0 && Number(token) === Number(activeGenerationToken);
}

function hardResetConversationState() {
    beginGenerationToken();
    if (abortController) {
        try { abortController.abort(); } catch (error) {}
        abortController = null;
    }
    stopSignal = true;
    chatHistory = [];
    window.__ISAI_CHAT_HISTORY_RESET_AT__ = Date.now();
    if (Array.isArray(window.extractedCodes)) window.extractedCodes = [];
    if (typeof clearContinueWriteContext === "function") clearContinueWriteContext();
    setMainGeneratingState(false);
    showLoader(false);
}

window.__isaiHardResetConversationState = hardResetConversationState;

function normalizeChatSlashLineBreaks(value) {
    return String(value ?? "").trim();
}

function normalizeAssistantSlashLineBreaks(value) {
    return String(value ?? "");
}

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
    const locale = String(
        (typeof LANG !== "undefined" && LANG) ||
        document.documentElement.lang ||
        navigator.language ||
        "en"
    ).toLowerCase();

    if (locale.startsWith("ko")) {
        return "... (응답이 길어 잘렸습니다. 아래 이어쓰기 아이콘을 눌러 계속 이어보세요.)";
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
        const fenceCount = (result.match(/```/g) || []).length;

        if (fenceCount % 2 === 1) {
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
    const koTail =
        "... (응답이 길어 잘렸습니다. 아래 이어쓰기 아이콘을 눌러 계속 이어보세요.)";

    const enTail =
        "... (Response was truncated here. Use the continue icon below to keep going.)";

    return String(text || "")
        .replace(koTail, "")
        .replace(enTail, "")
        .trim();
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

// extracted to /cdn/character.js
// extracted to /cdn/local-model.js
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
    let textToProcess = raw;
    const placeholders = [];

    // 1. 다중 라인 코드 블록 파싱 (실시간 타이핑 중 닫는 백틱이 없는 경우도 완벽 지원)
    textToProcess = textToProcess.replace(/```[ \t]*([a-zA-Z0-9_+\-#]*)[ \t]*\n?([\s\S]*?)(?:```|$)/g, function(match, lang, code) {
        // 코드 내부 특수문자 안전하게 치환 (HTML 깨짐 방지)
        const escapedCode = code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        
        // 상단 언어 이름 표시바 UI
        const langLabel = lang ? `<div style="font-size: 11px; color: #9ca3af; background: #2d2d2d; padding: 4px 12px; border-top-left-radius: 6px; border-top-right-radius: 6px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; border-bottom: 1px solid #3f3f46;">${lang}</div>` : '';
        const bgRadius = lang ? '0 0 6px 6px' : '6px';
        
        // 코드블록 전체 박스 UI
        const blockHtml = `
            <div class="code-block-wrapper" style="margin: 12px 0; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 6px rgba(0,0,0,0.2); text-align: left;">
                ${langLabel}
                <div style="background: #1e1e1e; padding: 12px; overflow-x: auto; border-radius: ${bgRadius};">
                    <pre style="margin: 0; white-space: pre; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.5; color: #d4d4d4;"><code>${escapedCode}</code></pre>
                </div>
            </div>`;
        
        const key = `__CODE_BLOCK_${placeholders.length}__`;
        placeholders.push({ key, html: blockHtml });
        return key; // 코드가 있던 자리를 임시 키로 치환
    });

    // 2. 인라인 코드 파싱 (`짧은 코드`)
    textToProcess = textToProcess.replace(/`([^`\n]+)`/g, function(match, code) {
        const escapedCode = code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        
        const inlineHtml = `<code style="background: rgba(128,128,128,0.15); padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; color: #e91e63; font-weight: 500;">${escapedCode}</code>`;
        
        const key = `__INLINE_CODE_${placeholders.length}__`;
        placeholders.push({ key, html: inlineHtml });
        return key; // 인라인 코드가 있던 자리를 임시 키로 치환
    });

    // 3. 밖으로 노출된 일반 텍스트 영역의 꺾쇠(<, >) 안전하게 치환
    // (이 과정이 없으면 사진처럼 HTML 코드를 뱉을 때 브라우저가 고장납니다)
    textToProcess = textToProcess
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 4. 일반 텍스트 영역의 엔터(줄바꿈)를 웹용 줄바꿈(<br>)으로 변환
    textToProcess = textToProcess.replace(/\n/g, "<br>");

    // 5. 임시 키로 치환해두었던 예쁜 코드블록 UI들을 원래 자리에 복구
    placeholders.forEach(item => {
        textToProcess = textToProcess.replace(item.key, item.html);
    });

    return textToProcess;
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

function waitingDotsHtmlLocal() {
    return `<img src="${WAITING_DOTS_SVG_URL}" alt="loading" class="chat-waiting-dots" style="display:block;width:28px;height:28px;object-fit:contain;pointer-events:none;" draggable="false">`;
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
            const normalizedContent = String(content ?? "").trim();
            if (normalizedContent === "...") {
                bubble.classList.add("chat-bubble-waiting");
                bubble.style.padding = "8px";
                bubble.style.width = "fit-content";
                bubble.style.minWidth = "44px";
                bubble.style.display = "inline-flex";
                bubble.style.alignItems = "center";
                bubble.style.justifyContent = "center";
                bubble.innerHTML = waitingDotsHtmlLocal();
            } else if (isLocalWelcomeGreeting(content)) {
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

// extracted to /cdn/code-editor.js
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
    const MODEL_TYPE_ORDER = ["all", "isai", "gemma", "huggingface", "qwen", "granite", "ernie"];
    const MODEL_TYPE_FILTER_ORDER = ["isai", "gemma", "huggingface", "qwen", "granite"];
    const ISAI_MODEL_LOGO_URL = "https://cdn.jsdelivr.net/gh/sllkx/icons@main/logo/isai2.png";
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
                isai: "ISAI",
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
                isai: "ISAI",
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
                isai: "ISAI",
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
                isai: "ISAI",
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
                isai: "ISAI",
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
            isai: { icon: "isai-logo", label: getShortcutText("isai") },
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
        if (hay.includes("vlite")) return "isai";
        if (hay.includes("gemma")) return "gemma";
        if (hay.includes("qwen")) return "qwen";
        if (hay.includes("granite")) return "granite";
        if (hay.includes("haru")) return "isai";
        if (hay.includes("kori")) return "isai";
        if (hay.includes("isai")) return "isai";
        if (hay.includes("ernie")) return "ernie";
        return "gemma";
    }

    function getProviderBadgeHtml(typeKey, compact) {
        const isCompact = !!compact;
        const sizeClass = isCompact ? " is-compact" : "";
if (typeKey === "huggingface") return `<span class="local-model-provider-badge huggingface${sizeClass}"><span class="hf-glyph">H</span></span>`;
        if (typeKey === "isai") return `<span class="local-model-provider-badge isai${sizeClass}"><img src="${ISAI_MODEL_LOGO_URL}" alt="ISAI" class="isai-logo-img"></span>`;
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
                next.preferredRuntime = catalogItem.preferredRuntime || next.preferredRuntime || "wasm";
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
		const typeRank = { isai: 0, gemma: 1, qwen: 2, granite: 3, ernie: 4, huggingface: 5 };

		// --- [추가된 부분: 카운트 데이터 불러오기] ---
		let usageStats = {};
		try {
			usageStats = JSON.parse(localStorage.getItem("ISAI_MODEL_USAGE_STATS") || "{}");
		} catch (error) {}
		// -----------------------------------------------

		return Object.values(getModelCatalog()).filter((item) => String(item && item.id ? item.id : "") !== "qwen_coder_05b_q3kl").map((item) => {
			const next = Object.assign({}, item || {});
			next.modelType = getModelTypeFromItem(next);
			
			// --- [추가된 부분: 모델 객체에 사용 횟수 주입] ---
			next.usageCount = next.pending || next.externalUrl ? -1 : usageStats[next.id] || 0;
			
			return next;
		}).sort((a, b) => {
			// --- [추가/수정된 부분: 1순위 정렬 (자주 쓰는 순)] ---
			if (b.usageCount !== a.usageCount) {
				return b.usageCount - a.usageCount; // 숫자가 큰(많이 쓴) 모델이 위로
			}
			
			// --- 2순위 정렬 (기존 로직 유지: 횟수가 같으면 제조사/이름순) ---
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
		if (catalog[modelId].pending || catalog[modelId].externalUrl) {
			if (catalog[modelId].externalUrl) {
				window.open(catalog[modelId].externalUrl, "_blank", "noopener");
			}
			return;
		}

		// --- [추가된 부분: 자주 쓰는 모델 카운트 기록] ---
		try {
			const usageStats = JSON.parse(localStorage.getItem("ISAI_MODEL_USAGE_STATS") || "{}");
			usageStats[modelId] = (usageStats[modelId] || 0) + 1;
			localStorage.setItem("ISAI_MODEL_USAGE_STATS", JSON.stringify(usageStats));
		} catch (error) {}
		// --------------------------------------------------

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
			localWasmEngine = null;
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

    let providerUsage = {};
    const originalOrder = MODEL_TYPE_FILTER_ORDER.slice();
    
    try {
        const usageStats = JSON.parse(localStorage.getItem("ISAI_MODEL_USAGE_STATS") || "{}");
        const catalog = getModelCatalog();
        
        Object.values(catalog).forEach(item => {
            if (usageStats[item.id]) {
                const type = getModelTypeFromItem(item);
                providerUsage[type] = (providerUsage[type] || 0) + usageStats[item.id];
            }
        });
    } catch (error) {}

    const dynamicOrder = [...originalOrder].sort((a, b) => {
        const countA = providerUsage[a] || 0;
        const countB = providerUsage[b] || 0;
        
        if (countB !== countA) {
            return countB - countA; // 횟수가 높은 제조사가 앞쪽으로
        }
        return originalOrder.indexOf(a) - originalOrder.indexOf(b);
    });
    dynamicOrder.forEach((typeKey) => {
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
            const isPending = !!(item.pending || item.externalUrl);
            const isSelected = !isPending && selectedChatModelId === item.id;
            const card = document.createElement("div");
            card.className = `local-model-catalog-card${isSelected ? " is-selected" : ""}${isPending ? " is-pending" : ""}`;
            if (isPending && item.externalUrl) {
                card.title = item.externalUrl;
            }

            const meta = document.createElement("div");
            meta.className = "local-model-catalog-meta";
            meta.innerHTML = `<div class="local-model-catalog-name" title="${item.name}">${item.name}</div>`;

            const iconWrap = document.createElement("div");
            iconWrap.className = "local-model-slot-actions";
            const providerHtml = getProviderBadgeHtml(item.modelType, true);
            const pendingText = item.popupSizeText || "\uC900\uBE44\uC911";
            iconWrap.innerHTML = isPending
                ? `<span class="local-model-pending-icon" aria-hidden="true"><i class="ri-time-line"></i></span><span class="local-model-size-pill is-pending">${pendingText}</span>`
                : `<span class="local-model-provider-button" aria-hidden="true">${providerHtml}</span><span class="local-model-size-pill">${item.popupSizeText || ""}</span>`;

            if (shortcutSettingsOpen && !isPending) {
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
                if (isPending && item.externalUrl) {
                    window.open(item.externalUrl, "_blank", "noopener");
                    return;
                }
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

            catalogItems.filter((item) => !(item.pending || item.externalUrl)).forEach((item) => {
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
        localWasmEngine = null;
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

window.startCharacterImageChat = function(id, imageUrl, prompt, personaName, personaPersonality) {
        console.log("🚀 [캐릭터챗 시작] 배경 무한 방어 모드 작동");

        // 1. 캐릭터 세션 데이터 생성
        const rawPayload = { name: personaName, personality: personaPersonality };
        const sessionSeed = { sourceId: id, imageUrl: imageUrl, prompt: prompt };
        
        let normalizedPersona = { name: personaName || "Character", personality: personaPersonality || "" };
        if (typeof normalizeCharacterPersonaPayload === 'function') {
            normalizedPersona = normalizeCharacterPersonaPayload(rawPayload, prompt, personaName, sessionSeed);
        }

        const charSession = {
            active: true,
            sourceId: id,
            imageUrl: imageUrl,
            prompt: prompt,
            persona: normalizedPersona
        };

        if (typeof setCharacterChatSession === 'function') {
            setCharacterChatSession(charSession);
        }

        // 🌟 2. [핵심] 배경 강제 주입 및 무한 방어 (Observer)
        if (imageUrl) {
            // 따옴표 오류 방지
            const safeUrl = imageUrl.replace(/"/g, "%22").replace(/'/g, "%27");
            const bgValue = `linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.85) 100%), url("${safeUrl}")`;

            // [방어 1] 전역 CSS 폭격 (Alpine.js가 인라인 스타일을 밀어버려도 살아남음)
            let styleTag = document.getElementById('isai-char-bg-force');
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = 'isai-char-bg-force';
                document.head.appendChild(styleTag);
            }
            styleTag.innerHTML = `
                body div#chat-box {
                    background: ${bgValue} !important;
                    background-color: #000000 !important;
                    background-size: contain !important;
                    background-position: center top !important;
                    background-repeat: no-repeat !important;
                }
            `;

            // 배경을 직접 꽂는 함수
			const enforceBackground = () => {
				const cb = document.getElementById('chat-box');
				if(cb) {
					// 1. background 전체 값을 가장 먼저 넣습니다. (여기서 한번 초기화 됨)
					cb.style.setProperty('background', bgValue, 'important');
					
					// 2. 그 아래에 세부 속성을 적어주어야 무시되지 않고 꽂힙니다.
					cb.style.setProperty('background-repeat', 'no-repeat', 'important'); // 가로/세로 반복 금지
					cb.style.setProperty('background-size', 'auto 100%', 'important'); // 가로 자동, 세로(높이) 100%
					cb.style.setProperty('background-position', 'center top', 'important');
				}
			};
            
            // 즉시 1차 적용
            enforceBackground();

            // [방어 2] 스타일 감시자(Observer) 부착: 누군가 배경을 지우면 즉시 반격
            const chatBoxEl = document.getElementById('chat-box');
            if (chatBoxEl) {
                if (window.__bgObserver) window.__bgObserver.disconnect(); // 기존 감시자 초기화
                
                window.__bgObserver = new MutationObserver(() => {
                    // 무한 루프에 빠지지 않게 감시자를 잠깐 끄고 -> 배경 칠하고 -> 다시 켬
                    window.__bgObserver.disconnect();
                    enforceBackground();
                    window.__bgObserver.observe(chatBoxEl, { attributes: true, attributeFilter: ['style', 'class'] });
                });
                
                window.__bgObserver.observe(chatBoxEl, { attributes: true, attributeFilter: ['style', 'class'] });
                console.log("🛡️ 배경 감시자(Observer) 부착 완료. 이제 아무도 배경을 지울 수 없습니다.");
            }
        }

        // 3. AI 뇌 설정
        try {
            const sysPromptEl = document.getElementById("assistant-system-prompt");
            if (sysPromptEl && typeof buildCharacterChatSystemPrompt === 'function') {
                sysPromptEl.value = buildCharacterChatSystemPrompt(charSession);
            }
        } catch(e) {}

        // 4. 모달창 닫기 및 인사말
        try {
            if (typeof closeImageModal === 'function') closeImageModal();
            if (typeof closeCharacterShareModal === 'function') closeCharacterShareModal();

            if (charSession.persona && charSession.persona.openingLine) {
                setTimeout(() => {
                    if (typeof appendMsg === 'function') appendMsg("ai", charSession.persona.openingLine);
                }, 500);
            }
        } catch(e) {}

        // 5. 모드 변경
        try {
            if (typeof setMode === 'function') setMode('chat');
        } catch (e) {
            console.warn("⚠️ setMode 에러:", e);
        }
    };

    // 링크로 직접 들어왔을 때 실행
    document.addEventListener("DOMContentLoaded", function () {
        setTimeout(function () {
            if (typeof renderLocalModelTierSelector === "function") renderLocalModelTierSelector();
            if (typeof syncLocalModelTierVisibility === "function") syncLocalModelTierVisibility();

            if (window.INITIAL_CHAR_SESSION && window.INITIAL_CHAR_SESSION.active) {
                window.startCharacterImageChat(
                    window.INITIAL_CHAR_SESSION.sourceId,
                    window.INITIAL_CHAR_SESSION.imageUrl,
                    window.INITIAL_CHAR_SESSION.prompt,
                    window.INITIAL_CHAR_SESSION.persona.name,
                    window.INITIAL_CHAR_SESSION.persona.personality
                );
            }
        }, 0);
    });
})();
