import {
	expect,
	test,
	type Locator,
	type Page,
	type Request as PlaywrightRequest,
	type Route
} from '@playwright/test';

interface TestRegion {
	id: string;
	name: string;
	slug: string;
	description: string;

	enabled: boolean;
	created_at: number;
	updated_at: number;
}

interface TestPlace {
	id: string;
	region_id: string;

	name: string;
	description: string;
	type: string;

	position_x: number;
	position_y: number;

	enabled: boolean;
	created_at: number;
	updated_at: number;
}

interface TestPosition {
	human_id: string;
	region_id: string;
	place_id: string | null;

	position_x: number;
	position_y: number;

	updated_at: number;
}

interface TestBiome {
	id: string;
	name: string;
	slug: string;
	description: string;

	terrain_type: string;
	vegetation_type: string;

	enabled: boolean;
	created_at: number;
	updated_at: number;
}

interface TestNaturalArea {
	id: string;
	biome_id: string;
	region_id: string;
	place_id: string | null;

	name: string;
	description: string;

	enabled: boolean;
	created_at: number;
	updated_at: number;
}

interface TestEnvironment {
	natural_area_id: string;

	terrain_condition: string;
	vegetation_condition: string;
	ambient_description: string;

	vegetation_density: number;
	water_level: number;

	updated_at: number;
}

interface CityBackendState {
	position: TestPosition;
	moveRequests: Array<Record<string, unknown>>;
}

const NOW = 1_788_000_000;

const IDENTITY = {
	account_id: 'account-city-e2e',
	human_id: 'human-city-e2e',
	persona_id: 'persona-city-e2e',

	email: 'citizen@orelunza.test',
	display_name: 'Forest Citizen',
	avatar: '',

	active: true,
	email_verified: true,

	session_id: 'session-city-e2e',
	session_expires_at: 1_799_000_000
};

const REGIONS: TestRegion[] = [
	{
		id: 'region-green',
		name: 'Green Quarter',
		slug: 'green-quarter',

		description: 'A calm district of trees, gardens and old paths.',

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	},

	{
		id: 'region-river',
		name: 'River District',
		slug: 'river-district',

		description: 'A quiet district built alongside the river.',

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	}
];

const PLACES: TestPlace[] = [
	{
		id: 'place-garden',
		region_id: 'region-green',

		name: 'Community Garden',

		description: 'A shared garden where citizens can rest among plants.',

		type: 'garden',

		position_x: 220,
		position_y: 260,

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	},

	{
		id: 'place-library',
		region_id: 'region-green',

		name: 'Old Library',

		description: 'A silent library filled with books and warm wooden rooms.',

		type: 'library',

		position_x: 520,
		position_y: 330,

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	},

	{
		id: 'place-dock',
		region_id: 'region-river',

		name: 'River Dock',

		description: 'A wooden dock overlooking the slow river.',

		type: 'dock',

		position_x: 310,
		position_y: 420,

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	}
];

const BIOMES: TestBiome[] = [
	{
		id: 'biome-forest',
		name: 'Temperate Forest',
		slug: 'temperate-forest',

		description: 'A green biome with trees, grass and mild water levels.',

		terrain_type: 'forest',
		vegetation_type: 'woodland',

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	},

	{
		id: 'biome-wetland',
		name: 'River Wetland',
		slug: 'river-wetland',

		description: 'A wet biome shaped by the nearby river.',

		terrain_type: 'wetland',
		vegetation_type: 'river grass',

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	}
];

const AREAS: TestNaturalArea[] = [
	{
		id: 'area-green',
		biome_id: 'biome-forest',
		region_id: 'region-green',
		place_id: null,

		name: 'Green Quarter Woodland',

		description: 'The regional woodland surrounding Green Quarter.',

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	},

	{
		id: 'area-library',
		biome_id: 'biome-forest',
		region_id: 'region-green',
		place_id: 'place-library',

		name: 'Library Garden',

		description: 'An old garden growing quietly around the library.',

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	},

	{
		id: 'area-river',
		biome_id: 'biome-wetland',
		region_id: 'region-river',
		place_id: null,

		name: 'River District Wetland',

		description: 'The river and wet grass surrounding the district.',

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	},

	{
		id: 'area-dock',
		biome_id: 'biome-wetland',
		region_id: 'region-river',
		place_id: 'place-dock',

		name: 'Dock Riverside',

		description: 'The immediate riverside environment around the dock.',

		enabled: true,
		created_at: NOW,
		updated_at: NOW
	}
];

