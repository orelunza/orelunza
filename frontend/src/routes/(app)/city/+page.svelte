<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	import { ApiError } from '$lib/api/ApiError';

	import type { NaturalArea } from '$lib/api/contracts/nature';
	import type { HumanPosition, MoveHumanRequest, WorldPlace, WorldRegion } from '$lib/api/contracts/world';

	import Button from '$lib/components/ui/Button.svelte';
	import ErrorNotice from '$lib/components/ui/ErrorNotice.svelte';
	import LoadingScreen from '$lib/components/ui/LoadingScreen.svelte';
	import WorldCanvas from '$lib/components/world/WorldCanvas.svelte';

	import { natureState } from '$lib/state/nature.svelte';
	import { sessionState } from '$lib/state/session.svelte';
	import { worldState } from '$lib/state/world.svelte';
	import { PositionSyncSystem, type PositionSyncSnapshot } from '$lib/world/systems/PositionSyncSystem';

	import {
		distanceBetweenPoints,
		pointFromPlace,
		type WorldPoint,
		type WorldRendererSnapshot,
		type WorldSceneModel
	} from '$lib/world/types';

	let initialLoading = $state(true);
	let menuOpen = $state(false);
	let placePanelOpen = $state(false);
	let switchingRegionId = $state<string | null>(null);
	let movingPlaceId = $state<string | null>(null);
	let worldReady = $state(false);
	let localPosition = $state<WorldPoint | null>(null);
	let nearbyPlace = $state<WorldPlace | null>(null);
	let nearbyDistance = $state<number | null>(null);
	let moving = $state(false);
	let walkToPlaceId = $state<string | null>(null);
	let walkCommandToken = $state(0);
	let recenterToken = $state(0);
	let syncSnapshot = $state<PositionSyncSnapshot>({
		status: 'idle',
		error: null,
		pending: null,
		lastSynced: null
	});
	let pageError = $state<ApiError | null>(null);

	let pageController: AbortController | null = null;
	let positionSync: PositionSyncSystem | null = null;

	const selectedRegion = $derived(worldState.selectedRegion);
	const selectedPlace = $derived(worldState.selectedPlace);

	const activePoint = $derived.by<WorldPoint | null>(() => {
		if (localPosition) {
			return localPosition;
		}

		if (!worldState.position) {
			return null;
		}

		return {
			x: worldState.position.position_x,
			y: worldState.position.position_y
		};
	});

	const visiblePosition = $derived.by<HumanPosition | null>(() => {
		if (!worldState.position || worldState.position.region_id !== selectedRegion?.id) {
			return null;
		}

		if (!localPosition) {
			return worldState.position;
		}

		return {
			...worldState.position,
			position_x: localPosition.x,
			position_y: localPosition.y
		};
	});

	const positionPlace = $derived.by(() => {
		const position = worldState.position;

		if (!position?.place_id || position.region_id !== selectedRegion?.id) {
			return null;
		}

		return worldState.places.find((place) => place.id === position.place_id) ?? null;
	});

	const contextPlace = $derived(selectedPlace ?? nearbyPlace);

	const sceneModel = $derived.by<WorldSceneModel | null>(() => {
		if (!selectedRegion) {
			return null;
		}

		return {
			region: selectedRegion,
			places: worldState.places,
			position: visiblePosition,
			selectedPlaceId: selectedPlace?.id ?? null,
			currentPlaceId: visiblePosition?.place_id ?? null,
			naturalArea: natureState.selectedArea,
			biome: natureState.currentBiome,
			environment: natureState.environment
		};
	});

	const locationLabel = $derived.by(() => {
		if (positionPlace) {
			return positionPlace.name;
		}

		return 'Exploring';
	});

	const syncLabel = $derived.by(() => {
		switch (syncSnapshot.status) {
			case 'dirty':
				return 'Saving soon';
			case 'syncing':
				return 'Saving';
			case 'synced':
				return 'Saved';
			case 'error':
				return 'Local only';
			case 'idle':
				return 'Ready';
		}
	});

	const distanceToContextPlace = $derived.by(() => {
		if (!activePoint || !contextPlace) {
			return null;
		}

		return distanceBetweenPoints(activePoint, pointFromPlace(contextPlace));
	});

	function normalizeError(error: unknown): ApiError {
		return ApiError.fromUnknown(error);
	}

	function movementRequest(position: WorldPoint, placeId: string | null = null): MoveHumanRequest | null {
		const region = selectedRegion;

		if (!region) {
			return null;
		}

		return {
			region_id: region.id,
			place_id: placeId,
			position_x: Math.round(position.x * 100) / 100,
			position_y: Math.round(position.y * 100) / 100
		};
	}

	async function syncMovement(request: MoveHumanRequest): Promise<void> {
		const position = await worldState.move(request);

		if (position.region_id === selectedRegion?.id) {
			localPosition = {
				x: position.position_x,
				y: position.position_y
			};
		}
	}

	function ensurePositionSync(): PositionSyncSystem {
		if (positionSync) {
			return positionSync;
		}

		positionSync = new PositionSyncSystem({
			sync: syncMovement,
			onStatusChange: (snapshot) => {
				syncSnapshot = snapshot;
			}
		});

		return positionSync;
	}

	async function flushLocalPosition(placeId: string | null = null): Promise<void> {
		if (!activePoint) {
			return;
		}

		const request = movementRequest(activePoint, placeId);

		if (!request) {
			return;
		}

		ensurePositionSync().noteStopped(request);
		await ensurePositionSync().flush();
	}

	async function loadNatureForContext(
		regionId: string,
		placeId: string | null,
		signal?: AbortSignal
	): Promise<NaturalArea | null> {
		let area: NaturalArea | null = null;

		if (placeId) {
			area = await natureState.loadPlaceNature(placeId, signal);
		}

		if (!area) {
			area = await natureState.loadRegionNature(regionId, signal);
		}

		if (area) {
			await natureState.loadEnvironment(area.id, signal);
		}

		return area;
	}

	async function synchronizePosition(position: HumanPosition, signal?: AbortSignal): Promise<void> {
		let region = worldState.regions.find((candidate) => candidate.id === position.region_id) ?? null;

		if (!region) {
			region = await worldState.selectRegion(position.region_id, signal);
		} else {
			worldState.selectedRegion = region;
		}

		const places = await worldState.loadRegionPlaces(position.region_id, signal);

		worldState.selectedPlace = position.place_id
			? places.find((candidate) => candidate.id === position.place_id) ?? null
			: null;

		localPosition = {
			x: position.position_x,
			y: position.position_y
		};

		await loadNatureForContext(position.region_id, position.place_id, signal);
	}

	async function initialize(signal?: AbortSignal): Promise<void> {
		initialLoading = true;
		pageError = null;

		try {
			const [regions] = await Promise.all([worldState.loadWorld(signal), natureState.loadNature(signal)]);
			const position = await worldState.loadPosition(signal);

			if (position) {
				await synchronizePosition(position, signal);
				return;
			}

			const firstRegion = regions[0];

			if (!firstRegion) {
				return;
			}

			worldState.selectedRegion = firstRegion;
			worldState.selectedPlace = null;
			localPosition = null;

			await worldState.loadRegionPlaces(firstRegion.id, signal);
			await loadNatureForContext(firstRegion.id, null, signal);
		} catch (error) {
			if (!signal?.aborted) {
				pageError = normalizeError(error);
			}
		} finally {
			if (!signal?.aborted) {
				initialLoading = false;
			}
		}
	}

	async function changeRegion(region: WorldRegion): Promise<void> {
		if (switchingRegionId || region.id === selectedRegion?.id) {
			menuOpen = false;
			return;
		}

		switchingRegionId = region.id;
		pageError = null;
		worldReady = false;

		try {
			await flushLocalPosition();

			worldState.selectedRegion = region;
			worldState.selectedPlace = null;
			nearbyPlace = null;
			localPosition = null;

			await worldState.loadRegionPlaces(region.id);
			await loadNatureForContext(region.id, null);
			menuOpen = false;
		} catch (error) {
			pageError = normalizeError(error);
		} finally {
			switchingRegionId = null;
		}
	}

	async function selectPlace(place: WorldPlace): Promise<void> {
		pageError = null;
		worldState.selectedPlace = place;
		placePanelOpen = true;

		try {
			await loadNatureForContext(place.region_id, place.id);
		} catch (error) {
			pageError = normalizeError(error);
		}
	}

	function walkToPlace(place: WorldPlace): void {
		worldState.selectedPlace = place;
		placePanelOpen = true;
		walkToPlaceId = place.id;
		walkCommandToken += 1;
		menuOpen = false;
	}

	async function moveToPlace(place: WorldPlace): Promise<void> {
		if (movingPlaceId) {
			return;
		}

		movingPlaceId = place.id;
		pageError = null;

		try {
			await flushLocalPosition(place.id);
			const position = await worldState.moveToPlace(place);

			worldState.selectedPlace = place;
			localPosition = {
				x: position.position_x,
				y: position.position_y
			};
			await loadNatureForContext(position.region_id, position.place_id);
		} catch (error) {
			pageError = normalizeError(error);
		} finally {
			movingPlaceId = null;
		}
	}

	function handleLocalPositionChange(position: WorldPoint): void {
		localPosition = position;

		const request = movementRequest(position);

		if (request) {
			ensurePositionSync().notePosition(request);
		}
	}

	function handleMovementChange(nextMoving: boolean, position: WorldPoint): void {
		moving = nextMoving;
		localPosition = position;

		const request = movementRequest(position, nextMoving ? null : nearbyPlace?.id ?? null);

		if (!request) {
			return;
		}

		if (nextMoving) {
			ensurePositionSync().notePosition(request);
		} else {
			ensurePositionSync().noteStopped(request);
		}
	}

	function handleNearbyPlaceChange(place: WorldPlace | null, distance: number | null): void {
		nearbyPlace = place;
		nearbyDistance = distance;
	}

	function handlePlaceSelect(place: WorldPlace): void {
		void selectPlace(place);
	}

	function handlePlaceActivate(place: WorldPlace): void {
		void selectPlace(place);
	}

	function handleWorldReady(snapshot: WorldRendererSnapshot): void {
		worldReady = true;

		if (!localPosition && snapshot.currentPlaceId && worldState.position) {
			localPosition = {
				x: worldState.position.position_x,
				y: worldState.position.position_y
			};
		}
	}

	function handleWorldError(error: Error): void {
		worldReady = false;
		pageError = ApiError.fromUnknown(error, {
			code: 'world_renderer_error'
		});
	}

	function recenter(): void {
		recenterToken += 1;
	}

	function dismissError(): void {
		pageError = null;
		worldState.clearError();
		natureState.clearError();
	}

	onMount(() => {
		pageController = new AbortController();
		void initialize(pageController.signal);

		return () => {
			pageController?.abort();
			void flushLocalPosition();
			positionSync?.destroy();
			positionSync = null;
		};
	});
