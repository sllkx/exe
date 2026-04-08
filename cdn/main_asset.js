
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

let currentAppPage = 1;
let isAppLoading = false;
let hasMoreApps = true;
let currentAppQuery = "";
let defaultChatProfileSrc = "";

const STORE_LIMIT = 12;
const APP_LIMIT = 24;
const URL_IMAGE_DAILY_COOKIE = "ISAI_URL_IMAGE_DAILY";

function getIsaiApiMaxChars() {
    const raw = Number(window.ISAI_API_MAX_CHARS || 700);
    if (!Number.isFinite(raw)) return 700;
    return Math.max(120, Math.min(4000, Math.floor(raw)));
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
    return parseJsonTextSafe(rawText);
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
            const item = document.createElement("div");
            item.className = "fixed-app-item relative w-[44px] h-[44px] rounded-[14px]"; 
            item.title = app.title;
            item.onclick = () => loadAppDetails(app.id);
            item.innerHTML = getAppIconHtml(app) + `
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
            fixedApps.push({ id: activeApp.id, title: activeApp.title, icon_url: activeApp.icon_url });
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
            activeApp = data;
            activateAppMode();

            const category = (data.category || "").toLowerCase();
            if (category === "code") setMode("code");
            else if (category === "image") setMode("image");
            else if (category === "music") setMode("music");
            else if (category === "video") setMode("video");
            else if (category === "blog") setMode("blog");
            else setMode("chat");

            showToast(`App Loaded: ${data.title}`);
        } else {
            showToast("App not found");
        }
    } catch (error) {
        showToast("Error loading app details");
    } finally {
        showLoader(false);
    }
}

async function executeAction(side = "right") {
    if (typeof side !== "string") side = "right";

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
    const userText = inputElement.value.trim();

    if (isMenuOpen && userText) {
        fetchStoreApps(userText);
        return;
    }

    if (currentMode === "app") {
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

        inputElement.value = "";
        inputElement.style.height = "auto";
        showLoader(true);
        appendMsg("user", userText);

        if (abortController) abortController.abort();
        abortController = new AbortController();
        stopSignal = false;

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
                    
                    await runLocalInference(localPrompt, (token) => {
                        if (!stopSignal) {
                            localResult += token;
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
                    window.currentImagePrompt = prompt;
                    appendImg(data.b64, prompt);
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
                
                // --- 수정된 부분: 안전한 JSON 파싱 ---
                const rawText = await response.text();
                let data = {};
                try {
                    data = parseJsonTextSafe(rawText);
                } catch (e) {
                    console.error("Search Data JSON 파싱 에러:", rawText);
                    throw new Error("검색 서버로부터 올바른 데이터를 받지 못했습니다.");
                }
                // -------------------------------------
                
                if (data.results && data.results.length > 0) {
                    const topResults = data.results.slice(0, 5);
                    let contextStr = topResults.map((item, idx) => `[문서 ${idx + 1}] ${item.content}`).join("\n");
                    
                    const synthResponse = await fetch("?action=search_synthesis", {
                        method: "POST",
                        body: JSON.stringify({ query: userText, context: contextStr }),
                        signal: abortController.signal
                    });
                    
                    // --- 수정된 부분: 안전한 JSON 파싱 ---
                    const rawSynthText = await synthResponse.text();
                    let synthData = {};
                    try {
                        synthData = parseJsonTextSafe(rawSynthText);
                    } catch (e) {
                        console.error("Search Synthesis JSON 파싱 에러:", rawSynthText);
                        throw new Error("검색 요약 서버로부터 올바른 데이터를 받지 못했습니다.");
                    }
                    // -------------------------------------
                    
                    if (synthData.error === "LIMIT_REACHED") {
                        showToast("Server limit reached. Local Summarizing...");
                        if (!isModelLoaded) await startDownload();
                        
                        const bubble = appendMsg("ai", "...");
                        let localResult = "";
                        const localPrompt =[
                            { role: "system", content: "넌 천재 요약봇." },
                            { role: "user", content: `${contextStr}\n위 내용을 기반으로 답변해줘.` }
                        ];
                        
                        await runLocalInference(localPrompt, (token) => {
                            if (!stopSignal) {
                                localResult += token;
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
                        // 서버에서 에러 메시지를 보낸 경우 처리
                        appendMsg("error", "검색 요약 오류: " + synthData.error);
                    } else {
                        addSourcesToBubble(appendMsg("ai", synthData.html || "Thinking..."), topResults);
                    }
                } else {
                    appendMsg("ai", "검색 결과가 없습니다.");
                }
            } else {
                let finalPrompt = userText;
                let currentHistory = chatHistory;
                let sysPrompt = typeof SYSTEM_PROMPTS !== "undefined" && SYSTEM_PROMPTS[LANG] ? SYSTEM_PROMPTS[LANG] : "You are a helpful AI.";
                
                if (activeApp) {
                    if (activeApp.system_prompt) sysPrompt = activeApp.system_prompt;
                }

                if (typeof window.buildIsaiSystemPrompt === "function") {
                    sysPrompt = window.buildIsaiSystemPrompt(sysPrompt);
                }

                if (activeApp && activeApp.category === "Code") {
                    finalPrompt = `System: ${sysPrompt}\n\nUser Request: ${userText}`;
                }
                
                if (currentMode === "blog") {
                    finalPrompt = `Topic: "${userText}". Instructions: ${sysPrompt}. Lang: ${LANG === "ko" ? "Korean" : "English"}. Add [[IMG: keyword]] tags.`;
                    currentHistory =[];
                }

                if (isModelLoaded && isLocalActive) {
                    const localPromptArr =[
                        { role: "system", content: sysPrompt },
                        ...currentHistory.slice(-4),
                        { role: "user", content: finalPrompt }
                    ];
                    
                    let localResult = "";
                    const bubble = appendMsg("ai", "...");
                    
                    await runLocalInference(localPromptArr, (token) => {
                        if (!stopSignal) {
                            localResult += token;
                            bubble.innerHTML = parseMarkdownLocal(localResult, false);
                            scrollBottom();
                        }
                    });
                    
                    if (!stopSignal) {
                        bubble.innerHTML = parseMarkdownLocal(localResult, true);
                        updateCodeUI(localResult);
                        let historyResult = localResult.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
                        chatHistory.push({ role: "user", content: userText }, { role: "assistant", content: historyResult });
                        if (currentMode === "blog") await processBlogImages(bubble);
                        scrollBottom();
                    }
                } else {
                    const response = await fetch("?action=ai_chat", {
                        method: "POST",
                        body: JSON.stringify({
                            prompt: finalPrompt,
                            history: currentHistory,
                            system_prompt: sysPrompt,
                            max_chars: getIsaiApiMaxChars()
                        }),
                        signal: abortController.signal
                    });
                    
                    const data = await parseJsonResponseSafe(response);
                    
                    if (data.error === "LIMIT_REACHED") {
                        showToast("Limit reached. Local Model...");
                        if (!isModelLoaded) await startDownload();
                        
                        const bubble = appendMsg("ai", "...");
                        let localResult = "";
                        const localPromptArr =[
                            { role: "system", content: sysPrompt },
                            ...currentHistory.slice(-4),
                            { role: "user", content: finalPrompt }
                        ];
                        
                        await runLocalInference(localPromptArr, (token) => {
                            if (!stopSignal) {
                                localResult += token;
                                bubble.innerHTML = parseMarkdownLocal(localResult, false);
                                scrollBottom();
                            }
                        });
                        
                        if (!stopSignal) {
                            bubble.innerHTML = parseMarkdownLocal(localResult, true);
                            updateCodeUI(localResult);
                            let historyResult = localResult.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
                            chatHistory.push({ role: "user", content: userText }, { role: "assistant", content: historyResult });
                            if (currentMode === "blog") await processBlogImages(bubble);
                            scrollBottom();
                        }
                    } else if (data.response) {
                        const bubble = appendMsg("ai", parseMarkdownLocal(data.response, true));
                        updateCodeUI(data.response);
                        let historyResult = data.response.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
                        chatHistory.push({ role: "user", content: userText }, { role: "assistant", content: historyResult });
                        
                        if (currentMode === "blog") await processBlogImages(bubble);
                        if (currentMode === "voice") speakText(data.response);
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
            if (error.name !== "AbortError") {
                appendMsg("error", `오류: ${error.message}`);
            }
        } finally {
            showLoader(false);
            const focusInput = document.getElementById("prompt-input");
            if (focusInput) focusInput.focus();
        }
    } else {
        const fileInput = document.getElementById("comm-file-input");
        const nickname = document.getElementById("comm-nickname") ? document.getElementById("comm-nickname").value : "";
        const password = document.getElementById("comm-password").value;

        if (!userText && (!fileInput.files || fileInput.files.length === 0)) {
            showToast("내용이나 이미지를 입력해주세요.");
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
    apps.forEach((app) => {
        const item = document.createElement("div");
        item.className = "store-item relative w-[44px] h-[44px] rounded-[14px]";
        item.title = `${app.title} (Views: ${app.views || 0})`;
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
    const appTitle = String(activeApp.title || "App");
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
    if (isMenuOpen) toggleStoreMenu();
    document.getElementById("active-app-status").classList.remove("hidden");
    document.getElementById("active-app-name").innerText = activeApp.title;
    document.getElementById("prompt-input").value = "";
    document.getElementById("chat-box").innerHTML = "";

    if (activeApp.first_message) {
        appendMsg("ai", activeApp.first_message);
    } else {
        appendMsg("ai", `App '${activeApp.title}' started.`);
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
        // 기존에 있던 애니메이션(투명도 조절) 제거: grid.style.opacity = 0.5;
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
                // 불필요한 애니메이션 관련 클래스 토글 제거
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
        // 기존에 있던 투명도 원상복구 제거: grid.style.opacity = 1;
        isAppLoading = false;
    }
}

function createAppItem(app, isClone = false) {
    const item = document.createElement("a");
    item.href = app.url || "#";
    if(app.url) item.target = "_blank";
    
    item.className = "app-item relative w-[44px] h-[44px] rounded-[14px] transition-transform hover:scale-105";
    if (isClone) item.classList.add("clone-item");
    item.title = app.name || "";

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
    const title = app.title || app.name || "App";
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
        btnRight.className = "btn-submit w-9 h-9 flex items-center justify-center flex-shrink-0 transition-all duration-300";
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
        btnRight.style.backgroundColor = "";
        btnRight.style.color = "";
        btnRight.style.opacity = "1";
        btnRight.style.pointerEvents = "auto";
    }

    iconLeft.className = "ri-mic-line text-lg text-white";
    if (iconRight) iconRight.className = "ri-arrow-up-s-line text-[14px]";
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

function showPopup(title, msg, confirmCallback) {
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
    };

    layer.classList.add("show");
}

function closePopup() {
    document.getElementById("modal-layer").classList.remove("show");
}

function updateLocalBtnState() {
    const btn = document.getElementById("btn-download");
    if (!btn) return;
    const icon = btn.querySelector("i");
    if (!icon) return;

    if (isLocalActive) {
        btn.classList.add("text-green-400", "active");
        icon.className = "ri-check-line text-xl";
        btn.style.color = "";
    } else if (isModelDownloaded) {
        btn.classList.remove("text-green-400", "active");
        icon.className = "ri-check-line text-xl";
        btn.style.color = "rgba(255,255,255,0.6)";
    } else {
        btn.classList.remove("text-green-400", "active");
        icon.className = "ri-download-line text-xl";
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
            label: "라이트",
            fallbackUrl: "",
            popupSizeText: "257MB",
            preferredRuntime: "wllama"
        },
        middle: {
            key: "middle",
            label: "중간",
            fallbackUrl: "",
            preferredRuntime: "wllama"
        },
        hard: {
            key: "hard",
            label: "하드",
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
    const storedTier = String(localStorage.getItem(storageKey) || "").trim().toLowerCase();
    if (storedTier && profiles[storedTier]) return storedTier;
    const fallbackTier = getDefaultLocalModelTier();
    localStorage.setItem(storageKey, fallbackTier);
    return fallbackTier;
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
    if (profile.preferredRuntime) {
        modelConfig.preferredRuntime = profile.preferredRuntime;
    }
    window.MODEL_CONFIG = modelConfig;
    return profile;
}
window.applyLocalModelProfileToConfig = applyLocalModelProfileToConfig;

function getLocalDownloadStorageKey() {
    const baseKey = (window.MODEL_CONFIG && window.MODEL_CONFIG.storageKey) || "ISAI_MODEL_DOWNLOADED";
    const tier = getActiveLocalModelTier();
    return `${baseKey}__${tier}`;
}

function getLocalRuntimeStorageKey() {
    return (window.MODEL_CONFIG && window.MODEL_CONFIG.runtimeKey) || "ISAI_LOCAL_MODEL_RUNTIME_V1";
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
            return `LFM2.5 350M 모델(${sizeText})을 다운로드해 오프라인 모드를 사용합니다. 계속할까요?`;
        }
        if (profile && profile.key === "middle") {
            return "LFM2.5 350M Q6_K 모델을 다운로드해 오프라인 모드를 사용합니다. 계속할까요?";
        }
        if (profile && profile.key === "hard") {
            return "Qwen3 0.6B IQ4_XS 모델을 다운로드해 오프라인 모드를 사용합니다. 계속할까요?";
        }
        return "로컬 모델을 다운로드해 오프라인 모드를 사용합니다. 계속할까요?";
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

function syncLocalModelTierVisibility(mode) {
    const wrapper = document.getElementById("local-model-tier-wrapper");
    if (!wrapper) return;
    const effectiveMode = String(mode || (document.body && document.body.getAttribute("data-ui-mode")) || currentMode || "chat").toLowerCase();
    const shouldShow = (effectiveMode === "chat" || effectiveMode === "code") && !!isLocalActive;
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
        button.textContent = displayLabel;
        button.title = displayLabel;
        button.dataset.tier = tier;
        button.setAttribute("aria-pressed", tier === activeTier ? "true" : "false");
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            setLocalModelTier(tier);
        });
        list.appendChild(button);
    });

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
        const readySuffix = isModelDownloaded ? " (다운로드됨)" : "";
        showToast(`${getLocalizedLocalModelTierLabel(nextTier)} 모델 선택${readySuffix}`);
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
    const locale = getLocalModelTierLocale();
    const safeLabels = {
        ko: { code: "\ucf54\ub4dc", light: "\ub77c\uc774\ud2b8", middle: "\uc911\uac04", hard: "\ud558\ub4dc" },
        en: { code: "Code", light: "Light", middle: "Middle", hard: "Hard" }
    };
    const safeTable = safeLabels[locale] || safeLabels.en;
    return safeTable[key] || safeLabels.en[key] || getLocalModelTierLabelFallback(key);
    const labels = {
        ko: { code: "코드", light: "라이트", middle: "중간", hard: "하드" },
        ja: { code: "コード", light: "ライト", middle: "ミドル", hard: "ハード" },
        zh: { code: "代码", light: "轻量", middle: "中等", hard: "高性能" },
        es: { code: "Código", light: "Ligero", middle: "Medio", hard: "Avanzado" },
        pt: { code: "Código", light: "Leve", middle: "Médio", hard: "Pesado" },
        hi: { code: "कोड", light: "लाइट", middle: "मिड", hard: "हार्ड" },
        en: { code: "Code", light: "Light", middle: "Middle", hard: "Hard" }
    };
    const table = labels[locale] || labels.en;
    return table[key] || labels.en[key] || getLocalModelTierLabelFallback(key);
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
            fallbackUrl: "",
            popupSizeText: "369MB",
            preferredRuntime: "wllama"
        },
        light: {
            key: "light",
            label: "\ub77c\uc774\ud2b8",
            fallbackUrl: "",
            popupSizeText: "429MB",
            preferredRuntime: "wllama"
        },
        middle: {
            key: "middle",
            label: "\uc911\uac04",
            fallbackUrl: "",
            popupSizeText: "592MB",
            preferredRuntime: "wllama"
        },
        hard: {
            key: "hard",
            label: "\ud558\ub4dc",
            fallbackUrl: "",
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
    const fallbackTier = profiles.light ? "light" : getDefaultLocalModelTier();
    if (forceLightOnActivation && profiles[fallbackTier]) {
        localStorage.setItem(tierKey, fallbackTier);
        return fallbackTier;
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
        showPopup(getLocalModelPopupTitle(), getLocalModelPopupMessage(), () => {
            isLocalActive = true;
            syncLocalModelTierVisibility();
            startDownload();
        });
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
        .filter((message) => message.content.trim().length > 0);
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
    if (localEngine && localRuntime === "webllm") {
        return localEngine;
    }

    const modelId = modelConfig.webllm ? modelConfig.webllm.modelId : "Qwen2-0.5B-Instruct-q4f16_1-MLC";
    localEngine = await webllm.CreateMLCEngine(modelId, {
        logLevel: "WARN",
        initProgressCallback: (report) => {
            if (container) container.classList.remove("hidden");
            updateLocalProgress(bar, report && report.progress);
        }
    });

    setLocalRuntimeState("webllm");
    return localEngine;
}

async function loadWllamaFallbackEngine(container, bar) {
    const modelConfig = window.MODEL_CONFIG || {};
    const fallbackConfig = modelConfig.fallback || {};
    const { Wllama, LoggerWithoutDebug } = window.WllamaObj || {};
    if (!Wllama) {
        throw new Error("Fallback runtime is not available.");
    }
    if (!fallbackConfig.url || !fallbackConfig.wasmPaths) {
        throw new Error("Fallback model configuration is missing.");
    }

    if (!wllama) {
        wllama = new Wllama(fallbackConfig.wasmPaths, { logger: LoggerWithoutDebug });
    }

    await wllama.loadModelFromUrl(fallbackConfig.url, {
        n_ctx: 4096,
        progressCallback: ({ loaded, total }) => {
            if (container) container.classList.remove("hidden");
            if (total) {
                updateLocalProgress(bar, loaded / total);
            }
        }
    });

    localEngine = wllama;
    setLocalRuntimeState("wllama");
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
            temperature: webllmConfig.temperature ?? 0.65,
            top_p: webllmConfig.topP ?? 0.9,
            max_tokens: webllmConfig.maxTokens ?? 900,
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
                callback(delta);
            }
        }
        return;
    }
    
    const formatted = await wllama.formatChat(promptArr, true);
    
    const decoder = new TextDecoder("utf-8");
    
    await wllama.createCompletion(formatted, {
        nPredict: 1000,
        sampling: { temp: 0.7, top_k: 40, top_p: 0.9 },
        onNewToken: (tokenIndex, tokenBytes) => {
            if (stopSignal) return false;
            callback(decoder.decode(tokenBytes, { stream: true }));
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
    if (isGenerating) {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        if (localRuntime === "webllm" && localEngine && typeof localEngine.interruptGenerate === "function") {
            localEngine.interruptGenerate();
        }
        stopSignal = true;
        showLoader(false);
    }
}

function decodeHtmlEntitiesLocal(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(value ?? "");
    return textarea.value;
}

function extractPlainTextLocal(value) {
    const normalized = String(value ?? "")
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
    const decoded = decodeHtmlEntitiesLocal(raw);
    const sanitizedDecoded = sanitizeAiHtmlLocal(decoded);
    const sanitizedRaw = sanitizeAiHtmlLocal(raw);
    const htmlCandidate = /<\/?[a-z][^>]*>/i.test(sanitizedDecoded) ? sanitizedDecoded : sanitizedRaw;

    if (/<\/?[a-z][^>]*>/i.test(htmlCandidate)) {
        return htmlCandidate;
    }
    return htmlCandidate.replace(/\n/g, "<br>");
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
        bubble.className = "self-end px-4 py-2.5 rounded-[18px] rounded-tr-none max-w-[85%] shadow mb-3 text-sm break-words ml-auto";
        bubble.style.backgroundColor = "var(--accent, #3b82f6)";
        bubble.style.color = "var(--accent-text, #ffffff)";
    } else {
        bubble.className = "self-start px-4 py-2.5 rounded-[18px] rounded-tl-none max-w-[85%] mb-3 text-sm break-words leading-relaxed shadow-sm";
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
            bubble.innerHTML = formatAiBubbleContent(content);
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
    
    // 1. 생각 과정(<think>...</think>) 분리
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
        
        const displayStyle = isThinking ? "block" : "none";
        const iconRotate = isThinking ? "rotate(180deg)" : "rotate(0deg)";
        
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

    // 2. 전체 HTML 이스케이프 (안전장치: 쌩 HTML이 페이지 UI를 망가뜨리는 것 원천 차단)
    let processedMain = mainContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const blocks =[];
    let counter = 0;

    function createBlockUI(lang, code, isStreaming) {
        const blockId = "local-code-" + counter++;
        lang = lang || "text";
        
        // 우측 코드 에디터 및 복사 기능을 위해 원본 코드로 복구하여 배열에 저장
        let cleanCode = code.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        window.extractedCodes.push({ 
            lang: lang, 
            content: cleanCode, 
            name: `File ${window.extractedCodes.length + 1} (${lang})` 
        });

        const blink = isStreaming ? ' <span class="animate-pulse">...</span>' : '';
        const uiBlock = `<div class="code-wrapper my-4 rounded-lg overflow-hidden border border-white/10 bg-[#1e1e1e] shadow-lg"><div class="flex justify-between items-center px-4 py-2 bg-white/5 border-b border-white/5"><span class="text-xs text-gray-200 font-mono uppercase">${lang}${blink}</span><div class="flex items-center gap-3"><button onclick="openFullEditor('${blockId}')" class="flex md:hidden items-center gap-1 text-xs text-blue-300 hover:text-blue-200 transition"><i class="ri-code-box-line"></i> Edit</button><button onclick="copyCode('${blockId}')" class="flex items-center gap-1 text-xs text-gray-200 hover:text-white transition group"><i class="ri-file-copy-line"></i> <span class="group-hover:underline">Copy</span></button></div></div><div class="relative overflow-x-auto code-scroll"><pre id="${blockId}" class="p-4 text-sm font-mono leading-relaxed w-max min-w-full text-gray-50"><code>${code}</code></pre></div></div>`;
        
        blocks.push(uiBlock);
        return "###CODE_BLOCK_" + (blocks.length - 1) + "###";
    }

    // 3. 완전히 닫힌 코드 블록 처리
    processedMain = processedMain.replace(/```([a-zA-Z0-9_\-\+]*)[ \t]*\n?([\s\S]*?)```/g, (match, lang, code) => {
        return createBlockUI(lang, code, false);
    });

    // 4. 작성 중이라 아직 닫히지 않은 코드 블록 처리 (스트리밍 대응)
    processedMain = processedMain.replace(/```([a-zA-Z0-9_\-\+]*)[ \t]*\n?([\s\S]*)$/g, (match, lang, code) => {
        return createBlockUI(lang, code, !isFinished);
    });

    // 5. 인라인 코드 및 기본 마크다운 변환
    processedMain = processedMain.replace(/`([^`]+)`/g, (match, inlineCode) => {
        return `<code class="bg-white/20 px-1.5 py-0.5 rounded text-white font-bold font-mono text-sm border border-white/10">${inlineCode}</code>`;
    })
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/^###\s+(.*)$/gm, '<h3 class="text-lg font-bold mb-2 mt-4">$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<b class="font-bold text-base mt-3 mb-1 block">$1</b>')
    .replace(/^[\-\*]\s+(.*)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/\n/g, "<br>");

    // 6. 생성해둔 UI 블록을 원래 위치에 삽입
    blocks.forEach((blockHtml, index) => {
        processedMain = processedMain.replace("###CODE_BLOCK_" + index + "###", blockHtml);
    });

    return html + processedMain;
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
        if (codeEditor) codeEditor.value = text;
        if (codeTabs) {
            codeTabs.innerHTML = '<button type="button" class="code-tab-btn active" title="Current Code"><span class="code-tab-icon"><i class="ri-code-s-slash-line"></i></span><span class="code-tab-label">CODE</span></button>';
        }

        if (typeof window.syncInlineCodePanel === "function") {
            window.syncInlineCodePanel("code");
        } else {
            if (rightPanel) {
                if (document.body) document.body.setAttribute("data-ui-mode", "code");
                document.body.classList.remove("desktop-code-stage");
                document.body.classList.toggle("mode-code", mobileCodeMode);
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
    if (typeof currentMode !== "undefined" && currentMode === "code" && typeof setMode === "function") {
        setMode("chat");
        return;
    }
    document.body.classList.remove("mode-code");
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
}

function switchTab(index) {
    activeFileIndex = index;
    renderCodeTabs();
    const editor = document.getElementById("code-editor");
    if (editor && codeFiles[index]) {
        editor.value = codeFiles[index].content;
    }
}

function resetChat() {
    if (isGenerating) stopGeneration();
    
    chatHistory =[];
    codeFiles =[];
    activeFileIndex = 0;
    
    const chatBox = document.getElementById("chat-box");
    chatBox.style.display = "flex";
    chatBox.style.flexDirection = "column";
    chatBox.style.justifyContent = "normal";
    chatBox.innerHTML = "";
    
    const viewId = new URLSearchParams(window.location.search).get("v");
    
    document.getElementById("code-tabs").innerHTML = getCodePanelEmptyMarkup();
    document.getElementById("code-editor").value = "";
    
    document.body.classList.remove("started");
    document.body.classList.remove("mode-code");
    isStarted = false;
    document.getElementById("custom-scrollbar").style.display = "none";
    
    if (activeApp) exitAppMode();
    if (isMenuOpen) toggleStoreMenu();
    
    document.getElementById("prompt-input").value = "";
    setMode("chat");
    showToast("Chat Reset Completed");
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
    activeFileIndex = index;
    renderCodeTabs();
    const editor = document.getElementById("code-editor");
    if (editor && codeFiles[index]) {
        editor.value = codeFiles[index].content;
    }
};

document.getElementById("code-editor").addEventListener("input", function(e) {
    if (!isGenerating && codeFiles[activeFileIndex]) {
        codeFiles[activeFileIndex].content = e.target.value;
    }
});

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
