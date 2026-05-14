// extracted from main_asset.js: code editor helpers
function parseMarkdownLocal(text, isFinished = false) {
window.extractedCodes =[];
    
    let mainContent = text;

	let html = "";

    let processedMain = mainContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const blocks =[];
    let counter = 0;

    function createBlockUI(lang, code, isStreaming) {
        counter++;
        lang = lang || "text";
        
        let cleanCode = code.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        window.extractedCodes.push({ 
            lang: lang, 
            content: cleanCode, 
            name: `File ${window.extractedCodes.length + 1} (${lang})` 
        });

        const streamingClass = isStreaming ? " is-streaming" : "";
        const languageLabel = lang ? `<div class="chat-code-label">${lang}</div>` : "";
        const uiBlock = `${languageLabel}<pre class="chat-code-block${streamingClass}"><code>${code}</code></pre>`;        
        blocks.push(uiBlock);
        return "###CODE_BLOCK_" + (blocks.length - 1) + "###";
    }

    processedMain = processedMain.replace(/```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return createBlockUI(lang, code, false);
    });

    processedMain = processedMain.replace(/```([a-zA-Z0-9_\-\+]*)[ \t]*\n?([\s\S]*)$/g, (match, lang, code) => {
        return createBlockUI(lang, code, !isFinished);
    });

    processedMain = processedMain.replace(/`([^`]+)`/g, (match, inlineCode) => {
        return `<code class="bg-black/[0.06] px-1.5 py-0.5 rounded text-[#111827] font-bold font-mono text-sm border border-black/[0.08]">${inlineCode}</code>`;
    })
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#111827]">$1</strong>')
    .replace(/^###\s+(.*)$/gm, '<h3 class="text-lg font-bold text-[#111827] mb-2 mt-4">$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<b class="font-bold text-[#111827] text-base mt-3 mb-1 block">$1</b>')
    .replace(/^[\-\*]\s+(.*)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/\n/g, "<br>");

    blocks.forEach((blockHtml, index) => {
        processedMain = processedMain.replace("###CODE_BLOCK_" + index + "###", blockHtml);
    });

    return html + processedMain;
}

function escapeHtmlForBubbleLocal(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function looksLikeCodeOrHtmlResponseLocal(value) {
    const text = String(value ?? "").trim();
    if (!text) return false;
    return /```/.test(text)
        || /(?:^|\n)\s*(<!doctype html|<html\b|<head\b|<body\b|<script\b|<style\b|<canvas\b|<\?php|const\b|let\b|var\b|function\b|class\b|import\b|export\b)/i.test(text);
}

function detectCodeBlockLanguageLocal(value) {
    const text = String(value ?? "").trimStart();
    if (/^<!doctype html|^<html\b|^<head\b|^<body\b|^<script\b|^<style\b|^<canvas\b/i.test(text)) return "html";
    if (/^<\?php/i.test(text)) return "php";
    if (/^(const|let|var|function|class|import|export)\b/.test(text)) return "javascript";
    return "text";
}

