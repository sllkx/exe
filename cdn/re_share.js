const reShareConfig = window.__ISAI_RE_SHARE_CONFIG__ || {};
window.savedPrompt = String(reShareConfig.savedPrompt || '').trim();
const isSharedView = String(reShareConfig.viewId || '');

window.addEventListener('load', () => {
    const sharedImg = String(reShareConfig.ogImage || '');
    if (isSharedView && sharedImg && !sharedImg.includes('isailogo2.png')) {
        setTimeout(() => {
            if (typeof setMode === 'function') setMode('image');
            const img = document.getElementById('preview-img');
            const container = document.getElementById('img-preview-container');
            if (img) img.src = sharedImg;
            if (container) {
                container.classList.add('active');
                container.style.setProperty('display', 'block', 'important');
            }
            const appGrid = document.getElementById('app-container');
            if (appGrid) appGrid.style.setProperty('display', 'none', 'important');
        }, 100);
    }
});

window.currentShareCache = {};
window.ISAI_TEMP_SOCIAL_EXPIRE_MINUTES = Math.max(3, Math.min(60, Number(window.ISAI_TEMP_SOCIAL_EXPIRE_MINUTES || 10) || 10));

function getCharacterShareI18n() {
    return (window.__ISAI_CHARACTER_SHARE_I18N__ && typeof window.__ISAI_CHARACTER_SHARE_I18N__ === 'object')
        ? window.__ISAI_CHARACTER_SHARE_I18N__
        : {};
}

function getImageReportI18n() {
    return (window.__ISAI_IMAGE_REPORT_I18N__ && typeof window.__ISAI_IMAGE_REPORT_I18N__ === 'object')
        ? window.__ISAI_IMAGE_REPORT_I18N__
        : {};
}

function getSharePromptText() {
    const inputElement = document.getElementById('prompt-input');
    let promptText = inputElement ? String(inputElement.value || '').trim() : '';
    if (!promptText || promptText === '...') {
        promptText = window.currentImagePrompt || window.savedPrompt || 'AI Generated Art';
    }
    return promptText.replace(/\s-\s\d{4}-\d{2}-\d{2}.*$/, '').trim();
}

function buildShareCacheKey(currentSrc, promptText, options = {}) {
    const persona = (options && typeof options.persona === 'object' && options.persona) ? options.persona : {};
    return [
        String(options.storageMode || 'imgur_if_needed'),
        String(options.shareKind || 'gallery'),
        options.reuseExistingPage === false ? 'new' : 'reuse',
        String(currentSrc || ''),
        String(promptText || ''),
        String(persona.name || ''),
        String(persona.age || ''),
        String(persona.personality || ''),
        String(persona.speech_style || persona.speechStyle || '')
    ].join('||');
}

function getShareCacheEntry(cacheKey) {
    if (!cacheKey) return null;
    return window.currentShareCache[cacheKey] || null;
}

function setShareCacheEntry(cacheKey, value) {
    if (!cacheKey) return;
    window.currentShareCache[cacheKey] = value;
}

function getCurrentShareContext() {
    const base = (window.__ISAI_SHARE_CONTEXT__ && typeof window.__ISAI_SHARE_CONTEXT__ === 'object')
        ? window.__ISAI_SHARE_CONTEXT__
        : {};
    const params = new URLSearchParams(window.location.search);
    return {
        id: Number(base.id || 0) || 0,
        shareId: String(base.shareId || params.get('v') || '').trim(),
        shareKind: String(base.shareKind || '').trim(),
        isShared: !!(base.isShared || params.get('v')),
        hasPersona: !!base.hasPersona
    };
}

function isExistingImageSharePost() {
    return !!getCurrentShareContext().isShared;
}

function syncImageModalActionButtons() {
    const isShared = isExistingImageSharePost();
    const characterBtn = document.getElementById('image-modal-character-share-btn');
    const reportBtn = document.getElementById('image-modal-report-btn');
    if (characterBtn) characterBtn.classList.toggle('hidden', isShared);
    if (reportBtn) reportBtn.classList.toggle('hidden', !isShared);
}

