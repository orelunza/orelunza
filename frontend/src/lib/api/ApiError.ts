import type { ApiErrorResponse, JsonValue } from '$lib/api/contracts/common';

export interface ApiErrorContext {
	status?: number;
	statusText?: string;
	code?: string;
	method?: string;
	url?: string;
	details?: JsonValue;
	payload?: unknown;
	cause?: unknown;
}

/**
 * Error produced by the Orelunza HTTP client.
 */
export class ApiError extends Error {
	readonly status: number;
	readonly statusText: string;
	readonly code: string;
	readonly method: string;
	readonly url: string;
	readonly details?: JsonValue;
	readonly payload?: unknown;

	constructor(message: string, context: ApiErrorContext = {}) {
		super(message);

		this.name = 'ApiError';
		this.status = context.status ?? 0;
		this.statusText = context.statusText ?? '';
		this.code = context.code ?? 'unknown_error';
		this.method = context.method ?? '';
		this.url = context.url ?? '';
		this.details = context.details;
		this.payload = context.payload;

		if (context.cause !== undefined) {
			this.cause = context.cause;
		}
	}

	/**
	 * Return whether the error came from an HTTP response.
	 */
	get isHttpError(): boolean {
		return this.status >= 400;
	}

	/**
	 * Return whether the request failed before receiving a response.
	 */
	get isNetworkError(): boolean {
		return this.status === 0 && this.code === 'network_error';
	}

	/**
	 * Return whether the request exceeded its timeout.
	 */
	get isTimeout(): boolean {
		return this.code === 'request_timeout';
	}

	/**
	 * Return whether the request was cancelled.
	 */
	get isAborted(): boolean {
		return this.code === 'request_aborted';
	}

	/**
	 * Return whether authentication is required.
	 */
	get isUnauthorized(): boolean {
		return this.status === 401;
	}

	/**
	 * Return whether access is forbidden.
	 */
	get isForbidden(): boolean {
		return this.status === 403;
	}

	/**
	 * Return whether the requested resource was not found.
	 */
	get isNotFound(): boolean {
		return this.status === 404;
	}

	/**
	 * Test the stable backend error code.
	 */
	is(code: string): boolean {
		return this.code === code;
	}

	/**
	 * Create an ApiError from an Orelunza backend error response.
	 */
	static fromResponse(
		response: Response,
		payload: ApiErrorResponse,
		context: {
			method: string;
			url: string;
		}
	): ApiError {
		return new ApiError(payload.message || response.statusText || 'The request failed.', {
			status: response.status,
			statusText: response.statusText,
			code: payload.error || `http_${response.status}`,
			method: context.method,
			url: context.url,
			details: payload.details,
			payload
		});
	}

	/**
	 * Convert an unknown thrown value into an ApiError.
	 */
	static fromUnknown(error: unknown, context: ApiErrorContext = {}): ApiError {
		if (error instanceof ApiError) {
			return error;
		}

		if (error instanceof Error) {
			return new ApiError(error.message, {
				...context,
				cause: error
			});
		}

		return new ApiError('An unknown API error occurred.', {
			...context,
			cause: error
		});
	}
}

/**
 * Return whether a value is an ApiError.
 */
export function isApiError(value: unknown): value is ApiError {
	return value instanceof ApiError;
}
