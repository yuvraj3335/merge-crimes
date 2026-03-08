const LOCAL_RUNTIME_HOSTS = new Set(['localhost', '127.0.0.1']);

function getLocalSearchParams(): URLSearchParams | null {
    if (typeof window === 'undefined') {
        return null;
    }

    if (window.location.protocol === 'file:') {
        return new URLSearchParams(window.location.search);
    }

    if (!LOCAL_RUNTIME_HOSTS.has(window.location.hostname)) {
        return null;
    }

    return new URLSearchParams(window.location.search);
}

export function getRuntimeApiBaseOverride(): string | null {
    const params = getLocalSearchParams();
    const apiBase = params?.get('apiBase')?.trim();
    return apiBase ? apiBase : null;
}

export function isLocalSmokeMode(): boolean {
    return getLocalSearchParams()?.get('smoke') === '1';
}