async function getProcessedBlob(imageUrl, maxWidth = 1200) {
    const response = await fetch(imageUrl);
    const originalBlob = await response.blob();
    const mimeType = originalBlob.type || 'image/png';

    if (mimeType === 'image/gif') {
        return originalBlob;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = URL.createObjectURL(originalBlob);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (mimeType === 'image/jpeg') {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, width, height);
            }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas failed'));
            }, mimeType, 0.95);
        };
        img.onerror = () => reject(new Error('Image Load Failed'));
    });
}

function getImageUploadFilename(prefix, blob) {
    const mime = String(blob && blob.type ? blob.type : '').toLowerCase();
    const extMap = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif'
    };
    return `${prefix}.${extMap[mime] || 'png'}`;
}

async function uploadImageToImgur(currentSrc) {
    const processedBlob = await getProcessedBlob(currentSrc, 1200);
    const formData = new FormData();
    formData.append('image', processedBlob, getImageUploadFilename('isai-share-upload', processedBlob));

    const keyRes = await fetch('get_key.php');
    const keyData = await keyRes.json();
    const myClientId = keyData.clientId;

    const imgurRes = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: { 'Authorization': 'Client-ID ' + myClientId },
        body: formData
    });
    const imgurData = await imgurRes.json();

    if (!imgurData.success || !imgurData.data || !imgurData.data.link) {
        throw new Error('Imgur Upload Failed');
    }

    return {
        finalImageUrl: imgurData.data.link,
        tempImageExpiresAt: ''
    };
}

async function uploadImageToTemporaryShare(currentSrc, expiresMinutes = window.ISAI_TEMP_SOCIAL_EXPIRE_MINUTES) {
    const processedBlob = await getProcessedBlob(currentSrc, 1200);
    const formData = new FormData();
    formData.append('image', processedBlob, getImageUploadFilename('isai-social-temp', processedBlob));
    formData.append('expires_minutes', String(expiresMinutes));

    const uploadRes = await fetch('re_store.php?action=upload_temp_share_image', {
        method: 'POST',
        body: formData
    });
    const uploadData = await uploadRes.json();

    if (!uploadData || !uploadData.success || !uploadData.url) {
        throw new Error((uploadData && uploadData.error) || 'Temporary Upload Failed');
    }

    return {
        finalImageUrl: uploadData.url,
        tempImageExpiresAt: uploadData.expires_at || ''
    };
}

function normalizeCharacterPersonaForShare(rawPersona, promptText) {
    const source = (rawPersona && typeof rawPersona === 'object') ? rawPersona : {};
    const clampText = (value, maxLen) => {
        const text = String(value || '').replace(/\r/g, '').trim();
        if (!text) return '';
        return text.length > maxLen ? text.slice(0, maxLen) : text;
    };
    const ageRaw = Number(source.age || 0);
    const age = Number.isFinite(ageRaw) && ageRaw >= 19 && ageRaw <= 120 ? Math.floor(ageRaw) : 0;
    return {
        name: clampText(source.name, 80),
        age,
        personality: clampText(source.personality, 300),
        speech_style: clampText(source.speech_style || source.speechStyle, 300),
        background: clampText(source.background || promptText, 420),
        opening_line: clampText(source.opening_line || source.openingLine, 320),
        locale: clampText(source.locale || '', 10)
    };
}