</script>

<svelte:head>
	<title>City — Orelunza</title>
	<meta name="description" content="Explore Orelunza as a calm 2D digital city." />
</svelte:head>

<section
	class="city-world relative -m-4 min-h-[calc(100dvh-4rem)] overflow-hidden bg-[#131619] sm:-m-6 lg:min-h-[calc(100dvh-4rem)]"
	aria-label="Orelunza city"
>
	{#if initialLoading}
		<div class="absolute inset-0 z-40 flex items-center justify-center bg-[#131619]">
			<LoadingScreen
				message="Preparing the city…"
				detail="Loading regions, your position and the surrounding nature."
			/>
		</div>
	{:else if selectedRegion && sceneModel}
		<WorldCanvas
			model={sceneModel}
			displayName={sessionState.displayName}
			avatar={sessionState.avatar}
			minHeight="100%"
			showControls={false}
			showGrid={false}
			showPlaceLabels
			naturalObjectDensity={0.86}
			walkToPlaceId={walkToPlaceId}
			walkCommandToken={walkCommandToken}
			recenterToken={recenterToken}
			class="absolute inset-0"
			onPlaceSelect={handlePlaceSelect}
			onPlaceActivate={handlePlaceActivate}
			onLocalPositionChange={handleLocalPositionChange}
			onMovementChange={handleMovementChange}
			onNearbyPlaceChange={handleNearbyPlaceChange}
			onBeforeDestroy={(position) => {
				if (position) {
					localPosition = position;
					void flushLocalPosition();
				}
			}}
			onReady={handleWorldReady}
			onError={handleWorldError}
		/>

		<div class="pointer-events-none absolute inset-0 z-20">
			<header
				class="pointer-events-auto absolute top-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md border border-white/10 bg-[#1a1e22]/78 px-3 py-2 text-white shadow-[0_8px_40px_rgba(0,0,0,0.42)] backdrop-blur-md sm:top-4 sm:left-4"
			>
				<button
					type="button"
					class="grid size-9 place-items-center rounded-md border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
					aria-label="Open city menu"
					onclick={() => {
						menuOpen = true;
					}}
				>
					<span aria-hidden="true">☰</span>
				</button>

				<div class="min-w-0">
					<p class="m-0 truncate text-sm font-semibold">{selectedRegion.name}</p>
					<p class="m-0 truncate text-xs text-white/52">{locationLabel}</p>
				</div>
			</header>

			<div
				class="pointer-events-auto absolute top-3 right-3 flex items-center gap-2 sm:top-4 sm:right-4"
			>
				<button
					type="button"
					class="grid size-10 place-items-center rounded-md border border-white/10 bg-[#1a1e22]/78 text-white/75 shadow-[0_8px_40px_rgba(0,0,0,0.42)] backdrop-blur-md transition hover:bg-white/10 hover:text-white"
					aria-label="Recenter camera"
					onclick={recenter}
				>
					<span aria-hidden="true">⌖</span>
				</button>

				<a
					href="/profile"
					class="grid size-10 place-items-center rounded-md border border-white/10 bg-[#1a1e22]/78 text-sm font-semibold text-[#f97316] shadow-[0_8px_40px_rgba(0,0,0,0.42)] backdrop-blur-md transition hover:bg-white/10"
					aria-label="Open profile"
				>
					{sessionState.displayName.slice(0, 1).toUpperCase() || 'C'}
				</a>
			</div>

			<div
				class="pointer-events-auto absolute bottom-3 left-3 rounded-md border border-white/10 bg-[#1a1e22]/78 px-3 py-2 text-xs text-white/60 shadow-[0_8px_40px_rgba(0,0,0,0.42)] backdrop-blur-md sm:bottom-4 sm:left-4"
			>
				<span>{moving ? 'Walking' : syncLabel}</span>
				<span class="mx-2 text-white/25">•</span>
				<span>WASD / arrows</span>
				<span class="mx-2 text-white/25">•</span>
				<span>Click to walk</span>
			</div>

			{#if nearbyPlace}
				<div
					class="pointer-events-auto absolute bottom-20 left-1/2 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-md border border-[#f97316]/35 bg-[#1a1e22]/82 px-4 py-3 text-center text-white shadow-[0_8px_40px_rgba(0,0,0,0.42)] backdrop-blur-md"
				>
					<p class="m-0 text-sm font-semibold">{nearbyPlace.name}</p>
					<p class="m-0 text-xs text-white/55">Press E to interact</p>
				</div>
			{/if}

			{#if pageError}
				<div class="pointer-events-auto absolute right-3 bottom-3 w-[min(28rem,calc(100%-1.5rem))] sm:right-4 sm:bottom-4">
					<ErrorNotice
						error={pageError}
						title="The city could not be updated"
						dismissible
						onDismiss={dismissError}
					/>
				</div>
			{/if}
		</div>

		{#if menuOpen}
			<div class="absolute inset-0 z-30" role="dialog" aria-modal="true" aria-label="City menu">
				<button
					type="button"
					class="absolute inset-0 bg-black/36 backdrop-blur-[2px]"
					aria-label="Close city menu"
					onclick={() => {
						menuOpen = false;
					}}
				></button>

				<aside
					class="absolute top-0 left-0 h-full w-[min(24rem,92vw)] overflow-y-auto border-r border-white/10 bg-[#1a1e22]/94 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl"
				>
					<div class="mb-4 flex items-center justify-between gap-3">
						<div>
							<p class="m-0 text-xs font-semibold tracking-[0.12em] text-white/40 uppercase">
								Navigation
							</p>
							<h2 class="m-0 text-lg font-semibold">Regions and places</h2>
						</div>

						<button
							type="button"
							class="grid size-9 place-items-center rounded-md border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
							aria-label="Close menu"
							onclick={() => {
								menuOpen = false;
							}}
						>
							×
						</button>
					</div>

					<div class="grid gap-5">
						<section>
							<h3 class="mb-2 text-xs font-semibold tracking-[0.12em] text-white/40 uppercase">
								Regions
							</h3>

							<div class="grid gap-2">
								{#each worldState.regions as region (region.id)}
									<button
										type="button"
										class={[
											'w-full rounded-md border px-3 py-3 text-left transition',
											region.id === selectedRegion.id
												? 'border-[#f97316]/45 bg-[#f97316]/10 text-white'
												: 'border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.07] hover:text-white'
										].join(' ')}
										disabled={switchingRegionId !== null}
										onclick={() => {
											void changeRegion(region);
										}}
									>
										<span class="block text-sm font-semibold">{region.name}</span>
										<span class="mt-1 line-clamp-2 block text-xs text-white/45">
											{region.description || 'Quiet region'}
										</span>
									</button>
								{/each}
							</div>
						</section>

						<section>
							<h3 class="mb-2 text-xs font-semibold tracking-[0.12em] text-white/40 uppercase">
								Places in {selectedRegion.name}
							</h3>

							<div class="grid gap-2">
								{#each worldState.places as place (place.id)}
									<button
										type="button"
										class={[
											'w-full rounded-md border px-3 py-3 text-left transition',
											place.id === selectedPlace?.id
												? 'border-[#f97316]/45 bg-[#f97316]/10 text-white'
												: 'border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.07] hover:text-white'
										].join(' ')}
										onclick={() => {
											void selectPlace(place);
										}}
									>
										<span class="block text-sm font-semibold">{place.name}</span>
										<span class="mt-1 block text-xs capitalize text-white/45">{place.type}</span>
									</button>
								{/each}
							</div>
						</section>
					</div>
				</aside>
			</div>
		{/if}

		{#if placePanelOpen && contextPlace}
			<aside
				class="absolute right-3 bottom-3 z-30 w-[min(25rem,calc(100%-1.5rem))] rounded-md border border-white/10 bg-[#1a1e22]/90 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:right-4 sm:bottom-4"
				aria-label="Selected place"
			>
				<div class="mb-3 flex items-start justify-between gap-3">
					<div>
						<p class="m-0 text-xs font-semibold tracking-[0.12em] text-[#f97316] uppercase">
							{contextPlace.type || 'Place'}
						</p>
						<h2 class="m-0 text-xl font-semibold">{contextPlace.name}</h2>
					</div>

					<button
						type="button"
						class="grid size-9 place-items-center rounded-md border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
						aria-label="Close place panel"
						onclick={() => {
							placePanelOpen = false;
						}}
					>
						×
					</button>
				</div>

				<p class="m-0 text-sm leading-6 text-white/62">
					{contextPlace.description || 'This place is quiet for now.'}
				</p>

				<dl class="mt-4 grid grid-cols-2 gap-2 text-xs">
					<div class="rounded-md border border-white/10 bg-white/[0.03] p-3">
						<dt class="text-white/38">Region</dt>
						<dd class="mt-1 mb-0 font-semibold">{selectedRegion.name}</dd>
					</div>

					<div class="rounded-md border border-white/10 bg-white/[0.03] p-3">
						<dt class="text-white/38">Distance</dt>
						<dd class="mt-1 mb-0 font-semibold">
							{distanceToContextPlace === null ? 'Unknown' : `${Math.round(distanceToContextPlace)} m`}
						</dd>
					</div>

					<div class="rounded-md border border-white/10 bg-white/[0.03] p-3">
						<dt class="text-white/38">Biome</dt>
						<dd class="mt-1 mb-0 font-semibold">{natureState.currentBiome?.name ?? 'Regional'}</dd>
					</div>

					<div class="rounded-md border border-white/10 bg-white/[0.03] p-3">
						<dt class="text-white/38">Environment</dt>
						<dd class="mt-1 mb-0 font-semibold">
							{natureState.environment?.terrain_condition ?? 'Quiet'}
						</dd>
					</div>
				</dl>

				<div class="mt-4 grid gap-2">
					<Button
						fullWidth
						variant="secondary"
						disabled={movingPlaceId !== null}
						onclick={() => {
							walkToPlace(contextPlace);
						}}
					>
						Walk there
					</Button>

					<Button
						fullWidth
						loading={movingPlaceId === contextPlace.id}
						disabled={movingPlaceId !== null || worldState.position?.place_id === contextPlace.id}
						onclick={() => {
							void moveToPlace(contextPlace);
						}}
					>
						{worldState.position?.place_id === contextPlace.id ? 'You are here' : 'Enter place'}
					</Button>

					<Button
						fullWidth
						variant="ghost"
						onclick={() => {
							void goto(`/city/places/${encodeURIComponent(contextPlace.id)}`);
						}}
					>
						Open details
					</Button>
				</div>
			</aside>
		{/if}
	{:else}
		<div class="absolute inset-0 grid place-items-center px-5 text-center">
			<div class="max-w-lg rounded-md border border-white/10 bg-[#1a1e22] p-6 text-white">
				<h1 class="m-0 text-2xl font-semibold">The city is empty</h1>
				<p class="mt-3 mb-0 text-sm leading-6 text-white/52">
					No enabled region is currently available in this world.
				</p>
			</div>
		</div>
	{/if}
</section>

<style>
	.city-world {
		height: calc(100dvh - 4rem);
	}

	:global(.city-world canvas) {
		min-height: 100%;
	}
</style>
