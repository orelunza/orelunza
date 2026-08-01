import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '$lib/api/ApiError';

import type { IdentitySession } from '$lib/api/contracts/identity';

import { sessionState } from '$lib/state/session.svelte';

const fetchMock = vi.fn<typeof fetch>();

const authenticatedIdentity: IdentitySession = {
	account_id: 'account-1',
	human_id: 'human-1',
	persona_id: 'persona-1',

	email: 'citizen@orelunza.test',
	display_name: 'Forest Citizen',
	avatar: '/avatars/citizen.png',

	active: true,
	email_verified: true,

	session_id: 'session-1',
	session_expires_at: 1_799_000_000
};

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,

		headers: {
			'content-type': 'application/json'
		}
	});
}

/**
 * Identity endpoints normally return their data inside `identity`.
 *
 * The additional `session` property keeps the fixture descriptive and is
 * ignored by clients that do not use it.
 */
function identityResponse(identity = authenticatedIdentity): Response {
	return jsonResponse({
		ok: true,
		identity,
		session: identity
	});
}

function requestUrl(input: RequestInfo | URL): string {
	if (input instanceof Request) {
		return input.url;
	}

	return String(input);
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
	if (input instanceof Request) {
		return input.method.toUpperCase();
	}

	return init?.method?.toUpperCase() ?? 'GET';
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
	if (input instanceof Request) {
		const request = input.clone();

		if (request.method === 'GET' || request.method === 'HEAD') {
			return null;
		}

		const text = await request.text();

		return text ? JSON.parse(text) : null;
	}

	if (typeof init?.body !== 'string') {
		return null;
	}

	return JSON.parse(init.body);
}

