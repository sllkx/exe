(function () {
    const ASSISTANT_ICON = "https://api.dicebear.com/7.x/identicon/svg?seed=IP&backgroundColor=transparent";
    const USER_ICON = "https://api.dicebear.com/7.x/identicon/svg?seed=IP&backgroundColor=transparent";
    const SERVER_I18N = window.ISAI_SERVER_I18N || {};

    const DEFAULT_ASSISTANT = {
        name: "ISAI",
        icon: ASSISTANT_ICON,
    };

    const DEFAULT_WELCOME_MESSAGES = {
        ko: "\uc548\ub155\ud558\uc138\uc694. \ubb34\uc5c7\uc744 \ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694? \ud83d\ude0a",
        en: "Hello! How can I help you? 😊",
        ja: "こんにちは。どのようにお手伝いできますか？ 😊",
        zh: "你好！我可以帮你做什么？ 😊",
        "zh-tw": "你好！我可以幫你做什麼？ 😊",
        es: "Hola, ¿en qué puedo ayudarte? 😊",
        fr: "Bonjour ! Comment puis-je vous aider ? 😊",
        de: "Hallo! Wie kann ich Ihnen helfen? 😊",
        pt: "Olá! Como posso ajudar? 😊",
        ru: "Здравствуйте! Чем я могу помочь? 😊",
        ar: "مرحبًا! كيف يمكنني مساعدتك؟ 😊",
        hi: "नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ? 😊",
        id: "Halo! Ada yang bisa saya bantu? 😊",
        vi: "Xin chào! Tôi có thể giúp gì cho bạn? 😊",
        th: "สวัสดี! มีอะไรให้ฉันช่วยได้บ้าง? 😊",
        tr: "Merhaba! Size nasıl yardımcı olabilirim? 😊",
        it: "Ciao! Come posso aiutarti? 😊",
        nl: "Hallo! Waarmee kan ik je helpen? 😊",
        pl: "Czesc! W czym moge pomóc? 😊"
    };

    const MODE_META = {
        chat: {
            badge: "Chat",
            kicker: "ISAI Assistant",
            title: "Ready to help.",
            subtitle: "Chat, search, and generated results stay inside this card.",
            hint: "Type here to keep the conversation and outputs inside this card.",
            placeholder: ""
        },
        search: {
            badge: "Search",
            kicker: "Search Mode",
            title: "Search the web",
            subtitle: "Summaries and source-backed answers stay in the same chat card.",
            hint: "Ask for news, links, or a quick web summary.",
            placeholder: "What should I search for?"
        },
        image: {
            badge: "Image",
            kicker: "Image Mode",
            title: "Create an image",
            subtitle: "Describe a scene and keep the preview in this chat workspace.",
            hint: "Describe the image you want to generate.",
            placeholder: "Describe the image you want..."
        },
        video: {
            badge: "Video",
            kicker: "Video Mode",
            title: "Create a motion clip",
            subtitle: "Storyboard-style generations stay in the same conversation.",
            hint: "Describe the motion or scene for the clip.",
            placeholder: "Describe the video you want..."
        },
        community: {
            badge: "Community",
            kicker: "Community Mode",
            title: "Post to the board",
            subtitle: "Write a forum-style post and attach an image if you want.",
            hint: "Add a nickname, password, and optional image before posting.",
            placeholder: "Write your community post..."
        },
        code: {
            badge: "Code",
            kicker: "Code Mode",
            title: "Build with code",
            subtitle: "Code responses stay paired with the workspace panel on the right.",
            hint: "Describe the code or file you want to generate.",
            placeholder: "Describe the code you want..."
        },
        blog: {
            badge: "Blog",
            kicker: "Blog Mode",
            title: "Draft a blog post",
            subtitle: "Long-form writing and image tags stay in this same thread.",
            hint: "Give the topic, tone, or structure you want for the post.",
            placeholder: "What should the blog post be about?"
        },
        voice: {
            badge: "Voice",
            kicker: "Voice Mode",
            title: "Talk naturally",
            subtitle: "Use the mic button to speak and keep the transcript in the card.",
            hint: "Tap the mic button to start or pause voice capture.",
            placeholder: "Voice mode listens through the mic."
        },
        translate: {
            badge: "Translate",
            kicker: "Translate Mode",
            title: "Translate both ways",
            subtitle: "Pick left and right languages, then translate in the chat card.",
            hint: "Use the left button for the source side and the right button for the target side.",
            placeholder: "Enter the text you want to translate..."
        },
        settings: {
            badge: "Settings",
            kicker: "Voice Settings",
            title: "Tune voice conversation",
            subtitle: "Choose language, voice, speed, and tone for spoken replies.",
            hint: "These settings apply to voice chat and spoken responses.",
            placeholder: ""
        },
        music: {
            badge: "Music",
            kicker: "Music Mode",
            title: "Generate audio",
            subtitle: "Music clips are rendered and returned in the same conversation.",
            hint: "Describe the mood, instruments, or energy for the track.",
            placeholder: "Describe the music you want..."
        },
        app: {
            badge: "Apps",
            kicker: "Shortcut Mode",
            title: "Browse shortcuts",
            subtitle: "Open saved shortcuts and run lightweight app flows from here.",
            hint: "Search the shortcut list or open the app panel from the side rail.",
            placeholder: "Search shortcuts..."
        }
    };

    Object.keys(SERVER_I18N.modeMeta || {}).forEach((modeKey) => {
        MODE_META[modeKey] = Object.assign({}, MODE_META[modeKey] || {}, SERVER_I18N.modeMeta[modeKey]);
    });

    const TTS_TEXT = Object.assign({
        previewLabel: "Preview Voice",
        previewHelper: "Use your browser voice to preview settings.",
        failedToast: "Voice preview failed",
        errorPrefix: "TTS failed:"
    }, SERVER_I18N.ttsText || {});

    const VOICE_SETTINGS_STORAGE_KEY = "ISAI_VOICE_SETTINGS";
    const ASSISTANT_SETTINGS_STORAGE_KEY = "ISAI_ASSISTANT_SETTINGS";
    const RECENT_MODE_STORAGE_KEY = "ISAI_RECENT_MODES";
    const TRANSLATE_LANG_STORAGE_KEY = "ISAI_TRANSLATE_LANGS";
    const TRANSLATE_DEFAULTS = (() => {
        const defaults = SERVER_I18N.translationDefaults || {};
        return {
            left: String(defaults.left || defaults.source || "English"),
            right: String(defaults.right || defaults.target || "Korean")
        };
    })();
    const RECENT_MODE_LIMIT = 3;
    const TRACKED_RECENT_MODES = ["chat", "search", "image", "video", "community", "code", "blog", "voice", "translate", "music"];
    const DEFAULT_TTS_ENGINE = "browser";
    const DEFAULT_TTS_VOICE = "";
    const DEFAULT_TTS_STEPS = 1;
    const DEFAULT_TTS_SPEED = 1;
    const DEFAULT_TTS_VOLUME = 1;
    const DEFAULT_ASSISTANT_TONE = "friendly";
    const TTS_ENGINES = [
        { id: "browser", label: "Browser Voice", chip: "SYS", icon: "ri-volume-up-line", description: "Use the browser built-in voice." }
    ];

    const SUPER_TTS_LANGUAGES = [
        { id: "ko", label: "Korean", chip: "KO", icon: "ri-global-line" },
        { id: "en", label: "English", chip: "EN", icon: "ri-global-line" },
        { id: "ja", label: "Japanese", chip: "JA", icon: "ri-global-line" },
        { id: "zh", label: "Chinese", chip: "ZH", icon: "ri-global-line" },
        { id: "es", label: "Spanish", chip: "ES", icon: "ri-global-line" },
        { id: "pt", label: "Portuguese", chip: "PT", icon: "ri-global-line" },
        { id: "fr", label: "French", chip: "FR", icon: "ri-global-line" },
        { id: "de", label: "German", chip: "DE", icon: "ri-global-line" },
        { id: "ru", label: "Russian", chip: "RU", icon: "ri-global-line" }
    ];

    const ASSISTANT_TONES = [
        { id: "friendly", label: "Friendly", chip: "FR", icon: "ri-emotion-happy-line", instruction: "Respond in a warm, friendly, and supportive tone." },
        { id: "natural", label: "Natural", chip: "NA", icon: "ri-leaf-line", instruction: "Respond in a natural, balanced, and clear conversational tone." },
        { id: "concise", label: "Concise", chip: "CO", icon: "ri-focus-3-line", instruction: "Respond concisely, directly, and with minimal filler." },
        { id: "professional", label: "Professional", chip: "PR", icon: "ri-briefcase-4-line", instruction: "Respond in a polished, professional, and structured tone." },
        { id: "playful", label: "Playful", chip: "PL", icon: "ri-sparkling-line", instruction: "Respond with a light, lively, and playful tone while staying clear." }
    ];

    let activeTtsLanguage = detectBrowserLanguage();
    let activeTtsEngine = DEFAULT_TTS_ENGINE;
    let activeTtsVoiceId = DEFAULT_TTS_VOICE;
    let activeAssistantToneId = DEFAULT_ASSISTANT_TONE;
    let activePreviewUtterance = null;

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatTemplate(template, replacements = {}) {
        return Object.keys(replacements).reduce((message, key) => {
            return message.replace(new RegExp(`\\{${key}\\}`, "g"), String(replacements[key]));
        }, String(template ?? ""));
    }

    function isImageErrorMessage(value) {
        return /^Image Error:/i.test(String(value ?? "").trim());
    }

    function imageErrorIconHtml(message) {
        const safeMessage = escapeHtml(String(message ?? "").trim() || "Image generation failed");
        return `<span class="image-error-icon" title="${safeMessage}" aria-label="${safeMessage}"><i class="ri-image-line"></i><i class="ri-close-circle-fill image-error-icon-badge"></i></span>`;
    }

    function genericErrorIconHtml(message) {
        const safeMessage = escapeHtml(String(message ?? "").trim() || "Request failed");
        return `<span class="image-error-icon" title="${safeMessage}" aria-label="${safeMessage}"><i class="ri-error-warning-line"></i><i class="ri-close-circle-fill image-error-icon-badge"></i></span>`;
    }

    function loadRecentModes() {
        try {
            const parsed = JSON.parse(localStorage.getItem(RECENT_MODE_STORAGE_KEY) || "[]");
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((mode) => TRACKED_RECENT_MODES.includes(mode));
        } catch (error) {
            return [];
        }
    }

    function saveRecentModes(modes) {
        try {
            localStorage.setItem(RECENT_MODE_STORAGE_KEY, JSON.stringify(modes.slice(0, 8)));
        } catch (error) {}
    }

    function rememberMode(mode) {
        if (!TRACKED_RECENT_MODES.includes(mode)) return;
        const merged = [mode].concat(loadRecentModes().filter((item) => item !== mode));
        saveRecentModes(merged);
    }

    function syncRecentModePadding(count) {
        const inputField = document.getElementById("chat-input-field");
        if (!inputField) return;
        inputField.style.setProperty("padding-right", "0px", "important");
    }

    function renderRecentModeActions(currentModeValue = getCurrentMode()) {
        const container = document.getElementById("recent-mode-actions");
        if (!container) return;

        const modes = loadRecentModes()
            .filter((mode) => mode !== currentModeValue)
            .slice(0, RECENT_MODE_LIMIT);

        if (modes.length === 0) {
            container.innerHTML = "";
            container.classList.add("hidden");
            syncRecentModePadding(0);
            return;
        }

        container.innerHTML = modes.map((mode) => {
            const sourceButton = document.getElementById(`btn-${mode}`);
            const iconHtml = sourceButton ? sourceButton.innerHTML : `<span class="text-[11px] font-bold uppercase">${escapeHtml(mode.slice(0, 2))}</span>`;
            const label = sourceButton?.getAttribute("title")
                || sourceButton?.getAttribute("aria-label")
                || mode;
            return `<button type="button" class="input-action-btn recent-mode-btn" data-mode="${escapeHtml(mode)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${iconHtml}</button>`;
        }).join("");

        container.querySelectorAll("[data-mode]").forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const mode = button.dataset.mode;
                if (mode && typeof setMode === "function") {
                    setMode(mode);
                }
            });
        });

        container.classList.remove("hidden");
        syncRecentModePadding(modes.length);
    }

    function currentAppRef() {
        if (typeof activeApp !== "undefined" && activeApp) return activeApp;
        if (window.activeApp) return window.activeApp;
        return null;
    }

    function getCurrentMode() {
        if (typeof currentMode !== "undefined" && currentMode) return currentMode;
        if (typeof selectedMode !== "undefined" && selectedMode) return selectedMode;
        if (window.currentMode) return window.currentMode;
        if (window.selectedMode) return window.selectedMode;
        return "chat";
    }

    function detectBrowserLanguage() {
        const serverLocale = String(SERVER_I18N.locale || "").toLowerCase();
        const serverCode = serverLocale.split("-")[0];
        if (SUPER_TTS_LANGUAGES.some((item) => item.id === serverCode)) return serverCode;
        if (serverCode === "ja" || serverCode === "hi") return "en";
        const browserLang = navigator.language || navigator.userLanguage || "ko";
        const langCode = browserLang.split("-")[0].toLowerCase();
        return SUPER_TTS_LANGUAGES.some((item) => item.id === langCode) ? langCode : "en";
    }

    function detectUiLanguage() {
        const raw = String(SERVER_I18N.locale || document.documentElement?.lang || navigator.language || navigator.userLanguage || "ko").toLowerCase();
        if (DEFAULT_WELCOME_MESSAGES[raw]) return raw;
        const primary = raw.split("-")[0];
        if (primary === "zh") {
            return raw.includes("tw") || raw.includes("hk") ? "zh-tw" : "zh";
        }
        return DEFAULT_WELCOME_MESSAGES[primary] ? primary : "en";
    }

    function getTranslateSelectPair() {
        return {
            leftSelect: document.getElementById("trans-select-left"),
            rightSelect: document.getElementById("trans-select-right")
        };
    }

    function getTranslateOptionValues(select) {
        return Array.from(select?.options || []).map((option) => option.value);
    }

    function pickTranslateValue(select, preferred, fallback) {
        const values = getTranslateOptionValues(select);
        if (!values.length) return "";
        if (values.includes(preferred)) return preferred;
        if (values.includes(fallback)) return fallback;
        return values[0];
    }

    function pickTranslateAlternative(select, avoidValue) {
        const values = getTranslateOptionValues(select);
        if (!values.length) return "";
        if (avoidValue === "English" && values.includes("Spanish")) return "Spanish";
        if (avoidValue !== "English" && values.includes("English")) return "English";
        const alternative = values.find((value) => value !== avoidValue);
        return alternative || values[0];
    }

    function loadTranslateLangSelection() {
        try {
            const parsed = JSON.parse(localStorage.getItem(TRANSLATE_LANG_STORAGE_KEY) || "{}");
            if (!parsed || typeof parsed !== "object") return {};
            return parsed;
        } catch (error) {
            return {};
        }
    }

    function saveTranslateLangSelection(leftValue, rightValue) {
        try {
            localStorage.setItem(TRANSLATE_LANG_STORAGE_KEY, JSON.stringify({
                left: leftValue,
                right: rightValue
            }));
        } catch (error) {}
    }

    function syncTranslateVoiceRecognition() {
        if (typeof updateRecognitionLang === "function") {
            try { updateRecognitionLang(); } catch (error) {}
        }
    }

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

        if (label) label.textContent = code || selected.value;
        if (img) {
            img.src = flag || "";
            img.alt = `${selected.value} flag`;
        }
        if (trigger) {
            trigger.setAttribute("title", selected.value);
        }
    }

    function closeAllTranslateMenus(exceptRoot = null) {
        document.querySelectorAll(".flag-select").forEach((root) => {
            if (exceptRoot && root === exceptRoot) return;
            const trigger = root.querySelector(".flag-select-trigger");
            const menu = root.querySelector(".flag-select-menu");
            if (menu) menu.classList.add("hidden");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
        });
    }

    function renderFlagSelectMenu(select) {
        const root = select?.closest(".flag-select");
        if (!root) return;
        const menu = root.querySelector(".flag-select-menu");
        if (!menu) return;

        const options = Array.from(select.options || []);
        menu.innerHTML = options.map((option, index) => {
            const code = String(option.dataset.code || option.textContent || option.value || "").trim().toUpperCase();
            const flag = String(option.dataset.flag || "").trim();
            const isActive = option.value === select.value;
            return `
                <button type="button" class="flag-select-item${isActive ? " is-active" : ""}" data-option-index="${index}" role="option" aria-selected="${isActive ? "true" : "false"}">
                    <img class="flag-select-img" src="${escapeHtml(flag)}" alt="${escapeHtml(option.value)} flag" loading="lazy" decoding="async">
                    <span class="flag-select-item-code">${escapeHtml(code)}</span>
                    <span class="flag-select-item-name">${escapeHtml(option.value)}</span>
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
            if (changedSide === "left") {
                rightSelect.value = pickTranslateAlternative(rightSelect, leftSelect.value);
            } else {
                leftSelect.value = pickTranslateAlternative(leftSelect, rightSelect.value);
            }
        }

        saveTranslateLangSelection(leftSelect.value, rightSelect.value);
        syncFlagSelectTrigger(leftSelect);
        syncFlagSelectTrigger(rightSelect);
        syncTranslateVoiceRecognition();
    }

    function applyTranslateDefaults(forceServerDefaults = false) {
        const { leftSelect, rightSelect } = getTranslateSelectPair();
        if (!leftSelect || !rightSelect) return;

        const saved = loadTranslateLangSelection();
        const nextLeft = forceServerDefaults
            ? TRANSLATE_DEFAULTS.left
            : String(saved.left || TRANSLATE_DEFAULTS.left);
        const nextRight = forceServerDefaults
            ? TRANSLATE_DEFAULTS.right
            : String(saved.right || TRANSLATE_DEFAULTS.right);

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
                    menu.classList.remove("hidden");
                    trigger.setAttribute("aria-expanded", "true");
                } else {
                    menu.classList.add("hidden");
                    trigger.setAttribute("aria-expanded", "false");
                }
            });
        }

        select.addEventListener("change", () => {
            normalizeTranslatePair(side);
            renderFlagSelectMenu(select);
        });

        syncFlagSelectTrigger(select);
    }

    function initTranslateSelectors() {
        const { leftSelect, rightSelect } = getTranslateSelectPair();
        if (!leftSelect || !rightSelect) return;

        applyTranslateDefaults(false);
        bindTranslateSelect(leftSelect, "left");
        bindTranslateSelect(rightSelect, "right");
        renderFlagSelectMenu(leftSelect);
        renderFlagSelectMenu(rightSelect);
        syncFlagSelectTrigger(leftSelect);
        syncFlagSelectTrigger(rightSelect);

        if (!window.__isaiTranslateOutsideClickBound) {
            window.__isaiTranslateOutsideClickBound = true;
            document.addEventListener("click", (event) => {
                const target = event.target;
                if (target instanceof Element && target.closest(".flag-select")) return;
                closeAllTranslateMenus();
            });
            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape") closeAllTranslateMenus();
            });
        }
    }

    function normalizeWelcomeMessage(message, localeHint) {
        const raw = String(message || "").trim();
        if (!raw) return "";
        const cleaned = raw.replace(/\?삃/g, "😊").replace(/\s+/g, " ").trim();
        if ((String(localeHint || "").toLowerCase().startsWith("ko") || /[ㄱ-ㅎ가-힣]/.test(cleaned)) && /도와드릴까요|뭐 도와드릴까요/.test(cleaned)) {
            return "안녕하세요. 무엇을 도와드릴까요? 😊";
        }
        return cleaned;
    }

    function getLocalizedWelcomeMessage() {
        const uiLanguage = detectUiLanguage();
        if (SERVER_I18N.welcomeMessage) {
            const normalized = normalizeWelcomeMessage(SERVER_I18N.welcomeMessage, uiLanguage);
            if (normalized) return normalized;
        }
        const fallbackMessage = DEFAULT_WELCOME_MESSAGES[uiLanguage] || DEFAULT_WELCOME_MESSAGES.en;
        return normalizeWelcomeMessage(fallbackMessage, uiLanguage);
    }

    function getAssistantInfo() {
        const appRef = currentAppRef();
        if (appRef) {
            return {
                name: appRef.title || DEFAULT_ASSISTANT.name,
                icon: ASSISTANT_ICON,
                subtitle: appRef.description || appRef.summary || ""
            };
        }
        return DEFAULT_ASSISTANT;
    }

    function buildAvatarContent(info, fallbackClass) {
        const name = (info && info.name) || DEFAULT_ASSISTANT.name;
        const icon = info && info.icon;
        if (icon) {
            return `
                <img src="${escapeHtml(icon)}" alt="${escapeHtml(name)}" onerror="this.remove();this.nextElementSibling.style.display='flex';">
                <span class="${fallbackClass}" style="display:none;">${escapeHtml(name.charAt(0).toUpperCase())}</span>
            `;
        }
        return `<span class="${fallbackClass}">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
    }

    function updateHeaderAvatar(info) {
        const wrapper = document.querySelector("#chat-profile-card .chat-profile-avatar");
        if (!wrapper) return;
        wrapper.innerHTML = buildAvatarContent(info, "chat-profile-fallback");
    }

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
        const icon = document.getElementById("icon-submit");
        const submitButton = document.getElementById("btn-submit");

        if (kicker) kicker.textContent = appRef ? "App Mode" : meta.kicker;
        if (title) title.textContent = appRef ? assistant.name : meta.title;
        if (subtitle) {
            const subtitleText = appRef && assistant.subtitle ? assistant.subtitle : meta.subtitle;
            subtitle.textContent = subtitleText.length > 140 ? `${subtitleText.slice(0, 137)}...` : subtitleText;
        }
        if (badge) badge.textContent = meta.badge;
        if (hint) hint.textContent = meta.hint;
        if (input) input.placeholder = "";
        if (submitButton) {
            submitButton.style.display = "inline-flex";
        }
        if (icon) icon.className = "ri-arrow-up-s-line text-[14px]";
        updateHeaderAvatar(assistant);
    }

    function readRecentModes() {
        try {
            const raw = localStorage.getItem(RECENT_MODE_STORAGE_KEY);
            const parsed = JSON.parse(raw || "[]");
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((mode, index, list) => (
                typeof mode === "string" &&
                TRACKED_RECENT_MODES.includes(mode) &&
                list.indexOf(mode) === index
            ));
        } catch (error) {
            return [];
        }
    }

    function writeRecentModes(modes) {
        try {
            localStorage.setItem(
                RECENT_MODE_STORAGE_KEY,
                JSON.stringify((Array.isArray(modes) ? modes : []).slice(0, RECENT_MODE_LIMIT + 1))
            );
        } catch (error) {
            return;
        }
    }

    function rememberRecentMode(mode) {
        if (!TRACKED_RECENT_MODES.includes(mode)) return;
        const nextModes = [mode].concat(readRecentModes().filter((item) => item !== mode));
        writeRecentModes(nextModes);
    }

    function getModeButton(mode) {
        return document.getElementById(`btn-${mode}`);
    }

    function getModeButtonMarkup(mode) {
        const button = getModeButton(mode);
        return button ? button.innerHTML : `<span>${escapeHtml(String(mode || "?").charAt(0).toUpperCase())}</span>`;
    }

    function getModeButtonLabel(mode) {
        const button = getModeButton(mode);
        if (!button) return mode;
        return button.getAttribute("aria-label") || button.getAttribute("title") || mode;
    }

    function syncRecentModePadding(count) {
        const field = document.getElementById("chat-input-field");
        if (!field) return;
        field.style.setProperty("padding-right", "0px", "important");
    }

    function renderRecentModeActions(currentModeValue = getCurrentMode()) {
        const container = document.getElementById("recent-mode-actions");
        if (!container) return;

        const recentModes = readRecentModes()
            .filter((mode) => mode !== currentModeValue)
            .filter((mode) => !!getModeButton(mode))
            .slice(0, RECENT_MODE_LIMIT);

        container.innerHTML = "";

        if (!recentModes.length) {
            container.classList.add("hidden");
            syncRecentModePadding(0);
            return;
        }

        recentModes.forEach((mode) => {
            const button = document.createElement("button");
            const label = getModeButtonLabel(mode);
            button.type = "button";
            button.className = "input-action-btn recent-mode-btn";
            button.dataset.mode = mode;
            button.setAttribute("aria-label", label);
            button.setAttribute("title", label);
            button.innerHTML = getModeButtonMarkup(mode);
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (typeof setMode === "function") setMode(mode);
            });
            container.appendChild(button);
        });

        container.classList.remove("hidden");
        syncRecentModePadding(recentModes.length);
    }

    function decodeHtmlEntities(value) {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = String(value ?? "");
        return textarea.value;
    }

    function sanitizeAssistantHtml(value) {
        return String(value ?? "")
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
            .replace(/<img\b[^>]*>/gi, "")
            .replace(/\son\w+=(["']).*?\1/gi, "")
            .replace(/\son\w+=([^\s>]+)/gi, "")
            .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
    }

    function normalizeMessageHtml(role, content) {
        const text = String(content ?? "");
        if (role === "user") return escapeHtml(text).replace(/\n/g, "<br>");

        const decoded = decodeHtmlEntities(text);
        const sanitizedDecoded = sanitizeAssistantHtml(decoded);
        const sanitizedRaw = sanitizeAssistantHtml(text);
        const htmlCandidate = /<\/?[a-z][^>]*>/i.test(sanitizedDecoded) ? sanitizedDecoded : sanitizedRaw;
        return htmlCandidate
            .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
            .replace(/\n/g, "<br>");
    }

    function ensureChatSpacer(chatBox) {
        if (!chatBox) return null;
        const first = chatBox.firstElementChild;
        if (first && first.classList && first.classList.contains("chat-spacer")) return first;

        let spacer = chatBox.querySelector(".chat-spacer");
        if (!spacer) {
            spacer = document.createElement("div");
            spacer.className = "chat-spacer";
            spacer.setAttribute("aria-hidden", "true");
        }
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
            if (entries.length > 60) {
                const oldest = entries[0];
                if (oldest && oldest.parentNode) {
                    oldest.parentNode.removeChild(oldest);
                }
            }

            const wrapper = document.createElement("div");
            const body = document.createElement("div");
            const bubble = document.createElement("div");

            if (role === "user") {
                wrapper.className = "chat-entry user-entry";

                body.className = "chat-entry-body";
                bubble.className = "chat-bubble-user";
                bubble.innerHTML = normalizeMessageHtml("user", content);
                body.appendChild(bubble);
                wrapper.appendChild(body);
            } else {
                wrapper.className = "chat-entry ai-entry";

                body.className = "chat-entry-body";

                const isError = role === "error";
                const imageError = isError && isImageErrorMessage(content);
                bubble.className = isError ? "chat-bubble-image-error" : "chat-bubble-ai";
                bubble.innerHTML = isError
                    ? (imageError ? imageErrorIconHtml(content) : genericErrorIconHtml(content))
                    : normalizeMessageHtml(role, content);

                body.appendChild(bubble);
                wrapper.appendChild(body);
            }

            chatBox.appendChild(wrapper);
            if (typeof scrollBottom === "function") scrollBottom();
            return bubble;
        };

        window.appendMsg = appendMsg;
    }

    function ensureWelcomeMessage(force = false) {
        const chatBox = document.getElementById("chat-box");
        if (!chatBox) return;
        if (force) chatBox.innerHTML = "";
        ensureChatSpacer(chatBox);
        if (chatBox.querySelector(".chat-entry")) return;
        const welcomeMessage = getLocalizedWelcomeMessage();
        if (typeof appendMsg === "function") {
            appendMsg("ai", welcomeMessage);
            return;
        }

        const wrapper = document.createElement("div");
        const body = document.createElement("div");
        const bubble = document.createElement("div");

        wrapper.className = "chat-entry ai-entry";
        body.className = "chat-entry-body";
        bubble.className = "chat-bubble-ai";
        bubble.innerHTML = normalizeMessageHtml("ai", welcomeMessage);
        body.appendChild(bubble);
        wrapper.appendChild(body);
        chatBox.appendChild(wrapper);
    }

    function wrapResetChat() {
        if (typeof resetChat !== "function") return;
        const originalResetChat = resetChat;
        resetChat = function () {
            const result = originalResetChat.apply(this, arguments);
            setTimeout(() => {
                ensureWelcomeMessage(true);
                updateComposerMeta("chat");
            }, 0);
            return result;
        };
        window.resetChat = resetChat;
    }

    function wrapAppModeHooks() {
        if (typeof activateAppMode === "function") {
            const originalActivateAppMode = activateAppMode;
            activateAppMode = function () {
                const result = originalActivateAppMode.apply(this, arguments);
                setTimeout(() => updateComposerMeta(getCurrentMode()), 0);
                return result;
            };
            window.activateAppMode = activateAppMode;
        }

        if (typeof exitAppMode === "function") {
            const originalExitAppMode = exitAppMode;
            exitAppMode = function () {
                const result = originalExitAppMode.apply(this, arguments);
                setTimeout(() => updateComposerMeta(getCurrentMode()), 0);
                return result;
            };
            window.exitAppMode = exitAppMode;
        }
    }

    function selectedTtsLanguage() {
        return SUPER_TTS_LANGUAGES.find((item) => item.id === activeTtsLanguage) || SUPER_TTS_LANGUAGES[0];
    }

    function selectedTtsEngine() {
        return TTS_ENGINES.find((item) => item.id === activeTtsEngine) || TTS_ENGINES[0];
    }

    function speechLangCode(languageId) {
        const map = {
            ko: "ko-KR",
            en: "en-US",
            ja: "ja-JP",
            zh: "zh-CN",
            es: "es-ES",
            pt: "pt-PT",
            fr: "fr-FR",
            de: "de-DE",
            ru: "ru-RU"
        };
        return map[languageId] || (navigator.language || "en-US");
    }

    function getBrowserVoices(languageId = activeTtsLanguage) {
        const synth = window.speechSynthesis;
        const voices = synth && typeof synth.getVoices === "function" ? synth.getVoices() : [];
        if (!voices || !voices.length) {
            return [{
                id: "",
                label: "System Default",
                chip: "AUTO",
                icon: "ri-volume-up-line",
                description: "Use the browser default voice."
            }];
        }

        const langCode = speechLangCode(languageId).toLowerCase();
        const langPrefix = langCode.split("-")[0];
        const filtered = voices.filter((voice) => {
            const voiceLang = String(voice.lang || "").toLowerCase();
            return voiceLang === langCode || voiceLang.startsWith(`${langPrefix}-`);
        });
        const source = filtered.length ? filtered : voices;

        return source.slice(0, 12).map((voice, index) => ({
            id: voice.name,
            label: voice.name,
            chip: `V${index + 1}`,
            icon: voice.localService ? "ri-user-voice-line" : "ri-volume-up-line",
            description: `${voice.lang || "auto"} / ${voice.localService ? "local" : "remote"}`
        }));
    }

    function getAvailableTtsVoices(languageId = activeTtsLanguage) {
        return getBrowserVoices(languageId);
    }

    function ensureValidTtsVoiceSelection() {
        const voices = getAvailableTtsVoices(activeTtsLanguage);
        if (!voices.length) {
            activeTtsVoiceId = "";
            return voices;
        }
        if (!voices.some((item) => item.id === activeTtsVoiceId)) {
            activeTtsVoiceId = voices[0].id;
        }
        return voices;
    }

    function selectedTtsVoice() {
        const voices = ensureValidTtsVoiceSelection();
        return voices.find((item) => item.id === activeTtsVoiceId) || voices[0];
    }

    function stopPreviewPlayback() {
        activePreviewUtterance = null;
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    window.stopIsaiTtsPreview = stopPreviewPlayback;

    function selectedSpeed() {
        const range = document.getElementById("tts-speed-range");
        const parsed = parseFloat(range?.value || String(DEFAULT_TTS_SPEED));
        return Number.isFinite(parsed) ? parsed : DEFAULT_TTS_SPEED;
    }

    function selectedSteps() {
        const range = document.getElementById("tts-steps-range");
        const parsed = parseFloat(range?.value || String(DEFAULT_TTS_STEPS));
        return Number.isFinite(parsed) ? parsed : DEFAULT_TTS_STEPS;
    }

    function loadVoiceSettings() {
        try {
            return JSON.parse(localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY) || "{}");
        } catch (error) {
            return {};
        }
    }

    function loadAssistantSettings() {
        try {
            const parsed = JSON.parse(localStorage.getItem(ASSISTANT_SETTINGS_STORAGE_KEY) || "{}");
            const toneId = typeof parsed.tone === "string" && ASSISTANT_TONES.some((item) => item.id === parsed.tone)
                ? parsed.tone
                : DEFAULT_ASSISTANT_TONE;
            return {
                systemPrompt: typeof parsed.systemPrompt === "string" ? parsed.systemPrompt : "",
                tone: toneId
            };
        } catch (error) {
            return {
                systemPrompt: "",
                tone: DEFAULT_ASSISTANT_TONE
            };
        }
    }

    function selectedAssistantTone() {
        return ASSISTANT_TONES.find((item) => item.id === activeAssistantToneId) || ASSISTANT_TONES[0];
    }

    function syncAssistantSettings() {
        const promptInput = document.getElementById("assistant-system-prompt");
        const state = {
            systemPrompt: String(promptInput?.value || "").trim(),
            tone: selectedAssistantTone().id
        };

        window.ISAI_ASSISTANT_SETTINGS = state;
        window.getIsaiAssistantSettings = function () {
            return Object.assign({}, state);
        };

        try {
            localStorage.setItem(ASSISTANT_SETTINGS_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {}

        return state;
    }

    function buildIsaiSystemPrompt(basePrompt = "") {
        const settings = typeof window.getIsaiAssistantSettings === "function"
            ? (window.getIsaiAssistantSettings() || {})
            : loadAssistantSettings();
        const assistantTone = ASSISTANT_TONES.find((item) => item.id === settings.tone) || ASSISTANT_TONES[0];
        return [
            String(basePrompt || "").trim(),
            String(settings.systemPrompt || "").trim(),
            assistantTone.instruction
        ].filter(Boolean).join("\n\n");
    }

    window.buildIsaiSystemPrompt = buildIsaiSystemPrompt;

    function renderAssistantToneChips() {
        const container = document.getElementById("assistant-tone-list");
        if (!container) return;

        container.innerHTML = ASSISTANT_TONES.map((tone) => (
            renderSettingsChip(tone, "tone", tone.id, tone.instruction)
        )).join("");

        container.querySelectorAll("[data-tone]").forEach((button) => {
            button.addEventListener("click", () => {
                activeAssistantToneId = button.dataset.tone || activeAssistantToneId;
                updateAssistantSettingsUi();
            });
        });
    }

    function updateAssistantSettingsUi() {
        const state = syncAssistantSettings();
        updateChipState("assistant-tone-list", "[data-tone]", state.tone, "tone");
    }

    function setupAssistantSettingsControls() {
        const saved = loadAssistantSettings();
        activeAssistantToneId = saved.tone || DEFAULT_ASSISTANT_TONE;

        const promptInput = document.getElementById("assistant-system-prompt");
        if (promptInput) {
            promptInput.value = saved.systemPrompt || "";
            promptInput.addEventListener("input", () => {
                syncAssistantSettings();
            });
        }

        renderAssistantToneChips();
        updateAssistantSettingsUi();
    }

    function syncVoiceSettings() {
        const selectedVoice = selectedTtsVoice();
        const state = {
            ttsEngine: "browser",
            recognitionLang: speechLangCode(activeTtsLanguage),
            speechLang: speechLangCode(activeTtsLanguage),
            voiceName: selectedVoice?.id || "",
            rate: selectedSpeed(),
            pitch: selectedSteps(),
            volume: DEFAULT_TTS_VOLUME
        };
        window.ISAI_VOICE_SETTINGS = state;
        window.getIsaiVoiceSettings = function () {
            return Object.assign({}, state);
        };
        try {
            localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {}
        return state;
    }

    function stripLanguageTags(text) {
        return String(text ?? "")
            .trim()
            .replace(/^<(en|ko|es|pt|fr)>/i, "")
            .replace(/<\/(en|ko|es|pt|fr)>$/i, "")
            .trim();
    }

    function updateChipState(containerId, selector, value, dataKey) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll(selector).forEach((element) => {
            element.classList.toggle("active", element.dataset[dataKey] === value);
        });
    }

    function renderSettingsChip(item, dataAttr, value, titleText = "") {
        const iconClass = item.icon || "ri-settings-3-line";
        const chipText = item.chip || item.id || "";
        const compactText = item.shortLabel || chipText || item.label || value;
        const title = titleText || item.description || item.instruction || item.label || "";
        return `
            <button type="button" class="tts-chip" data-${dataAttr}="${escapeHtml(value)}" title="${escapeHtml(title)}">
                <span class="tts-chip-icon">
                    <i class="${escapeHtml(iconClass)}"></i>
                </span>
                <span class="tts-chip-main">
                    <small>${escapeHtml(chipText)}</small>
                    <strong>${escapeHtml(compactText)}</strong>
                </span>
            </button>
        `;
    }

    function ensureTtsEngineControls() {
        let group = document.getElementById("tts-engine-group");
        if (group) return group;

        const languageList = document.getElementById("tts-language-list");
        const languageGroup = languageList ? languageList.closest(".tts-control-group") : null;
        if (!languageGroup || !languageGroup.parentNode) return null;

        group = document.createElement("div");
        group.id = "tts-engine-group";
        group.className = "tts-control-group";
        group.innerHTML = `
            <div class="tts-control-heading"><i class="ri-cpu-line"></i><span>Speech Engine</span></div>
            <div id="tts-engine-list" class="tts-chip-list no-scrollbar"></div>
        `;
        languageGroup.parentNode.insertBefore(group, languageGroup);
        return group;
    }

    function renderTtsEngineChips() {
        ensureTtsEngineControls();
        const container = document.getElementById("tts-engine-list");
        if (!container) return;

        container.innerHTML = TTS_ENGINES.map((engine) => (
            renderSettingsChip(engine, "engine", engine.id, engine.description)
        )).join("");

        container.querySelectorAll("[data-engine]").forEach((button) => {
            button.addEventListener("click", () => {
                const nextEngine = button.dataset.engine || DEFAULT_TTS_ENGINE;
                if (nextEngine === activeTtsEngine) return;

                activeTtsEngine = nextEngine;
                activeTtsVoiceId = "";
                renderTtsVoiceChips();
                updateTtsUi();
            });
        });
    }

    function renderTtsLanguageChips() {
        const container = document.getElementById("tts-language-list");
        if (!container) return;

        container.innerHTML = SUPER_TTS_LANGUAGES.map((language) => (
            renderSettingsChip(language, "language", language.id, language.label)
        )).join("");

        container.querySelectorAll("[data-language]").forEach((button) => {
            button.addEventListener("click", () => {
                activeTtsLanguage = button.dataset.language || activeTtsLanguage;
                activeTtsVoiceId = "";
                renderTtsVoiceChips();
                updateTtsUi();
            });
        });
    }

    function renderTtsVoiceChips() {
        const container = document.getElementById("tts-voice-list");
        if (!container) return;

        container.innerHTML = getAvailableTtsVoices(activeTtsLanguage).map((voice) => (
            renderSettingsChip(Object.assign({ icon: "ri-user-voice-line" }, voice), "voice", voice.id, voice.description)
        )).join("");

        container.querySelectorAll("[data-voice]").forEach((button) => {
            button.addEventListener("click", () => {
                activeTtsVoiceId = button.dataset.voice || activeTtsVoiceId;
                updateTtsUi();
            });
        });
    }

    function updateTtsUi(options = {}) {
        const meta = MODE_META.settings || MODE_META.voice;
        const engine = selectedTtsEngine();
        const language = selectedTtsLanguage();
        const voice = selectedTtsVoice();
        const assistantTone = selectedAssistantTone();
        const downloadButton = document.getElementById("tts-download-button");
        const downloadLabel = document.getElementById("tts-download-label");
        const helper = document.getElementById("tts-helper-text");
        const languageValue = document.getElementById("tts-language-value");
        const voiceValue = document.getElementById("tts-voice-value");
        const speedValue = document.getElementById("tts-speed-value");
        const stepsValue = document.getElementById("tts-steps-value");
        const speedValueInline = document.getElementById("tts-speed-value-inline");
        const stepsValueInline = document.getElementById("tts-steps-value-inline");
        const kicker = document.querySelector(".tts-panel-kicker");
        const title = document.querySelector(".tts-panel-title");
        const toneMetaLabel = document.querySelector(".tts-meta-grid .tts-meta-item:nth-child(4) .tts-meta-copy span");
        const toneRangeLabel = document.querySelector('label[for="tts-steps-range"] .tts-slider-label-main span:last-child');
        const stepLabel = "Pitch";

        if (languageValue) languageValue.textContent = language.label;
        if (voiceValue) voiceValue.textContent = voice.label;
        if (speedValue) speedValue.textContent = `${selectedSpeed().toFixed(2)}x`;
        if (stepsValue) stepsValue.textContent = engine.label;
        if (speedValueInline) speedValueInline.textContent = `${selectedSpeed().toFixed(2)}x`;
        if (stepsValueInline) stepsValueInline.textContent = selectedSteps().toFixed(2);
        if (kicker) kicker.textContent = meta.kicker || "Voice Settings";
        if (title) title.textContent = meta.title || "Voice Settings";
        if (toneMetaLabel) toneMetaLabel.textContent = "Engine";
        if (toneRangeLabel) toneRangeLabel.textContent = stepLabel;

        updateChipState("tts-engine-list", "[data-engine]", engine.id, "engine");
        updateChipState("tts-language-list", "[data-language]", language.id, "language");
        updateChipState("tts-voice-list", "[data-voice]", voice.id, "voice");
        updateChipState("assistant-tone-list", "[data-tone]", assistantTone.id, "tone");

        if (downloadLabel) {
            downloadLabel.textContent = options.label || TTS_TEXT.previewLabel || "Preview Voice";
        }

        if (helper) {
            helper.textContent = options.helper || `${TTS_TEXT.previewHelper || meta.hint || "Voice settings apply to spoken responses."} / ${assistantTone.label} / ${language.label} / ${voice.label}`;
        }

        if (downloadButton) {
            downloadButton.disabled = Boolean(options.disabled);
        }

        syncVoiceSettings();
    }

    function setupTtsControls() {
        const saved = loadVoiceSettings();
        const savedEngine = String(saved.ttsEngine || DEFAULT_TTS_ENGINE).toLowerCase();
        const savedLang = String(saved.speechLang || saved.recognitionLang || "").toLowerCase().split("-")[0];
        if (TTS_ENGINES.some((item) => item.id === savedEngine)) {
            activeTtsEngine = savedEngine;
        }
        if (savedLang && SUPER_TTS_LANGUAGES.some((item) => item.id === savedLang)) {
            activeTtsLanguage = savedLang;
        }
        if (typeof saved.voiceName === "string") {
            activeTtsVoiceId = saved.voiceName;
        }

        setupAssistantSettingsControls();
        renderTtsEngineChips();
        renderTtsLanguageChips();
        renderTtsVoiceChips();

        const stepsRange = document.getElementById("tts-steps-range");
        const speedRange = document.getElementById("tts-speed-range");
        const downloadButton = document.getElementById("tts-download-button");

        if (stepsRange) {
            stepsRange.value = String(saved.pitch || DEFAULT_TTS_STEPS);
            stepsRange.addEventListener("input", () => updateTtsUi());
        }

        if (speedRange) {
            speedRange.value = String(saved.rate || DEFAULT_TTS_SPEED);
            speedRange.addEventListener("input", () => updateTtsUi());
        }

        if (downloadButton) {
            downloadButton.addEventListener("click", async () => {
                const settings = syncVoiceSettings();
                const previewText = stripLanguageTags(getLocalizedWelcomeMessage()).replace(/<br\s*\/?>/gi, " ");
                stopPreviewPlayback();

                const synth = window.speechSynthesis;
                if (!synth) return;
                const preview = new SpeechSynthesisUtterance(previewText);
                const browserVoice = synth.getVoices().find((voice) => voice.name === settings.voiceName);
                preview.lang = settings.speechLang;
                preview.rate = settings.rate;
                preview.pitch = settings.pitch;
                preview.volume = settings.volume;
                if (browserVoice) preview.voice = browserVoice;
                synth.cancel();
                activePreviewUtterance = preview;
                synth.speak(preview);
            });
        }

        if (window.speechSynthesis && !window.__isaiVoiceSettingsBound) {
            window.speechSynthesis.addEventListener("voiceschanged", () => {
                renderTtsVoiceChips();
                updateTtsUi();
            });
            window.__isaiVoiceSettingsBound = true;
        }

        updateTtsUi();
    }

    window.generateIsaiSupertonicSpeech = null;

    async function generateTtsFromInput() {
        const input = document.getElementById("prompt-input");
        if (!input) return;
        const rawText = input.value.trim();
        if (!rawText) return;

        try {
            if (typeof startExperience === "function") startExperience();
            if (typeof showLoader === "function") showLoader(true);
            appendMsg("user", rawText);
            input.value = "";
            input.style.height = "auto";

            const settings = syncVoiceSettings();
            const synth = window.speechSynthesis;
            if (!synth) throw new Error("Browser speech synthesis is not available.");

            const utterance = new SpeechSynthesisUtterance(rawText);
            const browserVoice = synth.getVoices().find((voice) => voice.name === settings.voiceName);
            utterance.lang = settings.speechLang;
            utterance.rate = settings.rate;
            utterance.pitch = settings.pitch;
            utterance.volume = settings.volume;
            if (browserVoice) utterance.voice = browserVoice;
            activePreviewUtterance = utterance;
            synth.cancel();
            synth.speak(utterance);
        } catch (error) {
            appendMsg("error", `${TTS_TEXT.errorPrefix} ${error?.message || error}`);
        } finally {
            if (typeof showLoader === "function") showLoader(false);
            updateTtsUi();
            input.focus();
        }
    }

    function syncCodeWorkspace(mode) {
        if (typeof window.syncInlineCodePanel === "function") {
            window.syncInlineCodePanel(mode);
            return;
        }

        mode = mode || "chat";
        if (document.body) document.body.setAttribute("data-ui-mode", mode);

        const rightPanel = document.getElementById("right-panel");
        const codeTabs = document.getElementById("code-tabs");
        const codeEditor = document.getElementById("code-editor");
        const topZone = document.getElementById("top-zone");
        const chatBox = document.getElementById("chat-box");
        const chatInputShell = document.getElementById("chat-input-shell");
        const rightPanelOriginAnchor = document.getElementById("right-panel-origin-anchor");
        const desktopCodePanelHost = document.getElementById("desktop-code-panel-host");
        const isCodeMode = mode === "code";
        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || null;
        const fullscreenActive = !!(fullscreenElement && fullscreenElement.classList && fullscreenElement.classList.contains("island-box"));
        const mobileCodeMode = isCodeMode && vw <= 900;
        const desktopCodeMode = isCodeMode && vw > 900;
        const codePanelGridColumn = vw <= 1180 ? "1 / span 2" : "1 / span 4";
        const codePanelGridRow = vw <= 900 ? "2" : (vw <= 1180 ? "3" : "2");
        const codePanelMinHeight = vw <= 900 ? "240px" : "320px";
        const codePanelMaxHeight = vw <= 900 ? "360px" : "520px";

        if (!rightPanel) return;

        if (rightPanelOriginAnchor && rightPanelOriginAnchor.parentElement && desktopCodePanelHost) {
            if (desktopCodeMode && !fullscreenActive) {
                desktopCodePanelHost.style.display = "block";
                desktopCodePanelHost.style.width = "100%";
                desktopCodePanelHost.style.minWidth = "0";
                desktopCodePanelHost.style.minHeight = codePanelMinHeight;
                desktopCodePanelHost.style.visibility = "visible";
                desktopCodePanelHost.style.opacity = "1";
                if (rightPanel.parentElement !== desktopCodePanelHost) {
                    desktopCodePanelHost.appendChild(rightPanel);
                }
            } else {
                desktopCodePanelHost.style.display = "none";
                desktopCodePanelHost.style.removeProperty("min-height");
                desktopCodePanelHost.style.removeProperty("visibility");
                desktopCodePanelHost.style.removeProperty("opacity");
                desktopCodePanelHost.style.removeProperty("overflow");
                if (rightPanel.parentElement !== rightPanelOriginAnchor.parentElement) {
                    rightPanelOriginAnchor.parentElement.insertBefore(rightPanel, rightPanelOriginAnchor.nextSibling);
                }
            }
        }

        document.body.classList.toggle("mode-code", mobileCodeMode);
        document.body.classList.toggle("desktop-code-open", desktopCodeMode);
        document.body.classList.toggle("desktop-code-panel-mounted", desktopCodeMode && !fullscreenActive);
        document.body.classList.remove("desktop-code-stage");
        rightPanel.classList.toggle("mobile-active", mobileCodeMode);

        if (isCodeMode) {
            if (codeTabs && !codeTabs.querySelector(".code-tab-btn")) {
                codeTabs.innerHTML = '<div class="code-panel-empty"><span class="code-panel-empty-icon"><i class="ri-ai-generate-text text-sm"></i></span><span class="code-panel-empty-dots" aria-hidden="true"><span></span><span></span><span></span></span></div>';
            }

            if (codeEditor && !String(codeEditor.value || "").trim()) {
                codeEditor.value = "// Describe the code you want and generated files will appear here.";
            }

            rightPanel.classList.remove("hidden");
            rightPanel.style.setProperty("display", "flex", "important");
            rightPanel.style.setProperty("visibility", "visible", "important");
            rightPanel.style.setProperty("opacity", "1", "important");
            rightPanel.style.setProperty("width", "100%", "important");
            rightPanel.style.setProperty("min-width", "0", "important");
            rightPanel.style.setProperty("max-width", "100%", "important");
            if (mobileCodeMode) {
                rightPanel.style.setProperty("grid-row", codePanelGridRow, "important");
                rightPanel.style.setProperty("grid-column", codePanelGridColumn, "important");
            } else {
                rightPanel.style.removeProperty("grid-row");
                rightPanel.style.removeProperty("grid-column");
            }
            rightPanel.style.setProperty("height", "auto", "important");
            rightPanel.style.setProperty("min-height", codePanelMinHeight, "important");
            rightPanel.style.setProperty("max-height", codePanelMaxHeight, "important");
            rightPanel.style.setProperty("overflow", "hidden", "important");
            rightPanel.style.setProperty("border-top", "1px solid rgba(255, 255, 255, 0.06)", "important");
            if (topZone) {
                topZone.style.setProperty("display", "flex", "important");
                topZone.style.setProperty("visibility", "visible", "important");
                topZone.style.setProperty("opacity", "1", "important");
            }
            if (chatBox) {
                chatBox.classList.remove("hidden");
                chatBox.style.setProperty("display", "flex", "important");
                chatBox.style.setProperty("visibility", "visible", "important");
                chatBox.style.setProperty("opacity", "1", "important");
            }
            if (chatInputShell) {
                chatInputShell.classList.remove("hidden");
                chatInputShell.style.setProperty("display", "flex", "important");
                chatInputShell.style.setProperty("visibility", "visible", "important");
                chatInputShell.style.setProperty("opacity", "1", "important");
            }
            setTimeout(() => {
                try {
                    (desktopCodeMode && desktopCodePanelHost ? desktopCodePanelHost : rightPanel).scrollIntoView({ behavior: "smooth", block: "start" });
                } catch (error) {}
            }, vw <= 900 ? 90 : 20);
        } else {
            document.body.classList.remove("desktop-code-stage");
            document.body.classList.remove("desktop-code-open");
            document.body.classList.remove("desktop-code-panel-mounted");
            rightPanel.classList.remove("mobile-active");
            rightPanel.classList.add("hidden");
            if (desktopCodePanelHost) {
                desktopCodePanelHost.style.display = "none";
                desktopCodePanelHost.style.removeProperty("min-height");
                desktopCodePanelHost.style.removeProperty("visibility");
                desktopCodePanelHost.style.removeProperty("opacity");
                desktopCodePanelHost.style.removeProperty("overflow");
            }
            if (rightPanelOriginAnchor && rightPanelOriginAnchor.parentElement && rightPanel.parentElement !== rightPanelOriginAnchor.parentElement) {
                rightPanelOriginAnchor.parentElement.insertBefore(rightPanel, rightPanelOriginAnchor.nextSibling);
            }
            rightPanel.style.removeProperty("display");
            rightPanel.style.removeProperty("visibility");
            rightPanel.style.removeProperty("opacity");
            rightPanel.style.removeProperty("width");
            rightPanel.style.removeProperty("min-width");
            rightPanel.style.removeProperty("max-width");
            rightPanel.style.removeProperty("grid-row");
            rightPanel.style.removeProperty("grid-column");
            rightPanel.style.removeProperty("height");
            rightPanel.style.removeProperty("max-height");
            rightPanel.style.removeProperty("min-height");
            rightPanel.style.removeProperty("overflow");
            rightPanel.style.removeProperty("border-top");
            if (topZone) {
                topZone.style.removeProperty("display");
                topZone.style.removeProperty("visibility");
                topZone.style.removeProperty("opacity");
            }
            if (chatBox) {
                chatBox.style.removeProperty("display");
                chatBox.style.removeProperty("visibility");
                chatBox.style.removeProperty("opacity");
            }
            if (chatInputShell) {
                chatInputShell.style.removeProperty("display");
                chatInputShell.style.removeProperty("visibility");
                chatInputShell.style.removeProperty("opacity");
            }
        }

        if (typeof window.__applyMobileChatRailSafety === "function") {
            [0, 60, 160, 360].forEach((delay) => {
                setTimeout(window.__applyMobileChatRailSafety, delay);
            });
        }
    }
    window.syncCodeWorkspace = syncCodeWorkspace;

    function wrapModeSetters() {
        if (typeof setMode !== "function") return;
        const originalSetMode = setMode;
        setMode = function (mode) {
            if (mode !== "voice" && typeof stopVoiceMode === "function") {
                try { stopVoiceMode(true); } catch (error) {}
            }
            const result = originalSetMode.apply(this, arguments);
            try { currentMode = mode; } catch (error) {}
            try { selectedMode = mode; } catch (error) {}
            window.currentMode = mode;
            window.selectedMode = mode;
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
            if (leftVoiceButton) {
                leftVoiceButton.classList.remove("hidden");
                leftVoiceButton.style.display = "flex";
            }
            if (typeof setVoiceState === "function") {
                setTimeout(() => setVoiceState("left", "idle"), 0);
            }
            if (mode === "chat") {
                setTimeout(() => ensureWelcomeMessage(false), 0);
            }
            if (mode === "translate") {
                initTranslateSelectors();
                syncTranslateVoiceRecognition();
            } else {
                closeAllTranslateMenus();
            }
            updateComposerMeta(mode);
            updateTtsUi();
            renderRecentModeActions(mode);
            return result;
        };
        window.setMode = setMode;
    }

    function wrapExecuteAction() {
        if (typeof executeAction !== "function") return;
        const originalExecuteAction = executeAction;
        executeAction = async function () {
            return originalExecuteAction.apply(this, arguments);
        };
        window.executeAction = executeAction;
    }

    function loadSideBanner() {
        const slot = document.getElementById("chat-ad-slot");
        const fallback = document.getElementById("chat-ad-fallback");
        if (!slot) return;

        const renderBanner = () => {
            if (typeof loadBanner !== "function") return;
            try {
                const slotRect = slot.getBoundingClientRect();
                const island = slot.closest(".island-box");
                const islandRect = island ? island.getBoundingClientRect() : null;
                const measuredHeight = Math.round(slotRect.height || 0);
                const fallbackHeight = Math.round((islandRect ? islandRect.height : 0) - 4);
                const bannerHeight = Math.max(120, measuredHeight || fallbackHeight || 220);
                loadBanner("chat-ad-slot", "fluke103", "200", bannerHeight);
                setTimeout(() => {
                    if (slot.querySelector(".snapp-banner-container") && fallback) {
                        fallback.classList.add("hidden");
                    }
                }, 1200);
            } catch (error) {
                if (fallback) fallback.classList.remove("hidden");
            }
        };

        if (typeof loadBanner === "function") {
            renderBanner();
            return;
        }

        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/gh/sllkx/addly/cdnbanner_radius.js";
        script.onload = renderBanner;
        script.onerror = () => {
            if (fallback) fallback.classList.remove("hidden");
        };
        document.head.appendChild(script);
    }

    function initChatTtsUi() {
        overwriteAppendMsg();
        wrapResetChat();
        wrapAppModeHooks();
        wrapModeSetters();
        wrapExecuteAction();
        setupTtsControls();
        initTranslateSelectors();
        ensureWelcomeMessage(true);
        updateComposerMeta(getCurrentMode());
        updateTtsUi();
        renderRecentModeActions(getCurrentMode());
        loadSideBanner();

        const ttsControls = document.getElementById("tts-controls");
        const chatBox = document.getElementById("chat-box");
        const chatStack = document.getElementById("chat-main-stack");
        const topZone = document.getElementById("top-zone");
        const leftVoiceButton = document.getElementById("btn-submit-left");
        const chatInputShell = document.getElementById("chat-input-shell");
        if (ttsControls) {
            ttsControls.classList.toggle("hidden", getCurrentMode() !== "settings");
        }
        if (chatBox) {
            chatBox.classList.toggle("hidden", getCurrentMode() === "settings");
        }
        if (chatStack) {
            chatStack.classList.toggle("settings-mode", getCurrentMode() === "settings");
        }
        if (topZone) {
            topZone.classList.toggle("settings-mode", getCurrentMode() === "settings");
        }
        if (chatInputShell) {
            chatInputShell.classList.toggle("hidden", getCurrentMode() === "settings");
        }
        syncCodeWorkspace(getCurrentMode());
        if (leftVoiceButton) {
            leftVoiceButton.classList.remove("hidden");
            leftVoiceButton.style.display = "flex";
        }
        if (getCurrentMode() === "translate") {
            syncTranslateVoiceRecognition();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initChatTtsUi);
    } else {
        initChatTtsUi();
    }
})();
