
let recognition = null;
let isVoiceProcessing = false;
let isVoiceListening = false;
let targetLangCode = "en-US";
let musicTokenizer = null;
let musicModel = null;
let currentMode = "chat";
let chatHistory =[];
let wllama = null;
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

const STORE_LIMIT = 12;
const APP_LIMIT = 24;

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

function toggleStoreMenu() {
    const storePanel = document.getElementById('store-panel');
    const appPanel = document.getElementById('app-container');
    const iconMenu = document.getElementById('icon-menu');
    const btnMenu = document.getElementById('btn-menu');
    const btnApp = document.getElementById('btn-app');

    // 앱스토어를 열 때, 숏컷 패널이 열려있다면 닫기
    if (!storePanel.classList.contains('open')) {
        if (appPanel.classList.contains('open')) {
            appPanel.classList.remove('open');
            if (btnApp) btnApp.classList.remove('active', 'text-white', 'bg-[#262626]');
        }
        
        storePanel.classList.add('open');
        isMenuOpen = true;
        if (iconMenu) iconMenu.className = 'ri-draggable text-xl'; // 아이콘 변경
        if (btnMenu) btnMenu.classList.add('text-white');
        fetchStoreApps("", false);
    } else {
        storePanel.classList.remove('open');
        isMenuOpen = false;
        if (btnMenu) btnMenu.classList.remove('text-white');
    }
}

function toggleAppPanel() {
    const storePanel = document.getElementById('store-panel');
    const appPanel = document.getElementById('app-container');
    const btnApp = document.getElementById('btn-app');
    const iconMenu = document.getElementById('icon-menu');
    const btnMenu = document.getElementById('btn-menu');

    // 숏컷을 열 때, 앱스토어가 열려있다면 닫기
    if (!appPanel.classList.contains('open')) {
        if (storePanel.classList.contains('open')) {
            storePanel.classList.remove('open');
            isMenuOpen = false;
            if (btnMenu) btnMenu.classList.remove('text-white');
            if (iconMenu) iconMenu.className = 'ri-draggable text-lg';
        }

        appPanel.classList.add('open');
        if (btnApp) btnApp.classList.add('active', 'text-white', 'bg-[#262626]');
        setMode('app');
        fetchApps(document.getElementById('prompt-input').value.trim());
    } else {
        appPanel.classList.remove('open');
        if (btnApp) btnApp.classList.remove('active', 'text-white', 'bg-[#262626]');
    }
}

