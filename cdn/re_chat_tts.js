(function () {
    const ICON_SEED = encodeURIComponent(String(window.ISAI_CLIENT_IP || "IP"));
    const ASSISTANT_ICON = `https://api.dicebear.com/7.x/identicon/svg?seed=${ICON_SEED}&backgroundColor=transparent`;
    const SERVER_I18N = window.ISAI_SERVER_I18N || {};

    const DEFAULT_ASSISTANT = {
        name: "ISAI",
        icon: ASSISTANT_ICON,
    };

    const LOCAL_WELCOME_CTA_MESSAGES = {
        ko: "로컬로 더 안전하게 대화하세요",
        en: "Chat more safely in local mode",
        ja: "ローカルモードでより安全に会話しましょう",
        zh: "在本地模式下更安全地聊天",
        "zh-tw": "在本地模式下更安全地對話",
        es: "Habla de forma mas segura en modo local",
        fr: "Discutez plus surement en mode local",
        de: "Sicherer im lokalen Modus chatten",
        pt: "Converse com mais seguranca no modo local",
        ru: "Общайтесь безопаснее в локальном режиме",
        ar: "تحدث بشكل أكثر أمانا في الوضع المحلي",
        hi: "लोकल मोड में और अधिक सुरक्षित तरीके से चैट करें",
        id: "Ngobrol lebih aman di mode lokal",
        vi: "Tro chuyen an toan hon o che do cuc bo",
        th: "แชทได้อย่างปลอดภัยยิ่งขึ้นในโหมดโลคัล",
        tr: "Yerel modda daha guvenli sohbet edin",
        it: "Chatta in modo piu sicuro in locale",
        nl: "Chat veiliger in lokale modus",
        pl: "Rozmawiaj bezpieczniej w trybie lokalnym"
    };

    const MODE_META = {
        chat: { badge: "Chat", kicker: "ISAI Assistant", title: "Ready to help.", subtitle: "Chat, search, and generated results stay inside this card.", hint: "Type here to keep the conversation and outputs inside this card.", placeholder: "" },
        expert: { badge: "Expert", kicker: "Expert Mode", title: "Compare multiple takes", subtitle: "Several expert-style passes are merged into one final answer.", hint: "Ask for a decision, plan, or comparison and this mode will synthesize it.", placeholder: "Ask for a deeper synthesized answer..." },
        search: { badge: "Search", kicker: "Search Mode", title: "Search the web", subtitle: "Summaries and source-backed answers stay in the same chat card.", hint: "Ask for news, links, or a quick web summary.", placeholder: "What should I search for?" },
        image: { badge: "Image", kicker: "Image Mode", title: "Create an image", subtitle: "Describe a scene and keep the preview in this chat workspace.", hint: "Describe the image you want to generate.", placeholder: "Describe the image you want..." },
        video: { badge: "Video", kicker: "Video Mode", title: "Create a motion clip", subtitle: "Storyboard-style generations stay in the same conversation.", hint: "Describe the motion or scene for the clip.", placeholder: "Describe the video you want..." },
        community: { badge: "Community", kicker: "Community Mode", title: "Post to the board", subtitle: "Write a forum-style post and attach an image if you want.", hint: "Add a nickname, password, and optional image before posting.", placeholder: "Write your community post..." },
        code: { badge: "Code", kicker: "Code Mode", title: "Build with code", subtitle: "Code responses stay paired with the workspace panel on the right.", hint: "Describe the code or file you want to generate.", placeholder: "Describe the code you want..." },
        blog: { badge: "Blog", kicker: "Blog Mode", title: "Draft a blog post", subtitle: "Long-form writing and image tags stay in this same thread.", hint: "Give the topic, tone, or structure you want for the post.", placeholder: "What should the blog post be about?" },
        voice: { badge: "Voice", kicker: "Voice Mode", title: "Talk naturally", subtitle: "Use the mic button to speak and keep the transcript in the card.", hint: "Tap the mic button to start or pause voice capture.", placeholder: "Voice mode listens through the mic." },
        translate: { badge: "Translate", kicker: "Translate Mode", title: "Translate both ways", subtitle: "Pick left and right languages, then translate in the chat card.", hint: "Use the left button for the source side and the right button for the target side.", placeholder: "Enter the text you want to translate..." },
        settings: { badge: "Settings", kicker: "Voice Settings", title: "Tune voice conversation", subtitle: "Choose language, voice, speed, and tone for spoken replies.", hint: "These settings apply to voice chat and spoken responses.", placeholder: "" },
        music: { badge: "Music", kicker: "Music Mode", title: "Generate audio", subtitle: "Music clips are rendered and returned in the same conversation.", hint: "Describe the mood, instruments, or energy for the track.", placeholder: "Describe the music you want..." },
        app: { badge: "Apps", kicker: "Shortcut Mode", title: "Browse shortcuts", subtitle: "Open saved shortcuts and run lightweight app flows from here.", hint: "Search the shortcut list or open the app panel from the side rail.", placeholder: "Search shortcuts..." }
    };

    Object.keys(SERVER_I18N.modeMeta || {}).forEach((modeKey) => {
        MODE_META[modeKey] = Object.assign({}, MODE_META[modeKey] || {}, SERVER_I18N.modeMeta[modeKey]);
    });

    const TTS_TEXT = Object.assign({ previewLabel: "Preview Voice", previewHelper: "Use your browser voice to preview settings.", failedToast: "Voice preview failed", errorPrefix: "TTS failed:" }, SERVER_I18N.ttsText || {});
    const VOICE_SETTINGS_STORAGE_KEY = "ISAI_VOICE_SETTINGS";
    const ASSISTANT_SETTINGS_STORAGE_KEY = "ISAI_ASSISTANT_SETTINGS";
    const RECENT_MODE_STORAGE_KEY = "ISAI_RECENT_MODES";
    const TRANSLATE_LANG_STORAGE_KEY = "ISAI_TRANSLATE_LANGS";
    const TRANSLATE_DEFAULTS = (() => { const defaults = SERVER_I18N.translationDefaults || {}; return { left: String(defaults.left || defaults.source || "English"), right: String(defaults.right || defaults.target || "Korean") }; })();
    const RECENT_MODE_LIMIT = 3;
    const TRACKED_RECENT_MODES = ["chat", "search", "image", "video", "community", "code", "blog", "voice", "translate", "music"];
    const DEFAULT_TTS_ENGINE = "browser";
    const DEFAULT_TTS_VOICE = "";
    const DEFAULT_TTS_STEPS = 1;
    const DEFAULT_TTS_SPEED = 1;
    const DEFAULT_TTS_VOLUME = 1;
    const DEFAULT_ASSISTANT_TONE = "friendly";
    const TTS_ENGINES = [{ id: "browser", label: "Browser Voice", chip: "SYS", icon: "ri-volume-up-line", description: "Use the browser built-in voice." }];
    const SUPER_TTS_LANGUAGES = [
        { id: "ko", label: "Korean", chip: "KO", icon: "ri-global-line" }, { id: "en", label: "English", chip: "EN", icon: "ri-global-line" },
        { id: "ja", label: "Japanese", chip: "JA", icon: "ri-global-line" }, { id: "zh", label: "Chinese", chip: "ZH", icon: "ri-global-line" },
        { id: "es", label: "Spanish", chip: "ES", icon: "ri-global-line" }, { id: "pt", label: "Portuguese", chip: "PT", icon: "ri-global-line" },
        { id: "fr", label: "French", chip: "FR", icon: "ri-global-line" }, { id: "de", label: "German", chip: "DE", icon: "ri-global-line" },
        { id: "ru", label: "Russian", chip: "RU", icon: "ri-global-line" }
    ];

    function getBrowserLanguage() {
        const lang = (navigator.language || navigator.userLanguage || "en").toLowerCase();
        if (lang.startsWith("ko")) return "ko";
        if (lang.startsWith("ja")) return "ja";
        if (lang.startsWith("zh")) return lang.includes("tw") || lang.includes("hk") ? "zh-tw" : "zh";
        if (lang.startsWith("es")) return "es";
        if (lang.startsWith("fr")) return "fr";
        if (lang.startsWith("de")) return "de";
        if (lang.startsWith("ru")) return "ru";
        if (lang.startsWith("pt")) return "pt";
        if (lang.startsWith("tr")) return "tr";
        if (lang.startsWith("th")) return "th";
        if (lang.startsWith("vi")) return "vi";
        if (lang.startsWith("id")) return "id";
        if (lang.startsWith("it")) return "it";
        if (lang.startsWith("nl")) return "nl";
        if (lang.startsWith("pl")) return "pl";
        if (lang.startsWith("ar")) return "ar";
        if (lang.startsWith("hi")) return "hi";
        return "en";
    }

    function escapeHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
    function isImageErrorMessage(value) { return /^Image Error:/i.test(String(value ?? "").trim()); }
    function imageErrorIconHtml(message) { const safeMessage = escapeHtml(String(message ?? "").trim() || "Image generation failed"); return `<span class="image-error-icon" title="${safeMessage}" aria-label="${safeMessage}"><i class="ri-image-line"></i><i class="ri-close-circle-fill image-error-icon-badge"></i></span>`; }
    function genericErrorIconHtml(message) { const safeMessage = escapeHtml(String(message ?? "").trim() || "Request failed"); return `<span class="image-error-icon" title="${safeMessage}" aria-label="${safeMessage}"><i class="ri-error-warning-line"></i><i class="ri-close-circle-fill image-error-icon-badge"></i></span>`; }
    function loadRecentModes() { try { const parsed = JSON.parse(localStorage.getItem(RECENT_MODE_STORAGE_KEY) || "[]"); if (!Array.isArray(parsed)) return []; return parsed.filter((mode) => TRACKED_RECENT_MODES.includes(mode)); } catch (error) { return []; } }
    function saveRecentModes(modes) { try { localStorage.setItem(RECENT_MODE_STORAGE_KEY, JSON.stringify(modes.slice(0, 8))); } catch (error) {} }
    
    function currentAppRef() { if (typeof activeApp !== "undefined" && activeApp) return activeApp; if (window.activeApp) return window.activeApp; return null; }
    function getCurrentMode() { if (typeof currentMode !== "undefined" && currentMode) return currentMode; if (typeof selectedMode !== "undefined" && selectedMode) return selectedMode; if (window.currentMode) return window.currentMode; if (window.selectedMode) return window.selectedMode; return "chat"; }

    function getTranslateSelectPair() { return { leftSelect: document.getElementById("trans-select-left"), rightSelect: document.getElementById("trans-select-right") }; }
    function getTranslateOptionValues(select) { return Array.from(select?.options || []).map((option) => option.value); }
    function pickTranslateValue(select, preferred, fallback) { const values = getTranslateOptionValues(select); if (!values.length) return ""; if (values.includes(preferred)) return preferred; if (values.includes(fallback)) return fallback; return values[0]; }
    function pickTranslateAlternative(select, avoidValue) { const values = getTranslateOptionValues(select); if (!values.length) return ""; if (avoidValue === "English" && values.includes("Spanish")) return "Spanish"; if (avoidValue !== "English" && values.includes("English")) return "English"; const alternative = values.find((value) => value !== avoidValue); return alternative || values[0]; }
    function loadTranslateLangSelection() { try { const parsed = JSON.parse(localStorage.getItem(TRANSLATE_LANG_STORAGE_KEY) || "{}"); if (!parsed || typeof parsed !== "object") return {}; return parsed; } catch (error) { return {}; } }
    function saveTranslateLangSelection(leftValue, rightValue) { try { localStorage.setItem(TRANSLATE_LANG_STORAGE_KEY, JSON.stringify({ left: leftValue, right: rightValue })); } catch (error) {} }
    function syncTranslateVoiceRecognition() { if (typeof updateRecognitionLang === "function") { try { updateRecognitionLang(); } catch (error) {} } }

    function syncFlagSelectTrigger(select) {
        if (!select) return;
        const root = select.closest(".flag-select");
        if (!root) return;
        const trigger = root.querySelector(".flag-select-trigger");
        const img = root.querySelector(".flag-select-img");
        const label = root.querySelector(".flag-select-label");
        const selected = select.options[select.selectedIndex] || select.options[0];
        if (!selected) return;

        const code = String(selected.dataset.code || selected.textContent || selected.value || "").trim().toUpperCase();
        const flag = String(selected.dataset.flag || "").trim();

        if (label) { label.textContent = code || selected.value; label.style.display = "none"; }
        if (img) { img.src = flag || ""; img.alt = `${selected.value} flag`; }
        if (trigger) { trigger.setAttribute("title", selected.value); }
    }

    function closeAllTranslateMenus(exceptRoot = null) {
        document.querySelectorAll(".flag-select").forEach((root) => {
            if (exceptRoot && root === exceptRoot) return;
            const trigger = root.querySelector(".flag-select-trigger");
            const menu = root.querySelector(".flag-select-menu");
            if (menu) { menu.classList.add("hidden"); menu.style.display = "none"; }
            if (trigger) trigger.setAttribute("aria-expanded", "false");
        });
    }

    function renderFlagSelectMenu(select) {
        const root = select?.closest(".flag-select");
        if (!root) return;
        const menu = root.querySelector(".flag-select-menu");
        if (!menu) return;
        menu.style.display = menu.classList.contains("hidden") ? "none" : "block";

        const options = Array.from(select.options || []);
        
        menu.innerHTML = options.map((option, index) => {
            const code = String(option.dataset.code || option.textContent || option.value || "").trim().toUpperCase();
            const flag = String(option.dataset.flag || "").trim();
            const isActive = option.value === select.value;
            const label = `${code} ${option.value}`.trim();
            return `
                <button type="button"
                    class="flag-select-item${isActive ? " is-active" : ""}"
                    data-option-index="${index}"
                    role="option"
                    aria-selected="${isActive ? "true" : "false"}"
                    aria-label="${escapeHtml(label)}"
                    title="${escapeHtml(option.value)}">
                    <img class="flag-select-img" src="${escapeHtml(flag)}" alt="${escapeHtml(option.value)} flag" loading="lazy" decoding="async">
                </button>
            `;
        }).join("");

        menu.querySelectorAll("[data-option-index]").forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                const index = Number(button.dataset.optionIndex);
                if (!Number.isFinite(index) || !options[index]) return;
                const nextValue = options[index].value;
                if (select.value !== nextValue) {
                    select.value = nextValue;
                    select.dispatchEvent(new Event("change", { bubbles: true }));
                } else {
                    syncFlagSelectTrigger(select);
                }
                closeAllTranslateMenus();
            });
        });
    }

    function normalizeTranslatePair(changedSide = null) {
        const { leftSelect, rightSelect } = getTranslateSelectPair();
        if (!leftSelect || !rightSelect) return;
        if (leftSelect.value === rightSelect.value) {
            if (changedSide === "left") { rightSelect.value = pickTranslateAlternative(rightSelect, leftSelect.value); } 
            else { leftSelect.value = pickTranslateAlternative(leftSelect, rightSelect.value); }
        }
        saveTranslateLangSelection(leftSelect.value, rightSelect.value);
        syncFlagSelectTrigger(leftSelect); syncFlagSelectTrigger(rightSelect);
        syncTranslateVoiceRecognition();
    }

    function applyTranslateDefaults(forceServerDefaults = false) {
        const { leftSelect, rightSelect } = getTranslateSelectPair();
        if (!leftSelect || !rightSelect) return;
        const saved = loadTranslateLangSelection();
        const nextLeft = forceServerDefaults ? TRANSLATE_DEFAULTS.left : String(saved.left || TRANSLATE_DEFAULTS.left);
        const nextRight = forceServerDefaults ? TRANSLATE_DEFAULTS.right : String(saved.right || TRANSLATE_DEFAULTS.right);
        leftSelect.value = pickTranslateValue(leftSelect, nextLeft, TRANSLATE_DEFAULTS.left);
        rightSelect.value = pickTranslateValue(rightSelect, nextRight, TRANSLATE_DEFAULTS.right);
        normalizeTranslatePair();
    }

    function bindTranslateSelect(select, side) {
        if (!select || select.dataset.flagBound === "1") return;
        select.dataset.flagBound = "1";
        const root = select.closest(".flag-select");
        const trigger = root ? root.querySelector(".flag-select-trigger") : null;
        const menu = root ? root.querySelector(".flag-select-menu") : null;
        if (trigger && menu) {
            trigger.addEventListener("click", (event) => {
                event.preventDefault();
                const willOpen = menu.classList.contains("hidden");
                closeAllTranslateMenus(willOpen ? root : null);
                if (willOpen) {
                    renderFlagSelectMenu(select);
                    menu.classList.remove("hidden"); menu.style.display = "block";
                    trigger.setAttribute("aria-expanded", "true");
                } else {
                    menu.classList.add("hidden"); menu.style.display = "none";
                    trigger.setAttribute("aria-expanded", "false");
                }
            });
        }
        select.addEventListener("change", () => { normalizeTranslatePair(side); renderFlagSelectMenu(select); });
        syncFlagSelectTrigger(select);
    }

    function initTranslateSelectors() {
        const { leftSelect, rightSelect } = getTranslateSelectPair();
        if (!leftSelect || !rightSelect) return;
        applyTranslateDefaults(false);
        bindTranslateSelect(leftSelect, "left"); bindTranslateSelect(rightSelect, "right");
        renderFlagSelectMenu(leftSelect); renderFlagSelectMenu(rightSelect);
        syncFlagSelectTrigger(leftSelect); syncFlagSelectTrigger(rightSelect);
        
        if (!window.__isaiTranslateOutsideClickBound) {
            window.__isaiTranslateOutsideClickBound = true;
            document.addEventListener("click", (event) => {
                const target = event.target;
                if (target instanceof Element && target.closest(".flag-select")) return;
                closeAllTranslateMenus();
            });
            document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeAllTranslateMenus(); });
        }
    }

    function getLocalizedWelcomeMessage() {
        const userLang = getBrowserLanguage();
        return LOCAL_WELCOME_CTA_MESSAGES[userLang] || LOCAL_WELCOME_CTA_MESSAGES.en;
    }

    // [강력한 감지 기능] 공백을 모조리 지우고 철자만 비교하여 서버가 어떤 형태로 보내든 잡아냅니다.
    function isLocalWelcomeCtaMessage(text) {
        if (!text) return false;
        const normalized = String(text).replace(/\s+/g, "").toLowerCase();

        // 1. 강제 키워드 매칭 (가장 확실한 방법)
        if (normalized.includes("chatmoresafely")) return true;
        if (normalized.includes("로컬로더안전하게")) return true;
        if (normalized.includes("howcanihelp")) return true;
        if (normalized.includes("무엇을도와드릴까요")) return true;

        // 2. 사전에 등록된 모든 다국어 문장 검사
        for (const msg of Object.values(LOCAL_WELCOME_CTA_MESSAGES)) {
            if (normalized.includes(String(msg).replace(/\s+/g, "").toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    function activateLocalModeFromWelcomeBubble() {
        if (typeof isLocalActive !== "undefined" && !!isLocalActive) {
            if (typeof showToast === "function") showToast("이미 로컬 모드가 활성화되어 있습니다.");
            return;
        }
        if (typeof handleLocalToggle !== "function") return;
        Promise.resolve(handleLocalToggle()).then(() => {
            if (typeof showToast === "function") showToast("로컬 모드를 활성화했습니다.");
        }).catch(() => {});
    }

    // [강제 변환 함수] 무조건 기존 내용을 부수고 번역된 내용으로 교체합니다.
    function bindWelcomeCtaBubble(bubble) {
        if (!bubble) return;
        const localizedText = getLocalizedWelcomeMessage();

        bubble.classList.add("chat-welcome-cta");
        bubble.innerHTML = ""; // 기존 영어 내용 완벽하게 파괴

        const inner = document.createElement("span");
        inner.className = "chat-welcome-cta-inner";

        const icon = document.createElement("i");
        icon.className = "ri-ghost-4-line chat-welcome-cta-icon";
        icon.setAttribute("aria-hidden", "true");

        const text = document.createElement("span");
        text.className = "chat-welcome-cta-text";
        text.innerHTML = escapeHtml(localizedText).replace(/\n/g, "<br>");

        inner.appendChild(icon);
        inner.appendChild(text);
        bubble.appendChild(inner);

        bubble.setAttribute("role", "button");
        bubble.setAttribute("tabindex", "0");
        bubble.setAttribute("title", "클릭해서 로컬 모드를 활성화");

        if (bubble.dataset.welcomeCtaBound !== "1") {
            bubble.dataset.welcomeCtaBound = "1";
            bubble.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); activateLocalModeFromWelcomeBubble(); });
            bubble.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateLocalModeFromWelcomeBubble(); } });
        }
    }

    function hasActiveCharacterChatSession() { return !!(window.ISAI_CHARACTER_CHAT_SESSION && window.ISAI_CHARACTER_CHAT_SESSION.active); }

    function getAssistantInfo() {
        const appRef = currentAppRef();
        if (appRef) { return { name: appRef.title || DEFAULT_ASSISTANT.name, icon: ASSISTANT_ICON, subtitle: appRef.description || appRef.summary || "" }; }
        return DEFAULT_ASSISTANT;
    }

    function buildAvatarContent(info, fallbackClass) {
        const name = (info && info.name) || DEFAULT_ASSISTANT.name;
        const icon = info && info.icon;
        if (icon) { return `<img src="${escapeHtml(icon)}" alt="${escapeHtml(name)}" onerror="this.remove();this.nextElementSibling.style.display='flex';"><span class="${fallbackClass}" style="display:none;">${escapeHtml(name.charAt(0).toUpperCase())}</span>`; }
        return `<span class="${fallbackClass}">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
    }

    function updateHeaderAvatar(info) { const wrapper = document.querySelector("#chat-profile-card .chat-profile-avatar"); if (wrapper) wrapper.innerHTML = buildAvatarContent(info, "chat-profile-fallback"); }

    function updateComposerMeta(mode = getCurrentMode()) {
        const meta = MODE_META[mode] || MODE_META.chat;
        const assistant = getAssistantInfo();
        const appRef = currentAppRef();

        const kicker = document.getElementById("composer-profile-kicker");
        const title = document.getElementById("composer-profile-title");
        const subtitle = document.getElementById("composer-profile-subtitle");
        const badge = document.getElementById("chat-mode-badge");
        const hint = document.getElementById("composer-mode-hint");
        const input = document.getElementById("prompt-input");

        if (kicker) kicker.textContent = appRef ? "App Mode" : meta.kicker;
        if (title) title.textContent = appRef ? assistant.name : meta.title;
        if (subtitle) { const st = appRef && assistant.subtitle ? assistant.subtitle : meta.subtitle; subtitle.textContent = st.length > 140 ? `${st.slice(0, 137)}...` : st; }
        if (badge) badge.textContent = meta.badge;
        if (hint) hint.textContent = meta.hint;
        if (input && !hasActiveCharacterChatSession()) input.placeholder = "";
        
        updateHeaderAvatar(assistant);
    }

    function readRecentModes() { try { const raw = localStorage.getItem(RECENT_MODE_STORAGE_KEY); const parsed = JSON.parse(raw || "[]"); if (!Array.isArray(parsed)) return []; return parsed.filter((mode, index, list) => (typeof mode === "string" && TRACKED_RECENT_MODES.includes(mode) && list.indexOf(mode) === index)); } catch (error) { return []; } }
    function writeRecentModes(modes) { try { localStorage.setItem(RECENT_MODE_STORAGE_KEY, JSON.stringify((Array.isArray(modes) ? modes : []).slice(0, RECENT_MODE_LIMIT + 1))); } catch (error) { return; } }
    function rememberRecentMode(mode) { if (!TRACKED_RECENT_MODES.includes(mode)) return; const nextModes = [mode].concat(readRecentModes().filter((item) => item !== mode)); writeRecentModes(nextModes); }
    function getModeButton(mode) { return document.getElementById(`btn-${mode}`); }
    function getModeButtonMarkup(mode) { const btn = getModeButton(mode); return btn ? btn.innerHTML : `<span>${escapeHtml(String(mode || "?").charAt(0).toUpperCase())}</span>`; }
    function getModeButtonLabel(mode) { const btn = getModeButton(mode); if (!btn) return mode; return btn.getAttribute("aria-label") || btn.getAttribute("title") || mode; }
    function getRenderableRecentModes(currentModeValue) { return readRecentModes().filter((mode) => mode !== currentModeValue).filter((mode) => !!getModeButton(mode)).slice(0, getRecentModeLimit()); }
    function syncRecentModePadding(count) { const field = document.getElementById("chat-input-field"); if (field) field.style.setProperty("padding-right", "0px", "important"); }

    function renderRecentModeActions(currentModeValue = getCurrentMode()) {
        const container = document.getElementById("recent-mode-actions");
        if (!container) return;
        const recentModes = getRenderableRecentModes(currentModeValue);
        container.innerHTML = "";
        if (!recentModes.length) { container.classList.add("hidden"); syncRecentModePadding(0); return; }

        recentModes.forEach((mode) => {
            const button = document.createElement("button");
            const label = getModeButtonLabel(mode);
            button.type = "button"; button.className = "input-action-btn recent-mode-btn";
            button.dataset.mode = mode; button.setAttribute("aria-label", label); button.setAttribute("title", label);
            button.innerHTML = getModeButtonMarkup(mode);
            button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); if (typeof setMode === "function") setMode(mode); });
            container.appendChild(button);
        });

        container.classList.remove("hidden");
        syncRecentModePadding(recentModes.length);
    }

    function decodeHtmlEntities(value) { const textarea = document.createElement("textarea"); textarea.innerHTML = String(value ?? ""); return textarea.value; }
    function sanitizeAssistantHtml(value) { return String(value ?? "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/<img\b[^>]*>/gi, "").replace(/\son\w+=(["']).*?\1/gi, "").replace(/\son\w+=([^\s>]+)/gi, "").replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"'); }
    function getAssistantEmptyFallback() { const uiLanguage = getBrowserLanguage(); const map = { ko: "응답을 불러오지 못했습니다.", en: "I could not load a response." }; return map[uiLanguage] || map.en; }

    function normalizeMessageHtml(role, content) {
        const text = String(content ?? "");
        if (role === "user") return escapeHtml(text).replace(/\n/g, "<br>");
        const decoded = decodeHtmlEntities(text);
        const sanitizedDecoded = sanitizeAssistantHtml(decoded);
        const sanitizedRaw = sanitizeAssistantHtml(text);
        const htmlCandidate = /<\/?[a-z][^>]*>/i.test(sanitizedDecoded) ? sanitizedDecoded : sanitizedRaw;
        const rendered = htmlCandidate.replace(/&lt;br\s*\/?&gt;/gi, "<br>").replace(/\n/g, "<br>");
        const plainText = decodeHtmlEntities(rendered).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (plainText) return rendered;
        const fallbackText = decodeHtmlEntities(text).replace(/\s+/g, " ").trim() || getAssistantEmptyFallback();
        return escapeHtml(fallbackText).replace(/\n/g, "<br>");
    }

    function ensureChatSpacer(chatBox) {
        if (!chatBox) return null;
        const first = chatBox.firstElementChild;
        if (first && first.classList && first.classList.contains("chat-spacer")) return first;
        let spacer = chatBox.querySelector(".chat-spacer");
        if (!spacer) { spacer = document.createElement("div"); spacer.className = "chat-spacer"; spacer.setAttribute("aria-hidden", "true"); }
        chatBox.prepend(spacer);
        return spacer;
    }

    function overwriteAppendMsg() {
        if (typeof appendMsg !== "function") return;
        appendMsg = function (role, content) {
            const chatBox = document.getElementById("chat-box");
            if (!chatBox) return null;
            ensureChatSpacer(chatBox);
            const entries = chatBox.querySelectorAll(".chat-entry");
            if (entries.length > 60) { const oldest = entries[0]; if (oldest && oldest.parentNode) oldest.parentNode.removeChild(oldest); }

            const wrapper = document.createElement("div");
            const body = document.createElement("div");
            const bubble = document.createElement("div");

            if (role === "user") {
                wrapper.className = "chat-entry user-entry";
                body.className = "chat-entry-body";
                bubble.className = "chat-bubble-user";
                bubble.innerHTML = normalizeMessageHtml("user", content);
                body.appendChild(bubble); wrapper.appendChild(body);
            } else {
                wrapper.className = "chat-entry ai-entry";
                body.className = "chat-entry-body";
                const isError = role === "error";
                const imageError = isError && isImageErrorMessage(content);
                
                // [가로채기] AI 답변이 그려지기 전에 인사말이면 강제로 변환
                let isWelcome = false;
                if (!isError && isLocalWelcomeCtaMessage(content)) {
                    isWelcome = true;
                }

                bubble.className = isError ? "chat-bubble-image-error" : "chat-bubble-ai";
                bubble.innerHTML = isError ? (imageError ? imageErrorIconHtml(content) : genericErrorIconHtml(content)) : normalizeMessageHtml(role, content);
                
                // 렌더링된 이후 강제 컴포넌트 교체
                if (isWelcome) bindWelcomeCtaBubble(bubble);
                
                body.appendChild(bubble); wrapper.appendChild(body);
            }
            chatBox.appendChild(wrapper);
            if (typeof scrollBottom === "function") scrollBottom();
            return bubble;
        };
        window.appendMsg = appendMsg;
    }

    function ensureWelcomeMessage(force = false) {
        if (hasActiveCharacterChatSession()) return;
        if (window.ISAI_ENABLE_DEFAULT_WELCOME !== true) return;
        const chatBox = document.getElementById("chat-box");
        if (!chatBox) return;
        if (force) chatBox.innerHTML = "";
        ensureChatSpacer(chatBox);
        if (chatBox.querySelector(".chat-entry")) return;
        
        const welcomeMessage = getLocalizedWelcomeMessage();
        if (typeof appendMsg === "function") {
            const bubble = appendMsg("ai", welcomeMessage);
            bindWelcomeCtaBubble(bubble);
            return;
        }
    }

    function wrapResetChat() {
        if (typeof resetChat !== "function") return;
        const originalResetChat = resetChat;
        resetChat = function () {
            const result = originalResetChat.apply(this, arguments);
            setTimeout(() => {
                if (hasActiveCharacterChatSession()) { updateComposerMeta(getCurrentMode()); return; }
                ensureWelcomeMessage(true); updateComposerMeta("chat");
            }, 0);
            return result;
        };
        window.resetChat = resetChat;
    }

    function syncCodeWorkspace(mode) {
        if (typeof window.syncInlineCodePanel === "function") {
            window.syncInlineCodePanel(mode);
            return;
        }

        mode = mode || "chat";
        if (document.body) document.body.setAttribute("data-ui-mode", mode);

        const rightPanel = document.getElementById("right-panel");
        const rightPanelOriginAnchor = document.getElementById("right-panel-origin-anchor");
        const desktopCodePanelHost = document.getElementById("desktop-code-panel-host");
        
        const isCodeMode = mode === "code";
        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || null;
        const fullscreenActive = !!(fullscreenElement && fullscreenElement.classList && fullscreenElement.classList.contains("island-box"));
        const mobileCodeMode = isCodeMode && vw <= 900;
        const desktopCodeMode = isCodeMode && vw > 900;

        if (!rightPanel) return;

        if (rightPanelOriginAnchor && rightPanelOriginAnchor.parentElement && desktopCodePanelHost) {
            if (desktopCodeMode && !fullscreenActive) {
                if (rightPanel.parentElement !== desktopCodePanelHost) desktopCodePanelHost.appendChild(rightPanel);
            } else {
                if (rightPanel.parentElement !== rightPanelOriginAnchor.parentElement) rightPanelOriginAnchor.parentElement.insertBefore(rightPanel, rightPanelOriginAnchor.nextSibling);
            }
        }

        document.body.classList.toggle("mode-code", isCodeMode);
        document.body.classList.toggle("desktop-code-open", desktopCodeMode);
        document.body.classList.toggle("desktop-code-panel-mounted", desktopCodeMode && !fullscreenActive);
        document.body.classList.remove("desktop-code-stage");
        rightPanel.classList.toggle("mobile-active", mobileCodeMode);

        if (isCodeMode) {
            const codeTabs = document.getElementById("code-tabs");
            const codeEditor = document.getElementById("code-editor");
            if (codeTabs && !codeTabs.querySelector(".code-tab-btn")) {
                codeTabs.innerHTML = '<div class="code-panel-empty"><span class="code-panel-empty-icon"><i class="ri-ai-generate-text text-sm"></i></span><span class="code-panel-empty-dots" aria-hidden="true"><span></span><span></span><span></span></span></div>';
            }
            if (codeEditor && !String(codeEditor.value || "").trim()) {
                codeEditor.value = "// Describe the code you want and generated files will appear here.";
            }

            setTimeout(() => {
                try {
                    (desktopCodeMode && desktopCodePanelHost ? desktopCodePanelHost : rightPanel).scrollIntoView({ behavior: "smooth", block: "start" });
                } catch (error) {}
            }, vw <= 900 ? 90 : 20);
        }

        if (typeof window.__applyMobileChatRailSafety === "function") {
            [0, 60, 160, 360].forEach((delay) => { setTimeout(window.__applyMobileChatRailSafety, delay); });
        }
    }
    window.syncCodeWorkspace = syncCodeWorkspace;

    function wrapModeSetters() {
        if (typeof setMode !== "function") return;
        const originalSetMode = setMode;
        setMode = function (mode) {
            if (mode !== "voice" && typeof stopVoiceMode === "function") { try { stopVoiceMode(true); } catch (error) {} }
            const result = originalSetMode.apply(this, arguments);
            try { currentMode = mode; } catch (error) {} try { selectedMode = mode; } catch (error) {}
            window.currentMode = mode; window.selectedMode = mode;
            rememberRecentMode(mode);
            
            const ttsControls = document.getElementById("tts-controls");
            const chatBox = document.getElementById("chat-box");
            const chatStack = document.getElementById("chat-main-stack");
            const topZone = document.getElementById("top-zone");
            const leftVoiceButton = document.getElementById("btn-submit-left");
            const chatInputShell = document.getElementById("chat-input-shell");
            
            if (ttsControls) ttsControls.classList.toggle("hidden", mode !== "settings");
            if (chatBox) chatBox.classList.toggle("hidden", mode === "settings");
            if (chatStack) chatStack.classList.toggle("settings-mode", mode === "settings");
            if (topZone) topZone.classList.toggle("settings-mode", mode === "settings");
            if (chatInputShell) chatInputShell.classList.toggle("hidden", mode === "settings");
            
            syncCodeWorkspace(mode);
            
            if (leftVoiceButton) { leftVoiceButton.classList.remove("hidden"); leftVoiceButton.style.display = "flex"; }
            if (mode === "chat") { setTimeout(() => ensureWelcomeMessage(false), 0); }
            if (mode === "translate") { initTranslateSelectors(); syncTranslateVoiceRecognition(); } 
            else { closeAllTranslateMenus(); }
            
            updateComposerMeta(mode);
            renderRecentModeActions(mode);
            return result;
        };
        window.setMode = setMode;
    }

    function initChatTtsUi() {
        overwriteAppendMsg();
        wrapResetChat();
        wrapModeSetters();

        // [핵심] 페이지 접속 시 서버가 이미 그려둔 영어 말풍선이 있는지 스캔하고, 있다면 기기 언어로 박살냅니다!
        const chatBox = document.getElementById("chat-box");
        if (chatBox) {
            chatBox.querySelectorAll(".chat-bubble-ai").forEach(bubble => {
                if (isLocalWelcomeCtaMessage(bubble.textContent || "")) {
                    bindWelcomeCtaBubble(bubble);
                }
            });
        }

        ensureWelcomeMessage(false);
        updateComposerMeta(getCurrentMode());
        renderRecentModeActions(getCurrentMode());
        
        if (!window.__isaiRecentModeResizeBound) {
            window.addEventListener("resize", () => renderRecentModeActions(getCurrentMode()));
            window.__isaiRecentModeResizeBound = true;
        }

        const ttsControls = document.getElementById("tts-controls");
        const chatStack = document.getElementById("chat-main-stack");
        const topZone = document.getElementById("top-zone");
        const chatInputShell = document.getElementById("chat-input-shell");
        
        if (ttsControls) ttsControls.classList.toggle("hidden", getCurrentMode() !== "settings");
        if (chatBox) chatBox.classList.toggle("hidden", getCurrentMode() === "settings");
        if (chatStack) chatStack.classList.toggle("settings-mode", getCurrentMode() === "settings");
        if (topZone) topZone.classList.toggle("settings-mode", getCurrentMode() === "settings");
        if (chatInputShell) chatInputShell.classList.toggle("hidden", getCurrentMode() === "settings");
        
        syncCodeWorkspace(getCurrentMode());
        if (getCurrentMode() === "translate") { syncTranslateVoiceRecognition(); }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initChatTtsUi);
    } else {
        initChatTtsUi();
    }
})();

function getRecentModeLimit() {
    return 1;
}