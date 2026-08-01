import { env } from '$env/dynamic/public';

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

function normalizeBaseUrl(value: string | undefined): string {
	const baseUrl = value?.trim() ?? '';

	if (!baseUrl) {
		return '';
	}

	if (
		!baseUrl.startsWith('/') &&
		!baseUrl.startsWith('http://') &&
		!baseUrl.startsWith('https://')
	) {
		throw new Error('PUBLIC_API_BASE_URL must be empty, root-relative, or an HTTP(S) URL.');
	}

	return baseUrl.replace(/\/+$/, '');
}

function normalizePath(path: string): string {
	const normalized = path.trim();

	if (!normalized) {
		throw new Error('An API path is required.');
	}

	return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

/**
 * Public API origin.
 *
 * An empty value means that relative URLs such as `/api/world` are used.
 */
export const API_BASE_URL = normalizeBaseUrl(env.PUBLIC_API_BASE_URL);

/**
 * Default timeout applied by the shared HTTP client.
 */
export const REQUEST_TIMEOUT_MS = DEFAULT_REQUEST_TIMEOUT_MS;

/**
 * Stable application metadata.
 */
export const APP_CONFIG = Object.freeze({
	name: 'Orelunza',
	description: 'A peaceful digital city.',
	apiBaseUrl: API_BASE_URL,
	requestTimeoutMs: REQUEST_TIMEOUT_MS
});

/**
 * Stable backend route prefixes.
 */
export const API_ROUTES = Object.freeze({
	identity: '/api/identity',
	world: '/api/world',
	nature: '/api/nature'
});

/**
 * Build a complete API URL from a relative API path.
 */
export function apiUrl(path: string): string {
	return `${API_BASE_URL}${normalizePath(path)}`;
}
