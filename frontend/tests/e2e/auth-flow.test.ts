import {
	expect,
	test,
	type Page,
	type Request as PlaywrightRequest,
	type Route
} from '@playwright/test';

interface TestIdentity {
	account_id: string;
	human_id: string;
	persona_id: string;

	email: string;
	display_name: string;
	avatar: string;

	active: boolean;
	email_verified: boolean;

	session_id: string;
	session_expires_at: number;
}

interface AuthBackendState {
	authenticated: boolean;
	identity: TestIdentity;

	lastLoginBody: Record<string, unknown> | null;
	lastRegisterBody: Record<string, unknown> | null;

	logoutCount: number;
}

const DEFAULT_IDENTITY: TestIdentity = {
	account_id: 'account-e2e-1',
	human_id: 'human-e2e-1',
	persona_id: 'persona-e2e-1',

	email: 'citizen@orelunza.test',
	display_name: 'Forest Citizen',
	avatar: '',

	active: true,
	email_verified: true,

	session_id: 'session-e2e-1',
	session_expires_at: 1_799_000_000
};

async function installCharacter(page: Page, humanId = DEFAULT_IDENTITY.human_id): Promise<void> {
	await page.addInitScript(
		({ key, value }) => {
			localStorage.setItem(key, value);
		},
		{
			key: `orelunza-character:${humanId}`,
			value: JSON.stringify({
				version: 1,
				displayName: 'Forest Citizen',
				skinTone: '#b98565',
				hairStyle: 'short',
				hairColor: '#3b2b22',
				shirtColor: '#4f8f74',
				pantsColor: '#37485f',
				shoesColor: '#2b2725'
			})
		}
	);
}

function normalizedPath(request: PlaywrightRequest): string {
	const pathname = new URL(request.url()).pathname;

	const normalized = pathname.replace(/\/+$/, '');

	return normalized || '/';
}

function responseHeaders(request: PlaywrightRequest): Record<string, string> {
	const origin = request.headers().origin;

	return {
		'content-type': 'application/json; charset=utf-8',

		'access-control-allow-origin': origin || '*',

		'access-control-allow-credentials': 'true',

		'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',

		'access-control-allow-headers': 'content-type, accept, authorization, x-request-id'
	};
}

async function fulfillJson(route: Route, payload: unknown, status = 200): Promise<void> {
	await route.fulfill({
		status,

		headers: responseHeaders(route.request()),

		body: JSON.stringify(payload)
	});
}

function identityPayload(identity: TestIdentity): Record<string, unknown> {
	return {
		ok: true,

		identity,
		profile: identity,
		session: identity,

		...identity
	};
}

function readJsonBody(request: PlaywrightRequest): Record<string, unknown> {
	try {
		const payload = request.postDataJSON();

		if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
			return payload as Record<string, unknown>;
		}
	} catch {
		/*
		 * A malformed body is handled as an empty object by the test backend.
		 */
	}

	return {};
}

async function installAuthBackend(page: Page): Promise<AuthBackendState> {
	const state: AuthBackendState = {
		authenticated: false,

		identity: {
			...DEFAULT_IDENTITY
		},

		lastLoginBody: null,
		lastRegisterBody: null,

		logoutCount: 0
	};

	await page.route('**/api/**', async (route) => {
		const request = route.request();

		const method = request.method().toUpperCase();

		const pathname = normalizedPath(request);

		if (method === 'OPTIONS') {
			await route.fulfill({
				status: 204,
				headers: responseHeaders(request)
			});

			return;
		}

		if (method === 'GET' && pathname === '/api/identity/me') {
			if (!state.authenticated) {
				await fulfillJson(
					route,
					{
						ok: false,
						error: 'unauthorized',
						message: 'Authentication is required.'
					},
					401
				);

				return;
			}

			await fulfillJson(route, identityPayload(state.identity));

			return;
		}

		if (method === 'POST' && pathname === '/api/identity/login') {
			const body = readJsonBody(request);

			state.lastLoginBody = body;

			const validCredentials =
				body.email === DEFAULT_IDENTITY.email && body.password === 'correct-password';

			if (!validCredentials) {
				await fulfillJson(
					route,
					{
						ok: false,
						error: 'invalid_credentials',

						message: 'The email or password is incorrect.'
					},
					401
				);

				return;
			}

			state.authenticated = true;

			await fulfillJson(route, identityPayload(state.identity));

			return;
		}

		if (method === 'POST' && pathname === '/api/identity/register') {
			const body = readJsonBody(request);

			state.lastRegisterBody = body;

			const email = typeof body.email === 'string' ? body.email : DEFAULT_IDENTITY.email;

			const displayName =
				typeof body.display_name === 'string' ? body.display_name : DEFAULT_IDENTITY.display_name;

			const avatar = typeof body.avatar === 'string' ? body.avatar : '';

			state.identity = {
				...DEFAULT_IDENTITY,
				email,
				display_name: displayName,
				avatar
			};

			state.authenticated = true;

			await fulfillJson(route, identityPayload(state.identity), 201);

			return;
		}

		if (method === 'POST' && pathname === '/api/identity/logout') {
			state.authenticated = false;
			state.logoutCount++;

			await fulfillJson(route, {
				ok: true
			});

			return;
		}

		await fulfillJson(
			route,
			{
				ok: false,
				error: 'not_found',
				message: `No test endpoint matches ${method} ${pathname}.`
			},
			404
		);
	});

	return state;
}

