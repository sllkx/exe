function normalizeLegacyAiBubbleHtml(bubble) {
            if (!bubble) return;
            const raw = String(bubble.innerHTML ?? '');
            if (!raw.includes('&lt;') && !raw.includes('&gt;') && !raw.includes('\n')) return;
            bubble.innerHTML = raw
                .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
                .replace(/\n/g, '<br>');
        }

        function cleanLegacyAiEntry(entry) {
            if (!entry || entry.nodeType !== 1) return;
            if (entry.dataset && entry.dataset.aicleaned === '1') return;

            const avatar = entry.querySelector('.chat-entry-avatar, div.relative.flex-shrink-0');
            if (avatar) avatar.remove();

            const nameLabel = entry.querySelector('.chat-entry-name, div.flex.flex-col > span');
            if (nameLabel) nameLabel.remove();

            const textWrap = entry.querySelector('.chat-entry-body, div.flex.flex-col');
            if (textWrap) textWrap.style.maxWidth = '85%';

            const bubble = entry.querySelector('.chat-bubble-ai, .chat-entry-body > div, div.flex.flex-col > div');
            if (bubble) normalizeLegacyAiBubbleHtml(bubble);

            if (entry.dataset) entry.dataset.aicleaned = '1';
        }

        function stripLegacyAiProfiles(rootNode) {
            const chatBox = document.getElementById('chat-box');
            if (!chatBox) return;

            const selector = 'div.group.w-full.items-start, .chat-entry.ai-entry';
            if (rootNode && rootNode.nodeType === 1) {
                if (rootNode.matches && rootNode.matches(selector)) cleanLegacyAiEntry(rootNode);
                rootNode.querySelectorAll && rootNode.querySelectorAll(selector).forEach(cleanLegacyAiEntry);
                return;
            }

            chatBox.querySelectorAll(selector).forEach(cleanLegacyAiEntry);
        }

        function scheduleLegacyCleanup(rootNode) {
            if (window.__legacyCleanupPending) return;
            window.__legacyCleanupPending = true;
            requestAnimationFrame(() => {
                window.__legacyCleanupPending = false;
                stripLegacyAiProfiles(rootNode);
            });
        }

        function handleInput(el) {
            el.style.height = 'auto';
            const maxHeight = window.innerWidth <= 900 ? 64 : 72;
            const nextHeight = Math.min(el.scrollHeight, maxHeight);
            el.style.height = nextHeight + 'px';
            el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }

        function toggleChatFullscreen() {
            const island = document.querySelector('.island-box');
            if (!island) return;

            if (!document.fullscreenElement) {
                if (island.requestFullscreen) island.requestFullscreen();
                else if (island.webkitRequestFullscreen) island.webkitRequestFullscreen();
            } else if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }

        function syncFullscreenIcon() {
            const icon = document.getElementById('icon-fullscreen');
            if (!icon) return;
            const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
            icon.className = fullscreenElement
                ? 'ri-fullscreen-exit-line text-[14px]'
                : 'ri-fullscreen-line text-[14px]';
        }
        function copyCodeEditorContent() {
            const editor = document.getElementById('code-editor');
            const text = editor ? String(editor.value || '') : '';
            if (!text.trim()) return;
            const onSuccess = () => {
                if (typeof showToast === 'function') showToast('Copied');
            };
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(text).then(onSuccess).catch(function () {});
                return;
            }
            const helper = document.createElement('textarea');
            helper.value = text;
            helper.style.position = 'fixed';
            helper.style.opacity = '0';
            document.body.appendChild(helper);
            helper.select();
            try {
                document.execCommand('copy');
                onSuccess();
            } catch (error) {}
            helper.remove();
        }
        window.copyCodeEditorContent = copyCodeEditorContent;
        const HTML_PREVIEW_STORAGE_KEY = 'ISAI_HTML_PREVIEW_ENABLED';
        try { localStorage.setItem(HTML_PREVIEW_STORAGE_KEY, '0'); } catch (e) {}
        function isHtmlPreviewEnabled() {
            return localStorage.getItem(HTML_PREVIEW_STORAGE_KEY) === '1';
        }
        function looksLikeHtmlDocument(text) {
            const value = String(text || '').trim().toLowerCase();
            if (!value) return false;
            return value.includes('<html') || value.includes('<body') || value.includes('<div') || value.includes('<script') || value.includes('<!doctype html');
        }
        function injectPreviewReset(htmlText) {
            const resetStyle = '<style id="isai-preview-reset">html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;}body{box-sizing:border-box;}*,*:before,*:after{box-sizing:inherit;}</style>';
            const html = String(htmlText || '');
            if (/<head[^>]*>/i.test(html)) {
                return html.replace(/<head[^>]*>/i, function(match){ return match + resetStyle; });
            }
            if (/<html[^>]*>/i.test(html)) {
                return html.replace(/<html[^>]*>/i, function(match){ return match + '<head>' + resetStyle + '</head>'; });
            }
            return '<!doctype html><html><head>' + resetStyle + '</head><body>' + html + '</body></html>';
        }
        function setHtmlPreviewButtonState(enabled) {
            const btn = document.getElementById('code-html-preview-toggle');
            if (!btn) return;
            btn.classList.toggle('is-active', !!enabled);
        }
        function refreshHtmlPreview() {
            const frame = document.getElementById('html-preview-frame');
            const editor = document.getElementById('code-editor');
            if (!frame || !editor) return;
            const codeText = String(editor.value || '');
            const previewHtml = looksLikeHtmlDocument(codeText)
                ? injectPreviewReset(codeText)
                : `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:100%;height:100%;background:#0f1115;color:#f3f4f6;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}pre{margin:0;padding:0;white-space:pre-wrap;word-break:break-word}</style></head><body><pre>${codeText.replace(/[&<>]/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;'})[ch]; })}</pre></body></html>`;
            frame.srcdoc = previewHtml;
        }
        function clearHtmlPreview() {
            const frame = document.getElementById('html-preview-frame');
            if (!frame) return;
            frame.removeAttribute('src');
            frame.srcdoc = '';
        }
        function applyHtmlPreviewState() {
            const pane = document.getElementById('html-preview-pane');
            const enabled = isHtmlPreviewEnabled();
            if (document.body) document.body.classList.toggle('html-preview-active', enabled);
            if (pane) pane.classList.toggle('hidden', !enabled);
            setHtmlPreviewButtonState(enabled);
            if (enabled) {
                refreshHtmlPreview();
            } else {
                clearHtmlPreview();
            }
        }
        function toggleHtmlPreview(forceValue) {
            const next = typeof forceValue === 'boolean' ? forceValue : !isHtmlPreviewEnabled();
            localStorage.setItem(HTML_PREVIEW_STORAGE_KEY, next ? '1' : '0');
            applyHtmlPreviewState();
        }
        function bindHtmlPreviewEditor() {
            const editor = document.getElementById('code-editor');
            if (!editor || editor.dataset.previewBound === '1') return;
            // Manual refresh mode: do not auto-render on editor input.
            editor.dataset.previewBound = '1';
        }
        window.toggleHtmlPreview = toggleHtmlPreview;
        window.refreshHtmlPreview = refreshHtmlPreview;
        window.clearHtmlPreview = clearHtmlPreview;
        function getGitHubSettings() {
            return {
                username: String(localStorage.getItem('ISAI_GH_USERNAME') || '').trim(),
                repo: String(localStorage.getItem('ISAI_GH_REPO') || '').trim(),
                token: String(localStorage.getItem('ISAI_GH_TOKEN') || '').trim()
            };
        }
        async function resolveGitHubIdentity(token, fallbackUsername) {
            const fallback = String(fallbackUsername || '').trim();
            if (!token) return fallback;
            try {
                const res = await fetch('https://api.github.com/user', {
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Accept': 'application/vnd.github+json'
                    }
                });
                const json = await res.json();
                const login = String((json && json.login) || '').trim();
                return login || fallback;
            } catch (e) {
                return fallback;
            }
        }
        function saveGitHubSettings() {
            const usernameEl = document.getElementById('gh-username');
            const repoEl = document.getElementById('gh-repo');
            const tokenEl = document.getElementById('gh-token');
            const username = usernameEl ? String(usernameEl.value || '').trim() : '';
            const repo = repoEl ? String(repoEl.value || '').trim() : '';
            const token = tokenEl ? String(tokenEl.value || '').trim() : '';
            if (!token) {
                if (typeof showToast === 'function') showToast('Token 필요');
                return false;
            }
            localStorage.setItem('ISAI_GH_USERNAME', username);
            localStorage.setItem('ISAI_GH_REPO', repo);
            localStorage.setItem('ISAI_GH_TOKEN', token);
            if (typeof showToast === 'function') showToast('GitHub 설정 저장 완료');
            return true;
        }
        function openGitHubConnectModal() {
            const modal = document.getElementById('gh-connect-modal');
            if (!modal) return;
            const settings = getGitHubSettings();
            const usernameEl = document.getElementById('gh-username');
            const repoEl = document.getElementById('gh-repo');
            const tokenEl = document.getElementById('gh-token');
            if (usernameEl) usernameEl.value = settings.username || '';
            if (repoEl) repoEl.value = settings.repo || '';
            if (tokenEl) tokenEl.value = settings.token || '';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        function closeGitHubConnectModal() {
            const modal = document.getElementById('gh-connect-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        async function ensureRepoExists(username, repo, token) {
            const repoName = String(repo || '').trim() || 'isai-playground';
            const checkRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}`, {
                headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
            });
            if (checkRes.ok) return repoName;

            const createRes = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token,
                    'Accept': 'application/vnd.github+json'
                },
                body: JSON.stringify({
                    name: repoName,
                    description: 'ISAI Playground Publish',
                    private: false,
                    auto_init: true
                })
            });
            if (!createRes.ok) {
                const raw = await createRes.text();
                let err = {};
                try { err = JSON.parse(raw); } catch (e) {}
                throw new Error((err && err.message) ? err.message : 'Repository create failed');
            }
            return repoName;
        }
        async function publishCodeToGitHub(forceFromModal) {
            const editor = document.getElementById('code-editor');
            const codeText = editor ? String(editor.value || '').trim() : '';
            if (!codeText) {
                if (typeof showToast === 'function') showToast('Code is empty.');
                return;
            }

            if (forceFromModal === true) {
                if (!saveGitHubSettings()) return;
            }
            const settings = getGitHubSettings();
            if (!settings.token) {
                openGitHubConnectModal();
                return;
            }

            const fileNameInput = window.prompt('File name (ex: app.js)', 'app.js');
            if (fileNameInput === null) return;
            const fileName = String(fileNameInput || '').trim() || 'app.js';
            const path = 'playground/' + Date.now() + '-' + fileName.replace(/[^\w.\-]/g, '_');

            try {
                if (typeof showLoader === 'function') showLoader(true);
                const owner = await resolveGitHubIdentity(settings.token, settings.username);
                if (!owner) {
                    throw new Error('GitHub username not found');
                }
                localStorage.setItem('ISAI_GH_USERNAME', owner);
                const repoName = await ensureRepoExists(owner, settings.repo, settings.token);
                if (!settings.repo) localStorage.setItem('ISAI_GH_REPO', repoName);

                const putRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/contents/${encodeURIComponent(path)}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + settings.token,
                        'Accept': 'application/vnd.github+json'
                    },
                    body: JSON.stringify({
                        message: 'Publish from ISAI Playground',
                        content: btoa(unescape(encodeURIComponent(codeText)))
                    })
                });
                const putRaw = await putRes.text();
                let putJson = {};
                try { putJson = JSON.parse(String(putRaw || '{}')); } catch (e) {}
                if (!putRes.ok) throw new Error((putJson && putJson.message) ? putJson.message : 'Publish failed');

                const githubUrl = `https://github.com/${owner}/${repoName}/blob/main/${path}`;
                const runUrl = `https://cdn.jsdelivr.net/gh/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}@main/${path}`;
                try {
                    await fetch('re_store.php?action=save_code_publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            gist_id: `${owner}/${repoName}:${path}`,
                            gist_url: githubUrl,
                            run_url: runUrl,
                            title: repoName,
                            file_name: fileName,
                            language: (fileName.split('.').pop() || 'txt').slice(0, 20),
                            source_type: 'github',
                            code: codeText
                        })
                    });
                } catch (saveError) {}

                closeGitHubConnectModal();
                if (typeof showToast === 'function') showToast('Published to GitHub');
                if ((fileName || '').toLowerCase().endsWith('.html')) {
                    window.open(runUrl, '_blank', 'noopener');
                } else {
                    window.open(githubUrl, '_blank', 'noopener');
                }
            } catch (error) {
                if (typeof showToast === 'function') showToast('Publish failed: ' + (error.message || 'Unknown'));
            } finally {
                if (typeof showLoader === 'function') showLoader(false);
            }
        }
        window.openGitHubConnectModal = openGitHubConnectModal;
        window.closeGitHubConnectModal = closeGitHubConnectModal;
        window.saveGitHubSettings = saveGitHubSettings;
        window.publishCodeToGitHub = publishCodeToGitHub;
        function setBoardRailActive(tab) {
            document.querySelectorAll('#board-right-rail [data-board-tab]').forEach((button) => {
                button.classList.toggle('active', button.dataset.boardTab === tab);
            });
        }
        function openBoardRailTab(tab) {
            setBoardRailActive(tab);
            if (window.$boardApp && typeof window.$boardApp.switchTab === 'function') {
                window.$boardApp.switchTab(tab);
            }
            const boardContainer = document.getElementById('board-container');
            if (boardContainer) {
                window.scrollTo({
                    top: Math.max(0, boardContainer.getBoundingClientRect().top + window.scrollY - 12),
                    behavior: 'smooth'
                });
            }
        }
        window.addEventListener('board-tab-change', function (event) {
            const tab = event && event.detail && event.detail.tab ? event.detail.tab : 'news';
            setBoardRailActive(tab);
        });
        window.onload = () => { 
            const textarea = document.getElementById('prompt-input');
            if(textarea) {
                textarea.removeAttribute('placeholder');
                textarea.placeholder = '';
                handleInput(textarea);
            }
            stripLegacyAiProfiles();

            const chatBox = document.getElementById('chat-box');
            if (chatBox && !window.__legacyAiProfileObserver) {
                const observer = new MutationObserver((mutations) => {
                    let targetNode = null;
                    for (const mutation of mutations) {
                        if (!mutation.addedNodes || mutation.addedNodes.length === 0) continue;
                        for (const node of mutation.addedNodes) {
                            if (node && node.nodeType === 1) {
                                targetNode = node;
                                break;
                            }
                        }
                        if (targetNode) break;
                    }
                    if (targetNode) scheduleLegacyCleanup(targetNode);
                });
                observer.observe(chatBox, { childList: true, subtree: false });
                window.__legacyAiProfileObserver = observer;
            }
            __handleChatFullscreenChange();
            setBoardRailActive('news');
        }

        let selectedMode = 'chat';

        function syncInlineCodePanel(mode) {
            mode = mode || 'chat';
            if (document.body) document.body.setAttribute('data-ui-mode', mode);
            const rightPanel = document.getElementById('right-panel');
            const codeTabs = document.getElementById('code-tabs');
            const codeEditor = document.getElementById('code-editor');
            const topZone = document.getElementById('top-zone');
            const chatBox = document.getElementById('chat-box');
            const chatInputShell = document.getElementById('chat-input-shell');
            const rightPanelOriginAnchor = document.getElementById('right-panel-origin-anchor');
            const desktopCodePanelHost = document.getElementById('desktop-code-panel-host');
            const isCodeMode = mode === 'code';
            const vw = window.innerWidth || document.documentElement.clientWidth || 0;
            const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || null;
            const fullscreenActive = !!(fullscreenElement && fullscreenElement.classList && fullscreenElement.classList.contains('island-box'));
            const mobileCodeMode = isCodeMode && vw <= 900;
            const desktopCodeMode = isCodeMode && vw > 900;
            const codePanelGridColumn = vw <= 1180 ? '1 / span 2' : '1 / span 4';
            const codePanelGridRow = vw <= 900 ? '2' : (vw <= 1180 ? '3' : '2');
            const codePanelMinHeight = vw <= 900 ? '240px' : '320px';
            const codePanelMaxHeight = vw <= 900 ? '360px' : '520px';

            if (!rightPanel) {
                if (typeof __applyMobileChatRailSafety === 'function') {
                    setTimeout(__applyMobileChatRailSafety, 0);
                }
                return;
            }

            if (rightPanelOriginAnchor && rightPanelOriginAnchor.parentElement && desktopCodePanelHost) {
                if (desktopCodeMode && !fullscreenActive) {
                    desktopCodePanelHost.style.display = 'block';
                    desktopCodePanelHost.style.width = '100%';
                    desktopCodePanelHost.style.minWidth = '0';
                    desktopCodePanelHost.style.minHeight = codePanelMinHeight;
                    desktopCodePanelHost.style.visibility = 'visible';
                    desktopCodePanelHost.style.opacity = '1';
                    if (rightPanel.parentElement !== desktopCodePanelHost) {
                        desktopCodePanelHost.appendChild(rightPanel);
                    }
                } else {
                    desktopCodePanelHost.style.display = 'none';
                    desktopCodePanelHost.style.removeProperty('min-height');
                    desktopCodePanelHost.style.removeProperty('visibility');
                    desktopCodePanelHost.style.removeProperty('opacity');
                    desktopCodePanelHost.style.removeProperty('overflow');
                    if (rightPanel.parentElement !== rightPanelOriginAnchor.parentElement) {
                        rightPanelOriginAnchor.parentElement.insertBefore(rightPanel, rightPanelOriginAnchor.nextSibling);
                    }
                }
            }

            document.body.classList.toggle('mode-code', mobileCodeMode);
            document.body.classList.toggle('desktop-code-open', desktopCodeMode);
            document.body.classList.toggle('desktop-code-panel-mounted', desktopCodeMode && !fullscreenActive);
            document.body.classList.remove('desktop-code-stage');
            rightPanel.classList.toggle('mobile-active', mobileCodeMode);

            if (isCodeMode) {
                bindHtmlPreviewEditor();
                if (codeTabs && !codeTabs.querySelector('.code-tab-btn')) {
                    codeTabs.innerHTML = '<div class="code-panel-empty"><span class="code-panel-empty-icon"><i class="ri-ai-generate-text text-sm"></i></span><span class="code-panel-empty-dots" aria-hidden="true"><span></span><span></span><span></span></span></div>';
                }

                if (codeEditor && !String(codeEditor.value || '').trim()) {
                    codeEditor.value = '// Describe the code you want and generated files will appear here.';
                }
                applyHtmlPreviewState();

                rightPanel.classList.remove('hidden');
                rightPanel.style.setProperty('display', 'flex', 'important');
                rightPanel.style.setProperty('visibility', 'visible', 'important');
                rightPanel.style.setProperty('opacity', '1', 'important');
                rightPanel.style.setProperty('width', '100%', 'important');
                rightPanel.style.setProperty('min-width', '0', 'important');
                rightPanel.style.setProperty('max-width', '100%', 'important');
                if (mobileCodeMode) {
                    rightPanel.style.setProperty('grid-row', codePanelGridRow, 'important');
                    rightPanel.style.setProperty('grid-column', codePanelGridColumn, 'important');
                } else {
                    rightPanel.style.removeProperty('grid-row');
                    rightPanel.style.removeProperty('grid-column');
                }
                rightPanel.style.setProperty('height', 'auto', 'important');
                rightPanel.style.setProperty('min-height', codePanelMinHeight, 'important');
                rightPanel.style.setProperty('max-height', codePanelMaxHeight, 'important');
                rightPanel.style.setProperty('overflow', 'hidden', 'important');
                rightPanel.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.06)', 'important');
                if (topZone) {
                    topZone.style.setProperty('display', 'flex', 'important');
                    topZone.style.setProperty('visibility', 'visible', 'important');
                    topZone.style.setProperty('opacity', '1', 'important');
                }
                if (chatBox) {
                    chatBox.classList.remove('hidden');
                    chatBox.style.setProperty('display', 'flex', 'important');
                    chatBox.style.setProperty('visibility', 'visible', 'important');
                    chatBox.style.setProperty('opacity', '1', 'important');
                }
                if (chatInputShell) {
                    chatInputShell.classList.remove('hidden');
                    chatInputShell.style.setProperty('display', 'flex', 'important');
                    chatInputShell.style.setProperty('visibility', 'visible', 'important');
                    chatInputShell.style.setProperty('opacity', '1', 'important');
                }
            } else {
                clearHtmlPreview();
                if (document.body) document.body.classList.remove('html-preview-active');
                document.body.classList.remove('desktop-code-stage');
                document.body.classList.remove('desktop-code-open');
                document.body.classList.remove('desktop-code-panel-mounted');
                rightPanel.classList.remove('mobile-active');
                rightPanel.classList.add('hidden');
                if (typeof __resetChatFullscreenLayoutStyles === 'function') {
                    __resetChatFullscreenLayoutStyles();
                }
                if (desktopCodePanelHost) {
                    desktopCodePanelHost.style.display = 'none';
                    desktopCodePanelHost.style.removeProperty('min-height');
                    desktopCodePanelHost.style.removeProperty('visibility');
                    desktopCodePanelHost.style.removeProperty('opacity');
                    desktopCodePanelHost.style.removeProperty('overflow');
                }
                if (rightPanelOriginAnchor && rightPanelOriginAnchor.parentElement && rightPanel.parentElement !== rightPanelOriginAnchor.parentElement) {
                    rightPanelOriginAnchor.parentElement.insertBefore(rightPanel, rightPanelOriginAnchor.nextSibling);
                }
                __clearInlineStyleProps(rightPanel, ['display', 'visibility', 'opacity', 'width', 'min-width', 'max-width', 'grid-row', 'grid-column', 'height', 'min-height', 'max-height', 'overflow', 'border-top']);
                __clearInlineStyleProps(topZone, ['display', 'visibility', 'opacity']);
                __clearInlineStyleProps(chatBox, ['display', 'visibility', 'opacity']);
                __clearInlineStyleProps(chatInputShell, ['display', 'visibility', 'opacity']);
            }

            if (typeof __applyMobileChatRailSafety === 'function') {
                [0, 60, 160, 360].forEach(function(delay) {
                    setTimeout(__applyMobileChatRailSafety, delay);
                });
            }
        }
        window.syncInlineCodePanel = syncInlineCodePanel;

        function setStoreMenuState(open) {
            const shouldOpen = !!open;
            const chatStack = document.getElementById('chat-main-stack');
            const topZone = document.getElementById('top-zone');
            const storePanel = document.getElementById('store-panel');
            const appPanel = document.getElementById('app-container');
            const btnMenu = document.getElementById('btn-menu');
            const iconMenu = document.getElementById('icon-menu');
            const promptInput = document.getElementById('prompt-input');

            if (chatStack) chatStack.classList.toggle('menu-mode', shouldOpen);
            if (topZone) topZone.classList.toggle('menu-mode', shouldOpen);
            if (storePanel) storePanel.classList.toggle('open', shouldOpen);
            if (appPanel) appPanel.classList.remove('open');
            if (chatStack) {
                if (shouldOpen) {
                    chatStack.style.setProperty('height', '100%', 'important');
                    chatStack.style.setProperty('min-height', '0', 'important');
                    chatStack.style.setProperty('max-height', '100%', 'important');
                } else {
                    chatStack.style.removeProperty('height');
                    chatStack.style.removeProperty('min-height');
                    chatStack.style.removeProperty('max-height');
                }
            }
            if (topZone) {
                if (shouldOpen) {
                    topZone.style.setProperty('display', 'none', 'important');
                    topZone.style.setProperty('height', '0', 'important');
                    topZone.style.setProperty('min-height', '0', 'important');
                    topZone.style.setProperty('max-height', '0', 'important');
                    topZone.style.setProperty('flex', '0 0 auto', 'important');
                    topZone.style.setProperty('padding', '0', 'important');
                    topZone.style.setProperty('margin', '0', 'important');
                    topZone.style.setProperty('overflow', 'hidden', 'important');
                    topZone.style.setProperty('visibility', 'hidden', 'important');
                    topZone.style.setProperty('opacity', '0', 'important');
                } else {
                    topZone.style.removeProperty('display');
                    topZone.style.removeProperty('height');
                    topZone.style.removeProperty('min-height');
                    topZone.style.removeProperty('max-height');
                    topZone.style.removeProperty('flex');
                    topZone.style.removeProperty('padding');
                    topZone.style.removeProperty('margin');
                    topZone.style.removeProperty('overflow');
                    topZone.style.removeProperty('visibility');
                    topZone.style.removeProperty('opacity');
                }
            }
            if (btnMenu) {
                btnMenu.classList.toggle('menu-open', shouldOpen);
                btnMenu.classList.toggle('text-white', shouldOpen);
            }
            if (iconMenu) {
                iconMenu.className = shouldOpen ? 'ri-draggable text-xl' : 'ri-draggable text-lg';
            }
            if (typeof isMenuOpen !== 'undefined') isMenuOpen = shouldOpen;
            window.isMenuOpen = shouldOpen;

            if (shouldOpen && typeof fetchStoreApps === 'function') {
                const query = promptInput ? promptInput.value.trim() : '';
                fetchStoreApps(query, false);
            }
            if (typeof __applyMobileChatRailSafety === 'function') {
                [0, 40, 120, 260].forEach(function(delay) {
                    setTimeout(__applyMobileChatRailSafety, delay);
                });
            }
        }
        window.setStoreMenuState = setStoreMenuState;

        function setMode(mode) {
            mode = mode || 'chat';
            if (mode !== 'chat' && typeof window.clearCharacterChatSession === 'function') {
                try { window.clearCharacterChatSession(); } catch (error) {}
            }
            if (document.body) document.body.setAttribute('data-ui-mode', mode);
            if (typeof window.setStoreMenuState === 'function') {
                window.setStoreMenuState(false);
            }
            selectedMode = mode;
            try { if (typeof currentMode !== 'undefined') currentMode = mode; } catch (e) {}
            window.currentMode = mode;
            window.selectedMode = mode;
            document.querySelectorAll('.btn-icon').forEach(b => b.classList.remove('active', 'text-white', 'bg-[#262626]'));
            const btn = document.getElementById('btn-' + mode);
            if(btn) btn.classList.add('active', 'text-white', 'bg-[#262626]');
            
            const commTools = document.getElementById('community-tools');
            if(commTools) commTools.style.display = (mode === 'community') ? 'flex' : 'none';
            
            const musicWrap = document.getElementById('music-duration-wrapper');
            const transLeft = document.getElementById('translation-left-wrapper');
            const transRight = document.getElementById('translation-right-wrapper');
            
            if(musicWrap) musicWrap.style.display = (mode === 'music') ? 'flex' : 'none';
            if(transLeft) transLeft.style.display = (mode === 'translate') ? 'block' : 'none';
            if(transRight) transRight.style.display = (mode === 'translate') ? 'block' : 'none';

            syncInlineCodePanel(mode);
            if (typeof window.syncLocalModelTierVisibility === 'function') {
                window.syncLocalModelTierVisibility(mode);
            }

            if (mode === 'code') {
                if (typeof window.exitAppMode === 'function' && window.activeApp) {
                    try { window.exitAppMode(); } catch (error) {}
                }
                return;
            }

            if(typeof window.setAppMode === 'function') window.setAppMode(mode);
        }

        function toggleStoreMenu() {
            const chatStack = document.getElementById('chat-main-stack');
            const shouldOpen = !(chatStack && chatStack.classList.contains('menu-mode'));
            if (shouldOpen && typeof window.currentMode !== 'undefined' && window.currentMode !== 'chat' && typeof window.setMode === 'function') {
                window.setMode('chat');
            }
            if (typeof window.setStoreMenuState === 'function') {
                window.setStoreMenuState(shouldOpen);
            }
        }

        async function executeAction(direction) {
            const input = document.getElementById('prompt-input');
            const val = input.value.trim();
            if (!val) return;

            const btn = document.getElementById('btn-submit');
            const originalIcon = btn.innerHTML;
            
            btn.innerHTML = '<i class="ri-loader-4-line animate-spin text-xl"></i>';
            btn.disabled = true;

            try {
                if (selectedMode !== 'community') {
                    const targetUrl = `https://isai.kr/?${selectedMode}=${encodeURIComponent(val)}`;
                    window.location.href = targetUrl;
                } else {
                    alert("Backend Logic needed for comment: " + val);
                    input.value = ''; 
                    handleInput(input);
                }
            } catch (e) {
                console.error(e);
                alert("Error occurred.");
            } finally {
                btn.innerHTML = originalIcon;
                btn.disabled = false;
            }
        }
        
        const canvas = document.getElementById('star-canvas');
        if(canvas) { /* Star Logic */ }








