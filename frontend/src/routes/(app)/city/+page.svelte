<script lang="ts">
	import { onMount } from 'svelte';

	import { ApiError } from '$lib/api/ApiError';

	import type { NaturalArea } from '$lib/api/contracts/nature';

	import type { HumanPosition, WorldPlace, WorldRegion } from '$lib/api/contracts/world';

	import BiomePanel from '$lib/components/nature/BiomePanel.svelte';
	import EnvironmentPanel from '$lib/components/nature/EnvironmentPanel.svelte';

	import Button from '$lib/components/ui/Button.svelte';
	import ErrorNotice from '$lib/components/ui/ErrorNotice.svelte';
	import LoadingScreen from '$lib/components/ui/LoadingScreen.svelte';

	import PlaceList from '$lib/components/world/PlaceList.svelte';
	import PositionPanel from '$lib/components/world/PositionPanel.svelte';
	import RegionList from '$lib/components/world/RegionList.svelte';
	import WorldCanvas from '$lib/components/world/WorldCanvas.svelte';

	import { natureState } from '$lib/state/nature.svelte';
	import { sessionState } from '$lib/state/session.svelte';
	import { worldState } from '$lib/state/world.svelte';

	import type { WorldPointerEvent, WorldRendererSnapshot, WorldSceneModel } from '$lib/world/types';

	let initialLoading = $state(true);
	let switchingRegionId = $state<string | null>(null);
	let movingPlaceId = $state<string | null>(null);
	let refreshingPosition = $state(false);
	let refreshingEnvironment = $state(false);

	let worldReady = $state(false);
	let worldZoom = $state(1);

	let pageError = $state<ApiError | null>(null);

	let pageController: AbortController | null = null;

	const selectedRegion = $derived(worldState.selectedRegion);

	const selectedPlace = $derived(worldState.selectedPlace);

	const positionRegion = $derived.by(() => {
		const regionId = worldState.position?.region_id;

		if (!regionId) {
			return null;
		}

		return worldState.regions.find((region) => region.id === regionId) ?? null;
	});

	const positionPlace = $derived.by(() => {
		const position = worldState.position;

		if (!position?.place_id || position.region_id !== selectedRegion?.id) {
			return null;
		}

		return worldState.places.find((place) => place.id === position.place_id) ?? null;
	});

	const positionInsideSelectedRegion = $derived(
		worldState.position?.region_id === selectedRegion?.id
	);

	const sceneModel = $derived.by<WorldSceneModel | null>(() => {
		const region = selectedRegion;

		if (!region) {
			return null;
		}

		const visiblePosition = positionInsideSelectedRegion ? worldState.position : null;

		return {
			region,

			places: worldState.places,

			position: visiblePosition,

			selectedPlaceId: selectedPlace?.id ?? null,

			currentPlaceId: visiblePosition?.place_id ?? null,

			naturalArea: natureState.selectedArea,

			biome: natureState.currentBiome,

			environment: natureState.environment
		};
	});

	const greeting = $derived(
		sessionState.displayName ? `Welcome back, ${sessionState.displayName}` : 'Welcome to Orelunza'
	);

	const cityStatus = $derived.by(() => {
		if (!selectedRegion) {
			return 'No region selected';
		}

		if (positionInsideSelectedRegion && positionPlace) {
			return `You are in ${positionPlace.name}`;
		}

		if (positionInsideSelectedRegion) {
			return `You are exploring ${selectedRegion.name}`;
		}

		return `Viewing ${selectedRegion.name}`;
	});

	function normalizeError(error: unknown): ApiError {
		return ApiError.fromUnknown(error);
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

		/*
		 * A place without a dedicated natural area inherits its region's
		 * natural environment.
		 */
		if (!area) {
			area = await natureState.loadRegionNature(regionId, signal);
		}

		if (area) {
			await natureState.loadEnvironment(area.id, signal);
		}

		return area;
	}

	async function synchronizePosition(position: HumanPosition, signal?: AbortSignal): Promise<void> {
		let region =
			worldState.regions.find((candidate) => candidate.id === position.region_id) ?? null;

		if (!region) {
			region = await worldState.selectRegion(position.region_id, signal);
		} else {
			worldState.selectedRegion = region;
		}

		const places = await worldState.loadRegionPlaces(position.region_id, signal);

		if (position.place_id) {
			const place = places.find((candidate) => candidate.id === position.place_id) ?? null;

			if (place) {
				worldState.selectedPlace = place;
			} else {
				await worldState.selectPlace(position.place_id, signal);
			}
		} else {
			worldState.selectedPlace = null;
		}

		await loadNatureForContext(position.region_id, position.place_id, signal);
	}

	async function initialize(signal?: AbortSignal): Promise<void> {
		initialLoading = true;
		pageError = null;

		try {
			const [regions] = await Promise.all([
				worldState.loadWorld(signal),

				natureState.loadNature(signal)
			]);

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

			await worldState.loadRegionPlaces(firstRegion.id, signal);

			await loadNatureForContext(firstRegion.id, null, signal);
		} catch (error) {
			if (signal?.aborted) {
				return;
			}

			pageError = normalizeError(error);
		} finally {
			if (!signal?.aborted) {
				initialLoading = false;
			}
		}
	}

	async function changeRegion(region: WorldRegion): Promise<void> {
		if (switchingRegionId || region.id === selectedRegion?.id) {
			return;
		}

		switchingRegionId = region.id;
		pageError = null;
		worldReady = false;

		try {
			worldState.selectedRegion = region;

			worldState.selectedPlace = null;

			const places = await worldState.loadRegionPlaces(region.id);

			const currentPosition = worldState.position;

			if (currentPosition?.region_id === region.id && currentPosition.place_id) {
				worldState.selectedPlace =
					places.find((place) => place.id === currentPosition.place_id) ?? null;
			}

			await loadNatureForContext(
				region.id,
				currentPosition?.region_id === region.id ? currentPosition.place_id : null
			);
		} catch (error) {
			pageError = normalizeError(error);
		} finally {
			switchingRegionId = null;
		}
	}

	function handleRegionSelect(region: WorldRegion): void {
		void changeRegion(region);
	}

	async function selectPlace(place: WorldPlace): Promise<void> {
		pageError = null;

		try {
			worldState.selectedPlace = place;

			await loadNatureForContext(place.region_id, place.id);
		} catch (error) {
			pageError = normalizeError(error);
		}
	}

	function handlePlaceSelect(place: WorldPlace): void {
		void selectPlace(place);
	}

	async function moveToPlace(place: WorldPlace): Promise<void> {
		if (movingPlaceId) {
			return;
		}

		movingPlaceId = place.id;
		pageError = null;

		try {
			const position = await worldState.moveToPlace(place);

			const region =
				worldState.regions.find((candidate) => candidate.id === position.region_id) ?? null;

			if (region) {
				worldState.selectedRegion = region;
			}

			worldState.selectedPlace = place;

			await loadNatureForContext(position.region_id, position.place_id);
		} catch (error) {
			pageError = normalizeError(error);
		} finally {
			movingPlaceId = null;
		}
	}

	function handlePlaceActivate(place: WorldPlace): void {
		void moveToPlace(place);
	}

	async function refreshPosition(): Promise<void> {
		if (refreshingPosition) {
			return;
		}

		refreshingPosition = true;
		pageError = null;

		try {
			const position = await worldState.loadPosition();

			if (position) {
				await synchronizePosition(position);
			}
		} catch (error) {
			pageError = normalizeError(error);
		} finally {
			refreshingPosition = false;
		}
	}

	async function refreshEnvironment(): Promise<void> {
		const area = natureState.selectedArea;

		if (!area || refreshingEnvironment) {
			return;
		}

		refreshingEnvironment = true;
		pageError = null;

		try {
			await natureState.loadEnvironment(area.id);
		} catch (error) {
			pageError = normalizeError(error);
		} finally {
			refreshingEnvironment = false;
		}
	}

	function handleWorldReady(snapshot: WorldRendererSnapshot): void {
		worldReady = true;
		worldZoom = snapshot.camera.zoom;
	}

	function handleWorldError(error: Error): void {
		worldReady = false;

		pageError = ApiError.fromUnknown(error, {
			code: 'world_renderer_error'
		});
	}

	function handleBackgroundPointer(_event: WorldPointerEvent): void {
		/*
		 * Background clicks intentionally keep the current place selection.
		 * This callback remains available for future walking or construction.
		 */
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
		};
	});
