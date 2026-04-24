function __cleanAdHashAndScrollTop() {
    const h = String(window.location.hash || '');
    const isAdHash = /^#_/i.test(h) || /eniple|mobon|ad/i.test(h);
    if (!isAdHash) return;
    if (history && history.replaceState) {
        history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }
    window.scrollTo(0, 0);
}
__cleanAdHashAndScrollTop();
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.addEventListener('hashchange', __cleanAdHashAndScrollTop);
function __dockToolbarIfNeeded(toolbarArea, ultraNarrow) {
    if (!toolbarArea) return;
    // Keep toolbar in normal layout flow on mobile as requested.
    toolbarArea.style.setProperty('position', 'relative', 'important');
    toolbarArea.style.setProperty('right', 'auto', 'important');
    toolbarArea.style.setProperty('top', 'auto', 'important');
    toolbarArea.style.setProperty('left', 'auto', 'important');
    toolbarArea.style.setProperty('bottom', 'auto', 'important');
}
function __syncAdFrameChildren(adFrame, desktopMode) {
    if (!adFrame) return;
    const nodes = adFrame.querySelectorAll('iframe, object, embed, img');
    nodes.forEach(function (node) {
        if (desktopMode) {
            node.style.width = '';
            node.style.height = '';
            node.style.maxWidth = '';
            node.style.maxHeight = '';
        } else {
            node.style.width = '100%';
            node.style.height = '100%';
            node.style.maxWidth = '100%';
            node.style.maxHeight = '100%';
        }
        node.style.display = 'block';
        node.style.margin = '0 auto';
    });
}
function __measureAdContent(adFrame) {
    if (!adFrame) return { width: 300, height: 250 };
    let width = 300;
    let height = 250;
    const nodes = adFrame.querySelectorAll('iframe, object, embed, img, a, div');
    nodes.forEach(function (node) {
        const rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
        const w = Math.round(
            Math.max(
                rect ? rect.width : 0,
                node.offsetWidth || 0,
                node.clientWidth || 0,
                node.scrollWidth || 0,
                node.naturalWidth || 0
            )
        );
        const h = Math.round(
            Math.max(
                rect ? rect.height : 0,
                node.offsetHeight || 0,
                node.clientHeight || 0,
                node.scrollHeight || 0,
                node.naturalHeight || 0
            )
        );
        if (w > width) width = w;
        if (h > height) height = h;
    });
    return {
        width: Math.max(300, Math.min(336, width)),
        height: Math.max(250, Math.min(280, height))
    };
}
function __clearInlineStyleProps(el, props) {
    if (!el || !el.style || !Array.isArray(props)) return;
    props.forEach(function (prop) {
        el.style.removeProperty(prop);
    });
}
function __resetChatFullscreenLayoutStyles() {
    const island = document.querySelector('.island-box');
    const mainLayout = document.getElementById('main-layout');
    const chatStack = document.getElementById('chat-main-stack');
    const chatInputField = document.getElementById('chat-input-field');
    const promptInput = document.getElementById('prompt-input');
    const toolbarArea = document.getElementById('toolbar-area');
    const controls = document.getElementById('toolbar-main-controls');
    const iconWrap = document.getElementById('icon-scroll-wrapper');
    const iconContainer = document.getElementById('icon-scroll-container');
    const chatInputActions = document.getElementById('chat-input-actions');
    const adWrap = document.getElementById('chat-side-ad');
    const adBody = document.getElementById('chat-side-ad-body');
    const adFrame = document.getElementById('chat-ad-frame');
    const boardRail = document.getElementById('board-right-rail');
    const rightPanel = document.getElementById('right-panel');

    __clearInlineStyleProps(mainLayout, [
        'padding-left',
        'margin-left',
        'width',
        'max-width',
        'height',
        'min-height',
        'flex',
        'display'
    ]);
    __clearInlineStyleProps(island, [
        'position',
        'width',
        'height',
        'min-height',
        'max-height',
        'margin',
        'padding',
        'border-radius',
        'display',
        'grid-template-columns',
        'grid-template-rows',
        'align-items',
        'justify-items'
    ]);
    __clearInlineStyleProps(chatStack, [
        'display',
        'visibility',
        'opacity',
        'grid-column',
        'grid-row',
        'flex',
        'width',
        'max-width',
        'min-width',
        'min-height',
        'height',
        'max-height',
        'padding-right',
        'box-sizing'
    ]);
    __clearInlineStyleProps(chatInputField, [
        'width',
        'max-width',
        'padding',
        'padding-right',
        'box-sizing'
    ]);
    __clearInlineStyleProps(promptInput, [
        'width',
        'max-width',
        'padding',
        'padding-right',
        'padding-bottom',
        'padding-left'
    ]);
    __clearInlineStyleProps(toolbarArea, [
        'grid-column',
        'grid-row',
        'display',
        'flex',
        'width',
        'min-width',
        'max-width',
        'height',
        'min-height',
        'max-height',
        'position',
        'right',
        'top',
        'left',
        'bottom',
        'z-index',
        'visibility',
        'opacity',
        'pointer-events',
        'transform'
    ]);
    __clearInlineStyleProps(chatInputActions, [
        'position',
        'width',
        'top',
        'left',
        'right',
        'bottom',
        'justify-content',
        'z-index'
    ]);
    __clearInlineStyleProps(controls, [
        'display',
        'flex-direction',
        'align-items',
        'justify-content',
        'height',
        'min-height'
    ]);
    __clearInlineStyleProps(iconWrap, [
        'display',
        'width',
        'flex',
        'height',
        'min-height',
        'overflow',
        'overflow-y',
        'overflow-x',
        'justify-content',
        'align-items',
        'mask-image',
        '-webkit-mask-image'
    ]);
    __clearInlineStyleProps(iconContainer, [
        'display',
        'flex-direction',
        'align-items',
        'justify-content',
        'width',
        'height',
        'min-height',
        'overflow-y',
        'overflow-x',
        'gap',
        'padding',
        'margin'
    ]);
    __clearInlineStyleProps(adWrap, [
        'display',
        'grid-column',
        'grid-row',
        'width',
        'min-width',
        'max-width',
        'flex',
        'height',
        'min-height',
        'max-height',
        'background'
    ]);
    __clearInlineStyleProps(adBody, [
        'display',
        'align-items',
        'justify-content',
        'padding',
        'overflow',
        'background',
        'width',
        'height',
        'min-height',
        'max-height'
    ]);
    __clearInlineStyleProps(adFrame, [
        'display',
        'width',
        'height',
        'min-width',
        'max-width',
        'margin',
        'overflow',
        'aspect-ratio',
        'transform',
        'transform-origin',
        'box-sizing',
        'padding'
    ]);
    __clearInlineStyleProps(boardRail, [
        'display',
        'grid-column',
        'grid-row',
        'width',
        'min-width',
        'max-width',
        'height',
        'min-height',
        'max-height'
    ]);
    __clearInlineStyleProps(rightPanel, [
        'display',
        'visibility',
        'grid-column',
        'grid-row',
        'width',
        'min-width',
        'max-width',
        'height',
        'min-height',
        'max-height',
        'opacity',
        'overflow',
        'position',
        'top',
        'left',
        'right',
        'bottom',
        'z-index',
        'border-top'
    ]);
}
function __applyMobileChatRailSafety() {
    const mainLayout = document.getElementById('main-layout');
    const leftPanel = document.getElementById('left-panel');
    const island = document.querySelector('.island-box');
    const chatStack = document.getElementById('chat-main-stack');
    const topZone = document.getElementById('top-zone');
    const chatBox = document.getElementById('chat-box');
    const chatInputShell = document.getElementById('chat-input-shell');
    const chatInputField = document.getElementById('chat-input-field');
    const promptInput = document.getElementById('prompt-input');
    const toolbarArea = document.getElementById('toolbar-area');
    const controls = document.getElementById('toolbar-main-controls');
    const iconWrap = document.getElementById('icon-scroll-wrapper');
    const iconContainer = document.getElementById('icon-scroll-container');
    const chatInputActions = document.getElementById('chat-input-actions');
    const adWrap = document.getElementById('chat-side-ad');
    const adBody = document.getElementById('chat-side-ad-body');
    const adFrame = document.getElementById('chat-ad-frame');
    const boardRail = document.getElementById('board-right-rail');
    const rightPanel = document.getElementById('right-panel');
    const rightPanelOriginAnchor = document.getElementById('right-panel-origin-anchor');
    const desktopCodePanelHost = document.getElementById('desktop-code-panel-host');
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || null;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const mobileLike = vw <= 900;
    const ultraNarrow = vw < 500;
    const toolbarWidth = mobileLike ? 58 : 74;
    const fullscreenActive = !!(fullscreenElement && fullscreenElement.classList && fullscreenElement.classList.contains('island-box'));
    const bodyMode = document.body ? String(document.body.getAttribute('data-ui-mode') || '').trim() : '';
    const runtimeMode = bodyMode || (typeof window !== 'undefined' ? String(window.currentMode || window.selectedMode || '').trim() : '');
    const menuModeActive = !!(chatStack && chatStack.classList.contains('menu-mode'));
    const settingsModeActive = runtimeMode === 'settings' || !!(chatStack && chatStack.classList.contains('settings-mode')) || !!(topZone && topZone.classList.contains('settings-mode'));
    const immersiveTopMode = menuModeActive || settingsModeActive;
    const codeModeActive = bodyMode === 'code' || !!(document.body && document.body.classList.contains('mode-code')) || !!(rightPanel && rightPanel.classList.contains('mobile-active'));
    const desktopCodeMode = codeModeActive && !mobileLike;
    const effectiveMobileLike = mobileLike;
    const codePanelVisible = !!(rightPanel && (codeModeActive || rightPanel.classList.contains('mobile-active')));
    const codePanelGridColumn = vw <= 1180 ? '1 / span 2' : '1 / span 4';
    const codePanelGridRow = vw <= 900 ? '2' : (vw <= 1180 ? '3' : '2');
    const codePanelMinHeight = vw <= 900 ? '240px' : '320px';
    const codePanelMaxHeight = vw <= 900 ? '360px' : '520px';
    const desktopFlowBypassModes = ['search', 'image', 'video', 'blog', 'music', 'translate', 'community', 'app'];

    if (rightPanel) {
        rightPanel.classList.toggle('mobile-active', codeModeActive && mobileLike);
    }
    if (document.body) {
        document.body.classList.toggle('mode-code', codeModeActive && mobileLike);
        document.body.classList.toggle('mobile-code-stacked', codeModeActive && mobileLike);
        document.body.classList.remove('desktop-code-stage');
        document.body.classList.toggle('desktop-code-open', desktopCodeMode);
        document.body.classList.toggle('desktop-code-panel-mounted', desktopCodeMode && !fullscreenActive);
    }
    if (rightPanel && rightPanelOriginAnchor && desktopCodePanelHost) {
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

    if (chatInputField) {
        chatInputField.style.setProperty('width', '100%', 'important');
        chatInputField.style.setProperty('max-width', '100%', 'important');
        chatInputField.style.setProperty('padding', '0', 'important');
        chatInputField.style.setProperty('padding-right', '0', 'important');
        chatInputField.style.setProperty('box-sizing', 'border-box', 'important');
    }
    if (promptInput) {
        promptInput.style.setProperty('width', '100%', 'important');
        promptInput.style.setProperty('max-width', '100%', 'important');
        promptInput.style.setProperty('padding', '6px 0 0 56px', 'important');
        promptInput.style.setProperty('padding-right', '0', 'important');
    }
    if (topZone) {
        if (settingsModeActive) {
            topZone.style.setProperty('display', 'flex', 'important');
            topZone.style.setProperty('flex', '1 1 auto', 'important');
            topZone.style.setProperty('height', '100%', 'important');
            topZone.style.setProperty('min-height', '0', 'important');
            topZone.style.setProperty('max-height', '100%', 'important');
            topZone.style.setProperty('overflow', 'hidden', 'important');
            topZone.style.setProperty('visibility', 'visible', 'important');
            topZone.style.setProperty('opacity', '1', 'important');
        } else if (menuModeActive) {
            topZone.style.setProperty('display', 'none', 'important');
            topZone.style.setProperty('flex', '0 0 auto', 'important');
            topZone.style.setProperty('height', '0', 'important');
            topZone.style.setProperty('min-height', '0', 'important');
            topZone.style.setProperty('max-height', '0', 'important');
            topZone.style.setProperty('padding', '0', 'important');
            topZone.style.setProperty('margin', '0', 'important');
            topZone.style.setProperty('overflow', 'hidden', 'important');
            topZone.style.setProperty('visibility', 'hidden', 'important');
            topZone.style.setProperty('opacity', '0', 'important');
        } else {
            __clearInlineStyleProps(topZone, ['display', 'flex', 'height', 'min-height', 'max-height', 'padding', 'margin', 'overflow', 'visibility', 'opacity']);
        }
    }

    if (fullscreenActive) {
        if (mainLayout) {
            mainLayout.style.paddingLeft = '0';
            mainLayout.style.marginLeft = '0';
            mainLayout.style.width = '100%';
            mainLayout.style.maxWidth = '100%';
            mainLayout.style.height = '100%';
            mainLayout.style.minHeight = '100%';
        }
        if (island) {
            island.style.position = 'relative';
            island.style.width = '100vw';
            island.style.height = `${window.innerHeight}px`;
            island.style.minHeight = `${window.innerHeight}px`;
            island.style.maxHeight = `${window.innerHeight}px`;
            island.style.margin = '0';
            island.style.padding = '0';
            island.style.borderRadius = '0';
            island.style.display = 'grid';
            island.style.gridTemplateColumns = `minmax(0, 1fr) ${toolbarWidth}px`;
            island.style.gridTemplateRows = codeModeActive ? 'minmax(0, 1fr) minmax(260px, 42vh)' : 'minmax(0, 1fr)';
            island.style.alignItems = 'stretch';
            island.style.justifyItems = 'stretch';
        }
        if (chatStack) {
            chatStack.style.gridColumn = '1';
            chatStack.style.gridRow = '1';
            chatStack.style.flex = '1 1 auto';
            chatStack.style.width = '100%';
            chatStack.style.maxWidth = '100%';
            chatStack.style.minWidth = '0';
            chatStack.style.minHeight = '0';
            chatStack.style.height = '100%';
            chatStack.style.maxHeight = '100%';
            chatStack.style.paddingRight = '0';
            chatStack.style.boxSizing = 'border-box';
        }
        if (toolbarArea) {
            toolbarArea.style.gridColumn = '2';
            toolbarArea.style.gridRow = codeModeActive ? '1 / span 2' : '1';
            toolbarArea.style.display = 'flex';
            toolbarArea.style.flexDirection = 'column';
            toolbarArea.style.flex = `0 0 ${toolbarWidth}px`;
            toolbarArea.style.width = `${toolbarWidth}px`;
            toolbarArea.style.minWidth = `${toolbarWidth}px`;
            toolbarArea.style.maxWidth = `${toolbarWidth}px`;
            toolbarArea.style.height = '100%';
            toolbarArea.style.minHeight = '100%';
            toolbarArea.style.maxHeight = '100%';
            toolbarArea.style.setProperty('position', 'relative', 'important');
            toolbarArea.style.setProperty('right', 'auto', 'important');
            toolbarArea.style.setProperty('top', 'auto', 'important');
            toolbarArea.style.setProperty('left', 'auto', 'important');
            toolbarArea.style.setProperty('bottom', 'auto', 'important');
            toolbarArea.style.zIndex = '260';
            toolbarArea.style.visibility = 'visible';
            toolbarArea.style.opacity = '1';
            toolbarArea.style.pointerEvents = 'auto';
            toolbarArea.style.transform = 'none';
            toolbarArea.style.overflowY = 'auto';
            toolbarArea.style.overflowX = 'visible';
            toolbarArea.style.scrollbarGutter = 'stable both-edges';
        }
        if (chatInputActions) {
            chatInputActions.style.setProperty('position', 'absolute', 'important');
            chatInputActions.style.setProperty('width', 'auto', 'important');
            chatInputActions.style.setProperty('top', 'auto', 'important');
            chatInputActions.style.setProperty('left', 'auto', 'important');
            chatInputActions.style.setProperty('right', '12px', 'important');
            chatInputActions.style.setProperty('bottom', '8px', 'important');
            chatInputActions.style.setProperty('justify-content', 'flex-end', 'important');
            chatInputActions.style.zIndex = '280';
        }
        if (controls) {
            controls.style.display = 'flex';
            controls.style.flexDirection = 'column';
            controls.style.alignItems = 'center';
            controls.style.justifyContent = 'flex-start';
            controls.style.width = '100%';
            controls.style.flex = '0 0 auto';
            controls.style.height = 'auto';
            controls.style.minHeight = 'auto';
        }
        if (iconWrap) {
            iconWrap.style.display = 'flex';
            iconWrap.style.width = '100%';
            iconWrap.style.flex = '0 0 auto';
            iconWrap.style.height = 'auto';
            iconWrap.style.minHeight = '0';
            iconWrap.style.overflowY = 'visible';
            iconWrap.style.overflowX = 'visible';
            iconWrap.style.justifyContent = 'flex-start';
            iconWrap.style.alignItems = 'flex-start';
            iconWrap.style.maskImage = 'none';
            iconWrap.style.webkitMaskImage = 'none';
        }
        if (iconContainer) {
            iconContainer.style.display = 'flex';
            iconContainer.style.flexDirection = 'column';
            iconContainer.style.alignItems = 'center';
            iconContainer.style.justifyContent = 'flex-start';
            iconContainer.style.width = '100%';
            iconContainer.style.height = 'auto';
            iconContainer.style.minHeight = '0';
            iconContainer.style.overflowY = 'visible';
            iconContainer.style.overflowX = 'visible';
            iconContainer.style.gap = '10px';
            iconContainer.style.padding = '6px 2px 14px';
            iconContainer.style.margin = '0 auto';
        }
        if (adWrap) adWrap.style.display = 'none';
        if (adBody) adBody.style.display = 'none';
        if (adFrame) adFrame.style.display = 'none';
        if (boardRail) boardRail.style.display = 'none';
        if (rightPanel) {
            if (codeModeActive) {
                rightPanel.classList.remove('hidden');
                rightPanel.style.setProperty('grid-column', '1', 'important');
                rightPanel.style.setProperty('grid-row', '2', 'important');
                rightPanel.style.setProperty('width', '100%', 'important');
                rightPanel.style.setProperty('min-width', '0', 'important');
                rightPanel.style.setProperty('max-width', '100%', 'important');
                rightPanel.style.setProperty('height', 'auto', 'important');
                rightPanel.style.setProperty('min-height', '260px', 'important');
                rightPanel.style.setProperty('max-height', '42vh', 'important');
                rightPanel.style.setProperty('position', 'relative', 'important');
                rightPanel.style.setProperty('top', 'auto', 'important');
                rightPanel.style.setProperty('left', 'auto', 'important');
                rightPanel.style.setProperty('right', 'auto', 'important');
                rightPanel.style.setProperty('bottom', 'auto', 'important');
                rightPanel.style.setProperty('z-index', '20', 'important');
                rightPanel.style.setProperty('display', 'flex', 'important');
                rightPanel.style.setProperty('visibility', 'visible', 'important');
                rightPanel.style.setProperty('opacity', '1', 'important');
                rightPanel.style.setProperty('overflow', 'hidden', 'important');
                rightPanel.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.06)', 'important');
            } else {
                rightPanel.style.setProperty('display', 'none', 'important');
                rightPanel.style.setProperty('visibility', 'hidden', 'important');
                rightPanel.style.setProperty('opacity', '0', 'important');
            }
        }
        return;
    }

    __resetChatFullscreenLayoutStyles();

    if (!mobileLike && !codeModeActive && desktopFlowBypassModes.includes(runtimeMode)) {
        if (desktopCodePanelHost) {
            desktopCodePanelHost.style.display = 'none';
            desktopCodePanelHost.style.removeProperty('min-height');
            desktopCodePanelHost.style.removeProperty('visibility');
            desktopCodePanelHost.style.removeProperty('opacity');
            desktopCodePanelHost.style.removeProperty('overflow');
        }
        if (rightPanel && !rightPanel.classList.contains('mobile-active')) {
            rightPanel.classList.add('hidden');
            __clearInlineStyleProps(rightPanel, ['display', 'visibility', 'opacity', 'width', 'min-width', 'max-width', 'grid-row', 'grid-column', 'height', 'min-height', 'max-height', 'overflow', 'position', 'top', 'left', 'right', 'bottom', 'z-index', 'border-top']);
        }
        return;
    }

    if (desktopCodeMode) {
        if (rightPanel) {
            rightPanel.classList.remove('hidden');
            rightPanel.classList.remove('mobile-active');
            rightPanel.style.setProperty('display', 'flex', 'important');
            rightPanel.style.setProperty('visibility', 'visible', 'important');
            rightPanel.style.setProperty('opacity', '1', 'important');
            rightPanel.style.setProperty('width', '100%', 'important');
            rightPanel.style.setProperty('min-width', '0', 'important');
            rightPanel.style.setProperty('max-width', '100%', 'important');
            rightPanel.style.removeProperty('grid-column');
            rightPanel.style.removeProperty('grid-row');
            rightPanel.style.setProperty('height', 'auto', 'important');
            rightPanel.style.setProperty('min-height', codePanelMinHeight, 'important');
            rightPanel.style.setProperty('max-height', codePanelMaxHeight, 'important');
            rightPanel.style.setProperty('position', 'relative', 'important');
            rightPanel.style.setProperty('top', 'auto', 'important');
            rightPanel.style.setProperty('left', 'auto', 'important');
            rightPanel.style.setProperty('right', 'auto', 'important');
            rightPanel.style.setProperty('bottom', 'auto', 'important');
            rightPanel.style.setProperty('overflow', 'hidden', 'important');
            rightPanel.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.06)', 'important');
        }
        return;
    }

    if (effectiveMobileLike && mainLayout) {
        const h = mainLayout.getBoundingClientRect().height || 0;
        const island = document.querySelector('.island-box');
        if (h < 180) {
            mainLayout.style.flex = '0 0 auto';
            mainLayout.style.height = 'auto';
            mainLayout.style.minHeight = '320px';
            mainLayout.style.display = 'flex';
        }
        if (leftPanel) {
            leftPanel.style.display = 'flex';
            leftPanel.style.height = 'auto';
            leftPanel.style.minHeight = '320px';
        }
        if (island) {
            const mobileRows = codePanelVisible
                ? (immersiveTopMode ? 'minmax(0, 1fr) minmax(240px, auto) 270px' : '320px minmax(240px, auto) 270px')
                : (immersiveTopMode ? 'minmax(0, 1fr) auto 270px' : '320px auto 270px');
            island.style.position = 'relative';
            island.style.display = 'grid';
            island.style.gridTemplateColumns = `minmax(0, 1fr) ${toolbarWidth}px`;
            island.style.gridTemplateRows = mobileRows;
            island.style.alignItems = 'stretch';
            island.style.justifyItems = 'stretch';
        }
        if (chatStack) {
            chatStack.style.gridColumn = '1';
            chatStack.style.gridRow = '1';
            chatStack.style.flex = '1 1 auto';
            chatStack.style.width = '100%';
            chatStack.style.maxWidth = '100%';
            chatStack.style.minHeight = immersiveTopMode ? '0' : '320px';
            chatStack.style.height = immersiveTopMode ? '100%' : '320px';
            chatStack.style.maxHeight = immersiveTopMode ? '100%' : '320px';
            chatStack.style.paddingRight = '0';
            chatStack.style.boxSizing = 'border-box';
        }
        if (toolbarArea) {
            toolbarArea.style.gridColumn = '2';
            toolbarArea.style.gridRow = '1';
            toolbarArea.style.display = 'flex';
            toolbarArea.style.flexDirection = 'column';
            toolbarArea.style.flex = `0 0 ${toolbarWidth}px`;
            toolbarArea.style.width = `${toolbarWidth}px`;
            toolbarArea.style.minWidth = `${toolbarWidth}px`;
            toolbarArea.style.maxWidth = `${toolbarWidth}px`;
            toolbarArea.style.height = '320px';
            toolbarArea.style.minHeight = '320px';
            toolbarArea.style.maxHeight = '320px';
            toolbarArea.style.setProperty('position', 'relative', 'important');
            toolbarArea.style.setProperty('right', 'auto', 'important');
            toolbarArea.style.setProperty('top', 'auto', 'important');
            toolbarArea.style.setProperty('left', 'auto', 'important');
            toolbarArea.style.setProperty('bottom', 'auto', 'important');
            toolbarArea.style.zIndex = '260';
            toolbarArea.style.visibility = 'visible';
            toolbarArea.style.opacity = '1';
            toolbarArea.style.pointerEvents = 'auto';
            toolbarArea.style.transform = 'none';
            toolbarArea.style.alignSelf = 'stretch';
            toolbarArea.style.justifySelf = 'stretch';
            toolbarArea.style.overflowY = 'auto';
            toolbarArea.style.overflowX = 'hidden';
            toolbarArea.style.scrollbarGutter = 'stable both-edges';
        }
        if (chatInputActions) {
            chatInputActions.style.setProperty('position', 'absolute', 'important');
            chatInputActions.style.setProperty('width', 'auto', 'important');
            chatInputActions.style.setProperty('top', 'auto', 'important');
            chatInputActions.style.setProperty('left', 'auto', 'important');
            chatInputActions.style.setProperty('right', '12px', 'important');
            chatInputActions.style.setProperty('bottom', '8px', 'important');
            chatInputActions.style.setProperty('justify-content', 'flex-end', 'important');
            chatInputActions.style.zIndex = ultraNarrow ? '280' : '40';
        }
        __dockToolbarIfNeeded(toolbarArea, ultraNarrow);
        if (boardRail) {
            boardRail.style.display = 'flex';
            boardRail.style.gridColumn = '2';
            boardRail.style.gridRow = '3';
            boardRail.style.width = `${toolbarWidth}px`;
            boardRail.style.minWidth = `${toolbarWidth}px`;
            boardRail.style.maxWidth = `${toolbarWidth}px`;
            boardRail.style.height = '270px';
            boardRail.style.minHeight = '270px';
            boardRail.style.maxHeight = '270px';
            boardRail.style.alignSelf = 'stretch';
            boardRail.style.justifySelf = 'stretch';
        }
        if (rightPanel) {
            rightPanel.style.gridColumn = '1 / span 2';
            rightPanel.style.gridRow = '2';
            rightPanel.style.width = '100%';
            rightPanel.style.minWidth = '0';
            rightPanel.style.maxWidth = '100%';
            rightPanel.style.position = 'relative';
            rightPanel.style.top = 'auto';
            rightPanel.style.left = 'auto';
            rightPanel.style.right = 'auto';
            rightPanel.style.bottom = 'auto';
            rightPanel.style.zIndex = codePanelVisible ? '8' : '20';
            rightPanel.style.display = codePanelVisible ? 'flex' : 'none';
            rightPanel.style.opacity = codePanelVisible ? '1' : '0';
            rightPanel.style.minHeight = codePanelVisible ? '240px' : '0';
            rightPanel.style.maxHeight = codePanelVisible ? '360px' : '0';
        }
        if (adWrap) {
            adWrap.style.display = 'flex';
            adWrap.style.gridColumn = '1';
            adWrap.style.gridRow = '3';
            adWrap.style.zIndex = '16';
            adWrap.style.background = '#ffffff';
            adWrap.style.width = 'auto';
            adWrap.style.minWidth = '0';
            adWrap.style.maxWidth = '100%';
            adWrap.style.flex = '1 1 auto';
            adWrap.style.height = '250px';
            adWrap.style.minHeight = '250px';
            adWrap.style.maxHeight = '250px';
            adWrap.style.alignSelf = 'stretch';
            adWrap.style.justifySelf = 'stretch';
            adWrap.style.overflow = 'hidden';
        }
        if (adBody) {
            adBody.style.display = 'flex';
            adBody.style.alignItems = 'center';
            adBody.style.justifyContent = 'center';
            adBody.style.zIndex = '16';
            adBody.style.padding = '8px 6px';
            adBody.style.overflow = 'hidden';
            adBody.style.background = '#ffffff';
            adBody.style.width = '100%';
            adBody.style.height = '250px';
            adBody.style.minHeight = '250px';
            adBody.style.maxHeight = '250px';
        }
        if (adFrame) {
            const availableWidth = Math.max(160, (adBody ? adBody.clientWidth : 300) - 12);
            const scale = Math.min(1, availableWidth / 300);
            adFrame.style.width = '300px';
            adFrame.style.height = '250px';
            adFrame.style.minWidth = '0';
            adFrame.style.maxWidth = '300px';
            adFrame.style.margin = '0 auto';
            adFrame.style.overflow = 'visible';
            adFrame.style.aspectRatio = '';
            adFrame.style.transform = `scale(${scale})`;
            adFrame.style.transformOrigin = 'top center';
            adFrame.style.boxSizing = 'border-box';
            adFrame.style.padding = '0';
            __syncAdFrameChildren(adFrame, true);
        }
        if (controls) {
            controls.style.display = 'flex';
            controls.style.flexDirection = 'column';
            controls.style.alignItems = 'center';
            controls.style.justifyContent = 'flex-start';
            controls.style.flex = '0 0 auto';
            controls.style.height = 'auto';
            controls.style.width = '100%';
            controls.style.minHeight = 'auto';
        }
        if (iconWrap) {
            iconWrap.style.display = 'flex';
            iconWrap.style.width = '100%';
            iconWrap.style.flex = '0 0 auto';
            iconWrap.style.height = 'auto';
            iconWrap.style.minHeight = '0';
            iconWrap.style.overflowY = 'visible';
            iconWrap.style.overflowX = 'visible';
            iconWrap.style.justifyContent = 'flex-start';
            iconWrap.style.alignItems = 'flex-start';
            iconWrap.style.maskImage = 'none';
            iconWrap.style.webkitMaskImage = 'none';
        }
        if (iconContainer) {
            iconContainer.style.display = 'flex';
            iconContainer.style.flexDirection = 'column';
            iconContainer.style.alignItems = 'center';
            iconContainer.style.justifyContent = 'flex-start';
            iconContainer.style.width = '100%';
            iconContainer.style.height = 'auto';
            iconContainer.style.minHeight = '0';
            iconContainer.style.overflowY = 'visible';
            iconContainer.style.overflowX = 'hidden';
            iconContainer.style.gap = '10px';
            iconContainer.style.padding = '6px 0 14px';
            iconContainer.style.margin = '0 auto';
        }
        if (toolbarArea) {
            const rect = toolbarArea.getBoundingClientRect();
            if ((rect.width || 0) < 30 || (rect.height || 0) < 120) {
                toolbarArea.style.setProperty('position', 'relative', 'important');
                toolbarArea.style.setProperty('right', 'auto', 'important');
                toolbarArea.style.setProperty('top', 'auto', 'important');
                toolbarArea.style.setProperty('left', 'auto', 'important');
                toolbarArea.style.setProperty('bottom', 'auto', 'important');
                toolbarArea.style.height = '320px';
                toolbarArea.style.minHeight = '320px';
                toolbarArea.style.maxHeight = '320px';
                toolbarArea.style.zIndex = '220';
            }
        }
    } else {
        __dockToolbarIfNeeded(toolbarArea, false);
        if (chatInputActions) {
            chatInputActions.style.setProperty('position', 'absolute', 'important');
            chatInputActions.style.setProperty('width', 'auto', 'important');
            chatInputActions.style.setProperty('top', 'auto', 'important');
            chatInputActions.style.setProperty('left', 'auto', 'important');
            chatInputActions.style.setProperty('right', '12px', 'important');
            chatInputActions.style.setProperty('bottom', '8px', 'important');
            chatInputActions.style.setProperty('justify-content', 'flex-end', 'important');
            chatInputActions.style.zIndex = '12';
        }
        if (boardRail) {
            boardRail.style.display = '';
        }
        const shouldPreserveCodePanel = codeModeActive || bodyMode === 'code' || (rightPanel && rightPanel.classList.contains('mobile-active'));
        if (rightPanel && shouldPreserveCodePanel) {
            rightPanel.classList.remove('hidden');
            rightPanel.style.setProperty('display', 'flex', 'important');
            rightPanel.style.setProperty('visibility', 'visible', 'important');
            rightPanel.style.setProperty('opacity', '1', 'important');
            rightPanel.style.setProperty('width', '100%', 'important');
            rightPanel.style.setProperty('min-width', '0', 'important');
            rightPanel.style.setProperty('max-width', '100%', 'important');
            rightPanel.style.setProperty('grid-column', codePanelGridColumn, 'important');
            rightPanel.style.setProperty('grid-row', codePanelGridRow, 'important');
            rightPanel.style.setProperty('height', 'auto', 'important');
            rightPanel.style.setProperty('min-height', codePanelMinHeight, 'important');
            rightPanel.style.setProperty('max-height', codePanelMaxHeight, 'important');
            rightPanel.style.setProperty('position', 'relative', 'important');
            rightPanel.style.setProperty('top', 'auto', 'important');
            rightPanel.style.setProperty('left', 'auto', 'important');
            rightPanel.style.setProperty('right', 'auto', 'important');
            rightPanel.style.setProperty('bottom', 'auto', 'important');
            rightPanel.style.setProperty('overflow', 'hidden', 'important');
            rightPanel.style.setProperty('border-top', '1px solid rgba(255, 255, 255, 0.06)', 'important');
        } else if (rightPanel) {
            rightPanel.style.display = '';
            rightPanel.style.visibility = '';
            rightPanel.style.opacity = '';
            rightPanel.style.width = '';
            rightPanel.style.minWidth = '';
            rightPanel.style.maxWidth = '';
            rightPanel.style.gridColumn = '';
            rightPanel.style.gridRow = '';
            rightPanel.style.height = '';
            rightPanel.style.minHeight = '';
            rightPanel.style.maxHeight = '';
            rightPanel.style.position = '';
            rightPanel.style.top = '';
            rightPanel.style.left = '';
            rightPanel.style.right = '';
            rightPanel.style.bottom = '';
            rightPanel.style.overflow = '';
            rightPanel.style.borderTop = '';
        }
        if (chatStack) {
            chatStack.style.gridColumn = '';
            chatStack.style.gridRow = '';
            chatStack.style.paddingRight = '';
            chatStack.style.maxWidth = '';
            chatStack.style.width = '';
            chatStack.style.height = immersiveTopMode ? '100%' : '270px';
            chatStack.style.minHeight = immersiveTopMode ? '0' : '270px';
            chatStack.style.maxHeight = immersiveTopMode ? '100%' : '270px';
        }
        if (toolbarArea) {
            toolbarArea.style.gridColumn = '';
            toolbarArea.style.gridRow = '';
            toolbarArea.style.display = 'flex';
            toolbarArea.style.flexDirection = 'column';
            toolbarArea.style.position = 'relative';
            toolbarArea.style.right = '';
            toolbarArea.style.top = '';
            toolbarArea.style.left = '';
            toolbarArea.style.bottom = '';
            toolbarArea.style.flex = '0 0 74px';
            toolbarArea.style.width = '74px';
            toolbarArea.style.minWidth = '74px';
            toolbarArea.style.maxWidth = '74px';
            toolbarArea.style.height = '270px';
            toolbarArea.style.minHeight = '270px';
            toolbarArea.style.maxHeight = '270px';
            toolbarArea.style.zIndex = '20';
            toolbarArea.style.visibility = 'visible';
            toolbarArea.style.opacity = '1';
            toolbarArea.style.pointerEvents = 'auto';
            toolbarArea.style.transform = '';
            toolbarArea.style.overflowY = 'auto';
            toolbarArea.style.overflowX = 'hidden';
            toolbarArea.style.scrollbarGutter = 'stable both-edges';
        }
        if (controls) {
            controls.style.display = 'flex';
            controls.style.flexDirection = 'column';
            controls.style.alignItems = 'center';
            controls.style.justifyContent = 'flex-start';
            controls.style.width = '100%';
            controls.style.flex = '0 0 auto';
            controls.style.height = 'auto';
            controls.style.minHeight = 'auto';
        }
        if (iconWrap) {
            iconWrap.style.display = 'flex';
            iconWrap.style.width = '100%';
            iconWrap.style.flex = '0 0 auto';
            iconWrap.style.height = 'auto';
            iconWrap.style.minHeight = '0';
            iconWrap.style.overflowY = 'visible';
            iconWrap.style.overflowX = 'visible';
            iconWrap.style.justifyContent = 'flex-start';
            iconWrap.style.alignItems = 'flex-start';
            iconWrap.style.maskImage = 'none';
            iconWrap.style.webkitMaskImage = 'none';
        }
        if (iconContainer) {
            iconContainer.style.display = 'flex';
            iconContainer.style.flexDirection = 'column';
            iconContainer.style.alignItems = 'center';
            iconContainer.style.justifyContent = 'flex-start';
            iconContainer.style.width = '100%';
            iconContainer.style.height = 'auto';
            iconContainer.style.minHeight = '0';
            iconContainer.style.overflowY = 'visible';
            iconContainer.style.overflowX = 'hidden';
            iconContainer.style.gap = '10px';
            iconContainer.style.padding = '6px 0 14px';
        }
        if (adWrap) {
            adWrap.style.display = 'flex';
            adWrap.style.gridColumn = '';
            adWrap.style.gridRow = '';
            adWrap.style.background = '#ffffff';
        }
        if (adBody) {
            adBody.style.display = 'flex';
            adBody.style.alignItems = 'center';
            adBody.style.justifyContent = 'center';
            adBody.style.padding = '9px 11px';
            adBody.style.overflow = 'visible';
            adBody.style.background = '#ffffff';
        }
        if (adFrame) {
            __syncAdFrameChildren(adFrame, true);
            const measured = __measureAdContent(adFrame);
            const desktopWidth = measured.width;
            const desktopHeight = measured.height;
            if (adWrap) {
                const wrapWidth = desktopWidth + 24;
                const wrapHeight = desktopHeight + 20;
                adWrap.style.width = `${wrapWidth}px`;
                adWrap.style.minWidth = `${wrapWidth}px`;
                adWrap.style.flex = `0 0 ${wrapWidth}px`;
                adWrap.style.height = `${wrapHeight}px`;
                adWrap.style.minHeight = `${wrapHeight}px`;
            }
            if (adBody) {
                adBody.style.height = `${desktopHeight + 20}px`;
                adBody.style.minHeight = `${desktopHeight + 20}px`;
            }
            adFrame.style.width = `${desktopWidth}px`;
            adFrame.style.height = `${desktopHeight}px`;
            adFrame.style.minWidth = '0';
            adFrame.style.maxWidth = `${desktopWidth}px`;
            adFrame.style.margin = '0 auto';
            adFrame.style.overflow = 'visible';
            adFrame.style.aspectRatio = '';
            adFrame.style.transform = 'none';
            adFrame.style.transformOrigin = 'center center';
            adFrame.style.boxSizing = 'content-box';
            adFrame.style.padding = '1px';
        }
    }
}
function __handleChatFullscreenChange() {
    syncFullscreenIcon();
    __applyMobileChatRailSafety();
    [0, 80, 220].forEach(function (delay) {
        setTimeout(__applyMobileChatRailSafety, delay);
    });
}
window.addEventListener('load', function () {
    __applyMobileChatRailSafety();
    window.addEventListener('resize', __applyMobileChatRailSafety);
    window.addEventListener('orientationchange', __applyMobileChatRailSafety);
    window.addEventListener('scroll', __applyMobileChatRailSafety, { passive: true });
    document.addEventListener('fullscreenchange', __handleChatFullscreenChange);
    document.addEventListener('webkitfullscreenchange', __handleChatFullscreenChange);
    const adFrame = document.getElementById('chat-ad-frame');
    if (adFrame && !window.__chatAdObserver) {
        const observer = new MutationObserver(function () {
            __applyMobileChatRailSafety();
        });
        observer.observe(adFrame, { childList: true, subtree: true });
        window.__chatAdObserver = observer;
    }
    [0, 120, 360, 800].forEach(function (delay) {
        setTimeout(function () {
            __cleanAdHashAndScrollTop();
            __applyMobileChatRailSafety();
            if (!window.location.hash) window.scrollTo(0, 0);
        }, delay);
    });
}, { once: true });
