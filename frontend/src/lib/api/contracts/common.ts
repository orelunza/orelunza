/**
 * Values accepted in JSON payloads.
 */
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
	| JsonPrimitive
	| JsonValue[]
	| {
			[key: string]: JsonValue;
	  };

/**
 * Base response returned by Orelunza endpoints.
 */
export interface ApiEnvelope {
	ok: boolean;
}

/**
 * Successful backend response.
 */
export interface ApiSuccessResponse extends ApiEnvelope {
	ok: true;
}

/**
 * Standard error returned by Vix.cpp modules.
 */
export interface ApiErrorResponse extends ApiEnvelope {
	ok: false;
	error: string;
	message: string;
	details?: JsonValue;
}

/**
 * Supported HTTP methods.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Values accepted in query parameters.
 */
export type QueryPrimitive = string | number | boolean | null | undefined;

export type QueryValue = QueryPrimitive | readonly QueryPrimitive[];

export type QueryParameters = Record<string, QueryValue>;

/**
 * Body values already understood directly by fetch.
 */
export type NativeRequestBody =
	| string
	| Blob
	| FormData
	| URLSearchParams
	| ArrayBuffer
	| ArrayBufferView
	| ReadableStream<Uint8Array>;

/**
 * Options accepted by the shared API client.
 */
export interface ApiRequestOptions<TBody = unknown> extends Omit<
	RequestInit,
	'body' | 'method' | 'signal'
> {
	body?: TBody;
	query?: QueryParameters;
	signal?: AbortSignal;
	timeoutMs?: number;
}

/**
 * Type guard for a standard backend error response.
 */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const candidate = value as Partial<ApiErrorResponse>;

	return (
		candidate.ok === false &&
		typeof candidate.error === 'string' &&
		typeof candidate.message === 'string'
	);
}

/**
 * Type guard for an object containing the Orelunza `ok` field.
 */
export function isApiEnvelope(value: unknown): value is ApiEnvelope {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	return typeof (value as Partial<ApiEnvelope>).ok === 'boolean';
}
