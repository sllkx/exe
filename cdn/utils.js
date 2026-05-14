const root = (typeof window !== 'undefined') ? window : globalThis;

export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

export function escapeCssUrlValue(value) {
    return String(value || '').trim().replace(/["\\\n\r]/g, '');
}

export function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

export function safeJsonParse(input, fallback = null) {
    try {
        if (input == null || input === '') return fallback;
        return JSON.parse(String(input));
    } catch (error) {
        return fallback;
    }
}

export function getElement(id) {
    return document.getElementById(id);
}

root.ISAI_CDN_UTILS = Object.assign(root.ISAI_CDN_UTILS || {}, {
    clamp,
    escapeCssUrlValue,
    normalizeText,
    safeJsonParse,
    getElement
});
