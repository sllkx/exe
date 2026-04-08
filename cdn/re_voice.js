function getIsaiVoiceSettingsSafe() {
    const settings = (typeof window.getIsaiVoiceSettings === 'function')
        ? (window.getIsaiVoiceSettings() || {})
        : (window.ISAI_VOICE_SETTINGS || {});

    const merged = Object.assign({
        ttsEngine: 'browser',
        recognitionLang: 'auto',
        speechLang: 'auto',
        voiceName: '',
        rate: 1,
        pitch: 1,
        volume: 1
    }, settings || {});
    merged.ttsEngine = 'browser';
    return merged;
}

function stopSupertonicPlayback() {
    return;
}

async function parseJsonResponseSafeVoice(response) {
    if (typeof parseJsonResponseSafe === 'function') {
        return parseJsonResponseSafe(response);
    }
    const rawText = await response.text();
    const cleaned = String(rawText || '').replace(/^\uFEFF/, '').trimStart();
    return cleaned ? JSON.parse(cleaned) : {};
}

function getVoiceApiMaxChars() {
    const raw = Number(window.ISAI_API_MAX_CHARS || 700);
    if (!Number.isFinite(raw)) return 700;
    return Math.max(120, Math.min(4000, Math.floor(raw)));
}

function extractPlainTextVoice(value) {
    const normalized = String(value || '')
        .replace(/<think>[\s\S]*?(<\/think>|$)/gi, ' ')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
    const holder = document.createElement('div');
    holder.innerHTML = normalized;
    return String(holder.textContent || holder.innerText || normalized).replace(/\s+/g, ' ').trim();
}

function normalizeIsaiVoiceLang(langCode) {
    const raw = String(langCode || '').trim();
    const fallback = (typeof LANG !== 'undefined' && LANG === 'ko') ? 'ko-KR' : (navigator.language || 'en-US');
    if (!raw || raw === 'auto') return fallback;
    if (raw.includes('-')) return raw;

    const map = {
        ko: 'ko-KR',
        en: 'en-US',
        ja: 'ja-JP',
        zh: 'zh-CN',
        es: 'es-ES',
        fr: 'fr-FR',
        de: 'de-DE',
        ru: 'ru-RU',
        pt: 'pt-PT',
        hi: 'hi-IN'
    };

    return map[raw] || fallback;
}

function resolveVoiceLangCode(value, fallback = 'en-US') {
    if (typeof window.resolveSpeechLangCode === 'function') {
        return window.resolveSpeechLangCode(value, fallback);
    }

    const raw = String(value || '').trim();
    if (!raw) return normalizeIsaiVoiceLang(fallback);

    const alias = {
        en: 'en-US',
        english: 'en-US',
        ko: 'ko-KR',
        kr: 'ko-KR',
        korean: 'ko-KR',
        ja: 'ja-JP',
        jp: 'ja-JP',
        japanese: 'ja-JP',
        zh: 'zh-CN',
        cn: 'zh-CN',
        chinese: 'zh-CN',
        es: 'es-ES',
        sp: 'es-ES',
        spanish: 'es-ES',
        fr: 'fr-FR',
        french: 'fr-FR',
        de: 'de-DE',
        ge: 'de-DE',
        german: 'de-DE',
        ru: 'ru-RU',
        russian: 'ru-RU',
        pt: 'pt-PT',
        portuguese: 'pt-PT',
        hi: 'hi-IN',
        hindi: 'hi-IN'
    };

    if (/^[a-z]{2}-[a-z]{2}$/i.test(raw)) {
        const [lang, region] = raw.split('-');
        return `${String(lang).toLowerCase()}-${String(region).toUpperCase()}`;
    }

    const normalized = raw.toLowerCase().replace(/_/g, '-');
    if (alias[normalized]) return alias[normalized];

    return normalizeIsaiVoiceLang(raw || fallback);
}

