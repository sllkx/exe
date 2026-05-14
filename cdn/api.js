import { safeJsonParse } from './utils.js';

const root = (typeof window !== 'undefined') ? window : globalThis;

export async function fetchJson(url, init = {}) {
    const response = await fetch(url, init);
    const text = await response.text();
    return safeJsonParse(text, {});
}

export async function fetchText(url, init = {}) {
    const response = await fetch(url, init);
    return response.text();
}

root.ISAI_CDN_API = Object.assign(root.ISAI_CDN_API || {}, {
    fetchJson,
    fetchText
});