test.describe('authentication flow', () => {
	test('redirects an anonymous citizen to login', async ({ page }) => {
		await installAuthBackend(page);

		await page.goto('/profile');

		await expect(page).toHaveURL(/\/login(?:\?|$)/);

		await expect(page.locator('input[name="email"]')).toBeVisible();

		await expect(page.locator('input[name="password"]')).toBeVisible();
	});

	test('shows an error when the credentials are invalid', async ({ page }) => {
		const backend = await installAuthBackend(page);

		await page.goto('/login');

		await page.locator('input[name="email"]').fill('citizen@orelunza.test');

		await page.locator('input[name="password"]').fill('wrong-password');

		await page
			.getByRole('button', {
				name: /enter orelunza|sign in|log in|login/i
			})
			.click();

		await expect(page.getByText('The email address or password is incorrect.')).toBeVisible();

		expect(backend.authenticated).toBe(false);

		expect(backend.lastLoginBody).toEqual({
			email: 'citizen@orelunza.test',

			password: 'wrong-password'
		});

		await expect(page).toHaveURL(/\/login(?:\?|$)/);
	});

	test('logs in, opens the profile and logs out', async ({ page }) => {
		const backend = await installAuthBackend(page);
		await installCharacter(page);

		await page.goto('/login');

		await page.locator('input[name="email"]').fill('citizen@orelunza.test');

		await page.locator('input[name="password"]').fill('correct-password');

		await page
			.getByRole('button', {
				name: /enter orelunza|sign in|log in|login/i
			})
			.click();

		await expect(page).toHaveURL(/\/world(?:\?|$)/);

		expect(backend.authenticated).toBe(true);

		expect(backend.lastLoginBody).toEqual({
			email: 'citizen@orelunza.test',

			password: 'correct-password'
		});

		await page.goto('/profile');

		await expect(
			page.getByRole('heading', {
				name: 'Forest Citizen'
			})
		).toBeVisible();

		await expect(
			page.getByLabel('Citizen identity').getByText('citizen@orelunza.test', {
				exact: true
			})
		).toBeVisible();

		await page
			.getByRole('button', {
				name: /sign out|log out|logout/i
			})
			.click();

		await expect(page).toHaveURL(/\/login(?:\?|$)/);

		expect(backend.authenticated).toBe(false);

		expect(backend.logoutCount).toBe(1);
	});

	test('registers a new citizen and creates a session', async ({ page }) => {
		const backend = await installAuthBackend(page);

		await page.goto('/register');

		await page.locator('input[name="display_name"]').fill('River Citizen');

		await page.locator('input[name="email"]').fill('river@orelunza.test');

		await page.locator('input[name="password"]').fill('strong-registration-password');

		const confirmPassword = page.locator('input[name="confirm_password"]');

		if ((await confirmPassword.count()) > 0) {
			await confirmPassword.fill('strong-registration-password');
		}

		await page
			.getByRole('button', {
				name: /become a citizen|create account|register|join/i
			})
			.click();

		await expect(page).toHaveURL(/\/character\/create(?:\?|$)/);
		const preview = page.getByTestId('character-preview');
		await expect(preview).toBeVisible();
		await expect(preview).toHaveAttribute('data-avatar-ready', 'true', { timeout: 15_000 });
		await expect(preview).toHaveAttribute('data-avatar-kind', 'humanoid-rigged');
		await expect(preview).toHaveAttribute('data-avatar-pipeline', 'procedural-voxel');
		await expect(preview).toHaveAttribute('data-model-source', 'procedural-fallback');
		await expect(preview).toHaveAttribute('data-avatar-model-source', 'procedural-fallback');
		await expect(preview).toHaveAttribute('data-current-animation', 'idle');
		await expect(preview).toHaveAttribute('data-hat-visible', 'false');
		expect(Number(await preview.getAttribute('data-skinned-mesh-count'))).toBeGreaterThan(0);
		expect(Number(await preview.getAttribute('data-retargeted-clip-count'))).toBeGreaterThanOrEqual(
			9
		);
		expect(Number(await preview.getAttribute('data-target-skeleton-bone-count'))).toBeGreaterThan(
			40
		);
		expect(
			Number(await preview.getAttribute('data-avatar-animation-clips'))
		).toBeGreaterThanOrEqual(9);
		expect(Number(await preview.getAttribute('data-avatar-objects'))).toBeGreaterThan(60);
		expect(Number(await preview.getAttribute('data-avatar-triangles'))).toBeGreaterThan(500);

		await page.locator('select').selectOption('afro');
		await expect(preview).toHaveAttribute('data-hair-style', 'afro');
		await page.getByRole('button', { name: 'Skin tone #d1a17f' }).click();
		await expect(preview).toHaveAttribute('data-skin-tone', '#d1a17f');
		await page.getByRole('button', { name: 'Shirt color #f97316' }).click();
		await expect(preview).toHaveAttribute('data-shirt-color', '#f97316');

		expect(backend.authenticated).toBe(true);

		expect(backend.lastRegisterBody).toMatchObject({
			display_name: 'River Citizen',

			email: 'river@orelunza.test',

			password: 'strong-registration-password'
		});

		await page.goto('/profile');

		await expect(
			page.getByRole('heading', {
				name: 'River Citizen'
			})
		).toBeVisible();

		await expect(
			page.getByLabel('Citizen identity').getByText('river@orelunza.test', {
				exact: true
			})
		).toBeVisible();
	});
});
