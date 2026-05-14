import { getElement } from './utils.js';

const root = (typeof window !== 'undefined') ? window : globalThis;

export function getChatBox() {
    return getElement('chat-box');
}

export function resetChatBoxBackground() {
    const chatBox = getChatBox();
    if (!chatBox) return;
    chatBox.classList.remove('character-chat-active');
    chatBox.style.removeProperty('background');
    chatBox.style.removeProperty('background-color');
    chatBox.style.removeProperty('background-image');
    chatBox.style.removeProperty('background-size');
    chatBox.style.removeProperty('background-position');
    chatBox.style.removeProperty('background-repeat');
    chatBox.style.removeProperty('background-blend-mode');
    chatBox.style.removeProperty('background-attachment');
}

export function scrollChatToBottom() {
    const chatBox = getChatBox();
    if (!chatBox) return;
    chatBox.scrollTop = chatBox.scrollHeight;
}

root.ISAI_CDN_CHAT = Object.assign(root.ISAI_CDN_CHAT || {}, {
    getChatBox,
    resetChatBoxBackground,
    scrollChatToBottom
});