</script>

<svelte:head>
	<title>City — Orelunza</title>

	<meta
		name="description"
		content="Explore the regions, places and natural environment of Orelunza."
	/>
</svelte:head>

<div class="grid gap-6">
	<section
		class="relative overflow-hidden rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] px-5 py-7 sm:px-7 sm:py-9"
	>
		<div
			class="pointer-events-none absolute top-[-8rem] right-[-5rem] size-80 rounded-full bg-[color-mix(in_srgb,var(--orelunza-accent)_12%,transparent)] blur-3xl"
			aria-hidden="true"
		></div>

		<div class="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
			<div class="max-w-3xl">
				<p
					class="mb-3 text-xs font-semibold tracking-[0.2em] text-[var(--orelunza-accent)] uppercase"
				>
					The city
				</p>

				<h1
					class="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--orelunza-text)] sm:text-4xl"
				>
					{greeting}
				</h1>

				<p class="mt-4 mb-0 max-w-2xl text-base leading-7 text-[var(--orelunza-text-soft)]">
					Explore the city visually, discover quiet places and move your citizen through the world.
				</p>
			</div>

			<div class="flex flex-wrap gap-3 text-sm">
				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-4 py-3"
				>
					<p class="m-0 text-xs text-[var(--orelunza-text-muted)]">Region</p>

					<p class="mt-1 mb-0 font-semibold text-[var(--orelunza-text)]">
						{selectedRegion?.name ?? 'Not selected'}
					</p>
				</div>

				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-4 py-3"
				>
					<p class="m-0 text-xs text-[var(--orelunza-text-muted)]">Status</p>

					<p class="mt-1 mb-0 font-semibold text-[var(--orelunza-text)]">
						{cityStatus}
					</p>
				</div>
			</div>
		</div>
	</section>

	<ErrorNotice
		error={pageError}
		title="The city could not be updated"
		dismissible
		onDismiss={dismissError}
	/>

	{#if initialLoading}
		<section
			class="rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]"
		>
			<LoadingScreen
				message="Preparing the city…"
				detail="Loading regions, your position and the surrounding nature."
			/>
		</section>
	{:else if selectedRegion && sceneModel}
		<section
			class="rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] p-4 sm:p-5"
		>
			<div class="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<p
						class="mb-1 text-xs font-semibold tracking-[0.16em] text-[var(--orelunza-accent)] uppercase"
					>
						World map
					</p>

					<div class="flex flex-wrap items-center gap-3">
						<h2 class="m-0 text-xl font-semibold tracking-[-0.025em] text-[var(--orelunza-text)]">
							{selectedRegion.name}
						</h2>

						<span
							class={[
								'rounded-full border px-2.5 py-1 text-xs font-semibold',
								worldReady
									? 'border-[color-mix(in_srgb,var(--orelunza-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-success)_10%,transparent)] text-[var(--orelunza-success)]'
									: 'border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] text-[var(--orelunza-text-muted)]'
							].join(' ')}
						>
							{worldReady ? 'World ready' : 'Preparing world'}
						</span>
					</div>

					<p class="mt-2 mb-0 text-sm text-[var(--orelunza-text-muted)]">
						Drag to move the camera, use the wheel to zoom and double-click a place to travel there.
					</p>
				</div>

				<a
					href={`/city/regions/${encodeURIComponent(selectedRegion.id)}`}
					class="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--orelunza-text-soft)] transition hover:border-[var(--orelunza-border-strong)] hover:text-[var(--orelunza-text)]"
				>
					Region details
				</a>
			</div>

			<WorldCanvas
				model={sceneModel}
				displayName={sessionState.displayName}
				avatar={sessionState.avatar}
				minHeight="42rem"
				showControls
				showGrid
				showPlaceLabels
				naturalObjectDensity={0.58}
				onPlaceSelect={handlePlaceSelect}
				onPlaceActivate={handlePlaceActivate}
				onBackgroundPointer={handleBackgroundPointer}
				onReady={handleWorldReady}
				onError={handleWorldError}
			/>

			<div
				class="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--orelunza-text-muted)]"
			>
				<p class="m-0">
					{worldState.places.length}
					{worldState.places.length === 1 ? ' place' : ' places'}
					in this region
				</p>

				{#if worldReady}
					<p class="m-0">
						Camera zoom:
						{worldZoom.toFixed(2)}×
					</p>
				{/if}
			</div>
		</section>

		<div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
			<div class="grid min-w-0 gap-6">
				<section
					class="rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4 sm:p-5"
				>
					<div class="mb-4">
						<p
							class="mb-1 text-xs font-semibold tracking-[0.16em] text-[var(--orelunza-accent)] uppercase"
						>
							Regions
						</p>

						<h2 class="m-0 text-lg font-semibold text-[var(--orelunza-text)]">
							Explore another area
						</h2>
					</div>

					<RegionList
						regions={worldState.regions}
						selectedRegionId={selectedRegion.id}
						loading={worldState.loading === 'regions' ||
							worldState.loading === 'world' ||
							switchingRegionId !== null}
						onSelect={handleRegionSelect}
					/>
				</section>

				<section
					class="rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4 sm:p-5"
				>
					<div
						class="mb-5 rounded-2xl border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] p-5"
					>
						<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
							<div>
								<p
									class="mb-1 text-xs font-semibold tracking-[0.16em] text-[var(--orelunza-accent)] uppercase"
								>
									Selected region
								</p>

								<h2
									class="m-0 text-2xl font-semibold tracking-[-0.03em] text-[var(--orelunza-text)]"
								>
									{selectedRegion.name}
								</h2>

								<p class="mt-3 mb-0 max-w-3xl text-sm leading-6 text-[var(--orelunza-text-soft)]">
									{selectedRegion.description || 'This region does not have a description yet.'}
								</p>
							</div>

							{#if switchingRegionId}
								<span
									class="rounded-full border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--orelunza-text-muted)]"
								>
									Loading region…
								</span>
							{/if}
						</div>
					</div>

					<PlaceList
						places={worldState.places}
						selectedPlaceId={selectedPlace?.id}
						currentPlaceId={positionInsideSelectedRegion ? worldState.position?.place_id : null}
						{movingPlaceId}
						loading={worldState.loading === 'places'}
						onSelect={handlePlaceSelect}
						onMove={moveToPlace}
					/>
				</section>
			</div>

			<aside class="grid gap-5 xl:sticky xl:top-24">
				{#if selectedPlace}
					<section
						class="overflow-hidden rounded-[var(--orelunza-radius-medium)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]"
					>
						<header class="border-b border-[var(--orelunza-border)] px-5 py-4">
							<p
								class="mb-1 text-xs font-semibold tracking-[0.16em] text-[var(--orelunza-accent)] uppercase"
							>
								Selected place
							</p>

							<h2 class="m-0 text-lg font-semibold text-[var(--orelunza-text)]">
								{selectedPlace.name}
							</h2>
						</header>

						<div class="p-5">
							<p class="m-0 text-sm leading-6 text-[var(--orelunza-text-soft)]">
								{selectedPlace.description || 'This place does not have a description yet.'}
							</p>

							<dl class="mt-4 grid grid-cols-2 gap-3">
								<div
									class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-3"
								>
									<dt class="text-xs text-[var(--orelunza-text-muted)]">Type</dt>

									<dd
										class="mt-1 mb-0 text-sm font-semibold text-[var(--orelunza-text)] capitalize"
									>
										{selectedPlace.type || 'Unspecified'}
									</dd>
								</div>

								<div
									class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-3"
								>
									<dt class="text-xs text-[var(--orelunza-text-muted)]">Position</dt>

									<dd class="mt-1 mb-0 font-mono text-xs font-semibold text-[var(--orelunza-text)]">
										{selectedPlace.position_x.toFixed(0)},
										{selectedPlace.position_y.toFixed(0)}
									</dd>
								</div>
							</dl>

							<div class="mt-5 grid gap-3">
								<Button
									fullWidth
									loading={movingPlaceId === selectedPlace.id}
									disabled={movingPlaceId !== null ||
										worldState.position?.place_id === selectedPlace.id}
									onclick={() => {
										void moveToPlace(selectedPlace);
									}}
								>
									{worldState.position?.place_id === selectedPlace.id
										? 'You are here'
										: 'Go to this place'}
								</Button>

								<a
									href={`/city/places/${encodeURIComponent(selectedPlace.id)}`}
									class="inline-flex items-center justify-center rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--orelunza-text-soft)] transition hover:border-[var(--orelunza-border-strong)] hover:text-[var(--orelunza-text)]"
								>
									Open place details
								</a>
							</div>
						</div>
					</section>
				{/if}

				<PositionPanel
					position={worldState.position}
					region={positionRegion}
					place={positionPlace}
					refreshing={refreshingPosition}
					onRefresh={refreshPosition}
				/>

				<BiomePanel
					biome={natureState.currentBiome}
					area={natureState.selectedArea}
					loading={natureState.loading === 'nature' ||
						natureState.loading === 'biomes' ||
						natureState.loading === 'region' ||
						natureState.loading === 'place'}
				/>

				<EnvironmentPanel
					environment={natureState.environment}
					area={natureState.selectedArea}
					loading={natureState.loading === 'environment'}
					refreshing={refreshingEnvironment}
					onRefresh={natureState.selectedArea ? refreshEnvironment : undefined}
				/>
			</aside>
		</div>
	{:else}
		<section
			class="rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] px-6 py-14 text-center"
		>
			<h1 class="m-0 text-2xl font-semibold text-[var(--orelunza-text)]">The city is empty</h1>

			<p class="mx-auto mt-3 mb-0 max-w-lg text-sm leading-6 text-[var(--orelunza-text-muted)]">
				No enabled region is currently available in this world.
			</p>
		</section>
	{/if}
</div>