async function downloadCurrentImage() {
    const img = document.getElementById('preview-img');
    const promptText = document.getElementById('modal-prompt-text').innerText;
    
    if (!img || !img.src || img.src.includes('isailogo2.png')) {
        alert("Download failed: No image found.");
        return;
    }

    try {
        const btn = event.currentTarget;
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> <span>SAVING...</span>';
        btn.disabled = true;

        const response = await fetch(img.src);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        const fileName = promptText.substring(0, 20).replace(/[/\\?%*:|"<>]/g, '-') || 'isai-art';
        a.download = `isai_${fileName}.png`;
        
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        btn.innerHTML = originalContent;
        btn.disabled = false;
        
    } catch (error) {
        console.error("Download error:", error);
        window.open(img.src, '_blank');
        
        const btn = document.querySelector('button[onclick="downloadCurrentImage()"]');
        if(btn) {
            btn.innerHTML = '<i class="ri-download-2-line"></i> <span>DOWNLOAD</span>';
            btn.disabled = false;
        }
    }
}

window.addEventListener('load', () => {
    const shareCtx = window.__ISAI_SHARE_CONTEXT__ || {};
    const phpPrompt = String(shareCtx.prompt || "").trim();
    const phpDate = String(shareCtx.date || "");
    const sharedImg = String(shareCtx.image || "");
    const isSharedView = shareCtx.isShared ? "true" : "false";

    if (isSharedView === 'true' && sharedImg && !sharedImg.includes('isailogo2.png')) {
        setTimeout(() => {
            openImageModal(sharedImg, phpPrompt, phpDate);
            
            if (typeof setMode === 'function') setMode('image');
        }, 100);
    }
});

function openImageModal(url, prompt = '', date = '') {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('preview-img');
    const promptEl = document.getElementById('modal-prompt-text');
    const dateEl = document.getElementById('modal-date-text');

    if (!url || url.includes('_____________________isailogo2.png')) return;

    img.src = url;

    const finalPrompt = (prompt || window.currentImagePrompt || "AI Generated Art").replace('2x2 grid', '').trim();
    const finalDate = date || new Date().toLocaleString();

    if (promptEl) promptEl.innerText = finalPrompt;
    if (dateEl) dateEl.innerText = finalDate;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

document.addEventListener('click', function(e) {
    const targetImg = e.target.closest('img');
    
    if (targetImg && (targetImg.closest('#chat-box') || targetImg.closest('#app-grid'))) {

        if (targetImg.classList.contains('h-12') || targetImg.id === 'comm-preview-img') return;

        const imgUrl = targetImg.src;
        const imgPrompt = targetImg.getAttribute('data-prompt') || targetImg.alt || "";
        
        openImageModal(imgUrl, imgPrompt);
    }
});

window.addEventListener('load', () => {
    const shareCtx = window.__ISAI_SHARE_CONTEXT__ || {};
    const phpPrompt = String(shareCtx.prompt || "").trim();
    const phpDate = String(shareCtx.date || "");
    const sharedImg = String(shareCtx.image || "");
    const isSharedView = shareCtx.isShared ? "true" : "false";

    if (isSharedView === 'true' && sharedImg && !sharedImg.includes('isailogo2.png')) {
        setTimeout(() => {
            openImageModal(sharedImg, phpPrompt, phpDate);
            if (typeof setMode === 'function') setMode('image');
        }, 300);
    }
});

const imgModalLayer = document.getElementById('image-modal');
if (imgModalLayer) {
    imgModalLayer.addEventListener('click', function(e) {
        if (e.target === this) closeImageModal();
    });
}

function getImageReportI18n() {
    return window.__ISAI_IMAGE_REPORT_I18N__ || {};
}

function getCurrentShareContext() {
    const ctx = window.__ISAI_SHARE_CONTEXT__ || {};
    return {
        id: Number(ctx.id || 0) || 0,
        isShared: !!ctx.isShared
    };
}

function openImageShareReportModal() {
    const i18n = getImageReportI18n();
    const context = getCurrentShareContext();
    if (!context.isShared || !context.id) {
        if (typeof showToast === 'function') showToast('Saved image post not found.');
        return;
    }
    const modal = document.getElementById('image-report-modal');
    const typeSelect = document.getElementById('image-report-type');
    const textarea = document.getElementById('image-report-reason');
    if (typeSelect) typeSelect.value = '';
    document.querySelectorAll('#image-report-modal .report-type-chip').forEach(function (chip) {
        chip.classList.remove('active');
    });
    if (textarea) textarea.value = '';
    if (modal) modal.classList.remove('hidden');
    if (textarea) textarea.focus();
}

function closeImageShareReportModal() {
    const modal = document.getElementById('image-report-modal');
    if (modal) modal.classList.add('hidden');
}

async function submitImageShareReport() {
    const i18n = getImageReportI18n();
    const context = getCurrentShareContext();
    const typeSelect = document.getElementById('image-report-type');
    const textarea = document.getElementById('image-report-reason');
    const reportType = String(typeSelect?.value || '').trim();
    const reason = String(textarea?.value || '').trim();
    if (!context.isShared || !context.id) {
        if (typeof showToast === 'function') showToast('Saved image post not found.');
        return;
    }
    if (!reportType) {
        if (typeof showToast === 'function') showToast(i18n.typeRequired || 'Please select a report type.');
        return;
    }
    if (!reason) {
        if (typeof showToast === 'function') showToast(i18n.reasonRequired || 'Please enter a report reason.');
        return;
    }
    try {
        const res = await fetch('/re_store.php?action=submit_content_report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_type: 'gallery',
                target_id: context.id,
                report_type: reportType,
                reason
            })
        });
        const data = await res.json();
        if (!data || !data.success) {
            throw new Error((data && data.error) || 'REPORT_FAILED');
        }
        closeImageShareReportModal();
        if (data.deleted) {
            if (typeof showToast === 'function') showToast(i18n.deleted || 'The post was removed after repeated reports.');
            window.setTimeout(() => { window.location.href = '/'; }, 700);
            return;
        }
        if (typeof showToast === 'function') {
            showToast(data.reported ? (i18n.reported || 'Report submitted.') : (i18n.duplicate || 'You already reported this post this month.'));
        }
    } catch (error) {
        console.error(error);
        if (typeof showToast === 'function') showToast(i18n.error || 'An error occurred while submitting the report.');
    }
}

