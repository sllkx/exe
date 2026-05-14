// Community post composer: Giphy attachment, image preview, nickname/password panel.
let selectedCommunityGiphyUrl = "";
if (typeof window !== "undefined" && typeof window.__ISAI_COMMUNITY_GIPHY_URL__ === "string") {
    selectedCommunityGiphyUrl = window.__ISAI_COMMUNITY_GIPHY_URL__;
}

let giphySearchTimer = null;
let giphyOffset = 0;
const giphyPageSize = 24;
let giphyHasMore = true;
let giphyLoading = false;
let giphyCurrentQuery = "";
const GIPHY_PUBLIC_API_KEY = "JBMEoL3GsHvYoASrdadQhrmDtXTXWEch";

function setSelectedCommunityGiphyUrl(url) {
    selectedCommunityGiphyUrl = String(url || "").trim();
    window.__ISAI_COMMUNITY_GIPHY_URL__ = selectedCommunityGiphyUrl;
    const hidden = document.getElementById("comm-image-url");
    if (hidden) hidden.value = selectedCommunityGiphyUrl;
}

function getSelectedCommunityGiphyUrl() {
    const hidden = document.getElementById("comm-image-url");
    if (hidden && String(hidden.value || "").trim()) return String(hidden.value || "").trim();
    if (typeof window.__ISAI_COMMUNITY_GIPHY_URL__ === "string") return String(window.__ISAI_COMMUNITY_GIPHY_URL__ || "").trim();
    return String(selectedCommunityGiphyUrl || "").trim();
}

function getCommunityPreviewNodes() {
    return {
        box: document.getElementById("comm-img-preview-box"),
        img: document.getElementById("comm-preview-img"),
        file: document.getElementById("comm-file-input"),
        attachmentRow: document.getElementById("prompt-attachment-row")
    };
}