const ENVIRONMENTS: TestEnvironment[] = [
	{
		natural_area_id: 'area-green',

		terrain_condition: 'healthy',
		vegetation_condition: 'growing',

		ambient_description: 'Leaves move softly above the quiet paths.',

		vegetation_density: 0.82,
		water_level: 0.34,

		updated_at: NOW
	},

	{
		natural_area_id: 'area-library',

		terrain_condition: 'stable',
		vegetation_condition: 'mature',

		ambient_description: 'Old trees surround the library in complete silence.',

		vegetation_density: 0.76,
		water_level: 0.25,

		updated_at: NOW
	},

	{
		natural_area_id: 'area-river',

		terrain_condition: 'wet',
		vegetation_condition: 'dense',

		ambient_description: 'Water moves slowly beside the tall river grass.',

		vegetation_density: 0.68,
		water_level: 0.88,

		updated_at: NOW
	},

	{
		natural_area_id: 'area-dock',

		terrain_condition: 'damp',
		vegetation_condition: 'healthy',

		ambient_description: 'The dock creaks gently above the moving water.',

		vegetation_density: 0.48,
		water_level: 0.94,

		updated_at: NOW
	}
];

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

function readJsonBody(request: PlaywrightRequest): Record<string, unknown> {
	try {
		const payload = request.postDataJSON();

		if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
			return payload as Record<string, unknown>;
		}
	} catch {
		/*
		 * Invalid test request bodies are represented as an empty object.
		 */
	}

	return {};
}

function findRegion(regionId: string): TestRegion | undefined {
	return REGIONS.find((region) => region.id === regionId);
}

function findPlace(placeId: string): TestPlace | undefined {
	return PLACES.find((place) => place.id === placeId);
}

function placesForRegion(regionId: string): TestPlace[] {
	return PLACES.filter((place) => place.region_id === regionId);
}

function findBiome(biomeId: string): TestBiome | undefined {
	return BIOMES.find((biome) => biome.id === biomeId);
}

function findArea(areaId: string): TestNaturalArea | undefined {
	return AREAS.find((area) => area.id === areaId);
}

function areaForRegion(regionId: string): TestNaturalArea | undefined {
	return AREAS.find((area) => area.region_id === regionId && area.place_id === null);
}

function areaForPlace(placeId: string): TestNaturalArea | undefined {
	return AREAS.find((area) => area.place_id === placeId);
}

function findEnvironment(areaId: string): TestEnvironment | undefined {
	return ENVIRONMENTS.find((environment) => environment.natural_area_id === areaId);
}

function identityResponse(): Record<string, unknown> {
	return {
		ok: true,

		identity: IDENTITY,
		profile: IDENTITY,
		session: IDENTITY,

		...IDENTITY
	};
}

function regionResponse(region: TestRegion): Record<string, unknown> {
	return {
		ok: true,
		region,
		...region
	};
}

function placeResponse(place: TestPlace): Record<string, unknown> {
	return {
		ok: true,
		place,
		...place
	};
}

function areaResponse(area: TestNaturalArea | undefined): Record<string, unknown> {
	return {
		ok: true,

		area: area ?? null,
		natural_area: area ?? null,
		areas: area ? [area] : []
	};
}

function environmentResponse(environment: TestEnvironment | undefined): Record<string, unknown> {
	return {
		ok: true,

		environment: environment ?? null,

		state: environment ?? null,

		environment_state: environment ?? null
	};
}