async function uploadAndSaveImage(currentSrc, promptText, options = {}) {
    const storageMode = String(options.storageMode || 'imgur_if_needed').toLowerCase();
    const shareKind = String(options.shareKind || 'gallery').toLowerCase();
    const reuseExistingPage = options.reuseExistingPage !== false;
    const persona = normalizeCharacterPersonaForShare(options.persona, promptText);
    const hasPersona = !!(persona.name || persona.personality || persona.age >= 19);
    const cacheKey = buildShareCacheKey(currentSrc, promptText, { storageMode, shareKind, reuseExistingPage, persona });

    const urlParams = new URLSearchParams(window.location.search);
    const existingV = urlParams.get('v');
    if (existingV && reuseExistingPage) {
        return {
            shareId: existingV,
            finalImageUrl: currentSrc,
            shareKind
        };
    }

    const cached = getShareCacheEntry(cacheKey);
    if (cached && cached.shareId) {
        return cached;
    }

    let finalImageUrl = currentSrc;
    let tempImageExpiresAt = '';
    if (storageMode === 'temporary') {
        const tempResult = await uploadImageToTemporaryShare(finalImageUrl, window.ISAI_TEMP_SOCIAL_EXPIRE_MINUTES);
        finalImageUrl = tempResult.finalImageUrl;
        tempImageExpiresAt = tempResult.tempImageExpiresAt || '';
    } else if (storageMode === 'imgur') {
        const imgurResult = await uploadImageToImgur(finalImageUrl);
        finalImageUrl = imgurResult.finalImageUrl;
    } else if (storageMode === 'imgur_if_needed' && (finalImageUrl.startsWith('blob:') || finalImageUrl.startsWith('data:'))) {
        const imgurResult = await uploadImageToImgur(finalImageUrl);
        finalImageUrl = imgurResult.finalImageUrl;
    }

    const dbRes = await fetch('re_store.php?action=save_share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: promptText,
            image_url: finalImageUrl,
            share_kind: shareKind,
            temp_image_expires_at: tempImageExpiresAt,
            persona: hasPersona ? persona : null
        })
    });
    const data = await dbRes.json();

    if (!data || !data.success) {
        throw new Error((data && data.error) || 'DB Save Failed');
    }

    const result = {
        dbId: Number(data.id || 0) || 0,
        shareId: data.share_id,
        finalImageUrl,
        shareKind,
        tempImageExpiresAt
    };
    setShareCacheEntry(cacheKey, result);
    return result;
}

async function shareCurrentResult() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentV = urlParams.get('v');

    if (currentV) {
        const shareUrl = window.location.origin + window.location.pathname + '?v=' + currentV;
        navigator.clipboard.writeText(shareUrl);
        if (typeof showToast === 'function') showToast('留곹겕媛 蹂듭궗?섏뿀?듬땲??');
        else alert('留곹겕媛 蹂듭궗?섏뿀?듬땲??');
        return;
    }

    const imgElement = document.getElementById('preview-img');
    if (!imgElement || !imgElement.src || imgElement.src.includes('isailogo2.png')) {
        if (typeof showToast === 'function') showToast('No image to save.');
        else alert('?대?吏媛 ?놁뒿?덈떎.');
        return;
    }

    const promptText = getSharePromptText();
    if (typeof showLoader === 'function') showLoader(true);
    if (typeof showToast === 'function') showToast('Saving to Gallery...');

    try {
        const result = await uploadAndSaveImage(imgElement.src, promptText, {
            storageMode: 'imgur_if_needed',
            shareKind: 'gallery',
            reuseExistingPage: true
        });
        const shareUrl = window.location.origin + window.location.pathname + '?v=' + result.shareId;
        navigator.clipboard.writeText(shareUrl);
        const newUrl = window.location.pathname + '?v=' + result.shareId;
        window.history.pushState({ path: newUrl }, '', newUrl);
        if (window.__ISAI_SHARE_CONTEXT__) {
            window.__ISAI_SHARE_CONTEXT__.id = Number(result.dbId || window.__ISAI_SHARE_CONTEXT__.id || 0) || 0;
            window.__ISAI_SHARE_CONTEXT__.shareId = result.shareId;
            window.__ISAI_SHARE_CONTEXT__.shareKind = 'gallery';
            window.__ISAI_SHARE_CONTEXT__.isShared = true;
        }
        syncImageModalActionButtons();
        if (typeof showToast === 'function') showToast('Saved Successfully!');
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast('Error: ' + e.message);
        else alert('Error: ' + e.message);
    } finally {
        if (typeof showLoader === 'function') showLoader(false);
    }
}