function resolveSpeechVoiceByName(name, langCode) {
    const voices = window.speechSynthesis && typeof window.speechSynthesis.getVoices === 'function'
        ? window.speechSynthesis.getVoices()
        : [];

    if (!voices.length) return null;

    const voiceName = String(name || '').trim();
    if (voiceName) {
        const exactMatch = voices.find((voice) => voice.name === voiceName);
        if (exactMatch) return exactMatch;
    }

    const normalizedLang = String(langCode || '').toLowerCase();
    const langPrefix = normalizedLang.split('-')[0];
    return voices.find((voice) => String(voice.lang || '').toLowerCase() === normalizedLang)
        || voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith(`${langPrefix}-`))
        || voices[0]
        || null;
}

function updateRecognitionLang() {
    if (!recognition) return;

    let targetLangCode = 'en-US';

    if (currentMode === 'translate') {
        const leftEl = document.getElementById('trans-select-left');
        const rightEl = document.getElementById('trans-select-right');
        const leftVal = leftEl ? leftEl.value : 'English';
        const rightVal = rightEl ? rightEl.value : 'Korean';

        if (translationSide === 'left') {
            targetLangCode = resolveVoiceLangCode(leftVal, 'en-US');
        } else {
            targetLangCode = resolveVoiceLangCode(rightVal, 'ko-KR');
        }
    } else {
        const settings = getIsaiVoiceSettingsSafe();
        targetLangCode = normalizeIsaiVoiceLang(settings.recognitionLang);
    }

    recognition.lang = targetLangCode;
}

function beginListeningForSide(side) {
    translationSide = side;
    setTimeout(() => {
        try {
            isVoiceListening = true;
            if (typeof setVoiceState === 'function') setVoiceState(side, 'recording');
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
}

function initVoiceMode() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!window.SpeechRecognition) {
        if (typeof showToast === 'function') showToast('Browser does not support Speech Recognition.');
        if (typeof setMode === 'function') setMode('chat');
        if (typeof setVoiceState === 'function') setVoiceState('left', 'idle');
        return;
    }

    if (!recognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = function () {
            isVoiceListening = true;
            if (typeof setVoiceState === 'function') setVoiceState(translationSide, 'recording');
        };

        recognition.onend = function () {
            const activeVoiceMode = (currentMode === 'voice' || currentMode === 'translate');
            if (activeVoiceMode && isVoiceListening && !isVoiceProcessing) {
                try {
                    updateRecognitionLang();
                    recognition.start();
                    return;
                } catch (error) {}
            }

            isVoiceListening = false;
            if (typeof setVoiceState === 'function') setVoiceState(translationSide, 'idle');
        };

        recognition.onresult = function (event) {
            if (isVoiceProcessing) return;

            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                if (event.results[i].isFinal) final += event.results[i][0].transcript;
                else interim += event.results[i][0].transcript;
            }

            const input = document.getElementById('prompt-input');
            if (!input) return;

            if (interim) {
                input.value = interim;
                input.style.opacity = '0.7';
                if (typeof handleInput === 'function') handleInput(input);
            }

            if (!final) return;

            input.value = final.trim();
            input.style.opacity = '1';
            if (typeof handleInput === 'function') handleInput(input);

            if (!input.value) return;

            if (recognition) recognition.stop();

            if (currentMode === 'translate') {
                performTranslationRequest(input.value, translationSide);
            } else {
                performVoiceConversationRequest(input.value);
            }
        };

        recognition.onerror = function (event) {
            if (typeof console !== 'undefined' && console.error) console.error('Mic Error:', event.error);
            if (event.error === 'not-allowed' && typeof showToast === 'function') {
                showToast('Microphone permission denied.');
            }
            isVoiceListening = false;
            if (typeof setVoiceState === 'function') setVoiceState(translationSide, 'idle');
            if ((event.error === 'not-allowed' || event.error === 'service-not-allowed') && typeof setMode === 'function') {
                setMode('chat');
            }
        };
    }

    updateRecognitionLang();

    try {
        isVoiceListening = true;
        recognition.start();
    } catch (error) {
        if (typeof console !== 'undefined' && console.log) console.log('Recognition start ignored', error);
    }
}

