const MOBILE_PAIRING_KEY = 'dmxmoney.securePairingToken';
const MOBILE_API_BASE_KEY = 'dmxmoney.secureApiBaseUrl';
const MOBILE_CSRF_KEY = 'dmxmoney.secureCsrfToken';
const MOBILE_PASSKEY_READY_KEY = 'dmxmoney.securePasskeyReady';

const getHashParamsFromValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
        const url = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'https://dmxmoney.develop-max.com');
        const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
        if (hash) return new URLSearchParams(hash);
    } catch {
        // The input may already be a raw fragment or query string.
    }

    const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
    return new URLSearchParams(raw);
};

export const hasTauriRuntime = () => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
};

export const isMobileCompanion = () => {
    if (typeof window === 'undefined' || hasTauriRuntime()) return false;
    return window.location.pathname.startsWith('/mobile')
        || Boolean(localStorage.getItem(MOBILE_API_BASE_KEY));
};

export const isStandalonePwa = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(display-mode: standalone)').matches
        || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
};

export const getMobilePlatform = (): 'ios' | 'android' | 'other' => {
    if (typeof navigator === 'undefined') return 'other';
    const userAgent = navigator.userAgent;
    const platform = navigator.platform || '';
    if (/iPhone|iPad|iPod/i.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        return 'ios';
    }
    if (/Android/i.test(userAgent)) return 'android';
    return 'other';
};

export const initializeMobileCompanionToken = () => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
    if (!hash) return;

    const params = getHashParamsFromValue(hash);
    if (!params) return;
    const pairing = params.get('pairing');
    const api = params.get('api');

    if (pairing || api) {
        localStorage.removeItem(MOBILE_CSRF_KEY);
    }

    if (pairing) localStorage.setItem(MOBILE_PAIRING_KEY, pairing);
    if (api) localStorage.setItem(MOBILE_API_BASE_KEY, api.replace(/\/$/, ''));

    if (pairing || api) {
        window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
    }
};

export const applyMobileCompanionPairingUrl = (value: string) => {
    if (typeof window === 'undefined') {
        return { ok: false, error: 'Navigateur indisponible.' };
    }

    const params = getHashParamsFromValue(value);
    const pairing = params?.get('pairing');
    const api = params?.get('api');

    if (!pairing && !api) {
        return { ok: false, error: 'Lien QR invalide. Le lien doit contenir pairing/api.' };
    }

    if (pairing || api) {
        localStorage.removeItem(MOBILE_CSRF_KEY);
    }

    if (pairing) localStorage.setItem(MOBILE_PAIRING_KEY, pairing);
    if (api) localStorage.setItem(MOBILE_API_BASE_KEY, api.replace(/\/$/, ''));

    return { ok: true, error: null };
};

export const getMobileApiBaseUrl = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(MOBILE_API_BASE_KEY);
};

export const getMobilePairingToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(MOBILE_PAIRING_KEY);
};

export const hasMobileCompanionSetup = () => {
    if (typeof window === 'undefined') return false;
    return Boolean(
        localStorage.getItem(MOBILE_PAIRING_KEY)
        || localStorage.getItem(MOBILE_API_BASE_KEY)
        || localStorage.getItem(MOBILE_CSRF_KEY)
    );
};

export const hasMobilePasskeySetup = () => {
    if (typeof window === 'undefined') return false;
    return Boolean(localStorage.getItem(MOBILE_PASSKEY_READY_KEY))
        || Boolean(localStorage.getItem(MOBILE_API_BASE_KEY) && !localStorage.getItem(MOBILE_PAIRING_KEY));
};

export const markMobilePasskeyReady = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MOBILE_PASSKEY_READY_KEY, '1');
};

export const clearMobilePairingToken = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(MOBILE_PAIRING_KEY);
};

export const clearMobileCompanionLocalState = () => {
    if (typeof window === 'undefined') return;

    Object.keys(localStorage)
        .filter(key => key.startsWith('dmxmoney.'))
        .forEach(key => localStorage.removeItem(key));

    sessionStorage.clear();
};

export const getMobileCsrfToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(MOBILE_CSRF_KEY);
};

export const setMobileCsrfToken = (token: string | null) => {
    if (typeof window === 'undefined') return;
    if (token) localStorage.setItem(MOBILE_CSRF_KEY, token);
    else localStorage.removeItem(MOBILE_CSRF_KEY);
};