async function shareToSocial(platform) {
    const imgElement = document.getElementById('preview-img');
    if (!imgElement || !imgElement.src || imgElement.src.includes('isailogo2.png')) {
        alert('怨듭쑀??肄섑뀗痢좉? ?놁뒿?덈떎.');
        return;
    }

    const promptText = getSharePromptText();
    const shareWindow = window.open('about:blank', '_blank', 'width=600,height=600');

    try {
        const result = await uploadAndSaveImage(imgElement.src, promptText, {
            storageMode: 'temporary',
            shareKind: 'social_temp',
            reuseExistingPage: false
        });

        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = baseUrl + '?v=' + result.shareId;
        const proxiedImgUrl = window.location.origin + '/proxy_img.php?url=' + encodeURIComponent(result.finalImageUrl);

        const encodedUrl = encodeURIComponent(shareUrl);
        const encodedText = encodeURIComponent(promptText);
        const encodedImg = encodeURIComponent(proxiedImgUrl);

        let snsUrl = '';
        switch (platform) {
            case 'pinterest': snsUrl = `https://www.pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodedImg}&description=${encodedText}`; break;
            case 'x': snsUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`; break;
            case 'threads': snsUrl = `https://www.threads.net/intent/post?text=${encodedText}%20${encodedUrl}`; break;
            case 'facebook': snsUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`; break;
            case 'tumblr': snsUrl = `https://www.tumblr.com/widgets/share/tool?posttype=link&title=${encodedText}&canonicalUrl=${encodedUrl}`; break;
        }

        if (snsUrl) shareWindow.location.href = snsUrl;
        else shareWindow.close();
    } catch (e) {
        console.error(e);
        if (shareWindow) shareWindow.close();
        alert('怨듭쑀 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎: ' + e.message);
    }
}

async function saveCurrentResultToGallery() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentV = urlParams.get('v');

    if (currentV) {
        if (typeof showToast === 'function') showToast('Already saved as a post.');
        else alert('Already saved as a post.');
        return { shareId: currentV, alreadySaved: true };
    }

    const imgElement = document.getElementById('preview-img');
    if (!imgElement || !imgElement.src || imgElement.src.includes('isailogo2.png')) {
        if (typeof showToast === 'function') showToast('No image to save.');
        else alert('No image available.');
        return null;
    }

    const promptText = getSharePromptText();
    if (typeof showLoader === 'function') showLoader(true);
    if (typeof showToast === 'function') showToast('Saving post...');

    try {
        const result = await uploadAndSaveImage(imgElement.src, promptText, {
            storageMode: 'imgur_if_needed',
            shareKind: 'gallery',
            reuseExistingPage: true
        });
        const newUrl = window.location.pathname + '?v=' + result.shareId;
        window.history.pushState({ path: newUrl }, '', newUrl);
        if (window.__ISAI_SHARE_CONTEXT__) {
            window.__ISAI_SHARE_CONTEXT__.id = Number(result.dbId || window.__ISAI_SHARE_CONTEXT__.id || 0) || 0;
            window.__ISAI_SHARE_CONTEXT__.shareId = result.shareId;
            window.__ISAI_SHARE_CONTEXT__.shareKind = 'gallery';
            window.__ISAI_SHARE_CONTEXT__.isShared = true;
        }
        syncImageModalActionButtons();
        if (typeof showToast === 'function') showToast('Post created successfully!');
        return { ...result, alreadySaved: false };
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast('Error: ' + e.message);
        else alert('Error: ' + e.message);
        throw e;
    } finally {
        if (typeof showLoader === 'function') showLoader(false);
    }
}

function openCharacterShareModal() {
    const i18n = getCharacterShareI18n();
    if (isExistingImageSharePost()) {
        if (typeof showToast === 'function') showToast('Already posted image. Use report instead.');
        return;
    }
    const modal = document.getElementById('character-share-modal');
    const imgElement = document.getElementById('preview-img');
    if (!modal || !imgElement || !imgElement.src || imgElement.src.includes('isailogo2.png')) {
        if (typeof showToast === 'function') showToast('No image available.');
        return;
    }
    const preview = document.getElementById('character-share-preview');
    const promptView = document.getElementById('character-share-prompt');
    const nameField = document.getElementById('character-share-name');
    const ageField = document.getElementById('character-share-age');
    const personalityField = document.getElementById('character-share-personality');
    const speechField = document.getElementById('character-share-speech');
    const promptText = getSharePromptText();
    if (preview) preview.src = imgElement.src;
    if (promptView) promptView.textContent = promptText || i18n.noPrompt || 'No prompt';
    if (nameField) nameField.value = '';
    if (ageField) ageField.value = '19';
    if (personalityField) personalityField.value = '';
    if (speechField) speechField.value = '';
    modal.classList.remove('hidden');
}

