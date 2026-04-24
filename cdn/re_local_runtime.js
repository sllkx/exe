(function () {
    const CHAT_MODEL_STORAGE_KEY = "ISAI_LOCAL_CHAT_MODEL_ID_V1";
    const LOCAL_ACTIVE_STORAGE_KEY = "ISAI_LOCAL_ACTIVE_V1";
    const WEBGPU_ACTIVE_STORAGE_KEY = "ISAI_LOCAL_WEBGPU_ACTIVE_V1";
    const MODEL_MENU_ID = "local-model-shortcut-panel";
    const MODEL_MENU_STYLE_ID = "isai-local-model-shortcut-style-v2";
    const SPEED_TIER_ORDER = ["code", "light", "middle", "hard"];
    const MODEL_TYPE_ORDER = ["all", "gemma", "qwen", "huggingface", "granite", "ernie"];
    const SLOT_ICON_MAP = {
        code: "ri-code-block",
        light: "ri-flashlight-line",
        middle: "ri-cpu-line",
        hard: "ri-focus-3-line"
    };
    const SPEED_TIER_ICON_MAP = {
        code: "ri-code-block",
        light: "ri-flashlight-line",
        middle: "ri-command-line",
        hard: "ri-fire-line"
    };
    let startDownloadPromise = null;

    function getLocale() {
        const locale = String(
            (window.ISAI_SERVER_I18N && window.ISAI_SERVER_I18N.locale)
            || window.LANG
            || document.documentElement.lang
            || navigator.language
            || "en"
        ).toLowerCase();
        if (locale.startsWith("ko")) return "ko";
        if (locale.startsWith("ja")) return "ja";
        if (locale.startsWith("zh")) return "zh";
        if (locale.startsWith("es")) return "es";
        return "en";
    }

    function t(key) {
        const dict = {
            ko: {
                submit: "보내기",
                stop: "중지",
                modelChanged: "채팅 모델이 변경되었습니다",
                presetChanged: "로컬 속도 설정이 변경되었습니다",
                downloading: "로컬 모델을 준비 중입니다",
                codeFixed: "코드 모델은 고정입니다",
                chatModel: "채팅 모델",
                code: "코드",
                light: "라이트",
                middle: "중간",
                hard: "하드",
                all: "전체"
            },
            en: {
                submit: "Send",
                stop: "Stop",
                modelChanged: "Chat model updated",
                presetChanged: "Local speed preset updated",
                downloading: "Preparing local model",
                codeFixed: "Code model is fixed",
                chatModel: "Chat model",
                code: "Code",
                light: "Light",
                middle: "Middle",
                hard: "Hard",
                all: "All"
            },
            ja: {
                submit: "送信",
                stop: "停止",
                modelChanged: "チャットモデルが更新されました",
                presetChanged: "ローカル速度設定が更新されました",
                downloading: "ローカルモデルを準備中です",
                codeFixed: "コードモデルは固定です",
                chatModel: "チャットモデル",
                code: "コード",
                light: "ライト",
                middle: "ミドル",
                hard: "ハード",
                all: "すべて"
            },
            zh: {
                submit: "发送",
                stop: "停止",
                modelChanged: "聊天模型已更新",
                presetChanged: "本地速度预设已更新",
                downloading: "正在准备本地模型",
                codeFixed: "代码模型已固定",
                chatModel: "聊天模型",
                code: "代码",
                light: "轻量",
                middle: "中等",
                hard: "高精度",
                all: "全部"
            },
            es: {
                submit: "Enviar",
                stop: "Detener",
                modelChanged: "Modelo de chat actualizado",
                presetChanged: "Ajuste local actualizado",
                downloading: "Preparando modelo local",
                codeFixed: "El modelo de codigo es fijo",
                chatModel: "Modelo de chat",
                code: "Codigo",
                light: "Ligero",
                middle: "Medio",
                hard: "Preciso",
                all: "Todo"
            }
        };
        const pack = dict[getLocale()] || dict.en;
        return pack[key] || dict.en[key] || key;
    }

    function getEmptyLocalResponseText(locale) {
        const value = String(locale || getLocale()).toLowerCase();
        if (value.startsWith("ko")) return "응답을 불러오지 못했습니다.";
        if (value.startsWith("ja")) return "応答を読み込めませんでした。";
        if (value.startsWith("zh")) return "无法加载回复。";
        if (value.startsWith("es")) return "No pude cargar una respuesta.";
        return "I could not load a response.";
    }

    function getSpeedPresets() {
        return window.__ISAI_LOCAL_SPEED_PRESETS || {};
    }

    function getLocalActivePreference() {
        return localStorage.getItem(LOCAL_ACTIVE_STORAGE_KEY) === "true";
    }

    function setLocalActivePreference(value) {
        localStorage.setItem(LOCAL_ACTIVE_STORAGE_KEY, value ? "true" : "false");
    }

    function getWebGPUPreference() {
        const stored = localStorage.getItem(WEBGPU_ACTIVE_STORAGE_KEY);
        if (stored == null) return true;
        return stored === "true";
    }

    function setWebGPUPreference(value) {
        localStorage.setItem(WEBGPU_ACTIVE_STORAGE_KEY, value ? "true" : "false");
    }

    function canUseWebLLM(profile) {
        return !!(
            getWebGPUPreference()
            && profile
            && profile.webllmModelId
            && navigator.gpu
            && window.WebLLMObj
            && typeof window.WebLLMObj.CreateMLCEngine === "function"
        );
    }

    function getWebGPUSupportState() {
        const profile = typeof getActiveLocalModelProfile === "function"
            ? getActiveLocalModelProfile()
            : null;
        const engineAvailable = !!(
            navigator.gpu
            && window.WebLLMObj
            && typeof window.WebLLMObj.CreateMLCEngine === "function"
        );
        const modelSupported = !!(profile && profile.webllmModelId);
        const enabled = getWebGPUPreference();
        return {
            profile,
            enabled,
            engineAvailable,
            modelSupported,
            effective: !!(enabled && engineAvailable && modelSupported)
        };
    }

    function getCatalog() {
        return window.__ISAI_LOCAL_MODEL_CATALOG || {};
    }

    function isRecoverableGgufLoadError(error) {
        const message = String(error && error.message ? error.message : error || "").toLowerCase();
        return /invalid gguf|invalid typed array length|gguf magic|native gguf load failed|selected model file|out of bounds|model file is not a valid gguf/.test(message);
    }

    async function syncDownloadedStateFromCache(profile) {
        const targetProfile = profile || (typeof getActiveLocalModelProfile === "function" ? getActiveLocalModelProfile() : null);
        const hasCachedModel = window.WWAIObj && typeof window.WWAIObj.hasCachedModel === "function"
            ? window.WWAIObj.hasCachedModel
            : null;
        let cacheReady = false;
        if (targetProfile && hasCachedModel) {
            const seen = new Set();
            const candidates = [];
            const push = function (value) {
                const url = String(value || "").trim();
                if (!url || seen.has(url)) return;
                seen.add(url);
                candidates.push(url);
            };
            push(targetProfile.fallbackUrl);
            if (Array.isArray(targetProfile.fallbackUrls)) {
                targetProfile.fallbackUrls.forEach(push);
            }
            for (const candidate of candidates) {
                try {
                    if (await hasCachedModel(candidate)) {
                        cacheReady = true;
                        break;
                    }
                } catch (error) {}
            }
        }
        isModelDownloaded = cacheReady || localStorage.getItem(getLocalDownloadStorageKey()) === "true";
        if (isModelDownloaded) {
            localStorage.setItem(getLocalDownloadStorageKey(), "true");
        } else {
            localStorage.removeItem(getLocalDownloadStorageKey());
        }
        return isModelDownloaded;
    }

    function getStoredChatModelId() {
        const raw = String(localStorage.getItem(CHAT_MODEL_STORAGE_KEY) || "").trim();
        const catalog = getCatalog();
        if (raw && catalog[raw]) return raw;
        return String((window.MODEL_CONFIG && window.MODEL_CONFIG.defaultChatModelId) || "qwen_05b_q3km");
    }

    function getModelType(item) {
        const explicit = String(item && item.modelType ? item.modelType : "").toLowerCase();
        if (explicit) return explicit;
        const hay = `${item && item.id ? item.id : ""} ${item && item.name ? item.name : ""}`.toLowerCase();
        if (hay.includes("smollm") || hay.includes("huggingface")) return "huggingface";
        if (hay.includes("gemma")) return "gemma";
        if (hay.includes("granite")) return "granite";
        if (hay.includes("ernie")) return "ernie";
        if (hay.includes("qwen")) return "qwen";
        return "gemma";
    }

    function getChatCatalogItems(activeTier) {
        const catalog = Object.values(getCatalog());
        const typeRank = { gemma: 0, qwen: 1, huggingface: 2, granite: 3, ernie: 4 };
        const byTypeThenName = (a, b) => {
            const aType = getModelType(a);
            const bType = getModelType(b);
            const aRank = Object.prototype.hasOwnProperty.call(typeRank, aType) ? typeRank[aType] : 99;
            const bRank = Object.prototype.hasOwnProperty.call(typeRank, bType) ? typeRank[bType] : 99;
            if (aRank !== bRank) return aRank - bRank;
            return String(a && a.name ? a.name : "").localeCompare(String(b && b.name ? b.name : ""));
        };
        if (String(activeTier || "").toLowerCase() === "code") {
            return catalog.filter((item) => item.id === "qwen_coder_05b_q3kl").sort(byTypeThenName);
        }
        return catalog.filter((item) => item.id !== "qwen_coder_05b_q3kl").sort(byTypeThenName);
    }

    function getActiveChatModelItem() {
        const catalog = getCatalog();
        return catalog[getStoredChatModelId()] || null;
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function getResolvedProfiles() {
        const baseProfiles = clone(window.__ISAI_LOCAL_MODEL_PROFILES || {});
        const chatItem = getActiveChatModelItem();
        ["light", "middle", "hard"].forEach((tierKey) => {
            if (!baseProfiles[tierKey] || !chatItem) return;
            baseProfiles[tierKey].modelId = chatItem.id;
            baseProfiles[tierKey].modelName = chatItem.name;
            baseProfiles[tierKey].fallbackUrl = chatItem.fallbackUrl;
            baseProfiles[tierKey].fallbackUrls = Array.isArray(chatItem.fallbackUrls) ? chatItem.fallbackUrls.slice() : [];
            baseProfiles[tierKey].popupSizeText = chatItem.popupSizeText;
            baseProfiles[tierKey].preferredRuntime = chatItem.preferredRuntime || "wllama";
            baseProfiles[tierKey].modelType = getModelType(chatItem);
            baseProfiles[tierKey].webllmModelId = chatItem.webllmModelId || "";
        });
        if (baseProfiles.code) {
            baseProfiles.code.preferredRuntime = "wllama";
            baseProfiles.code.fixedModel = true;
            baseProfiles.code.modelType = "qwen";
            baseProfiles.code.webllmModelId = "";
        }
        return baseProfiles;
    }

    function getSpeedPresetForTier(tierKey) {
        const presets = getSpeedPresets();
        return presets[String(tierKey || "").toLowerCase()] || presets.middle || null;
    }

    function getLocalModelProfilesOverride() {
        return getResolvedProfiles();
    }

    getLocalModelProfiles = window.getLocalModelProfiles = getLocalModelProfilesOverride;
    window.getIsaiLocalModelProfiles = getLocalModelProfilesOverride;

    getOrderedLocalModelTierKeys = window.getOrderedLocalModelTierKeys = function () {
        return SPEED_TIER_ORDER.filter((key) => !!getResolvedProfiles()[key]);
    };

    getLocalDownloadStorageKey = window.getLocalDownloadStorageKey = function () {
        const baseKey = (window.MODEL_CONFIG && window.MODEL_CONFIG.storageKey) || "ISAI_LOCAL_MODEL_CACHE_V7";
        const profile = typeof getActiveLocalModelProfile === "function" ? getActiveLocalModelProfile() : null;
        const modelId = profile && profile.modelId ? profile.modelId : getStoredChatModelId();
        return `${baseKey}__${modelId}`;
    };

    applyLocalModelProfileToConfig = window.applyLocalModelProfileToConfig = function () {
        const profile = typeof getActiveLocalModelProfile === "function" ? getActiveLocalModelProfile() : null;
        if (!profile) return null;
        const modelConfig = window.MODEL_CONFIG || {};
        modelConfig.preferredRuntime = "wllama";
        modelConfig.fallback = modelConfig.fallback || {};
        modelConfig.fallback.url = profile.fallbackUrl || "";
        modelConfig.webllm = null;
        modelConfig.activeProfile = profile;
        modelConfig.activeSpeedPreset = getSpeedPresetForTier(profile.key);
        modelConfig.modelProfiles = getResolvedProfiles();
        window.MODEL_CONFIG = modelConfig;
        return profile;
    };

    function getLocalizedTierLabel(tierKey) {
        const key = String(tierKey || "").toLowerCase();
        return t(key);
    }

    function getButtonBadge(type, compact) {
        const sizeClass = compact ? " is-compact" : "";
        if (type === "huggingface") return `<span class="local-model-provider-badge huggingface${sizeClass}">H</span>`;
        if (type === "granite") return `<span class="local-model-provider-badge granite${sizeClass}"><span class="model-provider-glyph">G</span></span>`;
        if (type === "gemma") return `<span class="local-model-provider-badge${sizeClass}"><i class="ri-gemini-fill"></i></span>`;
        if (type === "ernie") return `<span class="local-model-provider-badge ernie${sizeClass}"><span class="model-provider-glyph">E</span></span>`;
        return `<span class="local-model-provider-badge qwen${sizeClass}"><i class="ri-qwen-ai-fill"></i></span>`;
    }

    function ensureLocalModelMenuStyle() {
        if (document.getElementById(MODEL_MENU_STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = MODEL_MENU_STYLE_ID;
        style.textContent = `
#local-model-tier-wrapper{max-width:min(78vw,328px);overflow:visible!important}
#local-model-tier-list{display:flex;align-items:center;gap:5px;flex-wrap:nowrap}
.local-model-tier-btn,.local-model-tier-menu-btn,.local-model-tier-icon-btn{height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.64);color:rgba(255,255,255,.84);font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;transition:all .16s ease}
.local-model-tier-menu-btn,.local-model-tier-icon-btn{width:28px;min-width:28px;min-height:28px;max-width:28px;max-height:28px;aspect-ratio:1/1;flex:0 0 28px;padding:0;overflow:hidden;box-sizing:border-box}
.local-model-tier-btn:hover,.local-model-tier-btn.active,.local-model-tier-menu-btn:hover,.local-model-tier-menu-btn.is-open,.local-model-tier-icon-btn:hover,.local-model-tier-icon-btn.active{background:#fff;color:#111;border-color:#fff}
.local-model-shortcut-panel{position:absolute;top:calc(100% + 8px);left:0;right:0;width:100%;min-width:100%;max-width:100%;height:min(208px,calc(100vh - 220px));max-height:min(208px,calc(100vh - 220px));padding:5px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:rgba(10,10,11,.96);backdrop-filter:blur(14px);display:none;flex-direction:column;z-index:50;overflow:hidden!important;box-sizing:border-box}
.local-model-shortcut-panel.is-open{display:flex}
.local-model-shortcut-head{display:flex;align-items:center;gap:5px;margin-bottom:5px;flex:0 0 auto}
.local-model-shortcut-current{display:none!important}
.local-model-filter-row{display:flex;align-items:center;gap:3px;flex:1 1 auto;overflow-x:auto}
.local-model-filter-row::-webkit-scrollbar{display:none}
.local-model-filter-row > button:first-child{display:none!important}
.local-model-filter-btn{width:22px;height:22px;min-width:22px;min-height:22px;max-width:22px;max-height:22px;aspect-ratio:1/1;border:none;border-radius:999px;background:transparent;color:rgba(255,255,255,.76);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .16s ease;flex:0 0 22px;padding:0;overflow:hidden;box-sizing:border-box}
.local-model-filter-btn:hover,.local-model-filter-btn.is-active{background:rgba(255,255,255,.14);color:#fff}
.local-model-filter-btn.provider-huggingface{background:#facc15;border:1px solid #fde047;color:#111}
.local-model-filter-btn.provider-huggingface:hover,.local-model-filter-btn.provider-huggingface.is-active{background:#facc15;color:#111;border-color:#fde68a}
.local-model-filter-btn.provider-granite{background:#2563eb;border:1px solid #3b82f6;color:#fff}
.local-model-filter-btn.provider-granite:hover,.local-model-filter-btn.provider-granite.is-active{background:#2563eb;color:#fff;border-color:#60a5fa}
.local-model-catalog-scroll{display:block!important;flex:1 1 auto;min-height:0;height:0;max-height:100%;overflow-y:auto!important;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent;padding-right:1px}
.local-model-catalog-scroll::-webkit-scrollbar{width:4px}
.local-model-catalog-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22);border-radius:999px}
.local-model-catalog-grid{display:flex;flex-direction:column;gap:5px}
.local-model-catalog-card{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:6px 8px;border-radius:11px;border:1px solid rgba(255,255,255,.10);background:#151515;cursor:pointer;transition:all .16s ease}
.local-model-catalog-card:hover,.local-model-catalog-card.is-selected{border-color:rgba(255,255,255,.3);background:#1b1b1b}
.local-model-catalog-card.is-fixed{cursor:default;opacity:.92}
.local-model-catalog-card-main{min-width:0;display:flex;align-items:center;gap:7px;flex:1 1 auto}
.local-model-provider-button{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;min-width:20px;min-height:20px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);box-shadow:inset 0 1px 0 rgba(255,255,255,.03);padding:0;flex:0 0 auto}
.local-model-provider-badge{display:grid;place-items:center;width:20px;height:20px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;flex:0 0 auto;position:relative;overflow:hidden}
.local-model-provider-badge i,.local-model-provider-badge .hf-glyph,.local-model-provider-badge .model-provider-glyph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;line-height:1;margin:0;padding:0}
.local-model-provider-badge i::before{display:block;line-height:1;margin:0}
.local-model-provider-badge.huggingface{background:#facc15!important;border-color:#fde047!important;color:#fff!important;font-weight:900;font-size:10px;line-height:1}
.local-model-provider-badge.granite{background:#2563eb!important;border-color:#3b82f6!important;color:#fff!important;font-weight:800;font-size:10px;line-height:1}
.local-model-provider-badge.qwen{background:linear-gradient(180deg,#7c3aed,#5b21b6);border-color:rgba(196,181,253,.42);color:#fff;font-weight:800}
.local-model-provider-badge.qwen i{font-size:11px;line-height:1;color:#fff}
.local-model-provider-badge.ernie{position:relative;background:#0b0b0b;border-color:#3a3a3a;color:#fff;font-weight:800}
.local-model-provider-badge.ernie .model-provider-glyph,.local-model-provider-badge.granite .model-provider-glyph{font-size:10px;font-weight:800}
.local-model-provider-badge.is-compact{width:15px;height:15px;border-width:0;background:transparent}
.local-model-provider-button .local-model-provider-badge.is-compact{width:14px;height:14px;min-width:14px;min-height:14px;border-width:0;background:transparent!important;box-shadow:none!important;display:flex;align-items:center;justify-content:center}
.local-model-provider-button .local-model-provider-badge.huggingface.is-compact{background:#facc15!important;border-color:#fde047!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important}
.local-model-provider-button .local-model-provider-badge.qwen.is-compact{background:linear-gradient(180deg,#7c3aed,#5b21b6)!important;border-color:rgba(196,181,253,.42)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important}
.local-model-provider-button .local-model-provider-badge.gemma.is-compact{background:#2563eb!important;border-color:#60a5fa!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important}
.local-model-provider-button .local-model-provider-badge.granite.is-compact{background:#2563eb!important;border-color:#3b82f6!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important}
.local-model-provider-button .local-model-provider-badge.ernie.is-compact{background:#0b0b0b!important;border-color:#3a3a3a!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important}
.local-model-provider-button .local-model-provider-badge.qwen.is-compact i{font-size:11px}
.local-model-provider-badge.qwen.is-compact i{font-size:11px}
.local-model-provider-badge i{font-size:11px}
.local-model-catalog-name{min-width:0;font-size:9px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.local-model-size-pill{height:20px;padding:0 6px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);font-size:9px;font-weight:800;color:rgba(255,255,255,.86);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
`;
        document.head.appendChild(style);
    }

    function closeLocalModelShortcutMenu() {
        const panel = document.getElementById(MODEL_MENU_ID);
        const trigger = document.getElementById("local-model-tier-menu-btn");
        if (panel) panel.classList.remove("is-open");
        if (trigger) trigger.classList.remove("is-open");
    }

    function buildFilterRow(activeType) {
        const row = document.createElement("div");
        row.className = "local-model-filter-row";
        MODEL_TYPE_ORDER.forEach((typeKey) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `local-model-filter-btn provider-${typeKey}${activeType === typeKey ? " is-active" : ""}`;
            if (typeKey === "all") {
                button.innerHTML = '<i class="ri-apps-2-line text-[13px]"></i>';
            } else {
                button.innerHTML = getButtonBadge(typeKey, true);
            }
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                renderLocalModelTierSelector(typeKey);
                const panel = document.getElementById(MODEL_MENU_ID);
                if (panel) panel.classList.add("is-open");
                const trigger = document.getElementById("local-model-tier-menu-btn");
                if (trigger) trigger.classList.add("is-open");
            });
            row.appendChild(button);
        });
        return row;
    }

    function selectChatModel(modelId) {
        const catalog = getCatalog();
        if (!catalog[modelId]) return;
        localStorage.setItem(CHAT_MODEL_STORAGE_KEY, modelId);
        applyLocalModelProfileToConfig();
        isModelDownloaded = localStorage.getItem(getLocalDownloadStorageKey()) === "true";
        isModelLoaded = false;
        if (localEngine && typeof localEngine.unload === "function") {
            Promise.resolve(localEngine.unload()).catch(function () {});
        }
        localEngine = null;
        wllama = null;
        if (typeof setLocalRuntimeState === "function") setLocalRuntimeState(null);
        renderLocalModelTierSelector();
        syncLocalModelTierVisibility();
        if (String(getActiveLocalModelTier()) !== "code") {
            isLocalActive = true;
            setLocalActivePreference(true);
            startDownload();
        }
    }

    setLocalModelTier = window.setLocalModelTier = function (tierKey) {
        const profiles = getResolvedProfiles();
        const nextTier = String(tierKey || "").trim().toLowerCase();
        if (!profiles[nextTier]) return;
        const currentTier = String(getActiveLocalModelTier() || "").toLowerCase();
        if (currentTier === nextTier && isLocalActive && isModelLoaded) {
            renderLocalModelTierSelector();
            syncLocalModelTierVisibility();
            updateLocalBtnState();
            updateWebGPUBtnState();
            return;
        }
        localStorage.setItem(getLocalModelTierStorageKey(), nextTier);
        localStorage.setItem(getLocalModelTierUserSetKey(), "true");
        applyLocalModelProfileToConfig();
        isLocalActive = true;
        isModelLoaded = false;
        if (localEngine && typeof localEngine.unload === "function") {
            Promise.resolve(localEngine.unload()).catch(() => {});
        }
        localEngine = null;
        wllama = null;
        if (typeof setLocalRuntimeState === "function") setLocalRuntimeState(null);
        isModelDownloaded = localStorage.getItem(getLocalDownloadStorageKey()) === "true";
        updateLocalBtnState();
        renderLocalModelTierSelector();
        syncLocalModelTierVisibility();
        if (isLocalActive) {
            setLocalActivePreference(true);
        }
        startDownload();
    };

    handleLocalToggle = window.handleLocalToggle = async function () {
        applyLocalModelProfileToConfig();
        await syncDownloadedStateFromCache();
        if (isLocalActive && isModelLoaded) {
            isLocalActive = false;
            setLocalActivePreference(false);
            isModelLoaded = false;
            if (localEngine && typeof localEngine.unload === "function") {
                Promise.resolve(localEngine.unload()).catch(function () {});
            }
            localEngine = null;
            wllama = null;
            if (typeof setLocalRuntimeState === "function") setLocalRuntimeState(null);
            updateLocalBtnState();
            syncLocalModelTierVisibility();
            if (typeof window.updateMainSubmitButtonState === "function") {
                window.updateMainSubmitButtonState();
            }
            return;
        }

        // Always start local mode from Light tier by default.
        const profiles = typeof getLocalModelProfiles === "function" ? getLocalModelProfiles() : {};
        if (profiles && profiles.light) {
            localStorage.setItem(getLocalModelTierStorageKey(), "light");
        }
        applyLocalModelProfileToConfig();

        isLocalActive = true;
        setLocalActivePreference(true);
        updateLocalBtnState();
        renderLocalModelTierSelector();
        syncLocalModelTierVisibility();
        await startDownload();
    };

    syncLocalModelTierVisibility = window.syncLocalModelTierVisibility = function (mode) {
        const wrapper = document.getElementById("local-model-tier-wrapper");
        if (!wrapper) return;
        const shouldShow = true;
        wrapper.style.display = shouldShow ? "block" : "none";
        wrapper.classList.toggle("hidden", !shouldShow);
        if (!shouldShow) closeLocalModelShortcutMenu();
    };

    updateLocalBtnState = window.updateLocalBtnState = function () {
        const btn = document.getElementById("btn-download");
        if (!btn) return;
        const icon = btn.querySelector("i");
        btn.classList.toggle("active", !!isLocalActive);
        btn.style.color = isLocalActive
            ? "#ffffff"
            : (isModelDownloaded ? "rgba(255,255,255,0.76)" : "rgba(255,255,255,0.44)");
        btn.style.background = isLocalActive ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.64)";
        btn.style.borderColor = isLocalActive ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.10)";
        btn.title = isLocalActive ? "Local Mode On" : "Local Mode";
        btn.setAttribute("aria-pressed", isLocalActive ? "true" : "false");
        if (icon) {
            icon.className = "ri-ghost-4-line text-[15px]";
            icon.style.color = isLocalActive
                ? "#ffffff"
                : (isModelDownloaded ? "rgba(255,255,255,0.76)" : "rgba(255,255,255,0.44)");
        }
        if (typeof syncLocalModelTierVisibility === "function") {
            syncLocalModelTierVisibility();
        }
    };

    updateWebGPUBtnState = window.updateWebGPUBtnState = function () {
        const btn = document.getElementById("btn-webgpu");
        if (!btn) return;
        const icon = btn.querySelector("i");
        const state = getWebGPUSupportState();
        btn.classList.toggle("active", state.effective);
        btn.style.opacity = state.engineAvailable ? "1" : "0.45";
        btn.style.background = state.effective ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.04)";
        btn.style.borderColor = state.effective ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.08)";
        btn.style.color = state.effective ? "#ffffff" : "rgba(255,255,255,0.62)";
        btn.title = !state.engineAvailable
            ? "WebGPU Unavailable"
            : (!state.modelSupported ? "Current model uses Wllama only" : (state.enabled ? "WebGPU Enabled" : "WebGPU Disabled"));
        btn.setAttribute("aria-pressed", state.effective ? "true" : "false");
        if (icon) {
            icon.className = "ri-cpu-line text-lg";
            icon.style.color = state.effective ? "#ffffff" : "rgba(255,255,255,0.62)";
        }
    };

    handleWebGPUToggle = window.handleWebGPUToggle = function () {
        const state = getWebGPUSupportState();
        if (!state.engineAvailable) {
            setWebGPUPreference(false);
            updateWebGPUBtnState();
            if (typeof showToast === "function") {
                showToast("WebGPU is unavailable on this browser");
            }
            return;
        }
        if (!state.modelSupported) {
            setWebGPUPreference(false);
            updateWebGPUBtnState();
            if (typeof showToast === "function") {
                showToast("This model uses Wllama only");
            }
            return;
        }
        const next = !getWebGPUPreference();
        setWebGPUPreference(next);
        if (localEngine && typeof localEngine.unload === "function") {
            Promise.resolve(localEngine.unload()).catch(function () {});
        }
        localEngine = null;
        wllama = null;
        isModelLoaded = false;
        if (typeof setLocalRuntimeState === "function") setLocalRuntimeState(null);
        applyLocalModelProfileToConfig();
        updateWebGPUBtnState();
        updateLocalBtnState();
        if (typeof showToast === "function") {
            showToast(next ? "WebGPU enabled" : "WebGPU disabled");
        }
        if (isLocalActive) {
            startDownload();
        }
    };

    renderLocalModelTierSelector = window.renderLocalModelTierSelector = function (forcedFilter) {
        ensureLocalModelMenuStyle();
        const wrapper = document.getElementById("local-model-tier-wrapper");
        const list = document.getElementById("local-model-tier-list");
        if (!wrapper || !list) return;
        wrapper.classList.remove("hidden");

        const activeTier = String(getActiveLocalModelTier() || "middle").toLowerCase();
        const profiles = getResolvedProfiles();
        const selectedChatModelId = getStoredChatModelId();
        const activeFilter = String(forcedFilter || wrapper.dataset.modelFilter || "all").toLowerCase();
        wrapper.dataset.modelFilter = activeFilter;

        list.innerHTML = "";
        SPEED_TIER_ORDER.forEach((tier) => {
            const profile = profiles[tier];
            if (!profile) return;
            const button = document.createElement("button");
            button.type = "button";
            button.className = `local-model-tier-btn is-icon${tier === activeTier ? " active" : ""}`;
            button.dataset.tier = tier;
            button.innerHTML = `<i class="${SPEED_TIER_ICON_MAP[tier] || "ri-circle-line"}"></i>`;
            button.title = profile.modelName || getLocalizedTierLabel(tier);
            button.setAttribute("aria-label", profile.modelName || getLocalizedTierLabel(tier));
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
        localButton.className = "local-model-tier-icon-btn";
        localButton.innerHTML = '<i class="ri-ghost-4-line text-[15px]"></i>';
        localButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            handleLocalToggle();
        });
        list.appendChild(localButton);

        const gpuButton = document.createElement("button");
        gpuButton.type = "button";
        gpuButton.id = "btn-webgpu";
        gpuButton.className = "local-model-tier-icon-btn";
        gpuButton.innerHTML = '<i class="ri-cpu-line text-[15px]"></i>';
        gpuButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            handleWebGPUToggle();
        });
        list.appendChild(gpuButton);

        const menuButton = document.createElement("button");
        menuButton.type = "button";
        menuButton.id = "local-model-tier-menu-btn";
        menuButton.className = "local-model-tier-menu-btn";
        menuButton.innerHTML = '<i class="ri-menu-4-line text-[14px]"></i>';
        menuButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            const panel = document.getElementById(MODEL_MENU_ID);
            const willOpen = !(panel && panel.classList.contains("is-open"));
            closeLocalModelShortcutMenu();
            if (willOpen && panel) {
                panel.classList.add("is-open");
                menuButton.classList.add("is-open");
            }
        });
        list.appendChild(menuButton);

        let panel = document.getElementById(MODEL_MENU_ID);
        if (!panel) {
            panel = document.createElement("div");
            panel.id = MODEL_MENU_ID;
            panel.className = "local-model-shortcut-panel";
            wrapper.appendChild(panel);
        }

        const wasOpen = panel.classList.contains("is-open");
        panel.innerHTML = "";

        const head = document.createElement("div");
        head.className = "local-model-shortcut-head";
        head.appendChild(buildFilterRow(activeFilter));
        panel.appendChild(head);

        const scrollBox = document.createElement("div");
        scrollBox.className = "local-model-catalog-scroll";
        const grid = document.createElement("div");
        grid.className = "local-model-catalog-grid";
        const items = getChatCatalogItems(activeTier).filter((item) => activeFilter === "all" ? true : getModelType(item) === activeFilter);

        items.forEach((item) => {
            const modelType = getModelType(item);
            const isCodeCard = activeTier === "code";
            const isSelected = isCodeCard ? item.id === "qwen_coder_05b_q3kl" : item.id === selectedChatModelId;
            const card = document.createElement("div");
            card.className = `local-model-catalog-card${isSelected ? " is-selected" : ""}${isCodeCard ? " is-fixed" : ""}`;
            card.innerHTML = `
                <div class="local-model-catalog-card-main">
                    <span class="local-model-provider-button" aria-hidden="true">${getButtonBadge(modelType, true)}</span>
                    <div class="local-model-catalog-name" title="${item.name}">${item.name}</div>
                </div>
                <span class="local-model-size-pill">${item.popupSizeText || ""}</span>
            `;
            card.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (isCodeCard) {
                    if (typeof showToast === "function") showToast(t("codeFixed"));
                    return;
                }
                closeLocalModelShortcutMenu();
                selectChatModel(item.id);
            });
            grid.appendChild(card);
        });

        scrollBox.appendChild(grid);
        panel.appendChild(scrollBox);

        if (wasOpen) {
            panel.classList.add("is-open");
            menuButton.classList.add("is-open");
        }

        updateLocalBtnState();
        updateWebGPUBtnState();
        syncLocalModelTierVisibility();
    };

    function getRuntimeCreateEngine() {
        return window.WWAIObj && typeof window.WWAIObj.createEngine === "function"
            ? window.WWAIObj.createEngine
            : null;
    }

    startDownload = window.startDownload = async function () {
        if (startDownloadPromise) {
            return startDownloadPromise;
        }
        startDownloadPromise = (async () => {
        const container = document.getElementById("progress-container");
        const bar = document.getElementById("progress-bar");
        const profile = applyLocalModelProfileToConfig();
        const speedConfig = getSpeedPresetForTier(profile && profile.key);
        const modelUrlCandidates = (function () {
            const seen = new Set();
            const out = [];
            const push = function (value) {
                const url = String(value || "").trim();
                if (!url || seen.has(url)) return;
                seen.add(url);
                out.push(url);
            };
            push(profile && profile.fallbackUrl);
            if (profile && Array.isArray(profile.fallbackUrls)) {
                profile.fallbackUrls.forEach(push);
            }
            return out;
        })();

        const normalizeForCompare = function (value) {
            const raw = String(value || "").trim();
            if (!raw) return "";
            try {
                const u = new URL(raw, window.location.origin);
                u.searchParams.delete("download");
                return `${u.origin}${u.pathname}?${u.searchParams.toString()}`.replace(/\?$/, "").toLowerCase();
            } catch (error) {
                return raw.toLowerCase().replace(/[?&]download=true/gi, "").replace(/[?&]$/, "");
            }
        };

        const loadedModelUrl = localEngine && localEngine.modelInfo && localEngine.modelInfo.url
            ? normalizeForCompare(localEngine.modelInfo.url)
            : "";
        const candidateUrlSet = new Set(modelUrlCandidates.map(normalizeForCompare).filter(Boolean));
        if (isModelLoaded && loadedModelUrl && candidateUrlSet.has(loadedModelUrl)) {
            if (container) container.classList.add("hidden");
            if (typeof updateLocalProgress === "function") updateLocalProgress(bar, 100);
            isModelDownloaded = true;
            localStorage.setItem(getLocalDownloadStorageKey(), "true");
            return localEngine;
        }

        if (!profile || !modelUrlCandidates.length) {
            throw new Error("Local model configuration is missing.");
        }

        try {
            if (container) container.classList.remove("hidden");
            if (typeof updateLocalProgress === "function") updateLocalProgress(bar, 0);

            if (localEngine && typeof localEngine.unload === "function") {
                await Promise.resolve(localEngine.unload()).catch(function () {});
            }

            let engine = null;
            let runtimeName = "wllama";
            const shouldTryWebLLM = false;

            if (shouldTryWebLLM) {
                try {
                    const webllm = window.WebLLMObj;
                    engine = await webllm.CreateMLCEngine(profile.webllmModelId, {
                        logLevel: "WARN",
                        initProgressCallback: (report) => {
                            if (container) container.classList.remove("hidden");
                            if (typeof updateLocalProgress === "function") {
                                updateLocalProgress(bar, report && report.progress);
                            }
                        }
                    });
                    runtimeName = "webllm";
                } catch (webllmError) {
                    engine = null;
                }
            }

            if (!engine) {
                const createEngine = getRuntimeCreateEngine();
                if (!createEngine) {
                    throw new Error("Wllama runtime is not ready.");
                }

                engine = await createEngine("compat");
                const targetSeqLen = Math.min(
                    Math.max(
                        speedConfig && speedConfig.maxSeqLen ? Number(speedConfig.maxSeqLen) : 256,
                        384
                    ),
                    2048
                );
                const baseLoadOptions = {
                    speedPreset: speedConfig && speedConfig.enginePreset ? speedConfig.enginePreset : "turbo",
                    maxSeqLen: targetSeqLen,
                    nBatch: 96,
                    nCtx: targetSeqLen,
                    onStage(stage) {
                        if (container) container.classList.remove("hidden");
                        if (stage && stage.text === "compat-ready" && typeof updateLocalProgress === "function") {
                            updateLocalProgress(bar, 100);
                        }
                    },
                    onProgress(progress) {
                        if (container) container.classList.remove("hidden");
                        if (typeof updateLocalProgress === "function") {
                            updateLocalProgress(bar, progress && progress.ratio ? progress.ratio : 0);
                        }
                    }
                };
                const loadWithCandidates = async function (overrideLoadOptions) {
                    let lastError = null;
                    const purgeModelCache = window.WWAIObj && typeof window.WWAIObj.purgeModelCache === "function"
                        ? window.WWAIObj.purgeModelCache
                        : null;
                    for (const candidateUrl of modelUrlCandidates) {
                        try {
                            await engine.loadModel(candidateUrl, overrideLoadOptions || baseLoadOptions);
                            profile.fallbackUrl = candidateUrl;
                            return;
                        } catch (error) {
                            if (purgeModelCache && isRecoverableGgufLoadError(error)) {
                                try { await purgeModelCache(candidateUrl); } catch (cacheError) {}
                                try {
                                    // Retry once after cache purge to recover from stale/corrupted GGUF cache.
                                    await engine.loadModel(candidateUrl, overrideLoadOptions || baseLoadOptions);
                                    profile.fallbackUrl = candidateUrl;
                                    return;
                                } catch (retryError) {
                                    error = retryError;
                                }
                            }
                            lastError = error;
                        }
                    }
                    throw lastError || new Error("Model loading failed.");
                };
                try {
                    await loadWithCandidates(baseLoadOptions);
                } catch (compatLoadError) {
                    throw compatLoadError;
                }
            }

            localEngine = engine;
            isModelDownloaded = true;
            isModelLoaded = true;
            isLocalActive = true;
            wllama = null;
            if (typeof setLocalRuntimeState === "function") setLocalRuntimeState(runtimeName);
            localStorage.setItem(getLocalDownloadStorageKey(), "true");
            setLocalActivePreference(true);
            if (container) container.classList.add("hidden");
            updateLocalBtnState();
            updateWebGPUBtnState();
            renderLocalModelTierSelector();
        } catch (error) {
            if (container) container.classList.add("hidden");
            isModelDownloaded = false;
            isModelLoaded = false;
            if (localEngine && typeof localEngine.unload === "function") {
                await Promise.resolve(localEngine.unload()).catch(function () {});
            }
            localEngine = null;
            wllama = null;
            if (typeof setLocalRuntimeState === "function") setLocalRuntimeState(null);
            localStorage.removeItem(getLocalDownloadStorageKey());
            throw error;
        }
        })();
        try {
            return await startDownloadPromise;
        } finally {
            startDownloadPromise = null;
        }
    };

    runLocalInference = window.runLocalInference = async function (promptArr, callback) {
        if (isLocalActive && !isModelLoaded) {
            await startDownload();
        }
        const profile = applyLocalModelProfileToConfig();
        const speedConfig = getSpeedPresetForTier(profile && profile.key) || {};
        const isLightTier = !!(profile && profile.key === "light");
        const currentUiMode = String(
            window.currentMode
            || window.selectedMode
            || (document.body && document.body.getAttribute("data-ui-mode"))
            || "chat"
        ).toLowerCase();
        const isCharacterChat = !!(
            window.ISAI_CHARACTER_CHAT_SESSION
            && window.ISAI_CHARACTER_CHAT_SESSION.active
        );
        const isCodeMode = currentUiMode === "code";
        const isLightTierEffective = isLightTier && !isCodeMode && !isCharacterChat;
        const outputLocale = String(
            (document && document.documentElement && document.documentElement.lang)
            || (navigator && navigator.language)
            || "en"
        ).toLowerCase();
        const emptyResponseText = getEmptyLocalResponseText(outputLocale);
        let messages = typeof mapPromptMessagesForLocalEngine === "function"
            ? mapPromptMessagesForLocalEngine(promptArr)
            : [];
        messages = messages.filter((msg) => {
            if (!msg || msg.role !== "assistant") return true;
            const text = String(msg.content || "").trim();
            if (!text) return false;
            const normalized = text
                .toLowerCase()
                .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
                .replace(/[.!?~"'\u2019\u201D\u3002\uFF01\uFF1F]+/g, "")
                .replace(/\s+/g, " ")
                .trim();
            const blocked = new Set([
                "안녕하세요 무엇을 도와드릴까요",
                "로컬로 더 안전하게 대화하세요",
                "hello how can i help you",
                "chat more safely in local mode",
                "opening chat"
            ]);
            return !blocked.has(normalized);
        });
        if (!messages.length) return;
        async function ensureCompatEngineForLocalFallback() {
            const createEngine = getRuntimeCreateEngine();
            if (!createEngine) {
                throw new Error("Wllama runtime is not ready.");
            }
            if (localEngine && typeof localEngine.unload === "function") {
                await Promise.resolve(localEngine.unload()).catch(function () {});
            }
            const compatEngine = await createEngine("compat");
            const candidates = [];
            const seen = new Set();
            const push = function (value) {
                const url = String(value || "").trim();
                if (!url || seen.has(url)) return;
                seen.add(url);
                candidates.push(url);
            };
            push(profile && profile.fallbackUrl);
            if (profile && Array.isArray(profile.fallbackUrls)) profile.fallbackUrls.forEach(push);
            const purgeModelCache = window.WWAIObj && typeof window.WWAIObj.purgeModelCache === "function"
                ? window.WWAIObj.purgeModelCache
                : null;
            let lastError = null;
            for (const candidateUrl of candidates) {
                try {
                    await compatEngine.loadModel(candidateUrl, {
                        speedPreset: speedConfig.enginePreset || "balanced",
                        maxSeqLen: Math.max(speedConfig.maxSeqLen || 256, isCharacterChat ? 768 : (isLightTierEffective ? 384 : 640))
                    });
                    profile.fallbackUrl = candidateUrl;
                    lastError = null;
                    break;
                } catch (error) {
                    if (purgeModelCache && isRecoverableGgufLoadError(error)) {
                        try { await purgeModelCache(candidateUrl); } catch (cacheError) {}
                    }
                    lastError = error;
                }
            }
            if (lastError) throw lastError;
            localEngine = compatEngine;
            localRuntime = "wllama";
            if (typeof setLocalRuntimeState === "function") setLocalRuntimeState("wllama");
            return compatEngine;
        }

        if (localRuntime === "webllm" && localEngine && localEngine.chat && localEngine.chat.completions) {
            if (typeof localEngine.resetChat === "function") {
                try {
                    await localEngine.resetChat();
                } catch (error) {}
            }
            let emittedWebllmToken = false;
            const stream = await localEngine.chat.completions.create({
                messages,
                temperature: isLightTierEffective ? 0.18 : 0.45,
                top_p: isLightTierEffective ? 0.78 : 0.82,
                max_tokens: isCharacterChat ? 220 : (isLightTierEffective ? 48 : 220),
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
                    emittedWebllmToken = true;
                    callback(delta);
                }
            }
            if (emittedWebllmToken) {
                return;
            }
            await ensureCompatEngineForLocalFallback();
        }
        if (!localEngine || typeof localEngine.generateChat !== "function") {
            throw new Error("Wllama local engine is not ready.");
        }

        if (typeof localEngine.clearChatState === "function") {
            try {
                await localEngine.clearChatState();
            } catch (error) {}
        }

        function normalizeRepeatText(value) {
            return String(value || "")
                .toLowerCase()
                .replace(/\s+/g, " ")
                .replace(/[?쒋?']/g, "")
                .trim();
        }

        function trimIncomingOverlap(baseText, incomingText) {
            const base = String(baseText || "");
            const incoming = String(incomingText || "");
            const maxOverlap = Math.min(base.length, incoming.length, 180);
            for (let size = maxOverlap; size > 0; size -= 1) {
                if (base.slice(-size) === incoming.slice(0, size)) {
                    return incoming.slice(size);
                }
            }
            return incoming;
        }

        function getTrailingSentenceUnits(text) {
            return normalizeRepeatText(text)
                .split(/(?<=[.!?])\s+|\n+/)
                .map((part) => part.trim())
                .filter(Boolean);
        }

        function hasRepeatedSentence(text) {
            const units = getTrailingSentenceUnits(text);
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
                if (block && tail === block + block) {
                    return true;
                }
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

        function shouldSuppressRepeatedDelta(baseText, incomingText, previousDelta) {
            const trimmedIncoming = trimIncomingOverlap(baseText, incomingText);
            const normalizedDelta = normalizeRepeatText(trimmedIncoming);
            const normalizedPrevDelta = normalizeRepeatText(previousDelta);
            const candidateText = baseText + trimmedIncoming;
            if (!trimmedIncoming) {
                return { blocked: true, trimmed: "" };
            }
            if (normalizedDelta.length >= 12 && normalizedDelta === normalizedPrevDelta) {
                return { blocked: true, trimmed: "" };
            }
            if (hasRepeatedSentence(candidateText) || hasRepeatedTailBlock(candidateText) || hasRepeatedListPattern(candidateText) || hasRepeatedBlockSequence(candidateText)) {
                return { blocked: true, trimmed: "" };
            }
            return { blocked: false, trimmed: trimmedIncoming };
        }

        function normalizeRepeatKey(text) {
            return String(text || "")
                .replace(/\uFFFD/g, "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
        }

        function sanitizeStreamText(text) {
            return String(text || "")
                .replace(/\uFFFD+/g, "")
                .replace(/\r\n/g, "\n");
        }

        const localChunkDecoder = typeof TextDecoder !== "undefined"
            ? new TextDecoder("utf-8")
            : null;

        function hasRenderableLocalText(value) {
            const raw = String(value || "");
            if (!raw) return false;
            let extracted = "";
            if (typeof extractPlainTextLocal === "function") {
                try {
                    extracted = String(extractPlainTextLocal(raw) || "").trim();
                } catch (error) {
                    extracted = "";
                }
            }
            if (extracted) return true;
            const fallback = raw
                .replace(/<think>[\s\S]*?(<\/think>|$)/gi, " ")
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<[^>]+>/g, " ")
                .replace(/&nbsp;/gi, " ")
                .replace(/\s+/g, " ")
                .trim();
            return fallback.length > 0;
        }

        function readLocalChunkText(chunk) {
            if (chunk == null) return "";
            if (typeof chunk === "string") return chunk;
            if (typeof chunk === "number") return String(chunk);
            if (typeof Uint8Array !== "undefined" && chunk instanceof Uint8Array && localChunkDecoder) {
                return localChunkDecoder.decode(chunk, { stream: true });
            }
            if (Array.isArray(chunk)) {
                for (const item of chunk) {
                    if (item == null) continue;
                    if (typeof item === "string" || typeof item === "number") {
                        return String(item);
                    }
                    if (typeof Uint8Array !== "undefined" && item instanceof Uint8Array && localChunkDecoder) {
                        return localChunkDecoder.decode(item, { stream: true });
                    }
                    if (typeof item === "object" && item) {
                        const nested = item.currentText || item.text || item.content || (item.delta && item.delta.content) || "";
                        if (nested != null && String(nested).trim() !== "") {
                            return String(nested);
                        }
                    }
                }
            }

            const directCandidates = [
                chunk.currentText,
                chunk.text,
                chunk.content,
                chunk.delta,
                chunk.token,
                chunk.tokenText,
                chunk.tokenBytes,
                chunk.bytes
            ];
            for (const candidate of directCandidates) {
                if (candidate == null) continue;
                if (typeof candidate === "string" || typeof candidate === "number") {
                    return String(candidate);
                }
                if (typeof Uint8Array !== "undefined" && candidate instanceof Uint8Array && localChunkDecoder) {
                    return localChunkDecoder.decode(candidate, { stream: true });
                }
                if (typeof candidate === "object" && candidate && typeof candidate.content === "string") {
                    return candidate.content;
                }
            }

            const firstChoice = Array.isArray(chunk.choices) ? chunk.choices[0] : null;
            if (firstChoice && typeof firstChoice === "object") {
                const nestedCandidates = [
                    firstChoice.text,
                    firstChoice.content,
                    chunk.delta && chunk.delta.content,
                    firstChoice.delta && firstChoice.delta.content,
                    firstChoice.message && firstChoice.message.content
                ];
                for (const candidate of nestedCandidates) {
                    if (candidate == null) continue;
                    if (typeof candidate === "string" || typeof candidate === "number") {
                        return String(candidate);
                    }
                    if (typeof Uint8Array !== "undefined" && candidate instanceof Uint8Array && localChunkDecoder) {
                        return localChunkDecoder.decode(candidate, { stream: true });
                    }
                }
            }

            return "";
        }

        function cleanupAssistantBoilerplate(text) {
            let value = String(text || "");
            value = value
                .replace(/\n?\(hello!\)\s*how are you doing\?\)?/gi, "")
                .replace(/\n?i['??m here to help[\s\S]*$/i, "")
                .replace(/\n?don['??t hesitate[\s\S]*$/i, "")
                .replace(/\n?please let me know what['??s on your mind[\s\S]*$/i, "")
                .replace(/\n{3,}/g, "\n\n")
                .trim();

            if (outputLocale.startsWith("ko")) {
                const lines = value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean);
                const cleaned = lines.filter((line) => {
                    const hasHangul = /[가-힣]/.test(line);
                    const helperLike = /hello|how are you|i'?m here to help|don'?t hesitate|translate|write stories|chat about/i.test(line);
                    if (!hasHangul && helperLike) return false;
                    return true;
                });
                value = cleaned.join("\n").trim();
            }

            return value;
        }

        function escapeRegExp(text) {
            return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }

        function cleanupAssistantBoilerplateSafe(text) {
            let value = String(text || "");
            value = value
                .replace(/\n?\(hello!\)\s*how are you doing\?\)?/gi, "")
                .replace(/\n?i['??m here to help[\s\S]*$/i, "")
                .replace(/\n?don['??t hesitate[\s\S]*$/i, "")
                .replace(/\n?please let me know what['??s on your mind[\s\S]*$/i, "")
                .replace(/\n{3,}/g, "\n\n")
                .trim();

            if (!outputLocale.startsWith("ko")) {
                return value;
            }

            const lines = value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);

            const cleaned = lines.filter((line) => {
                const hasHangul = /[\uAC00-\uD7A3]/.test(line);
                const helperLike = /hello|how are you|i'?m here to help|don'?t hesitate|translate|write stories|chat about/i.test(line);
                if (!hasHangul && helperLike) return false;
                return true;
            });

            return cleaned.join("\n").trim();
        }

        function cleanupAssistantBoilerplateAscii(text) {
            let value = String(text || "");
            value = value
                .replace(/\n?\(hello!\)\s*how are you doing\?\)?/gi, "")
                .replace(/\n?i(?:'|\u2019)m here to help[\s\S]*$/i, "")
                .replace(/\n?don(?:'|\u2019)t hesitate[\s\S]*$/i, "")
                .replace(/\n?please let me know what(?:'|\u2019)s on your mind[\s\S]*$/i, "")
                .replace(/\n{3,}/g, "\n\n")
                .trim();

            if (!outputLocale.startsWith("ko")) return value;

            const lines = value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);

            const cleaned = lines.filter((line) => {
                const hasHangul = /[\uAC00-\uD7A3]/.test(line);
                const helperLike = /hello|how are you|i(?:'|\u2019)m here to help|don(?:'|\u2019)t hesitate|translate|write stories|chat about/i.test(line);
                if (!hasHangul && helperLike) return false;
                return true;
            });

            return cleaned.join("\n").trim();
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
                        .replace(new RegExp("(?:\\n)?" + escapeRegExp(lines[lines.length - 1]) + "\\s*$"), "")
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

            if (hasRepeatedListPattern(source)) {
                return true;
            }

            if (hasRepeatedBlockSequence(source)) {
                return true;
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

            return false;
        }

        function trimRestartedPrefixBlock(text) {
            let value = String(text || "").trimEnd();
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

        async function consumeLocalStream(stream) {
            let renderedText = "";
            let aggregatedText = "";
            let repetitionHits = 0;

            for await (const chunk of stream) {
                if (stopSignal) {
                    if (typeof localEngine.interruptGenerate === "function") {
                        localEngine.interruptGenerate();
                    }
                    break;
                }

                const rawCurrentText = sanitizeStreamText(readLocalChunkText(chunk));
                if (!rawCurrentText) continue;
                aggregatedText = aggregatedText
                    ? (aggregatedText + trimIncomingOverlap(aggregatedText, rawCurrentText))
                    : rawCurrentText;

                const cleanedText = cleanupAssistantBoilerplateAscii(aggregatedText);
                const currentText = trimRepeatedSentenceHistory(
                    trimRestartedSentenceBlock(trimRestartedPrefixBlock(cleanedText || aggregatedText))
                );
                let nextText = trimRepeatedSentenceHistory(
                    trimRestartedSentenceBlock(trimDuplicateParagraphs(trimRepeatedTail(currentText)))
                );
                if (!nextText) continue;
                nextText = trimRestartedPrefixBlock(nextText);
                nextText = trimRepeatedSentenceHistory(
                    trimRestartedSentenceBlock(trimDuplicateParagraphs(nextText))
                );

                if (normalizeRepeatKey(nextText) === normalizeRepeatKey(renderedText)) {
                    repetitionHits += 1;
                    if (repetitionHits >= 3) {
                        stopSignal = true;
                        if (typeof localEngine.interruptGenerate === "function") {
                            try {
                                localEngine.interruptGenerate();
                            } catch (error) {}
                        }
                        break;
                    }
                    continue;
                }

                if (hasExcessiveRepetition(nextText)) {
                    repetitionHits += 1;
                    nextText = trimRepeatedSentenceHistory(
                        trimRestartedSentenceBlock(trimDuplicateParagraphs(trimRepeatedTail(nextText)))
                    );
                    if (!nextText || repetitionHits >= 2) {
                        stopSignal = true;
                        if (typeof localEngine.interruptGenerate === "function") {
                            try {
                                localEngine.interruptGenerate();
                            } catch (error) {}
                        }
                        break;
                    }
                }

                if (normalizeRepeatKey(nextText) === normalizeRepeatKey(renderedText)) {
                    repetitionHits += 1;
                    if (repetitionHits >= 3) {
                        stopSignal = true;
                        if (typeof localEngine.interruptGenerate === "function") {
                            try {
                                localEngine.interruptGenerate();
                            } catch (error) {}
                        }
                        break;
                    }
                    continue;
                }

                repetitionHits = 0;
                renderedText = nextText;
                callback(renderedText, { replace: true, isStreaming: true });
            }

            if (!hasRenderableLocalText(renderedText || "") && hasRenderableLocalText(aggregatedText || "")) {
                const fallbackText = trimRepeatedSentenceHistory(
                    trimRestartedSentenceBlock(
                        trimDuplicateParagraphs(
                            trimRestartedPrefixBlock(cleanupAssistantBoilerplateAscii(aggregatedText))
                        )
                    )
                );
                if (hasRenderableLocalText(fallbackText || "")) {
                    renderedText = fallbackText;
                }
            }

            return renderedText;
        }

        async function generateWithOptions(generationOptions) {
            const stream = await localEngine.generateChat(messages, generationOptions);
            return consumeLocalStream(stream);
        }

        async function generateWithRawOptions(generationOptions) {
            const stream = await localEngine.generateChat(messages, generationOptions);
            let rawRendered = "";
            for await (const chunk of stream) {
                if (stopSignal) {
                    if (typeof localEngine.interruptGenerate === "function") {
                        try {
                            localEngine.interruptGenerate();
                        } catch (error) {}
                    }
                    break;
                }
                const rawPiece = sanitizeStreamText(readLocalChunkText(chunk));
                if (!rawPiece) continue;
                rawRendered = rawRendered
                    ? (rawRendered + trimIncomingOverlap(rawRendered, rawPiece))
                    : rawPiece;
                if (hasRenderableLocalText(rawRendered)) {
                    callback(rawRendered, { replace: true, isStreaming: true });
                }
            }
            return String(rawRendered || "").trim();
        }

        let renderedText = await generateWithOptions({
            ...(isLightTierEffective ? { nPredict: 64 } : {}),
            useCache: !isLightTierEffective,
            sampling: speedConfig.sampling || (isLightTierEffective
                ? { temp: 0.18, top_k: 12, top_p: 0.78, penalty_repeat: 1.22 }
                : { temp: 0.45, top_k: 32, top_p: 0.88, penalty_repeat: 1.14 })
        });

        if (!hasRenderableLocalText(renderedText || "")) {
            if (typeof localEngine.clearChatState === "function") {
                try {
                    await localEngine.clearChatState();
                } catch (error) {}
            }
            renderedText = await generateWithOptions({
                useCache: false,
                sampling: {
                    temp: 0.16,
                    top_k: 24,
                    top_p: 0.84,
                    penalty_repeat: 1.46
                }
            });
        }

        if (!hasRenderableLocalText(renderedText || "")) {
            renderedText = await generateWithRawOptions({
                useCache: false,
                nPredict: isLightTierEffective ? 96 : 220,
                sampling: {
                    temp: 0.22,
                    top_k: 28,
                    top_p: 0.9,
                    penalty_repeat: 1.1
                }
            });
        }

        if (!hasRenderableLocalText(renderedText || "")) {
            callback(emptyResponseText, { replace: true, isStreaming: false });
        }
    };

    window.updateMainSubmitButtonState = function () {
        const btn = document.getElementById("btn-submit");
        const icon = document.getElementById("icon-submit");
        if (!btn || !icon) return;
        const stopMode = !!(isGenerating || window.__ISAI_MAIN_GENERATING__);
        btn.style.display = "inline-flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.pointerEvents = "auto";
        btn.classList.add("input-action-btn");
        btn.classList.remove("stop-mode", "is-generating");
        btn.setAttribute("aria-label", stopMode ? t("stop") : t("submit"));
        btn.setAttribute("title", stopMode ? t("stop") : t("submit"));
        btn.dataset.state = stopMode ? "stop" : "submit";
        btn.style.backgroundColor = "";
        btn.style.color = "#ffffff";
        icon.className = stopMode
            ? "ri-square-fill text-[14px] text-white"
            : "ri-arrow-up-s-line text-[14px] text-white";
    };

    window.handleMainSubmitButton = function () {
        if (isGenerating || window.__ISAI_MAIN_GENERATING__) {
            if (typeof window.stopGeneration === "function") {
                window.stopGeneration();
            }
            return;
        }
        executeAction("right");
    };

    stopGeneration = window.stopGeneration = function () {
        const wasGenerating = !!(isGenerating || window.__ISAI_MAIN_GENERATING__);
        if (!wasGenerating) {
            window.updateMainSubmitButtonState();
            return;
        }
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        if (localEngine && typeof localEngine.interruptGenerate === "function") {
            try {
                localEngine.interruptGenerate();
            } catch (error) {}
        }
        stopSignal = true;
        isGenerating = false;
        window.__ISAI_MAIN_GENERATING__ = false;
        if (typeof showLoader === "function") showLoader(false);
        window.updateMainSubmitButtonState();
    };

    if (typeof window.setMode === "function" && !window.__ISAI_SETMODE_PATCHED__) {
        const originalSetMode = window.setMode;
        window.setMode = function () {
            const result = originalSetMode.apply(this, arguments);
            setTimeout(function () {
                if (typeof window.updateMainSubmitButtonState === "function") {
                    window.updateMainSubmitButtonState();
                }
            }, 0);
            return result;
        };
        window.__ISAI_SETMODE_PATCHED__ = true;
    }

    if (typeof window.setVoiceState === "function" && !window.__ISAI_VOICESTATE_PATCHED__) {
        const originalSetVoiceState = window.setVoiceState;
        window.setVoiceState = function () {
            const result = originalSetVoiceState.apply(this, arguments);
            if (typeof window.updateMainSubmitButtonState === "function") {
                window.updateMainSubmitButtonState();
            }
            return result;
        };
        window.__ISAI_VOICESTATE_PATCHED__ = true;
    }

    document.addEventListener("click", function (event) {
        const wrapper = document.getElementById("local-model-tier-wrapper");
        if (!wrapper) return;
        if (wrapper.contains(event.target)) return;
        closeLocalModelShortcutMenu();
    });

    document.addEventListener("DOMContentLoaded", function () {
        setTimeout(async function () {
            applyLocalModelProfileToConfig();
            await syncDownloadedStateFromCache();
            isLocalActive = false;
            setLocalActivePreference(false);
            renderLocalModelTierSelector();
            syncLocalModelTierVisibility();
            window.updateMainSubmitButtonState();
            updateLocalBtnState();
            updateWebGPUBtnState();
        }, 0);
    });
})();