async function performVoiceConversationRequest(text) {
    isVoiceProcessing = true;
    if (typeof setVoiceState === 'function') setVoiceState('left', 'processing');

    const input = document.getElementById('prompt-input');
    const userText = String(text || '').trim();
    if (!userText) {
        isVoiceProcessing = false;
        if (typeof setVoiceState === 'function') setVoiceState('left', 'idle');
        return;
    }

    if (input) {
        input.value = '';
        input.style.opacity = '1';
        if (typeof handleInput === 'function') handleInput(input);
    }

    if (typeof appendMsg === 'function') appendMsg('user', userText);
    if (typeof startExperience === 'function') startExperience();
    if (typeof showLoader === 'function') showLoader(true);

    try {
        let finalPrompt = userText;
        let sysPrompt = (typeof SYSTEM_PROMPTS !== 'undefined' && SYSTEM_PROMPTS[LANG])
            ? SYSTEM_PROMPTS[LANG]
            : 'You are a helpful AI.';

        if (typeof activeApp !== 'undefined' && activeApp && activeApp.system_prompt) {
            sysPrompt = activeApp.system_prompt;
        }

        if (typeof window.buildIsaiSystemPrompt === 'function') {
            sysPrompt = window.buildIsaiSystemPrompt(sysPrompt);
        }

        const history = Array.isArray(chatHistory) ? chatHistory.slice(-6) : [];
        const response = await fetch('?action=ai_chat', {
            method: 'POST',
            body: JSON.stringify({
                prompt: finalPrompt,
                history: history,
                system_prompt: sysPrompt,
                max_chars: getVoiceApiMaxChars()
            })
        });
        const data = await parseJsonResponseSafeVoice(response);

        if (!data || !data.response) {
            throw new Error(data && data.error ? data.error : 'Voice chat failed');
        }

        const bubbleHtml = (typeof parseMarkdownLocal === 'function')
            ? parseMarkdownLocal(data.response, true)
            : data.response;

        if (typeof appendMsg === 'function') appendMsg('ai', bubbleHtml);

        const historyResult = String(data.response).replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
        if (Array.isArray(chatHistory)) {
            chatHistory.push(
                { role: 'user', content: userText },
                { role: 'assistant', content: historyResult }
            );
        }

        if (typeof scrollBottom === 'function') scrollBottom();
        speakText(data.response);
    } catch (error) {
        isVoiceProcessing = false;
        if (typeof appendMsg === 'function') appendMsg('error', `Voice Error: ${error.message || error}`);
        if (typeof setVoiceState === 'function') setVoiceState('left', 'idle');
    } finally {
        if (typeof showLoader === 'function') showLoader(false);
    }
}

async function performTranslationRequest(text, side) {
    isVoiceProcessing = true;
    if (typeof setVoiceState === 'function') setVoiceState(side, 'processing');

    const input = document.getElementById('prompt-input');
    const userText = String(text || '').trim();
    if (!userText) {
        isVoiceProcessing = false;
        if (typeof setVoiceState === 'function') setVoiceState(side, 'idle');
        return;
    }

    if (input) {
        input.value = '';
        input.style.opacity = '1';
        if (typeof handleInput === 'function') handleInput(input);
    }

    if (typeof appendMsg === 'function') appendMsg('user', userText);

    const leftLang = document.getElementById('trans-select-left')?.value || 'English';
    const rightLang = document.getElementById('trans-select-right')?.value || 'Korean';
    const sourceLangName = side === 'left' ? leftLang : rightLang;
    const targetLangName = side === 'left' ? rightLang : leftLang;

    try {
        const res = await fetch('?action=ai_translate', {
            method: 'POST',
            body: JSON.stringify({ text: userText, source_lang: sourceLangName, target_lang: targetLangName })
        });
        const data = await parseJsonResponseSafeVoice(res);

        let resultText = data.response || '';
        let detectedLang = data.lang_code || '';
        try {
            if (data.response && typeof data.response === 'object') {
                resultText = data.response.text || resultText;
                detectedLang = data.response.lang_code || detectedLang;
            } else {
                const cleanRaw = String(data.response || '').replace(/```json/gi, '').replace(/```/g, '').trim();
                let clean = cleanRaw;
                const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
                if (jsonMatch) clean = jsonMatch[0];
                const parsed = JSON.parse(clean);
                resultText = parsed.text || resultText;
                detectedLang = parsed.lang_code || detectedLang;
            }
        } catch (error) {}

        const plainTranslatedText = extractPlainTextVoice(resultText);
        if (typeof appendMsg === 'function') {
            const translatedBubble = appendMsg('ai', plainTranslatedText);
            if (translatedBubble) {
                translatedBubble.style.color = '#111111';
                translatedBubble.style.fontWeight = '700';
            }
        }

        const targetCode = resolveVoiceLangCode(detectedLang || targetLangName, resolveVoiceLangCode(targetLangName, 'en-US'));
        speakText(plainTranslatedText, targetCode);
    } catch (error) {
        if (typeof console !== 'undefined' && console.error) console.error(error);
        isVoiceProcessing = false;
        if (isVoiceListening) {
            try {
                if (recognition) recognition.start();
            } catch (restartError) {}
            if (typeof setVoiceState === 'function') setVoiceState(side, 'recording');
        } else if (typeof setVoiceState === 'function') {
            setVoiceState(side, 'idle');
        }
    }
}

