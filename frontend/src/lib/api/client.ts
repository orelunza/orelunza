import { API_ROUTES, REQUEST_TIMEOUT_MS, apiUrl } from '$lib/config';

import { ApiError } from '$lib/api/ApiError';

import {
	isApiEnvelope,
	isApiErrorResponse,
	type ApiErrorResponse,
	type ApiRequestOptions,
	type HttpMethod,
	type JsonValue,
	type QueryParameters
} from '$lib/api/contracts/common';

export interface ApiClient {
	request<TResponse, TBody = unknown>(
		method: HttpMethod,
		path: string,
		options?: ApiRequestOptions<TBody>
	): Promise<TResponse>;

	get<TResponse>(path: string, options?: ApiRequestOptions<never>): Promise<TResponse>;

	post<TResponse, TBody = unknown>(
		path: string,
		body?: TBody,
		options?: ApiRequestOptions<TBody>
	): Promise<TResponse>;

	put<TResponse, TBody = unknown>(
		path: string,
		body?: TBody,
		options?: ApiRequestOptions<TBody>
	): Promise<TResponse>;

	patch<TResponse, TBody = unknown>(
		path: string,
		body?: TBody,
		options?: ApiRequestOptions<TBody>
	): Promise<TResponse>;

	delete<TResponse, TBody = unknown>(
		path: string,
		options?: ApiRequestOptions<TBody>
	): Promise<TResponse>;
}

interface ParsedResponse {
	payload: unknown;
	hasBody: boolean;
}

function buildQueryString(query: QueryParameters | undefined): string {
	if (!query) {
		return '';
	}

	const parameters = new URLSearchParams();

	for (const [key, rawValue] of Object.entries(query)) {
		const values = Array.isArray(rawValue) ? rawValue : [rawValue];

		for (const value of values) {
			if (value === undefined || value === null) {
				continue;
			}

			parameters.append(key, String(value));
		}
	}

	return parameters.toString();
}

function buildUrl(path: string, query: QueryParameters | undefined): string {
	const base = apiUrl(path);
	const queryString = buildQueryString(query);

	if (!queryString) {
		return base;
	}

	return `${base}${base.includes('?') ? '&' : '?'}${queryString}`;
}

function isInstanceOf<T>(constructorName: string, value: unknown): value is T {
	const constructor = (globalThis as Record<string, unknown>)[constructorName];

	return (
		typeof constructor === 'function' &&
		value instanceof (constructor as new (...args: never[]) => object)
	);
}

function isNativeBody(value: unknown): value is BodyInit {
	return (
		typeof value === 'string' ||
		isInstanceOf<Blob>('Blob', value) ||
		isInstanceOf<FormData>('FormData', value) ||
		isInstanceOf<URLSearchParams>('URLSearchParams', value) ||
		isInstanceOf<ArrayBuffer>('ArrayBuffer', value) ||
		ArrayBuffer.isView(value) ||
		isInstanceOf<ReadableStream<Uint8Array>>('ReadableStream', value)
	);
}

function prepareBody(body: unknown, headers: Headers): BodyInit | undefined {
	if (body === undefined) {
		return undefined;
	}

	if (isNativeBody(body)) {
		return body;
	}

	if (!headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json; charset=utf-8');
	}

	return JSON.stringify(body);
}

async function parseResponse(response: Response): Promise<ParsedResponse> {
	if (response.status === 204 || response.status === 205) {
		return {
			payload: undefined,
			hasBody: false
		};
	}

	const text = await response.text();

	if (!text.trim()) {
		return {
			payload: undefined,
			hasBody: false
		};
	}

	const contentType = response.headers.get('Content-Type') ?? '';

	if (contentType.includes('application/json') || contentType.includes('+json')) {
		try {
			return {
				payload: JSON.parse(text) as JsonValue,

				hasBody: true
			};
		} catch (error) {
			throw new ApiError('The server returned invalid JSON.', {
				status: response.status,

				statusText: response.statusText,

				code: 'invalid_json_response',

				payload: text,
				cause: error
			});
		}
	}

	return {
		payload: text,
		hasBody: true
	};
}

function fallbackErrorResponse(response: Response, payload: unknown): ApiErrorResponse {
	const message =
		typeof payload === 'string' && payload.trim()
			? payload
			: response.statusText || 'The request failed.';

	return {
		ok: false,
		error: `http_${response.status}`,
		message
	};
}

function createAbortContext(
	externalSignal: AbortSignal | undefined,
	timeoutMs: number
): {
	signal: AbortSignal;
	didTimeout: () => boolean;
	cleanup: () => void;
} {
	const controller = new AbortController();

	let timedOut = false;

	const abortFromExternalSignal = () => {
		controller.abort(externalSignal?.reason);
	};

	if (externalSignal) {
		if (externalSignal.aborted) {
			abortFromExternalSignal();
		} else {
			externalSignal.addEventListener('abort', abortFromExternalSignal, {
				once: true
			});
		}
	}

	const timeout =
		timeoutMs > 0
			? globalThis.setTimeout(() => {
					timedOut = true;

					controller.abort(new DOMException('The request timed out.', 'TimeoutError'));
				}, timeoutMs)
			: undefined;

	return {
		signal: controller.signal,

		didTimeout: () => timedOut,

		cleanup: () => {
			if (timeout !== undefined) {
				globalThis.clearTimeout(timeout);
			}

			externalSignal?.removeEventListener('abort', abortFromExternalSignal);
		}
	};
}