function handleInput(element) {
    element.style.height = "auto";
    element.style.height = element.scrollHeight + "px";

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
        const json = await response.json();
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
        const data = await response.json();

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

    if (currentMode === "voice" || currentMode === "translate") {
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
                
                const data = await response.json();

                if (data.error === "LIMIT_REACHED") {
                    showToast("Limit reached. Local Translation...");
                    if (!isModelLoaded) await startDownload();
                    
                    const localPrompt =[
                        { role: "system", content: `Translate the following text to ${targetLang}. Output ONLY the translated text.` },
                        { role: "user", content: userText }
                    ];
                    
                    let localResult = "";
                    const bubble = appendMsg("ai", "...");
                    const speechLang = langMap[targetLang] || "en-US";
                    
                    await runLocalInference(localPrompt, (token) => {
                        if (!stopSignal) {
                            localResult += token;
                            bubble.innerHTML = `<div class="text-lg font-bold text-blue-300 leading-relaxed">${localResult}</div>`;
                            scrollBottom();
                        }
                    });
                    
                    if (!stopSignal) speakText(localResult, speechLang);
                } else if (data.error) {
                    appendMsg("error", data.error);
                } else {
                    let resultObj = { text: data.response };
                    try {
                        let cleanJson = data.response.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json/g, "").replace(/```/g, "").trim();
                        let jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
                        if (jsonMatch) cleanJson = jsonMatch[0];
                        resultObj = JSON.parse(cleanJson);
                    } catch (err) {
                        resultObj.text = data.response;
                    }
                    
                    appendMsg("ai", `<div class="text-lg font-bold text-blue-300 leading-relaxed">${resultObj.text}</div>`);
                    const speechLang = langMap[targetLang] || "en-US";
                    speakText(resultObj.text, speechLang);
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
                
                const data = await response.json();
                
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
                
                const data = await response.json();
                
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
                    data = rawText ? JSON.parse(rawText) : {};
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
                        synthData = rawSynthText ? JSON.parse(rawSynthText) : {};
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
                    if (activeApp.category === "Code") {
                        finalPrompt = `System: ${sysPrompt}\n\nUser Request: ${userText}`;
                    }
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
                        body: JSON.stringify({ prompt: finalPrompt, history: currentHistory }),
                        signal: abortController.signal
                    });
                    
                    const data = await response.json();
                    
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
                    window.location.href = "view/" + postData.id + "&type=forum";
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
}

function exitAppMode() {
    activeApp = null;
    document.getElementById("active-app-status").classList.add("hidden");
    resetChat();
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
            const data = await response.json();

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
    initCheckModel();
    fetchApps("");
    renderFixedApps();

    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    chatBox.style.display = "flex";
    chatBox.style.flexDirection = "column";
    chatBox.style.height = "100%";

    const btnChat = document.getElementById("btn-chat");
    if (btnChat) btnChat.classList.add("active");

    const storePanel = document.getElementById("store-panel");
    if (storePanel) {
        storePanel.addEventListener("scroll", () => {
            if (storePanel.scrollTop + storePanel.clientHeight >= storePanel.scrollHeight - 50 && hasMoreStoreApps && !isStoreLoading && isMenuOpen) {
                fetchStoreApps(currentStoreQuery, true);
            }
        });
    }

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
            setMode(mode);
            const promptInput = document.getElementById("prompt-input");
            if (promptInput) {
                promptInput.value = queryVal;
                handleInput(promptInput);
            }
            setTimeout(() => {
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

function setVoiceState(side, state) {
    const btnLeft = document.getElementById("btn-submit-left");
    const btnRight = document.getElementById("btn-submit");
    const iconLeft = document.getElementById("icon-submit-left");
    const iconRight = document.getElementById("icon-submit");

    if (!btnLeft || !btnRight) return;

    btnLeft.className = "w-9 h-9 items-center justify-center flex-shrink-0 mr-2 transition-all duration-300 rounded-full";
    btnRight.className = "btn-submit w-9 h-9 flex items-center justify-center flex-shrink-0 transition-all duration-300";
    btnLeft.style.backgroundColor = "rgba(128,128,128,0.1)";
    btnRight.style.backgroundColor = "";
    btnRight.style.color = "";
    btnLeft.style.opacity = "1";
    btnRight.style.opacity = "1";
    btnLeft.style.pointerEvents = "auto";
    btnRight.style.pointerEvents = "auto";
    btnLeft.style.display = currentMode !== "translate" ? "none" : "flex";

    iconLeft.className = "ri-voiceprint-line text-lg";
    iconRight.className = "ri-voiceprint-line text-lg";

    if (state === "idle") return;

    const activeBtn = side === "left" ? btnLeft : btnRight;
    const activeIcon = side === "left" ? iconLeft : iconRight;
    const inactiveBtn = side === "left" ? btnRight : btnLeft;

    inactiveBtn.style.opacity = "0.3";
    inactiveBtn.style.pointerEvents = "none";

    if (state === "recording") {
        activeIcon.className = "ri-voiceprint-line text-lg animate-mic-breath";
        activeBtn.style.backgroundColor = "#ef4444";
        activeBtn.style.color = "white";
    } else if (state === "processing") {
        activeIcon.className = "ri-voiceprint-line text-lg animate-spin";
        activeBtn.style.backgroundColor = "";
        activeBtn.style.color = "";
    }
}

function updateSubmitIcon(state, side = "right") {
    setVoiceState(side, state === "mic" || state === "default" ? "idle" : state);
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

function handleLocalToggle() {
    if (isModelDownloaded) {
        isLocalActive = !isLocalActive;
        if (!isLocalActive || isModelLoaded) {
            updateLocalBtnState();
        } else {
            startDownload();
        }
    } else {
        showPopup(T.popup_title_wifi, T.popup_msg_wifi, startDownload);
    }
}

function updateLocalBtnState() {
    const btn = document.getElementById("btn-download");
    const icon = btn.querySelector("i");

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
}

async function startDownload() {
    const container = document.getElementById("progress-container");
    const bar = document.getElementById("progress-bar");

    try {
        container.classList.remove("hidden");
        const { Wllama, LoggerWithoutDebug } = window.WllamaObj;
        
        if (!wllama) {
            wllama = new Wllama(MODEL_CONFIG.wasmPaths, { logger: LoggerWithoutDebug });
        }

        await wllama.loadModelFromUrl(MODEL_CONFIG.url, {
            n_ctx: 4096,
            progressCallback: ({ loaded, total }) => {
                bar.style.width = Math.round((loaded / total) * 100) + "%";
            }
        });

        isModelDownloaded = true;
        isModelLoaded = true;
        isLocalActive = true;
        localStorage.setItem("ISAI_MODEL_DOWNLOADED", "true");
        container.classList.add("hidden");
        updateLocalBtnState();

    } catch (error) {
        if (error.message && error.message.includes("initialized")) {
            isModelDownloaded = true;
            isModelLoaded = true;
            isLocalActive = true;
            localStorage.setItem("ISAI_MODEL_DOWNLOADED", "true");
            container.classList.add("hidden");
            updateLocalBtnState();
            return;
        }
        
        container.classList.add("hidden");
        alert(error.message);
        isModelDownloaded = false;
        localStorage.removeItem("ISAI_MODEL_DOWNLOADED");
    }
}

async function runLocalInference(promptArr, callback) {
    if (isLocalActive && !isModelLoaded) {
        await startDownload();
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
        stopSignal = true;
        showLoader(false);
    }
}

function appendMsg(role, content) {
    const chatBox = document.getElementById("chat-box");
    
    if (chatBox.childElementCount > 50) chatBox.removeChild(chatBox.firstElementChild);
    if (chatBox.childElementCount === 0) {
        const spacer = document.createElement("div");
        spacer.style.marginTop = "auto";
        chatBox.appendChild(spacer);
    }

    let isAppAi = false;
    let iconUrl = "";
    let aiName = "AI";
    const appRef = window.activeApp || activeApp;

    if (role === "ai" && appRef && appRef.icon_url) {
        isAppAi = true;
        iconUrl = appRef.icon_url;
        aiName = appRef.title || "AI";
    }

    let returnElement = null;

    if (isAppAi) {
        const wrapper = document.createElement("div");
        wrapper.className = "flex w-full items-start gap-2.5 mb-4 animate-fade-in group";

        const imgWrapper = document.createElement("div");
        imgWrapper.className = "relative flex-shrink-0";

        const img = document.createElement("img");
        img.src = iconUrl;
        img.className = "w-10 h-10 rounded-[14px] object-cover border border-black/5 shadow-sm bg-gray-100";

        const fallback = document.createElement("div");
        fallback.className = "absolute inset-0 w-10 h-10 rounded-[14px] bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm hidden";
        fallback.innerText = aiName.charAt(0).toUpperCase();

        img.onerror = function() {
            this.style.display = "none";
            fallback.classList.remove("hidden");
        };

        imgWrapper.appendChild(img);
        imgWrapper.appendChild(fallback);

        const textWrapper = document.createElement("div");
        textWrapper.className = "flex flex-col gap-1 max-w-[75%]";

        const nameLabel = document.createElement("span");
        nameLabel.className = "text-[11px] text-gray-500 font-bold ml-1 opacity-90";
        nameLabel.innerText = aiName;

        const bubble = document.createElement("div");
        bubble.className = "px-4 py-2.5 rounded-[18px] rounded-tl-none text-sm break-words leading-relaxed shadow-sm relative";
        bubble.style.backgroundColor = "var(--bg-island, #ffffff)";
        bubble.style.color = "var(--text-main, #333333)";

        if (content.trim().startsWith("<div") || content.trim().startsWith("<p")) {
            bubble.innerHTML = content;
        } else {
            bubble.innerHTML = content.replace(/\n/g, "<br>");
        }

        textWrapper.appendChild(nameLabel);
        textWrapper.appendChild(bubble);

        wrapper.appendChild(imgWrapper);
        wrapper.appendChild(textWrapper);

        chatBox.appendChild(wrapper);
        returnElement = bubble;
    } else {
        const bubble = document.createElement("div");
        if (role === "user") {
            bubble.className = "self-end px-4 py-2.5 rounded-[18px] rounded-tr-none max-w-[85%] shadow mb-3 text-sm break-words ml-auto";
            bubble.style.backgroundColor = "var(--accent, #3b82f6)";
            bubble.style.color = "var(--accent-text, #ffffff)";
        } else {
            bubble.className = "self-start px-4 py-2.5 rounded-[18px] rounded-tl-none max-w-[85%] mb-3 text-sm break-words leading-relaxed shadow-sm";
            bubble.style.backgroundColor = "var(--bg-island, #ffffff)";
            bubble.style.color = "var(--text-main, #333333)";
        }

        if (role === "user") {
            let safeContent = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            bubble.innerHTML = safeContent.replace(/\n/g, "<br>");
        } else if (content.trim().startsWith("<div") || content.trim().startsWith("<p")) {
            bubble.innerHTML = content;
        } else if (role === "ai" || role === "error") {
            bubble.innerHTML = content;
        } else {
            bubble.innerHTML = content.replace(/\n/g, "<br>");
        }

        chatBox.appendChild(bubble);
        returnElement = bubble;
    }

    scrollBottom();
    return returnElement;
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
    let html = '<div class="border-t border-white/10 mt-3 pt-2 flex flex-wrap gap-2 items-center">';
    html += '<span class="text-[10px] text-gray-500 mr-1 uppercase tracking-widest font-bold">SOURCE</span>';
    
    sources.forEach((src) => {
        const favicon = "https://www.google.com/s2/favicons?sz=64&domain_url=" + encodeURIComponent(src.url);
        html += `<a href="${src.url}" target="_blank" class="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 transition" title="${src.title}"><img src="${favicon}" class="w-3.5 h-3.5 opacity-70"></a>`;
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
        document.getElementById("code-editor").value = text;
        document.getElementById("right-panel").classList.add("mobile-active");
        document.getElementById("code-tabs").innerHTML = '<button class="px-3 py-1.5 text-xs rounded-md transition font-mono font-bold">Current Code</button>';
        
        if (!document.body.classList.contains("mode-code")) {
            document.body.classList.add("mode-code");
        }
    }
};

window.closeFullEditor = function() {
    document.getElementById("right-panel").classList.remove("mobile-active");
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
                
                btn.innerText = file.name;
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
            tabsContainer.innerHTML = '<span class="text-[10px] text-white/20 px-3 tracking-widest uppercase">No files</span>';
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
    
    document.getElementById("code-tabs").innerHTML = '<span class="text-xs text-gray-500 px-2">Waiting...</span>';
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
            const data = await res.json();
            
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
