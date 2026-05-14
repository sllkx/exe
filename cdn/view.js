(function initViewUI() {
    const cfg = window.__VIEW_CONFIG__ || {};
    window.userLang = cfg.userLang || window.userLang || "en";
    window.selectedGifUrl = "";

    const tMap = {
        ko: { comment: "\ub313\uae00\uc744 \uc785\ub825\ud558\uc138\uc694...", chat: "AI\uc5d0\uac8c \uc9c8\ubb38\ud574\ubcf4\uc138\uc694...", search: "\uac80\uc0c9\uc5b4\ub97c \uc785\ub825\ud558\uc138\uc694...", image: "\uc774\ubbf8\uc9c0\ub97c \uc124\uba85\ud574\ubcf4\uc138\uc694...", video: "\uc601\uc0c1\uc744 \uc124\uba85\ud574\ubcf4\uc138\uc694...", music: "\uc74c\uc545\uc744 \uc124\uba85\ud574\ubcf4\uc138\uc694...", code: "\ucf54\ub4dc\ub97c \uc124\uba85\ud574\ubcf4\uc138\uc694..." },
        en: { comment: "Write a comment...", chat: "Ask AI...", search: "Search...", image: "Describe an image...", video: "Describe a video...", music: "Describe music...", code: "Describe code..." },
        ja: { comment: "\u30b3\u30e1\u30f3\u30c8\u3092\u5165\u529b...", chat: "AI\u306b\u8cea\u554f\u3057\u3066\u307f\u307e\u3057\u3087\u3046...", search: "\u691c\u7d22\u8a9e\u3092\u5165\u529b...", image: "\u753b\u50cf\u3092\u8aac\u660e\u3057\u3066\u307f\u307e\u3057\u3087\u3046...", video: "\u52d5\u753b\u3092\u8aac\u660e\u3057\u3066\u307f\u307e\u3057\u3087\u3046...", music: "\u97f3\u697d\u3092\u8aac\u660e\u3057\u3066\u307f\u307e\u3057\u3087\u3046...", code: "\u30b3\u30fc\u30c9\u3092\u8aac\u660e\u3057\u3066\u307f\u307e\u3057\u3087\u3046..." },
        hi: { comment: "\u091f\u093f\u092a\u094d\u092a\u0923\u0940 \u0932\u093f\u0916\u0947\u0902...", chat: "AI \u0938\u0947 \u092a\u0942\u091b\u0947\u0902...", search: "\u0916\u094b\u091c \u0936\u092c\u094d\u0926 \u0932\u093f\u0916\u0947\u0902...", image: "\u091b\u0935\u093f \u0915\u093e \u0935\u0930\u094d\u0923\u0928 \u0915\u0930\u0947\u0902...", video: "\u0935\u0940\u0921\u093f\u092f\u094b \u0915\u093e \u0935\u0930\u094d\u0923\u0928 \u0915\u0930\u0947\u0902...", music: "\u0938\u0902\u0917\u0940\u0924 \u0915\u093e \u0935\u0930\u094d\u0923\u0928 \u0915\u0930\u0947\u0902...", code: "\u0915\u094b\u0921 \u0915\u093e \u0935\u0930\u094d\u0923\u0928 \u0915\u0930\u0947\u0902..." },
        es: { comment: "Escribe un comentario...", chat: "Pregunta a la IA...", search: "Escribe una busqueda...", image: "Describe una imagen...", video: "Describe un video...", music: "Describe musica...", code: "Describe codigo..." }
    };
    const t = Object.assign({}, tMap.en, tMap[window.userLang] || {});
    const icons = { comment: "ri-discuss-line", chat: "ri-chat-ai-line", search: "ri-search-line", image: "ri-image-circle-ai-line", video: "ri-video-ai-line", music: "ri-music-ai-fill", code: "ri-code-block" };
    const viewReportI18n = cfg.viewReportI18n || {};
    let mode = "comment";
    let isSubmitting = false;
    let inlineEditKey = "";
    let giphyDebounce = null;

    window.mountViewShareBanner = () => {
        const isDark = document.documentElement.classList.contains("dark") || localStorage.theme === "dark";
        const src = `https://cdn.jsdelivr.net/gh/sllkx/olla@main/sharebanner.js?a=https://ollapp.isai.kr/view/9&p=tc&m=mini${isDark ? "" : "&t=light"}`;
        let old = document.getElementById("view-sharebanner-script");
        if (old && old.dataset.src === src) return;
        if (old) old.remove();
        let script = document.createElement("script");
        script.id = "view-sharebanner-script";
        script.dataset.src = src;
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
    };

    window.toggleTheme = () => {
        document.documentElement.classList.toggle("dark");
        localStorage.setItem("theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
        window.mountViewShareBanner();
    };

    window.openGiphyModal = () => {
        const modal = document.getElementById("giphy-modal");
        const surface = document.getElementById("giphy-modal-surface");
        if (!modal || !surface) return;
        modal.classList.remove("hidden");
        void modal.offsetWidth;
        modal.classList.remove("opacity-0", "pointer-events-none");
        surface.classList.remove("translate-y-10");
        const results = document.getElementById("giphy-results");
        if (results && results.innerHTML === "") searchGiphy("");
        const input = document.getElementById("giphy-search-input");
        if (input) input.focus();
    };

    window.closeGiphyModal = () => {
        const modal = document.getElementById("giphy-modal");
        const surface = document.getElementById("giphy-modal-surface");
        if (!modal || !surface) return;
        modal.classList.add("opacity-0", "pointer-events-none");
        surface.classList.add("translate-y-10");
        setTimeout(() => modal.classList.add("hidden"), 300);
    };

    window.searchGiphy = async (query) => {
        const container = document.getElementById("giphy-results");
        const loader = document.getElementById("giphy-loading");
        if (!container || !loader) return;
        container.innerHTML = "";
        loader.classList.remove("hidden");
        try {
            const res = await fetch(`/re_store.php?action=giphy_search&q=${encodeURIComponent(query)}&limit=24`);
            const json = await res.json();
            if (json.success && json.data) {
                json.data.forEach(gif => {
                    const imgUrl = gif.images.fixed_height.url;
                    const actualUrl = gif.images.downsized.url || gif.images.original.url;
                    const div = document.createElement("div");
                    div.className = "cursor-pointer rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 relative group h-32";
                    div.innerHTML = `<img src="${imgUrl}" class="w-full h-full object-cover" loading="lazy"><div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>`;
                    div.onclick = () => selectGif(actualUrl);
                    container.appendChild(div);
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            loader.classList.add("hidden");
        }
    };

    window.selectGif = (url) => {
        window.selectedGifUrl = url;
        const preview = document.getElementById("selected-gif-preview");
        const img = document.getElementById("selected-gif-img");
        if (img) img.src = url;
        if (preview) preview.classList.remove("hidden");
        closeGiphyModal();
        const input = document.getElementById("msg-input");
        if (input) input.focus();
    };

    window.clearSelectedGif = () => {
        window.selectedGifUrl = "";
        const preview = document.getElementById("selected-gif-preview");
        const img = document.getElementById("selected-gif-img");
        if (preview) preview.classList.add("hidden");
        if (img) img.src = "";
    };

    window.viewToggleModeSelector = () => {
        const sel = document.getElementById("mode-selector-container");
        if (sel) sel.classList.toggle("opacity-0");
        if (sel) sel.classList.toggle("pointer-events-none");
    };

    window.viewSetMode = (m) => {
        mode = m;
        const icon = document.getElementById("current-mode-icon");
        const input = document.getElementById("msg-input");
        const selector = document.getElementById("mode-selector-container");
        if (icon) icon.className = `${icons[m]} text-lg`;
        if (input) input.placeholder = t[m] || t.comment;
        const metaWrapper = document.getElementById("meta-wrapper");
        if (metaWrapper) {
            Object.assign(metaWrapper.style, mode === "comment"
                ? { height: "auto", marginTop: "0.25rem", opacity: "1", pointerEvents: "auto" }
                : { height: "0", marginTop: "0", opacity: "0", pointerEvents: "none" });
        }
        if (selector) selector.classList.add("opacity-0", "pointer-events-none");
    };

    window.viewSubmitAction = async () => {
        const input = document.getElementById("msg-input");
        if (!input) return;
        let contentVal = input.value.trim();
        if (window.selectedGifUrl) contentVal += (contentVal ? "\n" : "") + `[gif:${window.selectedGifUrl}]`;
        if (!contentVal || isSubmitting) return;
        if (mode !== "comment") {
            window.location.href = `/?${mode}=${encodeURIComponent(input.value.trim())}`;
            return;
        }
        isSubmitting = true;
        const btn = document.getElementById("view-btn-submit");
        const ogHtml = btn ? btn.innerHTML : "";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="ri-loader-4-line animate-spin text-xl"></i>';
        }
        try {
            const fd = new FormData(document.getElementById("chat-form"));
            fd.set("content", contentVal);
            const res = await fetch("/re_store.php?action=add_comment", { method: "POST", body: fd });
            const text = await res.text();
            const json = JSON.parse(text.replace(/^\uFEFF/, "").substring(text.indexOf("{")));
            if (json.success) window.location.reload();
            else alert("Error: " + (json.error || "Failed"));
        } catch (e) {
            alert("Server Error");
        } finally {
            isSubmitting = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = ogHtml;
            }
        }
    };

    window.startInlineEdit = (type, id) => {
        const k = `${type}-${id}`;
        if (inlineEditKey && inlineEditKey !== k) cancelInlineEdit(...inlineEditKey.split("-"));
        const prefix = type === "post" ? "post" : "comment";
        const cEl = document.getElementById(`${prefix}-content-display${type === "post" ? "" : `-${id}`}`);
        const eEl = document.getElementById(`${prefix}-inline-editor-${id}`);
        const tEl = document.getElementById(`${prefix}-inline-text-${id}`);
        const pEl = document.getElementById(`${prefix}-inline-password-${id}`);
        if (!cEl || !eEl || !tEl) return;
        if (pEl) pEl.value = "";
        tEl.value = cEl.dataset.raw || cEl.innerText || "";
        cEl.classList.add("hidden");
        eEl.classList.remove("hidden");
        inlineEditKey = k;
        tEl.focus();
    };

    window.cancelInlineEdit = (type, id) => {
        const prefix = type === "post" ? "post" : "comment";
        const cEl = document.getElementById(`${prefix}-content-display${type === "post" ? "" : `-${id}`}`);
        const eEl = document.getElementById(`${prefix}-inline-editor-${id}`);
        if (eEl) eEl.classList.add("hidden");
        if (cEl) cEl.classList.remove("hidden");
        inlineEditKey = "";
    };

    window.submitInlineEdit = async (type, id, m) => {
        const prefix = type === "post" ? "post" : "comment";
        const tEl = document.getElementById(`${prefix}-inline-text-${id}`);
        const pEl = document.getElementById(`${prefix}-inline-password-${id}`);
        if (!tEl || !pEl) return;
        if (m === "update" && !tEl.value.trim()) return alert("Empty content.");
        try {
            const fd = new FormData();
            fd.append("id", id);
            fd.append("password", pEl.value.trim());
            fd.append("content", tEl.value.trim());
            fd.append("mode", m);
            const action = type === "post" ? "edit_post" : "edit_comment";
            const res = await fetch(`/re_store.php?action=${action}`, { method: "POST", body: fd });
            const text = await res.text();
            const data = JSON.parse(text.replace(/^\uFEFF/, "").substring(text.indexOf("{")));
            if (!data.success) return alert("Failed: " + (data.error || "Unknown error"));
            if (m === "delete") return type === "post" ? window.location.href = "/" : document.getElementById(`comment-${id}`).remove();
            window.location.reload();
        } catch (e) {
            alert("Network error.");
        }
    };

    window.translateItem = async (type, id) => {
        if (type === "post") {
            try {
                const res = await fetch("/re_store.php?action=create_post_translation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: id, lang: window.userLang }) });
                const json = await res.json();
                if (json.success && json.url) window.location.href = json.url;
            } catch (e) {
                console.error(e);
            }
            return;
        }
        const el = document.getElementById(`comment-content-display-${id}`);
        if (!el) return;
        const ogHtml = el.innerHTML;
        el.innerHTML = '<span class="animate-pulse opacity-50">Translating...</span>';
        try {
            const rawText = (el.dataset.raw || el.innerText).replace(/\[gif:.*?\]/g, "");
            const res = await fetch("/re_store.php?action=ai_translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: rawText, lang: window.userLang }) });
            const data = JSON.parse((await res.text()).replace(/^\uFEFF/, "").trimStart());
            let translatedHtml = data.response ? data.response.trim() : "";
            const gifMatch = (el.dataset.raw || "").match(/\[gif:(https?:\/\/[^\]]+)\]/);
            if (gifMatch) translatedHtml += `<img src="${gifMatch[1]}" class="mt-2 max-w-[200px] w-full rounded-xl object-cover shadow-sm block border border-black/5 dark:border-white/5" alt="GIF">`;
            if (data.success && data.response) el.innerHTML = `<div class="mb-3 pb-2 border-b border-black/10 dark:border-white/10 text-[11px] opacity-70 flex items-center gap-1 font-bold"><i class="ri-translate-2"></i> Translated</div><div class="leading-relaxed text-[14px]">${translatedHtml}</div>`;
            else el.innerHTML = ogHtml;
        } catch (e) {
            alert("Error: " + e.message);
            el.innerHTML = ogHtml;
        }
    };

    window.playTTS = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (window.speechSynthesis.speaking) return window.speechSynthesis.cancel();
        const textToSpeak = (el.dataset.raw || el.innerText).replace(/\[gif:.*?\]/g, "");
        const u = new SpeechSynthesisUtterance(textToSpeak);
        u.lang = window.userLang;
        window.speechSynthesis.speak(u);
    };

    window.chooseViewReportType = (type, btn) => {
        document.getElementById("view-report-type").value = type || "";
        document.querySelectorAll("#view-report-modal .report-type-chip").forEach(c => c.classList.remove("active"));
        if (btn) btn.classList.add("active");
    };

    window.openViewReportModal = (targetType, targetId) => {
        document.getElementById("view-report-target-type").value = targetType || "";
        document.getElementById("view-report-target-id").value = targetId || "";
        document.getElementById("view-report-reason").value = "";
        document.getElementById("view-report-type").value = "";
        document.querySelectorAll("#view-report-modal .report-type-chip").forEach(c => c.classList.remove("active"));
        document.getElementById("view-report-modal-title").textContent = targetType === "forum_comment" ? (viewReportI18n.modalTitleComment || "Report Comment") : (viewReportI18n.modalTitlePost || "Report Post");
        document.getElementById("view-report-modal").classList.remove("hidden");
    };

    window.closeViewReportModal = () => document.getElementById("view-report-modal").classList.add("hidden");

    window.submitViewReport = async () => {
        const tType = document.getElementById("view-report-target-type").value;
        const tId = document.getElementById("view-report-target-id").value;
        const rType = document.getElementById("view-report-type").value;
        const reason = document.getElementById("view-report-reason").value.trim();
        if (!rType) return alert(viewReportI18n.typeRequired || "Please select type");
        if (!reason) return alert(viewReportI18n.reasonRequired || "Please write reason");
        try {
            const res = await fetch("/re_store.php?action=submit_content_report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_type: tType, target_id: tId, report_type: rType, reason }) });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            closeViewReportModal();
            if (data.deleted) tType === "forum_comment" ? document.getElementById("comment-" + tId).remove() : window.location.href = "/";
            else alert(data.duplicate ? "\uc774\ubbf8 \uc2e0\uace0\ud55c \ud56d\ubaa9\uc785\ub2c8\ub2e4." : "\uc2e0\uace0\uac00 \uc811\uc218\ub418\uc5c8\uc2b5\ub2c8\ub2e4.");
        } catch (e) {
            alert("Error occurred");
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        const gSearchInput = document.getElementById("giphy-search-input");
        if (gSearchInput) {
            gSearchInput.addEventListener("input", (e) => {
                clearTimeout(giphyDebounce);
                giphyDebounce = setTimeout(() => searchGiphy(e.target.value), 500);
            });
            gSearchInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    searchGiphy(e.target.value);
                }
            });
        }
        mountViewShareBanner();
        viewSetMode("comment");
    }, { once: true });

    document.addEventListener("click", (e) => {
        const sel = document.getElementById("mode-selector-container");
        const tBtn = document.getElementById("btn-mode-toggle");
        if (sel && tBtn && !sel.contains(e.target) && !tBtn.contains(e.target)) sel.classList.add("opacity-0", "pointer-events-none");
        const gModal = document.getElementById("giphy-modal-surface");
        const gWrap = document.getElementById("giphy-modal");
        if (gModal && gWrap && !gWrap.classList.contains("hidden") && !gModal.contains(e.target) && e.target === gWrap) closeGiphyModal();
    });
})();