/**
 * Create an Orelunza API client.
 *
 * A custom fetch implementation can be supplied by unit tests.
 */
export function createApiClient(fetcher?: typeof fetch): ApiClient {
	async function request<TResponse, TBody = unknown>(
		method: HttpMethod,
		path: string,
		options: ApiRequestOptions<TBody> = {}
	): Promise<TResponse> {
		const {
			query,
			body: requestBody,
			timeoutMs: configuredTimeout,
			signal: externalSignal,
			headers: customHeaders,
			credentials,
			cache,
			mode,
			redirect,
			referrer,
			referrerPolicy,
			integrity,
			keepalive
		} = options;

		const url = buildUrl(path, query);

		const headers = new Headers(customHeaders);

		if (!headers.has('Accept')) {
			headers.set('Accept', 'application/json');
		}

		const canContainBody = method !== 'GET';

		const body = canContainBody ? prepareBody(requestBody, headers) : undefined;

		const timeoutMs = configuredTimeout ?? REQUEST_TIMEOUT_MS;

		const abortContext = createAbortContext(externalSignal, timeoutMs);

		const requestInit: RequestInit = {
			method,
			headers,
			body,

			signal: abortContext.signal,

			credentials: credentials ?? 'include'
		};

		if (cache !== undefined) {
			requestInit.cache = cache;
		}

		if (mode !== undefined) {
			requestInit.mode = mode;
		}

		if (redirect !== undefined) {
			requestInit.redirect = redirect;
		}

		if (referrer !== undefined) {
			requestInit.referrer = referrer;
		}

		if (referrerPolicy !== undefined) {
			requestInit.referrerPolicy = referrerPolicy;
		}

		if (integrity !== undefined) {
			requestInit.integrity = integrity;
		}

		if (keepalive !== undefined) {
			requestInit.keepalive = keepalive;
		}

		try {
			const response = await (fetcher ?? globalThis.fetch)(url, requestInit);

			let parsed: ParsedResponse;

			try {
				parsed = await parseResponse(response);
			} catch (error) {
				if (error instanceof ApiError) {
					throw new ApiError(error.message, {
						status: response.status,

						statusText: response.statusText,

						code: error.code,

						method,
						url,

						payload: error.payload,

						cause: error.cause
					});
				}

				throw error;
			}

			if (!response.ok) {
				const payload = isApiErrorResponse(parsed.payload)
					? parsed.payload
					: fallbackErrorResponse(response, parsed.payload);

				throw ApiError.fromResponse(response, payload, {
					method,
					url
				});
			}

			if (isApiEnvelope(parsed.payload) && parsed.payload.ok === false) {
				const payload: ApiErrorResponse = isApiErrorResponse(parsed.payload)
					? parsed.payload
					: {
							ok: false,

							error: 'api_request_failed',

							message: 'The API request failed.'
						};

				throw ApiError.fromResponse(response, payload, {
					method,
					url
				});
			}

			if (!parsed.hasBody) {
				return undefined as TResponse;
			}

			return parsed.payload as TResponse;
		} catch (error) {
			if (error instanceof ApiError) {
				throw error;
			}

			if (abortContext.didTimeout()) {
				throw new ApiError(`The request exceeded ${timeoutMs} ms.`, {
					code: 'request_timeout',

					method,
					url,
					cause: error
				});
			}

			if (externalSignal?.aborted || abortContext.signal.aborted) {
				throw new ApiError('The request was cancelled.', {
					code: 'request_aborted',

					method,
					url,
					cause: error
				});
			}

			throw new ApiError('Unable to reach the Orelunza server.', {
				code: 'network_error',

				method,
				url,
				cause: error
			});
		} finally {
			abortContext.cleanup();
		}
	}

	return {
		request,

		get<TResponse>(path: string, options: ApiRequestOptions<never> = {}): Promise<TResponse> {
			return request<TResponse>('GET', path, options);
		},

		post<TResponse, TBody = unknown>(
			path: string,
			body?: TBody,
			options: ApiRequestOptions<TBody> = {}
		): Promise<TResponse> {
			return request<TResponse, TBody>('POST', path, {
				...options,
				body
			});
		},

		put<TResponse, TBody = unknown>(
			path: string,
			body?: TBody,
			options: ApiRequestOptions<TBody> = {}
		): Promise<TResponse> {
			return request<TResponse, TBody>('PUT', path, {
				...options,
				body
			});
		},

		patch<TResponse, TBody = unknown>(
			path: string,
			body?: TBody,
			options: ApiRequestOptions<TBody> = {}
		): Promise<TResponse> {
			return request<TResponse, TBody>('PATCH', path, {
				...options,
				body
			});
		},

		delete<TResponse, TBody = unknown>(
			path: string,
			options: ApiRequestOptions<TBody> = {}
		): Promise<TResponse> {
			return request<TResponse, TBody>('DELETE', path, options);
		}
	};
}

/**
 * Shared application API client.
 */
export const apiClient = createApiClient();

/**
 * Stable module route prefixes available to API clients.
 */
export const apiRoutes = API_ROUTES;