function closeCharacterShareModal() {
    const modal = document.getElementById('character-share-modal');
    if (modal) modal.classList.add('hidden');
}

async function createCharacterSharePost() {
    const i18n = getCharacterShareI18n();
    const imgElement = document.getElementById('preview-img');
    if (!imgElement || !imgElement.src || imgElement.src.includes('isailogo2.png')) {
        if (typeof showToast === 'function') showToast('No image available.');
        return;
    }
    const promptText = getSharePromptText();
    const name = String(document.getElementById('character-share-name')?.value || '').trim();
    const age = Number(document.getElementById('character-share-age')?.value || 0);
    const personality = String(document.getElementById('character-share-personality')?.value || '').trim();
    const speechStyle = String(document.getElementById('character-share-speech')?.value || '').trim();
    if (!name) {
        if (typeof showToast === 'function') showToast(i18n.nameRequired || 'Please enter a character name.');
        return;
    }
    if (!Number.isFinite(age) || age < 19) {
        if (typeof showToast === 'function') showToast(i18n.ageRequired || 'Character age must be 19 or older.');
        return;
    }
    if (!personality) {
        if (typeof showToast === 'function') showToast(i18n.personalityRequired || 'Please enter the character personality.');
        return;
    }
    if (typeof showLoader === 'function') showLoader(true);
    if (typeof showToast === 'function') showToast(i18n.creating || 'Character post is being created...');
    try {
        const result = await uploadAndSaveImage(imgElement.src, promptText, {
            storageMode: 'imgur',
            shareKind: 'character',
            reuseExistingPage: false,
            persona: {
                name,
                age,
                personality,
                speech_style: speechStyle,
                background: promptText
            }
        });
        const newUrl = window.location.pathname + '?v=' + result.shareId;
        window.history.pushState({ path: newUrl }, '', newUrl);
        if (window.__ISAI_SHARE_CONTEXT__) {
            window.__ISAI_SHARE_CONTEXT__.id = Number(result.dbId || window.__ISAI_SHARE_CONTEXT__.id || 0) || 0;
            window.__ISAI_SHARE_CONTEXT__.shareId = result.shareId;
            window.__ISAI_SHARE_CONTEXT__.shareKind = 'character';
            window.__ISAI_SHARE_CONTEXT__.isShared = true;
            window.__ISAI_SHARE_CONTEXT__.hasPersona = true;
        }
        syncImageModalActionButtons();
        closeCharacterShareModal();
        if (typeof showToast === 'function') showToast(i18n.created || 'Character post created successfully!');
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast('Error: ' + e.message);
        else alert('Error: ' + e.message);
    } finally {
        if (typeof showLoader === 'function') showLoader(false);
    }
}

function openImageShareReportModal() {
    const context = getCurrentShareContext();
    if (!context.isShared || !context.id) {
        if (typeof showToast === 'function') showToast('Saved image post not found.');
        return;
    }
    const modal = document.getElementById('image-report-modal');
    const textarea = document.getElementById('image-report-reason');
    if (textarea) textarea.value = '';
    if (modal) modal.classList.remove('hidden');
}

function closeImageShareReportModal() {
    const modal = document.getElementById('image-report-modal');
    if (modal) modal.classList.add('hidden');
}

async function submitImageShareReport() {
    const i18n = getImageReportI18n();
    const context = getCurrentShareContext();
    const textarea = document.getElementById('image-report-reason');
    const reason = String(textarea?.value || '').trim();
    if (!context.isShared || !context.id) {
        if (typeof showToast === 'function') showToast('Saved image post not found.');
        return;
    }
    if (!reason) {
        if (typeof showToast === 'function') showToast(i18n.placeholder || 'Write the reason for this report');
        return;
    }
    try {
        const res = await fetch('re_store.php?action=submit_content_report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_type: 'gallery',
                target_id: context.id,
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
            window.setTimeout(() => {
                window.location.href = '/';
            }, 700);
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

window.addEventListener('DOMContentLoaded', syncImageModalActionButtons);
window.addEventListener('popstate', syncImageModalActionButtons);