async function installCityBackend(
	page: Page,
	options: {
		emptyWorld?: boolean;
	} = {}
): Promise<CityBackendState> {
	const regions = options.emptyWorld ? [] : REGIONS;
	const places = options.emptyWorld ? [] : PLACES;
	const state: CityBackendState = {
		position: {
			human_id: IDENTITY.human_id,

			region_id: 'region-green',

			place_id: 'place-garden',

			position_x: 220,
			position_y: 260,

			updated_at: NOW
		},

		moveRequests: []
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
			await fulfillJson(route, identityResponse());

			return;
		}

		if (method === 'POST' && pathname === '/api/identity/logout') {
			await fulfillJson(route, {
				ok: true
			});

			return;
		}

		if (method === 'GET' && pathname === '/api/world') {
			await fulfillJson(route, {
				ok: true,

				id: 'world-orelunza',
				world_id: 'world-orelunza',

				name: 'Orelunza',

				regions
			});

			return;
		}

		if (method === 'GET' && pathname === '/api/world/regions') {
			await fulfillJson(route, {
				ok: true,
				regions
			});

			return;
		}

		const regionPlacesMatch = pathname.match(/^\/api\/world\/regions\/([^/]+)\/places$/);

		if (method === 'GET' && regionPlacesMatch) {
			const regionId = decodeURIComponent(regionPlacesMatch[1]);

			const region = findRegion(regionId);

			if (!region) {
				await fulfillJson(
					route,
					{
						ok: false,
						error: 'region_not_found',

						message: 'The requested region does not exist.'
					},
					404
				);

				return;
			}

			await fulfillJson(route, {
				ok: true,

				region,
				places: placesForRegion(regionId)
			});

			return;
		}

		const regionMatch = pathname.match(/^\/api\/world\/regions\/([^/]+)$/);

		if (method === 'GET' && regionMatch) {
			const region = findRegion(decodeURIComponent(regionMatch[1]));

			if (!region) {
				await fulfillJson(
					route,
					{
						ok: false,
						error: 'region_not_found',

						message: 'The requested region does not exist.'
					},
					404
				);

				return;
			}

			await fulfillJson(route, regionResponse(region));

			return;
		}

		const placeMatch = pathname.match(/^\/api\/world\/places\/([^/]+)$/);

		if (method === 'GET' && placeMatch) {
			const place = findPlace(decodeURIComponent(placeMatch[1]));

			if (!place) {
				await fulfillJson(
					route,
					{
						ok: false,
						error: 'place_not_found',

						message: 'The requested place does not exist.'
					},
					404
				);

				return;
			}

			await fulfillJson(route, placeResponse(place));

			return;
		}

		if (method === 'GET' && pathname === '/api/world/me/position') {
			await fulfillJson(route, {
				ok: true,

				position: state.position,

				human_position: state.position
			});

			return;
		}

		if (method === 'POST' && pathname === '/api/world/me/move') {
			const body = readJsonBody(request);

			state.moveRequests.push(body);

			const placeId = typeof body.place_id === 'string' ? body.place_id : null;

			const place = placeId ? places.find((candidate) => candidate.id === placeId) : undefined;

			const regionId = typeof body.region_id === 'string' ? body.region_id : place?.region_id;

			const region = regionId ? findRegion(regionId) : undefined;

			if (!region) {
				await fulfillJson(
					route,
					{
						ok: false,
						error: 'region_not_found',

						message: 'The requested destination region does not exist.'
					},
					404
				);

				return;
			}

			state.position = {
				human_id: IDENTITY.human_id,

				region_id: region.id,

				place_id: place?.id ?? null,

				position_x:
					typeof body.position_x === 'number' ? body.position_x : (place?.position_x ?? 0),

				position_y:
					typeof body.position_y === 'number' ? body.position_y : (place?.position_y ?? 0),

				updated_at: NOW + 60
			};

			await fulfillJson(route, {
				ok: true,

				position: state.position,

				human_position: state.position
			});

			return;
		}

		if (method === 'GET' && pathname === '/api/nature') {
			await fulfillJson(route, {
				ok: true,

				id: 'nature-orelunza',
				nature_id: 'nature-orelunza',

				biomes: BIOMES
			});

			return;
		}

		if (method === 'GET' && pathname === '/api/nature/biomes') {
			await fulfillJson(route, {
				ok: true,
				biomes: BIOMES
			});

			return;
		}

		const biomeAreasMatch = pathname.match(/^\/api\/nature\/biomes\/([^/]+)\/areas$/);

		if (method === 'GET' && biomeAreasMatch) {
			const biomeId = decodeURIComponent(biomeAreasMatch[1]);

			await fulfillJson(route, {
				ok: true,

				areas: AREAS.filter((area) => area.biome_id === biomeId)
			});

			return;
		}

		const biomeMatch = pathname.match(/^\/api\/nature\/biomes\/([^/]+)$/);

		if (method === 'GET' && biomeMatch) {
			const biome = findBiome(decodeURIComponent(biomeMatch[1]));

			if (!biome) {
				await fulfillJson(
					route,
					{
						ok: false,
						error: 'biome_not_found',

						message: 'The requested biome does not exist.'
					},
					404
				);

				return;
			}

			await fulfillJson(route, {
				ok: true,
				biome,
				...biome
			});

			return;
		}

		const environmentMatch = pathname.match(/^\/api\/nature\/areas\/([^/]+)\/state$/);

		if (method === 'GET' && environmentMatch) {
			const environment = findEnvironment(decodeURIComponent(environmentMatch[1]));

			await fulfillJson(route, environmentResponse(environment));

			return;
		}

		const areaMatch = pathname.match(/^\/api\/nature\/areas\/([^/]+)$/);

		if (method === 'GET' && areaMatch) {
			const area = findArea(decodeURIComponent(areaMatch[1]));

			if (!area) {
				await fulfillJson(
					route,
					{
						ok: false,
						error: 'natural_area_not_found',

						message: 'The requested natural area does not exist.'
					},
					404
				);

				return;
			}

			await fulfillJson(route, areaResponse(area));

			return;
		}

		const regionNatureMatch = pathname.match(/^\/api\/nature\/regions\/([^/]+)$/);

		if (method === 'GET' && regionNatureMatch) {
			const area = areaForRegion(decodeURIComponent(regionNatureMatch[1]));

			await fulfillJson(route, areaResponse(area));

			return;
		}

		const placeNatureMatch = pathname.match(/^\/api\/nature\/places\/([^/]+)$/);

		if (method === 'GET' && placeNatureMatch) {
			const area = areaForPlace(decodeURIComponent(placeNatureMatch[1]));

			await fulfillJson(route, areaResponse(area));

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

const CHARACTER_SAVE = {
	version: 1,
	displayName: 'Forest Citizen',
	skinTone: '#b98565',
	hairStyle: 'short',
	hairColor: '#3b2b22',
	shirtColor: '#4f8f74',
	pantsColor: '#37485f',
	shoesColor: '#2b2725'
};

async function installCharacter(page: Page): Promise<void> {
	await page.addInitScript(
		({ key, value }) => {
			localStorage.setItem(key, value);
		},
		{
			key: `orelunza-character:${IDENTITY.human_id}`,
			value: JSON.stringify(CHARACTER_SAVE)
		}
	);
}

async function playerPosition(locator: Locator): Promise<{
	x: number;
	y: number;
	z: number;
}> {
	return {
		x: Number(await locator.getAttribute('data-player-x')),
		y: Number(await locator.getAttribute('data-player-y')),
		z: Number(await locator.getAttribute('data-player-z'))
	};
}

async function numericAttribute(locator: Locator, name: string): Promise<number> {
	return Number(await locator.getAttribute(name));
}

async function keyDown(page: Page, code: string): Promise<void> {
	await page.evaluate((keyCode) => {
		window.dispatchEvent(new KeyboardEvent('keydown', { code: keyCode }));
	}, code);
}

async function keyUp(page: Page, code: string): Promise<void> {
	await page.evaluate((keyCode) => {
		window.dispatchEvent(new KeyboardEvent('keyup', { code: keyCode }));
	}, code);
}

async function pressKey(page: Page, code: string): Promise<void> {
	await keyDown(page, code);
	await keyUp(page, code);
}

test.describe('world flow', () => {
	test('opens a full-screen voxel game without the dashboard shell', async ({ page }) => {
		await installCityBackend(page);
		await installCharacter(page);

		await page.goto('/world');

		const canvas = page.locator('canvas[aria-label="Orelunza voxel world"]');

		await expect(canvas).toBeVisible({
			timeout: 15_000
		});

		await expect(page.getByRole('link', { name: /^City$/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0);
		await expect(page.getByLabel('Game HUD')).toBeVisible();
		await expect(page.getByLabel('Hotbar', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: /Hotbar slot 9 Flower/ })).toBeVisible();
		await expect(canvas).toHaveAttribute('data-camera', 'third-person');
		await expect(page.getByText('Spawn Meadow')).toBeVisible();
		await expect(page.getByText('The city lies beyond the meadow.')).toBeVisible();
		const state = page.getByTestId('game-debug-state');
		await expect(state).toHaveAttribute('data-zone', 'Spawn Meadow');
		expect(Number(await state.getAttribute('data-player-y'))).toBeGreaterThan(9);
		await page.waitForTimeout(1200);
		expect(await numericAttribute(state, 'data-engine-starts')).toBe(1);
		expect(await numericAttribute(state, 'data-active-loops')).toBe(1);
		expect(await numericAttribute(state, 'data-chunks-active')).toBeLessThanOrEqual(9);
		expect(await numericAttribute(state, 'data-callbacks-per-second')).toBeLessThanOrEqual(12);
		expect(await numericAttribute(state, 'data-three-objects')).toBeLessThan(250);
		await page.waitForFunction(() => {
			const state = document.querySelector(
				'[data-testid="game-debug-state"]'
			) as HTMLElement | null;

			return Number(state?.dataset.avatarObjects ?? 0) > 30;
		});
		expect(await numericAttribute(state, 'data-avatar-objects')).toBeGreaterThan(30);
		expect(await numericAttribute(state, 'data-avatar-objects')).toBeLessThan(60);
		expect(await numericAttribute(state, 'data-avatar-update-ms')).toBeLessThan(1);
	});

	test('moves forward, strafes correctly and sprints from spawn', async ({ page }) => {
		test.setTimeout(60_000);
		await installCityBackend(page);
		await installCharacter(page);

		await page.goto('/world');

		const canvas = page.locator('canvas[aria-label="Orelunza voxel world"]');
		await expect(canvas).toBeVisible({
			timeout: 15_000
		});

		const state = page.getByTestId('game-debug-state');
		await expect(state).toHaveAttribute('data-zone', 'Spawn Meadow');
		const start = await playerPosition(state);

		await canvas.click({
			position: {
				x: 120,
				y: 120
			}
		});

		await keyDown(page, 'KeyW');
		await page.waitForTimeout(500);
		await expect(state).toHaveAttribute('data-avatar-state', /walk_forward|run/);
		const walkSpeed = await numericAttribute(state, 'data-avatar-speed');
		const walkArmLeft = await numericAttribute(state, 'data-avatar-arm-left');
		const walkArmRight = await numericAttribute(state, 'data-avatar-arm-right');
		const walkLegLeft = await numericAttribute(state, 'data-avatar-leg-left');
		const walkLegRight = await numericAttribute(state, 'data-avatar-leg-right');
		await keyUp(page, 'KeyW');
		const afterWalk = await playerPosition(state);
		const walkDistance = Math.hypot(afterWalk.x - start.x, afterWalk.z - start.z);
		expect(walkDistance).toBeGreaterThan(0.05);
		expect(Math.abs(walkArmLeft - walkArmRight)).toBeGreaterThan(0.05);
		expect(Math.abs(walkLegLeft - walkLegRight)).toBeGreaterThan(0.05);

		await page.waitForTimeout(400);

		await keyDown(page, 'ShiftLeft');
		await keyDown(page, 'KeyW');
		await page.waitForTimeout(700);
		await expect(state).toHaveAttribute('data-avatar-state', /run|walk_forward/);
		await keyUp(page, 'KeyW');
		await keyUp(page, 'ShiftLeft');
		const afterSprint = await playerPosition(state);
		const sprintDistance = Math.hypot(afterSprint.x - afterWalk.x, afterSprint.z - afterWalk.z);
		expect(sprintDistance).toBeGreaterThan(0.05);
		expect(walkSpeed).toBeGreaterThan(0.1);

		await keyDown(page, 'KeyA');
		await page.waitForTimeout(350);
		await keyUp(page, 'KeyA');
		const afterLeft = await playerPosition(state);

		await keyDown(page, 'KeyD');
		await page.waitForTimeout(700);
		await keyUp(page, 'KeyD');
		const afterRight = await playerPosition(state);

		expect(afterLeft.x - afterSprint.x).toBeLessThan(-0.05);
		expect(afterRight.x - afterLeft.x).toBeGreaterThan(0.1);
		expect(Math.abs(await numericAttribute(state, 'data-avatar-body-yaw'))).toBeGreaterThan(0.1);

		await keyDown(page, 'Space');
		await page.waitForTimeout(120);
		await keyUp(page, 'Space');
		await expect(state).toHaveAttribute(
			'data-avatar-state',
			/jump_start|airborne|landing|idle|walk_forward/
		);
		await page.waitForTimeout(700);
		await expect(state).toHaveAttribute('data-avatar-grounded', 'true');
		expect(await numericAttribute(state, 'data-chunks-active')).toBeLessThanOrEqual(9);
		expect(await numericAttribute(state, 'data-world-rebuilds')).toBeLessThanOrEqual(3);
	});

	test('supports inventory and hotbar selection', async ({ page }) => {
		await installCityBackend(page);
		await installCharacter(page);

		await page.goto('/world');

		await expect(page.locator('canvas[aria-label="Orelunza voxel world"]')).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByTestId('game-debug-state')).toHaveAttribute('data-zone', 'Spawn Meadow');

		await page.getByRole('button', { name: /Hotbar slot 3 Glass/ }).click({
			force: true
		});
		await expect(page.getByRole('button', { name: /Hotbar slot 3 Glass/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await pressKey(page, 'KeyI');
		await expect(page.getByRole('dialog', { name: 'Inventory' })).toBeVisible();
	});

	test('supports build mode, pause menu and profile access', async ({ page }) => {
		await installCityBackend(page);
		await installCharacter(page);

		await page.goto('/world');

		await expect(page.locator('canvas[aria-label="Orelunza voxel world"]')).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByTestId('game-debug-state')).toHaveAttribute('data-zone', 'Spawn Meadow');

		await pressKey(page, 'KeyB');
		await expect(page.getByText('Build Mode')).toBeVisible();

		await pressKey(page, 'Escape');
		await expect(page.getByRole('dialog', { name: 'Pause menu' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
	});

	test('shows a playable starter world when the backend has no regions', async ({ page }) => {
		await installCityBackend(page, {
			emptyWorld: true
		});
		await installCharacter(page);

		await page.goto('/world');

		await expect(page.locator('canvas[aria-label="Orelunza voxel world"]')).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByText('Spawn Meadow')).toBeVisible();
		expect(await page.getByText('The city is empty').count()).toBe(0);
	});

	test('redirects old /city entrypoint to /world', async ({ page }) => {
		await installCityBackend(page);
		await installCharacter(page);

		await page.goto('/city');

		await expect(page).toHaveURL(/\/world(?:\?|$)/);
	});

	test('creates a character before entering the world', async ({ page }) => {
		await installCityBackend(page);

		await page.goto('/character/create');

		await expect(page.getByLabel('Character creator')).toBeVisible();
		await expect(page.getByLabel('Character preview')).toBeVisible();
		await page.getByLabel('Public name').fill('Meadow Builder');
		await page.getByRole('button', { name: 'Enter the world' }).click();

		await expect(page).toHaveURL(/\/world(?:\?|$)/);
		await expect(page.locator('canvas[aria-label="Orelunza voxel world"]')).toBeVisible({
			timeout: 15_000
		});
	});

	test('redirects /world to character creation when no character exists', async ({ page }) => {
		await installCityBackend(page);

		await page.goto('/world');

		await expect(page).toHaveURL(/\/character\/create(?:\?|$)/);
	});

	test('opens another region with its places and biome', async ({ page }) => {
		await installCityBackend(page);

		await page.goto('/city/regions/region-river');

		await expect(
			page
				.getByRole('heading', {
					name: 'River District',
					exact: true
				})
				.first()
		).toBeVisible();

		await expect(
			page
				.getByText('A quiet district built alongside the river.', {
					exact: true
				})
				.first()
		).toBeVisible();

		await expect(
			page
				.getByText('River Dock', {
					exact: true
				})
				.first()
		).toBeVisible();

		await expect(
			page.getByText('River Wetland', {
				exact: true
			})
		).toBeVisible();

		await expect(
			page.getByText('Water moves slowly beside the tall river grass.', {
				exact: true
			})
		).toBeVisible();

		await expect(page.getByText('Viewing River District')).toHaveCount(0);
	});

	test('moves to a place in another region from its detail page', async ({ page }) => {
		const backend = await installCityBackend(page);

		await page.goto('/city/places/place-dock');

		await expect(
			page
				.getByRole('heading', {
					name: 'River Dock',
					exact: true
				})
				.first()
		).toBeVisible();

		await expect(
			page.getByText('The dock creaks gently above the moving water.', {
				exact: true
			})
		).toBeVisible();

		await page
			.getByRole('button', {
				name: 'Go to this place'
			})
			.click();

		await expect(
			page.getByRole('button', {
				name: 'You are here'
			})
		).toBeVisible();

		expect(backend.position).toMatchObject({
			region_id: 'region-river',

			place_id: 'place-dock',

			position_x: 310,
			position_y: 420
		});
	});
});