function renderCommunityAttachmentRow(url) {
    const row = getCommunityPreviewNodes().attachmentRow;
    if (!row) return;
    const src = String(url || "").trim();
    if (!src) {
        row.innerHTML = "";
        row.classList.add("hidden");
        return;
    }
    const safeSrc = src.replace(/"/g, "&quot;");
    row.innerHTML = `<div class="inline-flex items-center gap-2 px-2 py-1 rounded-xl bg-white/8 border border-white/10 mt-1 mb-1">
        <img src="${safeSrc}" class="h-10 w-10 rounded-lg object-cover border border-white/20" alt="attachment">
        <span class="text-[11px] text-white/70">Image attached</span>
        <button type="button" onclick="clearCommFile()" class="h-6 w-6 rounded-full bg-red-500/90 text-white text-[12px] leading-none flex items-center justify-center" title="Remove">&times;</button>
    </div>`;
    row.classList.remove("hidden");
}

function setCommunityImagePreview(url) {
    const nodes = getCommunityPreviewNodes();
    const src = String(url || "").trim();
    if (!src) {
        if (nodes.img) nodes.img.src = "";
        if (nodes.box) nodes.box.classList.add("hidden");
        renderCommunityAttachmentRow("");
        return;
    }
    if (nodes.img) nodes.img.src = src;
    if (nodes.box) nodes.box.classList.remove("hidden");
    renderCommunityAttachmentRow(src);
}

function handleCommFileSelect(input) {
    setSelectedCommunityGiphyUrl("");
    const file = input && input.files && input.files[0] ? input.files[0] : null;
    setCommunityImagePreview(file ? URL.createObjectURL(file) : "");
}

function clearCommFile() {
    setSelectedCommunityGiphyUrl("");
    const nodes = getCommunityPreviewNodes();
    if (nodes.file) nodes.file.value = "";
    setCommunityImagePreview("");
}

function selectGiphyImage(url) {
    const value = String(url || "").trim();
    if (!value) return;
    setSelectedCommunityGiphyUrl(value);
    const nodes = getCommunityPreviewNodes();
    if (nodes.file) nodes.file.value = "";
    setCommunityImagePreview(value);
    if (typeof showToast === "function") showToast("Image selected");
    closeGiphyPicker();
}

function setGiphyPanelOpen(open) {
    const panel = document.getElementById("giphy-inline-panel");
    if (!panel) return;
    panel.classList.toggle("pointer-events-none", !open);
    panel.style.opacity = open ? "1" : "0";
    panel.style.transform = open ? "translateY(0)" : "translateY(-6px)";
    panel.style.maxHeight = open ? "180px" : "0";
}

function openGiphyPicker() {
    const input = document.getElementById("giphy-search-input");
    const results = document.getElementById("giphy-results");
    setGiphyPanelOpen(true);
    setTimeout(() => {
        if (input) input.focus();
    }, 30);
    if (results && !results.dataset.loaded && !giphyLoading) searchGiphyImages("trending");
}

function closeGiphyPicker() {
    setGiphyPanelOpen(false);
}

function toggleGiphyInlineSearch() {
    const panel = document.getElementById("giphy-inline-panel");
    const isOpen = panel && panel.style.opacity === "1";
    if (isOpen) closeGiphyPicker();
    else openGiphyPicker();
}

function queueGiphySearch() {
    clearTimeout(giphySearchTimer);
    giphySearchTimer = setTimeout(() => searchGiphyImages(), 260);
}

function getGiphyImageUrl(item) {
    if (!item || !item.images) return "";
    return (
        item.images.fixed_height && item.images.fixed_height.url ||
        item.images.fixed_width && item.images.fixed_width.url ||
        item.images.original && item.images.original.url ||
        ""
    );
}

function renderGiphyResults(items, append = false) {
    const results = document.getElementById("giphy-results");
    if (!results) return;

    const pick = (event) => {
        const target = event.target && event.target.closest ? event.target.closest("[data-giphy-url]") : null;
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        selectGiphyImage(target.getAttribute("data-giphy-url") || "");
    };

    if (!results.dataset.bindSelect) {
        results.dataset.bindSelect = "1";
        results.addEventListener("click", pick);
        results.addEventListener("mousedown", pick);
        results.addEventListener("touchstart", pick, { passive: false });
    }

    if (!results.dataset.bindScroll) {
        results.dataset.bindScroll = "1";
        results.addEventListener("scroll", () => {
            if (giphyLoading || !giphyHasMore) return;
            if (results.scrollHeight - results.scrollTop - results.clientHeight < 64) searchGiphyImages("append");
        });
    }

    results.dataset.loaded = "1";
    if (!Array.isArray(items) || !items.length) {
        if (!append) results.innerHTML = '<div class="col-span-full text-center text-white/45 text-xs py-8">No images found.</div>';
        return;
    }

    if (!append) results.innerHTML = "";
    items.forEach((item) => {
        const url = getGiphyImageUrl(item);
        if (!url) return;
        const thumb = (item.images && item.images.fixed_width_small && item.images.fixed_width_small.url) || url;
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.giphyUrl = url;
        button.className = "group relative aspect-square overflow-hidden rounded-xl bg-white/5 border border-white/10 hover:border-white/35 transition";
        const img = document.createElement("img");
        img.src = thumb;
        img.alt = "";
        img.loading = "lazy";
        img.className = "w-full h-full object-cover";
        const badge = document.createElement("span");
        badge.className = "absolute inset-x-2 bottom-2 h-6 rounded-full bg-black/70 text-white text-[11px] font-bold hidden group-hover:flex items-center justify-center";
        badge.textContent = "Select";
        button.appendChild(img);
        button.appendChild(badge);
        results.appendChild(button);
    });
}

async function fetchGiphyImages(query, limit, offset) {
    const localEndpoint = `re_store.php?action=giphy_search&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
    try {
        const response = await fetch(localEndpoint, { cache: "no-store" });
        const data = await response.json();
        if (data && data.success) return data;
    } catch (error) {}

    const apiBase = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_PUBLIC_API_KEY)}&q=${encodeURIComponent(query)}`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(GIPHY_PUBLIC_API_KEY)}`;
    const response = await fetch(`${apiBase}&limit=${limit}&offset=${offset}&rating=pg-13&lang=ko`, { cache: "no-store" });
    const data = await response.json();
    return {
        success: !!(data && Array.isArray(data.data)),
        data: data && Array.isArray(data.data) ? data.data : []
    };
}

async function searchGiphyImages(mode = "") {
    const input = document.getElementById("giphy-search-input");
    const results = document.getElementById("giphy-results");
    const append = mode === "append";
    const query = String(mode === "trending" ? "" : (input && input.value ? input.value : "")).trim();

    if (!append) {
        giphyOffset = 0;
        giphyHasMore = true;
        giphyCurrentQuery = query;
        if (results) results.innerHTML = '<div class="col-span-full text-center text-white/45 text-xs py-8">Loading...</div>';
    }
    if (giphyLoading || (append && !giphyHasMore)) return;

    giphyLoading = true;
    try {
        const data = await fetchGiphyImages(giphyCurrentQuery, giphyPageSize, giphyOffset);
        const items = data && data.success ? (data.data || []) : [];
        renderGiphyResults(items, append);
        giphyOffset += items.length;
        giphyHasMore = items.length >= giphyPageSize;
    } catch (error) {
        if (!append && results) results.innerHTML = '<div class="col-span-full text-center text-red-300 text-xs py-8">Giphy loading failed.</div>';
    } finally {
        giphyLoading = false;
        if (results && giphyHasMore && results.dataset.loaded && results.scrollHeight <= results.clientHeight + 8) {
            setTimeout(() => searchGiphyImages("append"), 30);
        }
    }
}

function toggleCommunityIdentityPanel(force) {
    const panel = document.getElementById("community-identity-panel");
    if (!panel) return;
    const open = typeof force === "boolean" ? force : panel.style.opacity !== "1";
    panel.classList.toggle("pointer-events-none", !open);
    panel.style.opacity = open ? "1" : "0";
    panel.style.transform = open ? "translateX(0)" : "translateX(-8px)";
    panel.style.maxWidth = open ? "240px" : "0";
    panel.style.paddingLeft = open ? "8px" : "0";
    panel.style.paddingRight = open ? "8px" : "0";
    if (open) {
        const nick = document.getElementById("comm-nickname");
        setTimeout(() => nick && nick.focus(), 120);
    }
}

window.getSelectedCommunityGiphyUrl = getSelectedCommunityGiphyUrl;
window.handleCommFileSelect = handleCommFileSelect;
window.clearCommFile = clearCommFile;
window.openGiphyPicker = openGiphyPicker;
window.closeGiphyPicker = closeGiphyPicker;
window.toggleGiphyInlineSearch = toggleGiphyInlineSearch;
window.queueGiphySearch = queueGiphySearch;
window.searchGiphyImages = searchGiphyImages;
window.selectGiphyImage = selectGiphyImage;
window.toggleCommunityIdentityPanel = toggleCommunityIdentityPanel;