function chooseImageReportType(type, buttonEl) {
    const input = document.getElementById('image-report-type');
    if (input) input.value = String(type || '');
    document.querySelectorAll('#image-report-modal .report-type-chip').forEach(function (chip) {
        chip.classList.remove('active');
    });
    if (buttonEl && buttonEl.classList) buttonEl.classList.add('active');
}

window.openImageShareReportModal = openImageShareReportModal;
window.closeImageShareReportModal = closeImageShareReportModal;
window.submitImageShareReport = submitImageShareReport;
window.chooseImageReportType = chooseImageReportType;

function __getDefaultChatGreeting() {
    const serverI18n = window.ISAI_SERVER_I18N || {};
    if (serverI18n.welcomeMessage) return serverI18n.welcomeMessage;
    return 'Hello! How can I help you? ?삃';
}

function __normalizeDefaultGreeting(message, localeHint) {
    /*
    if (!raw) return '';
    const cleaned = raw.replace(/\???g, '?삃').replace(/\s+/g, ' ').trim();
    if ((String(localeHint || '').toLowerCase().startsWith('ko') || /[???롪?-??/.test(cleaned)) && /?꾩??쒕┫源뚯슂|萸??꾩??쒕┫源뚯슂/.test(cleaned)) {
        return '?덈뀞?섏꽭?? 臾댁뾿???꾩??쒕┫源뚯슂? ?삃';
    }
    return cleaned;
    */
    return String(message || "").replace(/\s+/g, " ").trim();
}

