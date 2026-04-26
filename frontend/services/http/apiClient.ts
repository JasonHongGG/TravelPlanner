import { parseErrorResponse } from './parseError';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
    body?: unknown;
    fallbackMessage?: string;
    includeJsonContentType?: boolean;
};

export const apiUrl = (path: string): string => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
};

export const getAuthHeaders = (includeJsonContentType = true): Record<string, string> => {
    const headers: Record<string, string> = {
        'X-Correlation-ID': crypto.randomUUID()
    };
    if (includeJsonContentType) headers['Content-Type'] = 'application/json';

    const token = localStorage.getItem('google_auth_token');
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
};

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const includeJsonContentType = options.includeJsonContentType ?? true;
    const headers = {
        ...getAuthHeaders(includeJsonContentType),
        ...(options.headers as Record<string, string> | undefined)
    };
    const response = await fetch(apiUrl(path), {
        ...options,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (!response.ok) {
        throw await parseErrorResponse(response, options.fallbackMessage || 'Request failed');
    }

    return await response.json() as T;
}

export async function requestBlob(path: string, options: ApiRequestOptions = {}): Promise<Blob> {
    const includeJsonContentType = options.includeJsonContentType ?? true;
    const headers = {
        ...getAuthHeaders(includeJsonContentType),
        ...(options.headers as Record<string, string> | undefined)
    };
    const response = await fetch(apiUrl(path), {
        ...options,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (!response.ok) {
        throw await parseErrorResponse(response, options.fallbackMessage || 'Request failed');
    }

    return await response.blob();
}
