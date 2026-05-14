// extracted from main_asset.js: local model and generation helpers
let activeLocalInferenceRunId = Number(window.__ISAI_LOCAL_INFERENCE_RUN_ID__ || 0) || 0;

// Compatibility shim for mode/layout scripts that expect these globals.
if (typeof window !== "undefined") {
    if (typeof window.clearInlineStyleProps !== "function") {
        window.clearInlineStyleProps = function clearInlineStyleProps(node, props) {
            if (!node || !node.style) return;
            const list = Array.isArray(props) ? props : [];
            list.forEach((key) => {
                if (typeof key === "string" && key) node.style.removeProperty(key);
            });
        };
    }
    if (typeof window.__clearInlineStyleProps !== "function") {
        window.__clearInlineStyleProps = window.clearInlineStyleProps;
    }
}

function nextLocalInferenceRunId() {
    activeLocalInferenceRunId += 1;
    window.__ISAI_LOCAL_INFERENCE_RUN_ID__ = activeLocalInferenceRunId;
    return activeLocalInferenceRunId;
}

function terminateLocalRuntime(options = {}) {
    const runtime = wllama;
    const shouldReset = !!(options && options.reset);
    window.__ISAI_LOCAL_RUNTIME_STOPPING__ = true;
    nextLocalInferenceRunId();
    if (!runtime) {
        if (shouldReset) {
            isModelLoaded = false;
            wllama = null;
            if (typeof setLocalRuntimeState === "function") setLocalRuntimeState(null);
        }
        return;
    }
    const methods = ["abort", "stop", "cancel", "terminate", "interrupt"];
    for (const methodName of methods) {
        if (typeof runtime[methodName] === "function") {
            try {
                runtime[methodName]();
                break;
            } catch (error) {}
        }
    }
    if (shouldReset) {
        isModelLoaded = false;
        wllama = null;
        if (typeof setLocalRuntimeState === "function") setLocalRuntimeState(null);
    }
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

    const setActiveCharacterSession = typeof window.setCharacterChatSession === "function"
        ? window.setCharacterChatSession
        : (session) => {
            characterChatSession = session && session.active ? session : null;
            window.ISAI_CHARACTER_CHAT_SESSION = characterChatSession;
            if (typeof applyCharacterChatVisualState === "function") applyCharacterChatVisualState();
            return characterChatSession;
        };

    const activeCharacterSession = setActiveCharacterSession({
        active: true,
        imageUrl,
        prompt,
        nickname,
        sourceId,
        persona: null,
        locale
    });

    const introBubble = appendMsg("ai", "Opening chat...");
    let persona = null;
    if (hasStoredPersona) {
        persona = normalizeCharacterPersonaPayload(rawPersonaPayload, prompt, nickname, activeCharacterSession);
        persona.locale = locale;
    } else {
        persona = await generateCharacterPersonaForSession(activeCharacterSession);
        persona.locale = locale;
    }
    activeCharacterSession.persona = persona;
    setActiveCharacterSession(activeCharacterSession);
    if (!hasStoredPersona) {
        saveCharacterPersonaToStore(activeCharacterSession).catch(() => {});
    }

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
            : getCharacterSessionOpeningLine(activeCharacterSession)
    );
    if (introBubble) {
        introBubble.innerHTML = formatAiBubbleContent(openingLine);
    } else {
        appendMsg("ai", openingLine);
    }
    chatHistory = [];
    scrollBottom();
    setActiveCharacterSession(activeCharacterSession);

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

    document.body.classList.toggle("is-store-menu-open", shouldOpen);

    const chatStack = document.getElementById("chat-main-stack");
    const topZone = document.getElementById("top-zone");
    const storePanel = document.getElementById("store-panel");
    const appPanel = document.getElementById("app-container");
    const btnMenu = document.getElementById("btn-menu");

    if (chatStack) chatStack.classList.toggle("menu-mode", shouldOpen);
    if (topZone) topZone.classList.toggle("menu-mode", shouldOpen);
    if (storePanel) storePanel.classList.toggle("open", shouldOpen);
    if (btnMenu) btnMenu.classList.toggle("menu-open", shouldOpen);
    if (appPanel && shouldOpen) appPanel.classList.remove("open");

    isMenuOpen = shouldOpen;
    window.isMenuOpen = shouldOpen;

    if (shouldOpen && typeof fetchStoreApps === "function") {
        const promptInput = document.getElementById("prompt-input");
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
    if (typeof showLoader === "function") showLoader(true);
    try {
        const safeId = encodeURIComponent(String(id || "").trim());
        if (!safeId) {
            if (typeof showToast === "function") showToast("Invalid app id");
            return false;
        }
        const detailUrls = [
            `re_store.php?action=detail_app&id=${safeId}`,
            `/re_store.php?action=detail_app&id=${safeId}`,
            `./re_store.php?action=detail_app&id=${safeId}`
        ];
        let payload = null;
        let lastError = null;
        for (const url of detailUrls) {
            try {
                const response = await fetch(url, { credentials: "same-origin" });
                const json = await parseJsonResponseSafe(response);
                const candidate = (json && typeof json === "object" && "data" in json) ? json.data : json;
                if (candidate && !candidate.error) {
                    payload = candidate;
                    break;
                }
            } catch (err) {
                lastError = err;
            }
        }

        if (payload && !payload.error) {
            activeApp = normalizeAppPayload(payload) || payload;
            try {
                activateAppMode();
            } catch (uiError) {
                console.error("activateAppMode failed:", uiError);
            }

            const category = (activeApp.category || "").toLowerCase();
            if (typeof setMode === "function") {
                if (category === "code") setMode("code");
                else if (category === "image") setMode("image");
                else if (category === "music") setMode("music");
                else if (category === "video") setMode("video");
                else if (category === "blog") setMode("blog");
                else setMode("chat");
            }

            if (typeof showToast === "function") showToast(`App Loaded: ${normalizeAppDisplayText(activeApp.title, "App")}`);
            return true;
        } else {
            const reason = lastError && lastError.message ? ` (${lastError.message})` : "";
            if (typeof showToast === "function") showToast(`App not found${reason}`);
            if (lastError) console.error("detail_app request failed:", lastError);
            return false;
        }
    } catch (error) {
        console.error("loadAppDetails failed:", error, "id=", id);
        const message = error && error.message ? error.message : "unknown";
        if (typeof showToast === "function") showToast(`Error loading app details (${message})`);
        return false;
    } finally {
        if (typeof showLoader === "function") showLoader(false);
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
            strategist: "?諭??? ?袁⑥셽 ?브쑴苑띶첎???낅빍?? ???뼎 筌뤴뫚紐? ?醫뤾문筌왖, ?怨쀪퐨??뽰맄????쥓?ㅵ칰??類ｂ봺??뤾쉭?? ?館???? 筌띾Þ????쇱읈?類ㅼ몵嚥????릭?紐꾩뒄.",
            critic: "?諭??? ?귐딅뮞??野꺜???袁ⓓ?첎???낅빍?? 筌띾??? ?봔?臾믪뒠, 獄쏆꼶?, ??쎈솭 揶쎛?關苑??筌욎떝堉?雅뚯눘苑?? 筌욁룓???醫롫춦嚥?苡????릭?紐꾩뒄.",
            operator: "?諭??? ??쎈뻬 ?袁ⓓ?첎???낅빍?? 筌왖疫?獄쏅뗀以??怨몄뒠 揶쎛?館釉???ｍ? ??됰뻻, 筌ｋ똾寃뺟뵳?????袁⑼폒嚥????릭?紐꾩뒄.",
            synthesizer: "?諭??? ?????袁ⓓ?첎? ??띻퍍???ル굟鍮??롫뮉 ??뤾퐤 ??곷뻻??쎄쉘?紐꾩뿯??덈뼄. 餓λ쵎??? ??볤탢??랁? 揶쎛????쇱뒠?怨몄뵥 野껉퀡以롦???곸????類ｂ봺??곴퐣 ??롪돌???袁⑷쉐???????곗쨮 ?臾믨쉐??뤾쉭?? ????? ????癒?벥 ?紐꾨선嚥≪뮆彛??臾믨쉐??뤾쉭??"
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
    let generationToken = 0;
    const canContinueGeneration = () => !stopSignal && isGenerationTokenCurrent(generationToken);
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
    const rawInputText = inputElement ? normalizeChatSlashLineBreaks(inputElement.value || "") : "";
    let userText = normalizeChatSlashLineBreaks(overrideText || rawInputText);
    let userBubbleText = normalizeChatSlashLineBreaks(rawInputText || userText);

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
            userText = normalizeChatSlashLineBreaks(rawInputText);
            userBubbleText = normalizeChatSlashLineBreaks(rawInputText);
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
        generationToken = beginGenerationToken();
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
                        if (canContinueGeneration()) {
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
                    
                    if (canContinueGeneration()) speakText(extractPlainTextLocal(localResult), speechLang);
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

				const rawText = await response.text();
				let data = {};

				try {
					data = parseJsonTextSafe(rawText);
				} catch (e) {
					console.error("Search Data JSON parse failed:", rawText);
					throw new Error("Failed to parse search data response.");
				}

				if (data.results && data.results.length > 0) {
					const topResults = data.results.slice(0, 5);

					let contextStr = topResults
						.map((item, idx) => `[Source ${idx + 1}] ${item.content}`)
						.join("\n");

					const synthResponse = await fetch("?action=search_synthesis", {
						method: "POST",
						body: JSON.stringify({
							query: userText,
							context: contextStr
						}),
						signal: abortController.signal
					});

					const rawSynthText = await synthResponse.text();
					let synthData = {};

					try {
						synthData = parseJsonTextSafe(rawSynthText);
					} catch (e) {
						console.error("Search Synthesis JSON parse failed:", rawSynthText);
						throw new Error("Failed to parse search synthesis response.");
					}

					if (synthData.error === "LIMIT_REACHED") {

						showToast("Server limit reached. Local summarizing...");

						if (!isModelLoaded) {
							await startDownload();
						}

						const bubble = appendMsg("ai", "...");
						let localResult = "";

						const localPrompt = [
							{
								role: "system",
								content: "You are a summarization assistant."
							},
							{
								role: "user",
								content: `${contextStr}\nPlease summarize the above content.`
							}
						];

						await runLocalInference(
							localPrompt,
							(token, meta = {}) => {
								if (canContinueGeneration()) {
									localResult = meta.replace
										? token
										: (localResult + token);

									bubble.innerHTML = parseMarkdownLocal(localResult, false);
									scrollBottom();
								}
							},
							generationToken
						);

						if (canContinueGeneration()) {
							bubble.innerHTML = parseMarkdownLocal(localResult, true);

							addSourcesToBubble(bubble, topResults);

							scrollBottom();
						}

					} else if (synthData.error) {

						appendMsg("ai", `Error: ${synthData.error}`);

					} else {

						addSourcesToBubble(
							appendMsg("ai", synthData.html || "Thinking..."),
							topResults
						);
					}

				} else {

					appendMsg("ai", "No search results found.");
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
                    }, generationToken);
                    while (currentHistory.length > 0 && currentHistory[0].role !== "user") {
                        currentHistory.shift();
                    }
                } else {
                    currentHistory = [];
                }
                const activeLocalTierKey = typeof getActiveLocalModelTier === "function"
                    ? String(getActiveLocalModelTier() || "").trim().toLowerCase()
                    : "";
                const shouldOmitHistoryByTier = activeLocalTierKey === "light" || activeLocalTierKey === "middle";
                if (shouldOmitHistoryByTier) {
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
                        if (canContinueGeneration()) {
                            localResult = meta.replace ? token : (localResult + token);
                            if (!isScopedCodeEdit || !scopedTarget) {
                                setAssistantBubbleBodyLocal(bubble, localResult, { forcePlainText: shouldForceCodePrompt, isFinished: false });
                            }
                            scrollBottom();
                        }
                    }, generationToken);
                    
                    if (canContinueGeneration()) {
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
                            if (canContinueGeneration()) {
                                localResult = meta.replace ? token : (localResult + token);
                                if (!isScopedCodeEdit || !scopedTarget) {
                                    setAssistantBubbleBodyLocal(bubble, localResult, { forcePlainText: shouldForceCodePrompt, isFinished: false });
                                }
                                scrollBottom();
                            }
                        }, generationToken);

                        if (canContinueGeneration()) {
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
                    if (!canContinueGeneration()) return;
                    
                    if (data.error === "LIMIT_REACHED") {
                        await autoLocalFallbackRunner("Limit reached. Local Model...");
                    } else if (data.response) {
                        const renderedResponse = normalizeApiResponseForBubble(data.response, {
                            isCodeMode: shouldForceCodePrompt,
                            isTruncated: data.truncated === true
                        });
                        const bubble = appendMsg("ai", "...");
                        if (!canContinueGeneration()) return;
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
            if (!isGenerationTokenCurrent(generationToken)) return;
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
            if (!isGenerationTokenCurrent(generationToken)) return;
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

        const selectedGiphyUrl = getSelectedCommunityGiphyUrl();
		if (!userText && (!selectedGiphyUrl && (!fileInput.files || fileInput.files.length === 0))) {
			showToast("Please enter a message or attach a file.");
			return;
		}

        showLoader(true);
        try {
            const formData = new FormData();
            formData.append("content", userText);
            formData.append("password", password);
            formData.append("nickname", nickname);
            formData.append("type", "forum");

            if (selectedGiphyUrl) {
                formData.append("image_url", selectedGiphyUrl);
            } else if (fileInput.files.length > 0) {
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
    if (typeof clearCharacterChatSession === "function") {
        clearCharacterChatSession();
    }
    if (typeof isMenuOpen !== "undefined" && isMenuOpen && typeof toggleStoreMenu === "function") {
        toggleStoreMenu();
    }
    const activeAppStatus = document.getElementById("active-app-status");
    const activeAppName = document.getElementById("active-app-name");
    const promptInput = document.getElementById("prompt-input");
    const chatBox = document.getElementById("chat-box");
    if (activeAppStatus) activeAppStatus.classList.remove("hidden");
    if (activeAppName) activeAppName.innerText = safeAppTitle;
    if (promptInput) promptInput.value = "";
    if (chatBox) chatBox.innerHTML = "";

    if (typeof appendMsg === "function") {
        if (safeFirstMessage) {
            appendMsg("ai", safeFirstMessage);
        } else {
            appendMsg("ai", `App '${safeAppTitle}' started.`);
        }
    }
    if (typeof applyActiveAppProfileToChatInput === "function") {
        applyActiveAppProfileToChatInput();
    }
}



function exitAppMode() {
    activeApp = null;
    const activeAppStatus = document.getElementById("active-app-status");
    if (activeAppStatus) activeAppStatus.classList.add("hidden");
    if (typeof resetChat === "function") resetChat();
    if (typeof restoreDefaultChatInputProfile === "function") restoreDefaultChatInputProfile();
    if (typeof showToast === "function") showToast("App Mode Exited");
}

async function fetchApps(query = "", append = false) {
    const grid = document.getElementById("app-grid");

    if (!append) {
        currentAppPage = 1;
        hasMoreApps = true;
        currentAppQuery = query;
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

function resolveWllamaWasmPaths() {
    const configured = window.MODEL_CONFIG && window.MODEL_CONFIG.fallback && window.MODEL_CONFIG.fallback.wasmPaths;
    if (configured && typeof configured === "object") {
        const single = String(configured["single-thread/wllama.wasm"] || "").trim();
        const multi = String(configured["multi-thread/wllama.wasm"] || "").trim();
        if (single && multi) return configured;
    }
    return { ...DEFAULT_WLLAMA_WASM_PATHS };
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
    modelConfig.fallback.wasmPaths = resolveWllamaWasmPaths();
    modelConfig.preferredRuntime = "wllama";
    modelConfig.webllm = null;
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
    if (locale.startsWith("ko")) return "濡쒖뺄 紐⑤뜽 ?ㅼ슫濡쒕뱶";
    return "Download Local Model";
}

function getLocalModelPopupMessage() {
    const locale = String(document.documentElement.lang || navigator.language || "ko").toLowerCase();
    const profile = getActiveLocalModelProfile();
    if (locale.startsWith("ko")) {
        if (profile && profile.key === "light") {
            const sizeText = profile.popupSizeText || "257MB";
            return `?쇱씠??紐⑤뜽(${sizeText})???ㅼ슫濡쒕뱶?⑸땲??`;
        }
        if (profile && profile.key === "middle") {
            return "以묎컙 紐⑤뜽???ㅼ슫濡쒕뱶?⑸땲??";
        }
        if (profile && profile.key === "hard") {
            return "?섎뱶 紐⑤뜽???ㅼ슫濡쒕뱶?⑸땲??";
        }
        return "濡쒖뺄 紐⑤뜽???ㅼ슫濡쒕뱶?⑸땲??";
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
        const readySuffix = isModelDownloaded ? " (???깅뮧?β돦裕녻キ??" : "";
        showToast(`${getLocalizedLocalModelTierLabel(nextTier)} 嶺뚮ㅄ維????ルㅎ臾?{readySuffix}`);
    }
}
window.setLocalModelTier = setLocalModelTier;

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
    const locale = String(document.documentElement.lang || navigator.language || "en").toLowerCase();

    if (locale.startsWith("ko")) {
        return "濡쒖뺄 紐⑤뱶瑜??ъ슜?좉퉴??";
    }

    return "Enable local mode?";
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
        if (!isLocalActive) {
            stopGeneration();
            terminateLocalRuntime();
            isModelLoaded = false;
            setLocalRuntimeState(null);
            updateLocalBtnState();
            renderLocalModelTierSelector();
            syncLocalModelTierVisibility();
        } else if (isModelLoaded) {
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
    return promptArr
        .map((message) => ({
            role: message && typeof message.role === "string" ? message.role : "user",
            content: String(message && message.content != null ? message.content : "")
        }))
        .filter((message) => {
            if (message.content.trim().length <= 0) return false;
            if (message.role === "assistant" && isIgnorableAssistantGreeting(message.content)) return false;
            return true;
        });
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
    push("?덈뀞?섏꽭?? 臾댁뾿???꾩??쒕┫源뚯슂? ?삃");
    push("?덈뀞?섏꽭?? 臾댁뾿???꾩??쒕┫源뚯슂?");
    push("濡쒖뺄濡????덉쟾?섍쾶 ??뷀븯?몄슂");
    push("Hello! How can I help you? ?삃");
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
    push("濡쒖뺄濡????덉쟾?섍쾶 ??뷀븯?몄슂");
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

async function loadWllamaFallbackEngine(container, bar) {
    const modelConfig = window.MODEL_CONFIG || {};
    const fallbackConfig = modelConfig.fallback || {};
    const { Wllama, LoggerWithoutDebug } = window.WllamaObj || {};
    if (!fallbackConfig.wasmPaths) {
        fallbackConfig.wasmPaths = resolveWllamaWasmPaths();
        modelConfig.fallback = fallbackConfig;
        window.MODEL_CONFIG = modelConfig;
    }
    if (!Wllama) {
        throw new Error("Wllama runtime is not available.");
    }
    if (!fallbackConfig.url || !fallbackConfig.wasmPaths) {
        throw new Error("Local model configuration is missing.");
    }

    if (wllama && isModelLoaded) {
        return wllama;
    }

    if (!wllama) {
        wllama = new Wllama(fallbackConfig.wasmPaths, { logger: LoggerWithoutDebug });
    }

    await wllama.loadModelFromUrl(fallbackConfig.url, {
        progressCallback: ({ loaded, total }) => {
            if (container) container.classList.remove("hidden");
            if (total) {
                updateLocalProgress(bar, loaded / total);
            }
        }
    });

    setLocalRuntimeState("wllama");
    return wllama;
}

async function startDownload() {
    const container = document.getElementById("progress-container");
    const bar = document.getElementById("progress-bar");
    applyLocalModelProfileToConfig();
    window.__ISAI_LOCAL_RUNTIME_STOPPING__ = false;

    try {
        container.classList.remove("hidden");
        updateLocalProgress(bar, 0);
        await loadWllamaFallbackEngine(container, bar);

        isModelDownloaded = true;
        isModelLoaded = true;
        isLocalActive = true;
        localStorage.setItem(getLocalDownloadStorageKey(), "true");
        container.classList.add("hidden");
        updateLocalBtnState();

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
        setLocalRuntimeState(null);
        localStorage.removeItem(getLocalDownloadStorageKey());
    }
}

async function runLocalInference(promptArr, callback, generationToken = null) {
    if (isLocalActive && !isModelLoaded) {
        await startDownload();
    }
    const runToken = Number(generationToken) > 0 ? Number(generationToken) : Number(activeGenerationToken);
    const localRunId = nextLocalInferenceRunId();
    const localAbortController = abortController;
    const isCurrentLocalRun = () => (
        !stopSignal &&
        runToken === Number(activeGenerationToken) &&
        localRunId === Number(activeLocalInferenceRunId) &&
        !(localAbortController && localAbortController.signal && localAbortController.signal.aborted)
    );
    const messages = mapPromptMessagesForLocalEngine(promptArr);
    if (!messages.length) return;
    if (!wllama || !isCurrentLocalRun()) return;
    const runtime = wllama;
    const formatted = await runtime.formatChat(messages, true);
    if (!isCurrentLocalRun()) return;
    let streamedText = "";
    let resultText = "";
    try {
        resultText = await runtime.createCompletion(formatted, {
            sampling: { temp: 0.7, top_k: 40, top_p: 0.9 },
            signal: localAbortController ? localAbortController.signal : undefined,
            onNewToken: (token, piece, currentText) => {
                if (!isCurrentLocalRun()) return false;
                streamedText = String(currentText || streamedText);
                callback(streamedText, { replace: true });
                return true;
            }
        });
    } catch (error) {
        const abortLike = error && (error.name === "AbortError" || /abort|cancel|interrupt|terminate/i.test(String(error.message || "")));
        if (abortLike || !isCurrentLocalRun()) return;
        throw error;
    }
    if (!isCurrentLocalRun()) return;
    callback(String(resultText || streamedText || ""), { replace: true });
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
    beginGenerationToken();
    nextLocalInferenceRunId();
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    stopSignal = true;
    terminateLocalRuntime({ reset: true });
    document.querySelectorAll(".chat-bubble-waiting").forEach((node) => {
        if (node && node.parentElement) node.remove();
    });
    setMainGeneratingState(false);
    showLoader(false);
    if (typeof window.updateMainSubmitButtonState === "function") {
        window.updateMainSubmitButtonState();
    }
}

window.stopGeneration = stopGeneration;
window.runLocalInference = runLocalInference;
window.fetchStoreApps = fetchStoreApps;
window.loadAppDetails = loadAppDetails;
window.activateAppMode = activateAppMode;
window.exitAppMode = exitAppMode;