function __getDefaultChatGreeting() {
    const serverI18n = window.ISAI_SERVER_I18N || {};
    const localeHint = String(serverI18n.locale || document.documentElement?.lang || navigator.language || 'ko').toLowerCase();
    if (serverI18n.welcomeMessage) {
        const normalized = __normalizeDefaultGreeting(serverI18n.welcomeMessage, localeHint);
        if (normalized) return normalized;
    }
    return localeHint.startsWith('ko') ? '?덈뀞?섏꽭?? 臾댁뾿???꾩??쒕┫源뚯슂? ?삃' : 'Hello! How can I help you? ?삃';
}

function __normalizeDefaultGreeting(message, localeHint) {
    const raw = String(message || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    const isKoreanLocale = String(localeHint || "").toLowerCase().startsWith("ko");
    const hasKoreanText = /[\u3131-\u318e\uac00-\ud7a3]/.test(raw);
    const hasLegacyPhrase = /\ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694|\ubb50\s*\ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694/.test(raw);
    if ((isKoreanLocale || hasKoreanText) && hasLegacyPhrase) {
        return "\uc548\ub155\ud558\uc138\uc694. \ubb34\uc5c7\uc744 \ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694? \ud83d\ude0a";
    }
    return raw;
}

function __getDefaultChatGreeting() {
    const serverI18n = window.ISAI_SERVER_I18N || {};
    const localeHint = String(serverI18n.locale || document.documentElement?.lang || navigator.language || "ko").toLowerCase();
    if (serverI18n.welcomeMessage) {
        const normalized = __normalizeDefaultGreeting(serverI18n.welcomeMessage, localeHint);
        if (normalized) return normalized;
    }
    return localeHint.startsWith("ko")
        ? "\uc548\ub155\ud558\uc138\uc694. \ubb34\uc5c7\uc744 \ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694? \ud83d\ude0a"
        : "Hello! How can I help you? \ud83d\ude0a";
}

/*
// Final override to guarantee a clean default greeting even when legacy strings are garbled.
function __normalizeDefaultGreeting(message, localeHint) {
    const raw = String(message || "").replace(/\???g, "\ud83d\ude0a").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    const isKoreanLocale = String(localeHint || "").toLowerCase().startsWith("ko");
    const hasKoreanText = /[\u3131-\u318e\uac00-\ud7a3]/.test(raw);
    const hasLegacyPhrase = /\ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694|\ubb50\s*\ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694/.test(raw);
    if ((isKoreanLocale || hasKoreanText) && hasLegacyPhrase) {
        return "\uc548\ub155\ud558\uc138\uc694. \ubb34\uc5c7\uc744 \ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694? \ud83d\ude0a";
    }
    if (isKoreanLocale && !hasKoreanText) {
        return "\uc548\ub155\ud558\uc138\uc694. \ubb34\uc5c7\uc744 \ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694? \ud83d\ude0a";
    }
    return raw;
}

function __getDefaultChatGreeting() {
    const serverI18n = window.ISAI_SERVER_I18N || {};
    const localeHint = String(serverI18n.locale || document.documentElement?.lang || navigator.language || "ko").toLowerCase();
    if (serverI18n.welcomeMessage) {
        const normalized = __normalizeDefaultGreeting(serverI18n.welcomeMessage, localeHint);
        if (normalized) return normalized;
    }
    if (localeHint.startsWith("ko")) {
        return "\uc548\ub155\ud558\uc138\uc694. \ubb34\uc5c7\uc744 \ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694? \ud83d\ude0a";
    }
    return "Hello! How can I help you? \ud83d\ude0a";
}

*/

function __normalizeDefaultGreeting(message, localeHint) {
    const decodeEscaped = (value) => {
        let text = String(value || "");
        for (let i = 0; i < 3; i++) {
            text = text
                .replace(/\\\\u([0-9a-fA-F]{4})/g, function (_, hex) {
                    return String.fromCharCode(parseInt(hex, 16));
                })
                .replace(/\\u([0-9a-fA-F]{4})/g, function (_, hex) {
                    return String.fromCharCode(parseInt(hex, 16));
                })
                .replace(/\\\\x([0-9a-fA-F]{2})/g, function (_, hex) {
                    return String.fromCharCode(parseInt(hex, 16));
                })
                .replace(/\\x([0-9a-fA-F]{2})/g, function (_, hex) {
                    return String.fromCharCode(parseInt(hex, 16));
                });
        }
        return text;
    };
    const raw = decodeEscaped(message).replace(/\s+/g, " ").trim();
    if (!raw) return "";
    const isKoreanLocale = String(localeHint || "").toLowerCase().startsWith("ko");
    const hasKoreanText = /[\u3131-\u318e\uac00-\ud7a3]/.test(raw);
    const hasLegacyPhrase = /\ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694|\ubb50\s*\ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694/.test(raw);
    const hasEnglishLegacy = /hello!\s*how can i help you\??/i.test(raw);
    if ((isKoreanLocale || hasKoreanText) && hasLegacyPhrase) {
        return "\ub85c\uceec\ub85c \ub354 \uc548\uc804\ud558\uac8c \ub300\ud654\ud558\uc138\uc694";
    }
    if (hasEnglishLegacy) {
        return "Chat more safely in local mode";
    }
    if (isKoreanLocale && !hasKoreanText) {
        return "Chat more safely in local mode";
    }
    return raw;
}

function __getDefaultChatGreeting() {
    const serverI18n = window.ISAI_SERVER_I18N || {};
    const localeHint = String(serverI18n.locale || document.documentElement?.lang || navigator.language || "ko").toLowerCase();
    if (serverI18n.welcomeMessage) {
        const normalized = __normalizeDefaultGreeting(serverI18n.welcomeMessage, localeHint);
        if (normalized) return normalized;
    }
    if (localeHint.startsWith("ko")) {
        return "\ub85c\uceec\ub85c \ub354 \uc548\uc804\ud558\uac8c \ub300\ud654\ud558\uc138\uc694";
    }
    return "Chat more safely in local mode";
}

function __activateLocalModeFromGreeting() {
    if (window.isLocalActive) return;
    if (typeof window.handleLocalToggle !== "function") return;
    Promise.resolve(window.handleLocalToggle()).catch(function () {});
}

function __chatBoxHasContent(chatBox) {
    if (!chatBox) return false;
    return Array.from(chatBox.children).some(function(node) {
        if (!node || node.nodeType !== 1) return false;
        if (node.classList && node.classList.contains('chat-spacer')) return false;
        if (node.classList && node.classList.contains('__default-chat-greeting')) return true;
        return !!String(node.textContent || '').trim() || !!node.querySelector('img,video,audio,canvas,iframe,svg');
    });
}

function __ensureChatSpacer(chatBox) {
    if (!chatBox) return null;
    let spacer = chatBox.querySelector('.chat-spacer');
    if (!spacer) {
        spacer = document.createElement('div');
        spacer.className = 'chat-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        chatBox.prepend(spacer);
    }
    return spacer;
}

function __ensureDefaultChatGreeting(force) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    if (force) {
        chatBox.querySelectorAll('.__default-chat-greeting').forEach(function(node) {
            node.remove();
        });
    }

    __ensureChatSpacer(chatBox);
    if (__chatBoxHasContent(chatBox)) return;

    const wrapper = document.createElement('div');
    const body = document.createElement('div');
    const bubble = document.createElement('div');
    const greetingText = __getDefaultChatGreeting();

    wrapper.className = 'chat-entry ai-entry __default-chat-greeting';
    body.className = 'chat-entry-body';
    bubble.className = 'chat-bubble-ai';
    bubble.classList.add('chat-welcome-cta');
    bubble.style.display = 'inline-flex';
    bubble.style.alignItems = 'center';
    bubble.style.gap = '6px';
    bubble.innerHTML = '<span class="chat-welcome-cta-inner" style="display:inline-flex;align-items:center;gap:6px;"><i class="ri-ghost-4-line chat-welcome-cta-icon" aria-hidden="true" style="font-size:15px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;"></i><span class="chat-welcome-cta-text">' + greetingText + '</span></span>';
    bubble.style.cursor = 'pointer';
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('tabindex', '0');
    bubble.setAttribute('title', '로컬모드 활성화');
    bubble.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        __activateLocalModeFromGreeting();
    });
    bubble.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        __activateLocalModeFromGreeting();
    });

    body.appendChild(bubble);
    wrapper.appendChild(body);
    chatBox.appendChild(wrapper);

    if (typeof scrollBottom === 'function') {
        scrollBottom();
    } else {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

function __scheduleDefaultChatGreeting(force) {
    clearTimeout(window.__defaultChatGreetingTimer);
    window.__defaultChatGreetingTimer = setTimeout(function() {
        __ensureDefaultChatGreeting(!!force);
    }, 40);
}

if (typeof window.resetChat === 'function' && !window.__defaultGreetingResetWrapped) {
    const __originalResetChat = window.resetChat;
    window.resetChat = function() {
        const result = __originalResetChat.apply(this, arguments);
        __scheduleDefaultChatGreeting(true);
        return result;
    };
    window.__defaultGreetingResetWrapped = true;
}

if (typeof window.setMode === 'function' && !window.__defaultGreetingModeWrapped) {
    const __originalSetMode = window.setMode;
    window.setMode = function(mode) {
        const result = __originalSetMode.apply(this, arguments);
        if (mode === 'chat') {
            __scheduleDefaultChatGreeting(false);
        }
        return result;
    };
    window.__defaultGreetingModeWrapped = true;
}

window.addEventListener('DOMContentLoaded', function() {
    __scheduleDefaultChatGreeting(false);
});

window.addEventListener('load', function() {
    __scheduleDefaultChatGreeting(false);
    [120, 400, 900].forEach(function(delay) {
        setTimeout(function() {
            __scheduleDefaultChatGreeting(false);
        }, delay);
    });

    const chatBox = document.getElementById('chat-box');
    if (chatBox && !window.__defaultChatGreetingObserver) {
        const observer = new MutationObserver(function() {
            if (!__chatBoxHasContent(chatBox)) {
                __scheduleDefaultChatGreeting(false);
            }
        });
        observer.observe(chatBox, { childList: true });
        window.__defaultChatGreetingObserver = observer;
    }
});