function normalizeCodeLikeResponseForBubbleLocal(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (/```/.test(text)) return text;
    const startMatch = text.match(/(?:^|\n)\s*(<!doctype html|<html\b|<head\b|<body\b|<script\b|<style\b|<canvas\b|<\?php|const\b|let\b|var\b|function\b|class\b|import\b|export\b)/i);
    if (!startMatch) return text;

    const startIndex = text.search(/(?:^|\n)\s*(<!doctype html|<html\b|<head\b|<body\b|<script\b|<style\b|<canvas\b|<\?php|const\b|let\b|var\b|function\b|class\b|import\b|export\b)/i);
    if (startIndex < 0) return text;

    const prefix = text.slice(0, startIndex).trimEnd();
    const codeText = text.slice(startIndex).trim();
    const lang = detectCodeBlockLanguageLocal(codeText);
    const fenced = "```" + lang + "\n" + codeText + "\n```";
    return prefix ? (prefix + "\n\n" + fenced) : fenced;
}

function renderAssistantBubbleContentLocal(text, isFinished = false, options = {}) {
    const textValue = String(text ?? "");
    const normalizedText = (!!(options && options.forcePlainText) || looksLikeCodeOrHtmlResponseLocal(textValue))
        ? normalizeCodeLikeResponseForBubbleLocal(textValue)
        : normalizeAssistantSlashLineBreaks(textValue);
    return parseMarkdownLocal(normalizedText, isFinished);
}

function setAssistantBubbleBodyLocal(bubble, text, options = {}) {
    if (!bubble) return;
    const normalizedText = normalizeAssistantSlashLineBreaks(String(text ?? ""));
    const rawText = trimRepeatedDisplayText(normalizedText);
    const plainText = extractPlainTextLocal(rawText);
    if (!plainText) {
        const locale = String(document.documentElement.lang || navigator.language || "en").toLowerCase();
        const fallback = locale.startsWith("ko")
            ? "응답을 불러오지 못했습니다."
            : (locale.startsWith("ja") ? "応答を読み込めませんでした。" : "I could not load a response.");
        bubble.textContent = fallback;
        return;
    }
    bubble.style.whiteSpace = "";
    bubble.style.wordBreak = "";
    bubble.style.fontFamily = "";
    bubble.style.lineHeight = "";
    bubble.innerHTML = renderAssistantBubbleContentLocal(rawText, !!options.isFinished, options);
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
        if (codeEditor) {
            codeEditor.value = text;
            scheduleCodeBlockActionsRender();
        }
        if (codeTabs) {
            codeTabs.innerHTML = '<button type="button" class="code-tab-btn active" title="Current Code"><span class="code-tab-icon"><i class="ri-code-block"></i></span><span class="code-tab-label">CODE</span></button>';
        }

        if (typeof window.syncInlineCodePanel === "function") {
            window.syncInlineCodePanel("code");
        } else {
            if (rightPanel) {
                if (document.body) document.body.setAttribute("data-ui-mode", "code");
                document.body.classList.remove("desktop-code-stage");
                document.body.classList.toggle("mode-code", mobileCodeMode);
                document.body.classList.toggle("mobile-code-stacked", mobileCodeMode);
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
    if (document.body) document.body.classList.remove("mobile-code-stacked");
    if (typeof currentMode !== "undefined" && currentMode === "code" && typeof setMode === "function") {
        setMode("chat");
        return;
    }
    document.body.classList.remove("mode-code");
    document.body.classList.remove("mobile-code-stacked");
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
let scopedCodeBlocks =[];
let structuredCodeBlocksState = [];
let pendingScopedCodeAttachment = null;
let codeBlockRenderTimer = null;
let structuredPreviewTimer = null;
const codeBlockCollapseState = Object.create(null);

function getScopedCodeLocale() {
    const locale = String((window.ISAI_SERVER_I18N && window.ISAI_SERVER_I18N.locale) || window.LANG || document.documentElement.lang || navigator.language || "en").toLowerCase();
    if (locale.startsWith("ko")) return "ko";
    if (locale.startsWith("ja")) return "ja";
    if (locale.startsWith("zh")) return "zh";
    if (locale.startsWith("es")) return "es";
    return "en";
}

function getScopedCodeText(key) {
    const dict = {
        ko: {
            empty: "코드 블록 없음",
            fullFile: "전체 파일",
            setup: "설정 블록",
            editAsk: "이 블록에서 변경할 내용을 입력하세요.",
            processing: "선택 블록 수정 중...",
            applied: "선택 블록이 업데이트되었습니다.",
            failed: "블록 적용 실패. 더 구체적으로 요청해 주세요.",
            attached: "블록이 입력창에 첨부되었습니다."
        },
        ja: {
            empty: "コードブロックなし",
            fullFile: "ファイル全体",
            setup: "セットアップブロック",
            editAsk: "このブロックで変更したい内容を入力してください。",
            processing: "選択ブロックを編集中...",
            applied: "選択ブロックを更新しました。",
            failed: "ブロック適用に失敗しました。より具体的に入力してください。",
            attached: "ブロックを入力欄に添付しました。"
        },
        zh: {
            empty: "没有代码块",
            fullFile: "整个文件",
            setup: "设置块",
            editAsk: "请输入要修改的块内容。",
            processing: "正在编辑所选代码块...",
            applied: "已更新所选代码块。",
            failed: "应用代码块失败，请提供更具体的修改说明。",
            attached: "已将代码块附加到输入框。"
        },
        es: {
            empty: "No hay bloques de c처digo",
            fullFile: "Archivo completo",
            setup: "Bloque base",
            editAsk: "Escribe qu챕 quieres cambiar en este bloque.",
            processing: "Editando bloque seleccionado...",
            applied: "Bloque actualizado.",
            failed: "No se pudo aplicar el bloque. Describe mejor el cambio.",
            attached: "Bloque adjuntado al campo de entrada."
        },
        en: {
            empty: "No code blocks",
            fullFile: "Whole file",
            setup: "Setup block",
            editAsk: "Describe what to change in this block.",
            processing: "Editing selected block...",
            applied: "Selected block updated.",
            failed: "Block apply failed. Please give a more specific edit request.",
            attached: "Block attached to the input field."
        }
    };
    const locale = getScopedCodeLocale();
    const pack = dict[locale] || dict.en;
    return pack[key] || dict.en[key] || "";
}

function normalizeCodeLanguageKey(value) {
    const key = String(value || "").toLowerCase();
    if (["js", "jsx", "ts", "tsx", "javascript", "typescript", "json"].some((item) => key.includes(item))) return "javascript";
    if (["py", "python"].some((item) => key.includes(item))) return "python";
    if (["php"].some((item) => key.includes(item))) return "php";
    if (["html", "xml", "htm"].some((item) => key.includes(item))) return "html";
    if (["css", "scss", "sass", "less"].some((item) => key.includes(item))) return "css";
    return key || "text";
}

function getCodeBlockIconClass(lang = "") {
    const key = normalizeCodeLanguageKey(lang);
    if (key === "html") return "ri-html5-line";
    if (key === "css") return "ri-css3-line";
    if (key === "javascript") return "ri-braces-line";
    if (key === "php") return "ri-code-block";
    if (key === "python") return "ri-terminal-box-line";
    return "ri-file-code-line";
}

function getActiveCodeContentSnapshot() {
    if (codeFiles && codeFiles[activeFileIndex] && typeof codeFiles[activeFileIndex].content === "string") {
        return String(codeFiles[activeFileIndex].content || "");
    }
    const editor = document.getElementById("code-editor");
    return editor ? String(editor.value || "") : "";
}

function buildScopedCodeBlockKey(fileIndex, block) {
    const resolvedFileIndex = Number.isFinite(Number(fileIndex)) ? Number(fileIndex) : activeFileIndex;
    const label = String(block && block.label ? block.label : "").trim();
    const startLine = Number.isFinite(Number(block && block.startLine)) ? Number(block.startLine) : 0;
    const endLine = Number.isFinite(Number(block && block.endLine)) ? Number(block.endLine) : startLine;
    return `${resolvedFileIndex}:${label}:${startLine}:${endLine}`;
}

function parseScopedCodeBlocksFromContent(content, langHint = "") {
    const text = String(content || "");
    if (!text.trim()) return [];
    const lines = text.split("\n");
    const lineOffsets =[];
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
        lineOffsets.push(offset);
        offset += lines[i].length + 1;
    }
    const lang = normalizeCodeLanguageKey(langHint || detectCodeBlockLanguageLocal(text));
    const starts =[];
    const pushStart = (lineIndex, label) => {
        if (!label) return;
        starts.push({ line: lineIndex, label: String(label).trim() });
    };

    lines.forEach((line, lineIndex) => {
        const trimmed = String(line || "").trim();
        if (!trimmed) return;
        let match = null;
        if (lang === "javascript" || lang === "php") {
            match = trimmed.match(/^function\s+([A-Za-z0-9_$]+)/);
            if (match) return pushStart(lineIndex, `fn ${match[1]}`);
            match = trimmed.match(/^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/);
            if (match) return pushStart(lineIndex, `fn ${match[1]}`);
            match = trimmed.match(/^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
            if (match) return pushStart(lineIndex, `fn ${match[1]}`);
            match = trimmed.match(/^class\s+([A-Za-z0-9_$]+)/);
            if (match) return pushStart(lineIndex, `class ${match[1]}`);
        } else if (lang === "python") {
            match = trimmed.match(/^def\s+([A-Za-z0-9_]+)/);
            if (match) return pushStart(lineIndex, `def ${match[1]}`);
            match = trimmed.match(/^class\s+([A-Za-z0-9_]+)/);
            if (match) return pushStart(lineIndex, `class ${match[1]}`);
        } else if (lang === "html") {
            match = trimmed.match(/^<(script|style|section|main|header|footer|nav|article|aside|div|form)\b/i);
            if (match) return pushStart(lineIndex, `<${match[1].toLowerCase()}>`);
        } else if (lang === "css") {
            match = trimmed.match(/^(@media[^{]+)\{/i);
            if (match) return pushStart(lineIndex, match[1].trim());
            match = trimmed.match(/^([.#]?[A-Za-z0-9_:-][^{]*)\{/);
            if (match) return pushStart(lineIndex, match[1].trim());
        }
    });

    if (starts.length === 0) {
        return [{
            index: 0,
            label: getScopedCodeText("fullFile"),
            lang,
            startOffset: 0,
            endOffset: text.length,
            startLine: 0,
            endLine: Math.max(0, lines.length - 1),
            sourceText: text,
            promptText: text.trim()
        }];
    }

    const blocks =[];
    const firstStartLine = Number.isFinite(Number(starts[0] && starts[0].line)) ? Number(starts[0].line) : 0;
    const firstStartOffset = lineOffsets[firstStartLine] || 0;
    const leadingText = text.slice(0, firstStartOffset);
    if (leadingText.trim()) {
        blocks.push({
            index: 0,
            label: getScopedCodeText("setup"),
            lang,
            startOffset: 0,
            endOffset: firstStartOffset,
            startLine: 0,
            endLine: Math.max(0, firstStartLine - 1),
            sourceText: leadingText,
            promptText: leadingText.trim()
        });
    }

    for (let i = 0; i < starts.length; i++) {
        const startLine = starts[i].line;
        const nextLine = i + 1 < starts.length ? starts[i + 1].line : lines.length;
        const startOffset = lineOffsets[startLine] || 0;
        const endOffset = nextLine < lines.length ? (lineOffsets[nextLine] || text.length) : text.length;
        const sourceText = text.slice(startOffset, endOffset);
        const promptText = sourceText.trim();
        if (!promptText) continue;
        blocks.push({
            index: blocks.length,
            label: starts[i].label || `${getScopedCodeText("fullFile")} ${i + 1}`,
            lang,
            startOffset,
            endOffset,
            startLine,
            endLine: Math.max(startLine, nextLine - 1),
            sourceText,
            promptText
        });
    }

    return blocks.length ? blocks.slice(0, 24).map((block, index) => ({ ...block, index })) : [{
        index: 0,
        label: getScopedCodeText("fullFile"),
        lang,
        startOffset: 0,
        endOffset: text.length,
        startLine: 0,
        endLine: Math.max(0, lines.length - 1),
        sourceText: text,
        promptText: text.trim()
    }];
}

function createScopedTargetFromBlock(block, fileIndex = activeFileIndex) {
    if (!block || typeof block !== "object") return null;
    const next = {
        fileIndex,
        startOffset: Number.isFinite(Number(block.startOffset)) ? Number(block.startOffset) : 0,
        endOffset: Number.isFinite(Number(block.endOffset)) ? Number(block.endOffset) : 0,
        sourceText: String(block.currentText != null ? block.currentText : (block.sourceText || "")),
        originalBlock: String(block.sourceText || ""),
        label: String(block.label || ""),
        lang: String(block.lang || ""),
        startLine: Number.isFinite(Number(block.startLine)) ? Number(block.startLine) : 0,
        endLine: Number.isFinite(Number(block.endLine)) ? Number(block.endLine) : 0
    };
    next.blockKey = buildScopedCodeBlockKey(fileIndex, next);
    return next;
}

function syncStructuredCodeTextareaHeight(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
}

function scheduleStructuredPreviewRefresh() {
    if (structuredPreviewTimer) clearTimeout(structuredPreviewTimer);
    structuredPreviewTimer = setTimeout(() => {
        structuredPreviewTimer = null;
        if (typeof window.refreshHtmlPreview === "function" && document.body && document.body.classList.contains("html-preview-active")) {
            try { window.refreshHtmlPreview(); } catch (error) {}
        }
    }, 160);
}

function syncStructuredCodeToMaster(fileIndex = activeFileIndex) {
    const merged = structuredCodeBlocksState.map((block) => String(block && block.currentText != null ? block.currentText : (block.sourceText || ""))).join("");
    if (codeFiles[fileIndex]) {
        codeFiles[fileIndex].content = merged;
    }
    const editor = document.getElementById("code-editor");
    if (editor && fileIndex === activeFileIndex) {
        editor.value = merged;
    }
    scheduleStructuredPreviewRefresh();
}

function renderPromptAttachmentRow() {
    const row = document.getElementById("prompt-attachment-row");
    if (!row) return;
    row.innerHTML = "";
    if (!pendingScopedCodeAttachment) {
        row.classList.add("hidden");
        return;
    }

    const chip = document.createElement("div");
    chip.className = "prompt-attachment-chip";

    const icon = document.createElement("span");
    icon.className = "prompt-attachment-chip-icon";
    icon.innerHTML = '<i class="ri-attachment-2"></i>';
    chip.appendChild(icon);

    const label = document.createElement("span");
    label.className = "prompt-attachment-chip-label";
    label.textContent = pendingScopedCodeAttachment.label || getScopedCodeText("fullFile");
    chip.appendChild(label);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "prompt-attachment-chip-remove";
    removeButton.innerHTML = '<i class="ri-close-line"></i>';
    removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearPendingScopedCodeAttachment();
    });
    chip.appendChild(removeButton);

    row.appendChild(chip);
    row.classList.remove("hidden");
}

function syncStructuredAttachmentState() {
    const container = document.getElementById("code-structured-editor");
    if (!container) return;
    container.querySelectorAll(".code-structured-card").forEach((card) => {
        const isAttached = !!(pendingScopedCodeAttachment && card.dataset.blockKey === pendingScopedCodeAttachment.blockKey);
        card.classList.toggle("is-attached", isAttached);
        const aiButton = card.querySelector(".code-structured-ai");
        if (aiButton) aiButton.classList.toggle("is-attached", isAttached);
    });
}

function clearPendingScopedCodeAttachment(options = {}) {
    pendingScopedCodeAttachment = null;
    renderPromptAttachmentRow();
    syncStructuredAttachmentState();
    if (!options.silent) {
        const input = document.getElementById("prompt-input");
        if (input) input.focus();
    }
}

function resolvePendingScopedCodeAttachment() {
    if (!pendingScopedCodeAttachment) return null;
    const fileIndex = Number.isFinite(Number(pendingScopedCodeAttachment.fileIndex))
        ? Number(pendingScopedCodeAttachment.fileIndex)
        : activeFileIndex;
    const matched = structuredCodeBlocksState.find((block) => buildScopedCodeBlockKey(fileIndex, block) === pendingScopedCodeAttachment.blockKey);
    if (matched) return createScopedTargetFromBlock(matched, fileIndex);
    return { ...pendingScopedCodeAttachment };
}

function attachScopedCodeBlockToPrompt(blockIndex) {
    const index = Number(blockIndex);
    const block = structuredCodeBlocksState[index] || scopedCodeBlocks[index];
    if (!block) return;
    pendingScopedCodeAttachment = createScopedTargetFromBlock(block, activeFileIndex);
    renderPromptAttachmentRow();
    syncStructuredAttachmentState();
    const input = document.getElementById("prompt-input");
    if (input) {
        input.focus();
        if (typeof handleInput === "function") handleInput(input);
    }
    if (typeof showToast === "function") showToast(getScopedCodeText("attached"));
}

function renderStructuredCodeEditor() {
    const container = document.getElementById("code-structured-editor");
    const editor = document.getElementById("code-editor");
    const legacyContainer = document.getElementById("code-block-actions");
    if (legacyContainer) {
        legacyContainer.innerHTML = "";
        legacyContainer.classList.add("hidden");
    }
    renderPromptAttachmentRow();
    if (!container || !editor) return;

    const content = getActiveCodeContentSnapshot();
    const file = codeFiles && codeFiles[activeFileIndex] ? codeFiles[activeFileIndex] : null;
    const lang = normalizeCodeLanguageKey((file && file.lang) || detectCodeBlockLanguageLocal(content));

    if (!content.trim()) {
        scopedCodeBlocks = [];
        structuredCodeBlocksState = [];
        container.innerHTML = "";
        container.classList.add("hidden");
        container.classList.remove("is-active");
        editor.classList.remove("is-structured-hidden");
        syncStructuredAttachmentState();
        return;
    }

    const blocks = parseScopedCodeBlocksFromContent(content, lang).map((block) => ({
        ...block,
        fileIndex: activeFileIndex,
        blockKey: buildScopedCodeBlockKey(activeFileIndex, block),
        currentText: String(block.sourceText || "")
    }));
    scopedCodeBlocks = blocks;
    structuredCodeBlocksState = blocks.map((block) => ({ ...block }));

    container.innerHTML = "";
    container.classList.remove("hidden");
    container.classList.add("is-active");
    editor.classList.add("is-structured-hidden");

    blocks.forEach((block, idx) => {
        const card = document.createElement("section");
        card.className = "code-structured-card";
        card.dataset.blockKey = block.blockKey;

        const isCollapsed = !!codeBlockCollapseState[block.blockKey];
        if (isCollapsed) card.classList.add("is-collapsed");

        const head = document.createElement("div");
        head.className = "code-structured-card-head";

        const headMain = document.createElement("div");
        headMain.className = "code-structured-card-head-main";

        const icon = document.createElement("span");
        icon.className = "code-structured-icon";
        icon.innerHTML = `<i class="${getCodeBlockIconClass(block.lang)}"></i>`;
        headMain.appendChild(icon);

        const titleWrap = document.createElement("div");
        titleWrap.className = "code-structured-card-title-wrap";

        const title = document.createElement("div");
        title.className = "code-structured-card-title";
        title.textContent = block.label || `${getScopedCodeText("fullFile")} ${idx + 1}`;
        titleWrap.appendChild(title);

        const meta = document.createElement("div");
        meta.className = "code-structured-card-meta";
        meta.textContent = `L${Number(block.startLine || 0) + 1}-${Number(block.endLine || 0) + 1}`;
        titleWrap.appendChild(meta);
        headMain.appendChild(titleWrap);
        head.appendChild(headMain);

        const actions = document.createElement("div");
        actions.className = "code-structured-card-actions";

        const aiButton = document.createElement("button");
        aiButton.type = "button";
        aiButton.className = "code-structured-ai";
        aiButton.innerHTML = '<i class="ri-ai-generate-text"></i>';
        aiButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            attachScopedCodeBlockToPrompt(idx);
        });
        actions.appendChild(aiButton);

        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "code-structured-toggle";
        toggleButton.innerHTML = `<i class="${isCollapsed ? "ri-arrow-down-s-line" : "ri-arrow-up-s-line"}"></i>`;
        toggleButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const nextCollapsed = !card.classList.contains("is-collapsed");
            card.classList.toggle("is-collapsed", nextCollapsed);
            codeBlockCollapseState[block.blockKey] = nextCollapsed;
            toggleButton.innerHTML = `<i class="${nextCollapsed ? "ri-arrow-down-s-line" : "ri-arrow-up-s-line"}"></i>`;
        });
        actions.appendChild(toggleButton);

        head.appendChild(actions);
        card.appendChild(head);

        const body = document.createElement("div");
        body.className = "code-structured-card-body";

        const blockEditor = document.createElement("textarea");
        blockEditor.className = "code-structured-editor-input custom-scrollbar-code";
        blockEditor.spellcheck = false;
        blockEditor.value = block.currentText;
        blockEditor.dataset.blockIndex = String(idx);
        blockEditor.addEventListener("input", (event) => {
            const nextIndex = Number(event.target.dataset.blockIndex);
            const nextBlock = structuredCodeBlocksState[nextIndex];
            if (!nextBlock) return;
            nextBlock.currentText = event.target.value;
            nextBlock.sourceText = event.target.value;
            nextBlock.promptText = String(event.target.value || "").trim();
            syncStructuredCodeTextareaHeight(event.target);
            syncStructuredCodeToMaster(nextBlock.fileIndex);
            if (pendingScopedCodeAttachment && pendingScopedCodeAttachment.blockKey === nextBlock.blockKey) {
                pendingScopedCodeAttachment = createScopedTargetFromBlock(nextBlock, nextBlock.fileIndex);
                renderPromptAttachmentRow();
                syncStructuredAttachmentState();
            }
        });
        blockEditor.addEventListener("blur", () => {
            scheduleCodeBlockActionsRender();
        });
        body.appendChild(blockEditor);
        card.appendChild(body);
        container.appendChild(card);
        syncStructuredCodeTextareaHeight(blockEditor);
    });

    syncStructuredAttachmentState();
}

function buildScopedCodeEditPrompt(block, instruction, fileInfo = {}) {
    const lang = String(block && block.lang ? block.lang : fileInfo.lang || "text");
    const name = String(fileInfo.name || "");
    const label = String(block && block.label ? block.label : "Block");
    return [
        "You are editing only one code block from a file.",
        "Return ONLY the updated block code.",
        "Do not include markdown fences.",
        "Do not add explanation.",
        `Language: ${lang}`,
        name ? `File: ${name}` : "",
        `Target block: ${label}`,
        "",
        "[Edit request]",
        String(instruction || "").trim(),
        "",
        "[Current block code]",
        String(block && block.promptText ? block.promptText : "").trim()
    ].filter(Boolean).join("\n");
}

function extractScopedPatchCode(rawText) {
    const source = String(rawText || "").trim();
    if (!source) return "";
    const fencedMatch = source.match(/```[a-zA-Z0-9_+\-]*\s*([\s\S]*?)```/);
    if (fencedMatch && fencedMatch[1] != null) {
        return String(fencedMatch[1]).trim();
    }
    return source.replace(/^`+|`+$/g, "").trim();
}

function applyScopedCodePatchToEditor(target, rawText) {
    if (!target || typeof target !== "object") return false;
    const patch = extractScopedPatchCode(rawText);
    if (!patch) return false;

    const fileIndex = Number.isFinite(Number(target.fileIndex)) ? Number(target.fileIndex) : activeFileIndex;
    const editor = document.getElementById("code-editor");
    const currentText = (codeFiles[fileIndex] && typeof codeFiles[fileIndex].content === "string")
        ? String(codeFiles[fileIndex].content || "")
        : (editor ? String(editor.value || "") : "");
    if (!currentText) return false;

    const originalBlock = String(target.sourceText || target.originalBlock || "");
    if (!originalBlock) return false;

    let start = Number.isFinite(Number(target.startOffset)) ? Number(target.startOffset) : -1;
    let end = Number.isFinite(Number(target.endOffset)) ? Number(target.endOffset) : -1;

    if (!(start >= 0 && end >= start && currentText.slice(start, end) === originalBlock)) {
        const foundIndex = currentText.indexOf(originalBlock);
        if (foundIndex < 0) return false;
        start = foundIndex;
        end = foundIndex + originalBlock.length;
    }

    const merged = currentText.slice(0, start) + patch + currentText.slice(end);
    if (codeFiles[fileIndex]) {
        codeFiles[fileIndex].content = merged;
    }
    if (fileIndex === activeFileIndex && editor) {
        editor.value = merged;
    }
    renderCodeTabs();
    if (typeof window.refreshHtmlPreview === "function") {
        try { window.refreshHtmlPreview(); } catch (error) {}
    }
    return true;
}

function renderCodeBlockActions() {
    renderPromptAttachmentRow();
    renderStructuredCodeEditor();
}

function scheduleCodeBlockActionsRender() {
    if (codeBlockRenderTimer) clearTimeout(codeBlockRenderTimer);
    codeBlockRenderTimer = setTimeout(() => {
        codeBlockRenderTimer = null;
        renderCodeBlockActions();
    }, 120);
}

window.requestScopedCodeEdit = function(blockIndex) {
    attachScopedCodeBlockToPrompt(blockIndex);
};

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
    renderCodeBlockActions();
}

function switchTab(index) {
    if (typeof clearPendingScopedCodeAttachment === "function") {
        clearPendingScopedCodeAttachment({ silent: true });
    }
    activeFileIndex = index;
    renderCodeTabs();
    const editor = document.getElementById("code-editor");
    if (editor && codeFiles[index]) {
        editor.value = codeFiles[index].content;
    }
}

function resetChat(silent = false) {
    if (isGenerating || window.__ISAI_MAIN_GENERATING__) stopGeneration();
    clearCharacterChatSession();
    
    chatHistory =[];
    codeFiles =[];
    activeFileIndex = 0;
    structuredCodeBlocksState = [];
    pendingScopedCodeAttachment = null;
    
    const chatBox = document.getElementById("chat-box");
    chatBox.style.display = "flex";
    chatBox.style.flexDirection = "column";
    chatBox.style.justifyContent = "normal";
    chatBox.innerHTML = "";
    
    const viewId = new URLSearchParams(window.location.search).get("v");
    
    document.getElementById("code-tabs").innerHTML = getCodePanelEmptyMarkup();
    document.getElementById("code-editor").value = "";
    scopedCodeBlocks = [];
    renderCodeBlockActions();
    
    document.body.classList.remove("started");
    document.body.classList.remove("mode-code");
    isStarted = false;
    document.getElementById("custom-scrollbar").style.display = "none";
    
    if (activeApp) exitAppMode();
    if (isMenuOpen) toggleStoreMenu();
    
    document.getElementById("prompt-input").value = "";
    setMode("chat");
    if (!silent && typeof showToast === "function") {
        showToast("Chat Reset Completed");
    }
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
    if (typeof clearPendingScopedCodeAttachment === "function") {
        clearPendingScopedCodeAttachment({ silent: true });
    }
    activeFileIndex = index;
    renderCodeTabs();
    const editor = document.getElementById("code-editor");
    if (editor && codeFiles[index]) {
        editor.value = codeFiles[index].content;
    }
};
