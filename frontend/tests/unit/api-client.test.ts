import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '$lib/api/ApiError';

import { apiClient } from '$lib/api/client';

interface SuccessPayload {
	ok: true;
	value: string;
}

interface RequestDetails {
	url: string;
	method: string;
	headers: Headers;
	body: string | null;
	credentials: RequestCredentials | undefined;
	signal: AbortSignal | null;
}

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(payload: unknown, status = 200, headers: HeadersInit = {}): Response {
	return new Response(JSON.stringify(payload), {
		status,

		headers: {
			'content-type': 'application/json',

			...Object.fromEntries(new Headers(headers))
		}
	});
}

async function readRequestDetails(
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<RequestDetails> {
	if (input instanceof Request) {
		const request = input.clone();

		return {
			url: request.url,
			method: request.method,
			headers: request.headers,
			body: request.method === 'GET' || request.method === 'HEAD' ? null : await request.text(),

			credentials: request.credentials,

			signal: request.signal
		};
	}

	return {
		url: String(input),
		method: init?.method?.toUpperCase() ?? 'GET',

		headers: new Headers(init?.headers),

		body: typeof init?.body === 'string' ? init.body : null,

		credentials: init?.credentials,

		signal: init?.signal instanceof AbortSignal ? init.signal : null
	};
}

describe('apiClient', () => {
	beforeEach(() => {
		fetchMock.mockReset();

		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('performs a GET request and returns the decoded JSON payload', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				ok: true,
				value: 'orelunza'
			})
		);

		const response = await apiClient.get<SuccessPayload>('/api/test');

		expect(response).toEqual({
			ok: true,
			value: 'orelunza'
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);

		const [input, init] = fetchMock.mock.calls[0];

		const request = await readRequestDetails(input, init);

		expect(request.url).toContain('/api/test');

		expect(request.method).toBe('GET');

		expect(request.headers.get('accept')).toContain('application/json');

		expect(request.credentials).toBe('include');
	});

	it('serializes POST request bodies as JSON', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				ok: true,
				value: 'created'
			})
		);

		const response = await apiClient.post<
			SuccessPayload,
			{
				name: string;
				enabled: boolean;
			}
		>('/api/test', {
			name: 'Forest',
			enabled: true
		});

		expect(response.value).toBe('created');

		const [input, init] = fetchMock.mock.calls[0];

		const request = await readRequestDetails(input, init);

		expect(request.method).toBe('POST');

		expect(request.headers.get('content-type')).toContain('application/json');

		expect(JSON.parse(request.body ?? '')).toEqual({
			name: 'Forest',
			enabled: true
		});
	});

	it('preserves custom request headers', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				ok: true,
				value: 'authorized'
			})
		);

		await apiClient.get<SuccessPayload>('/api/protected', {
			headers: {
				'x-request-id': 'request-123'
			}
		});

		const [input, init] = fetchMock.mock.calls[0];

		const request = await readRequestDetails(input, init);

		expect(request.headers.get('x-request-id')).toBe('request-123');
	});

	it('returns undefined for a successful empty response', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(null, {
				status: 204
			})
		);

		const response = await apiClient.delete<void>('/api/test');

		expect(response).toBeUndefined();
	});

	it('throws ApiError for a non-successful HTTP response', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(
				{
					ok: false,
					error: 'place_not_found',
					message: 'The requested place does not exist.',

					details: {
						place_id: 'missing-place'
					}
				},
				404
			)
		);

		let capturedError: unknown = null;

		try {
			await apiClient.get('/api/world/places/missing-place');
		} catch (error) {
			capturedError = error;
		}

		expect(capturedError).toBeInstanceOf(ApiError);

		const apiError = capturedError as ApiError;

		expect(apiError.status).toBe(404);

		expect(apiError.code).toBe('place_not_found');

		expect(apiError.message).toBe('The requested place does not exist.');

		expect(apiError.details).toEqual({
			place_id: 'missing-place'
		});

		expect(apiError.isNotFound).toBe(true);
	});

	it('throws ApiError when a successful HTTP response contains ok false', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				ok: false,
				error: 'operation_rejected',
				message: 'The operation was rejected.'
			})
		);

		await expect(
			apiClient.post('/api/test', {
				value: 1
			})
		).rejects.toMatchObject({
			name: 'ApiError',
			code: 'operation_rejected',
			message: 'The operation was rejected.'
		});
	});

	it('converts network failures into ApiError', async () => {
		fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

		let capturedError: unknown = null;

		try {
			await apiClient.get('/api/unavailable');
		} catch (error) {
			capturedError = error;
		}

		expect(capturedError).toBeInstanceOf(ApiError);

		const apiError = capturedError as ApiError;

		expect(apiError.status).toBe(0);
		expect(apiError.code).toBe('network_error');

		expect(apiError.isNetworkError).toBe(true);
	});

	it('forwards an AbortSignal to fetch', async () => {
		const controller = new AbortController();

		fetchMock.mockImplementationOnce(async (input, init): Promise<Response> => {
			const request = await readRequestDetails(input, init);

			expect(request.signal).toBeInstanceOf(AbortSignal);
			expect(request.signal?.aborted).toBe(false);

			return jsonResponse({
				ok: true,
				value: 'not-aborted'
			});
		});

		const response = await apiClient.get<SuccessPayload>('/api/test', {
			signal: controller.signal
		});

		expect(response.value).toBe('not-aborted');
	});

	it('distinguishes an aborted request from a network error', async () => {
		const controller = new AbortController();

		fetchMock.mockImplementationOnce(async () => {
			controller.abort();

			throw new DOMException('The operation was aborted.', 'AbortError');
		});

		let capturedError: unknown = null;

		try {
			await apiClient.get('/api/slow', {
				signal: controller.signal
			});
		} catch (error) {
			capturedError = error;
		}

		expect(capturedError).toBeInstanceOf(ApiError);

		const apiError = capturedError as ApiError;

		expect(apiError.code).toBe('request_aborted');

		expect(apiError.isAborted).toBe(true);

		expect(apiError.isNetworkError).toBe(false);
	});
});