function stopVoiceMode(fullExit = true) {
    if (recognition) {
        if (fullExit) {
            recognition.onend = null;
            recognition.abort();
            recognition = null;
        } else {
            recognition.stop();
        }
    }

    isVoiceListening = false;
    if (typeof setVoiceState === 'function') setVoiceState(translationSide || 'left', 'idle');

    const input = document.getElementById('prompt-input');
    if (input) {
        input.placeholder = '';
        input.style.opacity = '1';
    }

    if (fullExit) {
        isVoiceProcessing = false;
        stopSupertonicPlayback();
        window.speechSynthesis.cancel();
        if (typeof window.stopIsaiTtsPreview === 'function') {
            window.stopIsaiTtsPreview();
        }
    }
}

function speakText(text, langCode = null) {
    if (currentMode !== 'voice' && currentMode !== 'translate') return;

    stopSupertonicPlayback();
    window.speechSynthesis.cancel();
    isVoiceProcessing = true;
    if (recognition) recognition.stop();

    if (typeof setVoiceState === 'function') setVoiceState(translationSide || 'left', 'processing');

    const cleanText = String(text || '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[*#`\[\]]/g, '')
        .replace(/<[^>]*>?/gm, '');

    const settings = getIsaiVoiceSettingsSafe();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const resolvedLang = normalizeIsaiVoiceLang(langCode || settings.speechLang);
    const selectedVoice = resolveSpeechVoiceByName(settings.voiceName, resolvedLang);

    utterance.lang = selectedVoice && selectedVoice.lang ? selectedVoice.lang : resolvedLang;
    utterance.rate = Math.max(0.7, Math.min(1.4, parseFloat(settings.rate) || 1));
    utterance.pitch = Math.max(0.6, Math.min(1.6, parseFloat(settings.pitch) || 1));
    utterance.volume = Math.max(0, Math.min(1, parseFloat(settings.volume) || 1));
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend = () => {
        isVoiceProcessing = false;
        if (currentMode === 'voice' || currentMode === 'translate') {
            beginListeningForSide(translationSide || 'left');
        } else if (typeof updateSubmitIcon === 'function') {
            updateSubmitIcon('mic');
        }
    };

    utterance.onerror = () => {
        isVoiceProcessing = false;
        if (currentMode === 'voice' || currentMode === 'translate') {
            if (typeof setVoiceState === 'function') setVoiceState(translationSide || 'left', 'idle');
        } else if (typeof updateSubmitIcon === 'function') {
            updateSubmitIcon('mic');
        }
    };

    window.speechSynthesis.speak(utterance);
}

function updateSubmitIcon(state, side = 'right') {
    if (typeof setVoiceState === 'function') {
        setVoiceState('left', state === 'mic' || state === 'default' ? 'idle' : state);
        return;
    }

    const btn = document.getElementById('btn-submit-left');
    const icon = document.getElementById('icon-submit-left');

    if (!btn || !icon) return;

    if (state === 'recording') {
        icon.className = 'ri-voiceprint-line text-lg text-white animate-mic-breath';
        btn.style.backgroundColor = '#ef4444';
    } else if (state === 'processing') {
        icon.className = 'ri-voiceprint-line text-lg text-white';
        btn.style.backgroundColor = '';
    } else {
        icon.className = 'ri-voiceprint-line text-lg text-white';
        btn.style.backgroundColor = '';
    }
}