describe('sessionState', () => {
	beforeEach(() => {
		fetchMock.mockReset();

		vi.stubGlobal('fetch', fetchMock);

		sessionState.reset();
	});

	afterEach(() => {
		sessionState.reset();

		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('starts without an authenticated identity', () => {
		expect(sessionState.identity).toBeNull();

		expect(sessionState.isAuthenticated).toBe(false);

		expect(sessionState.displayName).toBe('');

		expect(sessionState.humanId).toBe('');

		expect(sessionState.avatar).toBe('');

		expect(sessionState.error).toBeNull();
		expect(sessionState.status).toBe('idle');
	});

	it('loads the current identity from the active session', async () => {
		fetchMock.mockResolvedValueOnce(identityResponse());

		await sessionState.refresh();

		expect(fetchMock).toHaveBeenCalledTimes(1);

		expect(requestUrl(fetchMock.mock.calls[0][0])).toContain('/api/identity/me');

		expect(sessionState.identity).toEqual(authenticatedIdentity);

		expect(sessionState.status).toBe('authenticated');

		expect(sessionState.isAuthenticated).toBe(true);

		expect(sessionState.displayName).toBe('Forest Citizen');

		expect(sessionState.humanId).toBe('human-1');

		expect(sessionState.avatar).toBe('/avatars/citizen.png');

		expect(sessionState.error).toBeNull();
	});

	it('becomes anonymous when the current session is unauthorized', async () => {
		sessionState.identity = {
			...authenticatedIdentity
		};

		fetchMock.mockResolvedValueOnce(
			jsonResponse(
				{
					ok: false,
					error: 'unauthorized',
					message: 'Authentication is required.'
				},
				401
			)
		);

		await sessionState.refresh();

		expect(sessionState.identity).toBeNull();

		expect(sessionState.isAuthenticated).toBe(false);

		expect(sessionState.status).toBe('anonymous');

		expect(sessionState.error).toBeNull();
	});

	it('authenticates a citizen with email and password', async () => {
		fetchMock.mockResolvedValueOnce(identityResponse());

		await sessionState.login({
			email: 'citizen@orelunza.test',

			password: 'correct-horse-battery-staple'
		});

		expect(sessionState.identity).toEqual(authenticatedIdentity);

		expect(sessionState.status).toBe('authenticated');

		expect(sessionState.isAuthenticated).toBe(true);

		const [input, init] = fetchMock.mock.calls[0];

		expect(requestUrl(input)).toContain('/api/identity/login');

		expect(requestMethod(input, init)).toBe('POST');

		expect(await requestBody(input, init)).toEqual({
			email: 'citizen@orelunza.test',

			password: 'correct-horse-battery-staple'
		});
	});

	it('registers a new citizen and stores the returned session', async () => {
		fetchMock.mockResolvedValueOnce(identityResponse());

		await sessionState.register({
			email: 'citizen@orelunza.test',

			password: 'correct-horse-battery-staple',

			display_name: 'Forest Citizen',

			avatar: '/avatars/citizen.png'
		});

		expect(sessionState.identity).toEqual(authenticatedIdentity);

		expect(sessionState.status).toBe('authenticated');

		const [input, init] = fetchMock.mock.calls[0];

		expect(requestUrl(input)).toContain('/api/identity/register');

		expect(requestMethod(input, init)).toBe('POST');

		expect(await requestBody(input, init)).toEqual({
			email: 'citizen@orelunza.test',

			password: 'correct-horse-battery-staple',

			display_name: 'Forest Citizen',

			avatar: '/avatars/citizen.png'
		});
	});

	it('normalizes camelCase registration display names for the backend', async () => {
		fetchMock.mockResolvedValueOnce(identityResponse());

		await sessionState.register({
			email: 'citizen@orelunza.test',

			password: 'correct-horse-battery-staple',

			displayName: 'Forest Citizen'
		});

		const [input, init] = fetchMock.mock.calls[0];

		expect(await requestBody(input, init)).toEqual({
			email: 'citizen@orelunza.test',

			password: 'correct-horse-battery-staple',

			display_name: 'Forest Citizen'
		});
	});

	it('clears the local identity after logout', async () => {
		sessionState.identity = {
			...authenticatedIdentity
		};

		sessionState.status = 'authenticated';

		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				ok: true
			})
		);

		await sessionState.logout();

		expect(sessionState.identity).toBeNull();

		expect(sessionState.status).toBe('anonymous');

		expect(sessionState.isAuthenticated).toBe(false);

		expect(sessionState.error).toBeNull();

		const [input, init] = fetchMock.mock.calls[0];

		expect(requestUrl(input)).toContain('/api/identity/logout');

		expect(requestMethod(input, init)).toBe('POST');
	});

	it('clears the local session even when logout fails', async () => {
		sessionState.identity = {
			...authenticatedIdentity
		};

		sessionState.status = 'authenticated';

		fetchMock.mockResolvedValueOnce(
			jsonResponse(
				{
					ok: false,
					error: 'logout_failed',
					message: 'The server could not close the session.'
				},
				500
			)
		);

		await expect(sessionState.logout()).rejects.toBeInstanceOf(ApiError);

		expect(sessionState.identity).toBeNull();

		expect(sessionState.isAuthenticated).toBe(false);

		expect(sessionState.status).toBe('anonymous');
	});

	it('stores login errors and remains anonymous', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(
				{
					ok: false,
					error: 'invalid_credentials',

					message: 'The email or password is incorrect.'
				},
				401
			)
		);

		await expect(
			sessionState.login({
				email: 'citizen@orelunza.test',

				password: 'wrong-password'
			})
		).rejects.toMatchObject({
			name: 'ApiError',
			status: 401,
			code: 'invalid_credentials'
		});

		expect(sessionState.identity).toBeNull();

		expect(sessionState.isAuthenticated).toBe(false);

		expect(sessionState.status).toBe('anonymous');

		expect(sessionState.error).toBeInstanceOf(ApiError);

		expect(sessionState.error?.code).toBe('invalid_credentials');
	});

	it('clears a stored error without changing the identity', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(
				{
					ok: false,
					error: 'temporary_failure',

					message: 'Please try again.'
				},
				503
			)
		);

		await expect(
			sessionState.login({
				email: 'citizen@orelunza.test',

				password: 'password'
			})
		).rejects.toBeInstanceOf(ApiError);

		expect(sessionState.error).toBeInstanceOf(ApiError);

		sessionState.clearError();

		expect(sessionState.error).toBeNull();
		expect(sessionState.identity).toBeNull();
	});

	it('reset restores the initial state', async () => {
		fetchMock.mockResolvedValueOnce(identityResponse());

		await sessionState.login({
			email: 'citizen@orelunza.test',

			password: 'correct-horse-battery-staple'
		});

		expect(sessionState.isAuthenticated).toBe(true);

		sessionState.reset();

		expect(sessionState.identity).toBeNull();

		expect(sessionState.status).toBe('idle');

		expect(sessionState.error).toBeNull();

		expect(sessionState.isAuthenticated).toBe(false);
	});
});
