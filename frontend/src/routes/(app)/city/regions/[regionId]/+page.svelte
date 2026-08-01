<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	import { ApiError } from '$lib/api/ApiError';

	import type { NaturalArea } from '$lib/api/contracts/nature';

	import type { WorldPlace, WorldRegion } from '$lib/api/contracts/world';

	import BiomePanel from '$lib/components/nature/BiomePanel.svelte';
	import EnvironmentPanel from '$lib/components/nature/EnvironmentPanel.svelte';

	import ErrorNotice from '$lib/components/ui/ErrorNotice.svelte';
	import LoadingScreen from '$lib/components/ui/LoadingScreen.svelte';

	import PlaceList from '$lib/components/world/PlaceList.svelte';
	import PositionPanel from '$lib/components/world/PositionPanel.svelte';

	import { natureState } from '$lib/state/nature.svelte';
	import { worldState } from '$lib/state/world.svelte';

	let loading = $state(true);
	let pageError = $state<ApiError | null>(null);
	let movingPlaceId = $state<string | null>(null);
	let refreshingEnvironment = $state(false);

	let controller: AbortController | null = null;

	const regionId = $derived(page.params.regionId?.trim() ?? '');

	const region = $derived.by(() => {
		if (worldState.selectedRegion?.id === regionId) {
			return worldState.selectedRegion;
		}

		return worldState.regions.find((candidate) => candidate.id === regionId) ?? null;
	});

	const currentPlace = $derived.by(() => {
		const placeId = worldState.position?.place_id;

		if (!placeId || worldState.position?.region_id !== regionId) {
			return null;
		}

		return worldState.places.find((candidate) => candidate.id === placeId) ?? null;
	});

	async function loadNatureForRegion(
		id: string,
		signal?: AbortSignal
	): Promise<NaturalArea | null> {
		const area = await natureState.loadRegionNature(id, signal);

		if (area) {
			await natureState.loadEnvironment(area.id, signal);
		}

		return area;
	}

	async function initialize(signal?: AbortSignal): Promise<void> {
		loading = true;
		pageError = null;

		try {
			if (!regionId) {
				throw new ApiError('The region identifier is missing.', {
					code: 'invalid_region_id'
				});
			}

			if (worldState.regions.length === 0) {
				await worldState.loadRegions(signal);
			}

			const selectedRegion = await worldState.selectRegion(regionId, signal);

			const [, position] = await Promise.all([
				worldState.loadRegionPlaces(selectedRegion.id, signal),
				worldState.loadPosition(signal),
				natureState.biomes.length === 0
					? natureState.loadBiomes(signal)
					: Promise.resolve(natureState.biomes)
			]);

			if (position?.region_id === selectedRegion.id) {
				const place =
					worldState.places.find((candidate) => candidate.id === position.place_id) ?? null;

				worldState.selectedPlace = place;
			} else {
				worldState.selectedPlace = null;
			}

			await loadNatureForRegion(selectedRegion.id, signal);
		} catch (error) {
			if (signal?.aborted) {
				return;
			}

			pageError = ApiError.fromUnknown(error);
		} finally {
			if (!signal?.aborted) {
				loading = false;
			}
		}
	}

	function selectPlace(place: WorldPlace): void {
		worldState.selectedPlace = place;
	}

	async function loadNatureForPlace(place: WorldPlace): Promise<void> {
		let area = await natureState.loadPlaceNature(place.id);

		if (!area) {
			area = await natureState.loadRegionNature(place.region_id);
		}

		if (area) {
			await natureState.loadEnvironment(area.id);
		}
	}

	async function moveToPlace(place: WorldPlace): Promise<void> {
		if (movingPlaceId) {
			return;
		}

		movingPlaceId = place.id;
		pageError = null;

		try {
			await worldState.moveToPlace(place);
			worldState.selectedPlace = place;

			await loadNatureForPlace(place);
		} catch (error) {
			pageError = ApiError.fromUnknown(error);
		} finally {
			movingPlaceId = null;
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
			pageError = ApiError.fromUnknown(error);
		} finally {
			refreshingEnvironment = false;
		}
	}

	onMount(() => {
		controller = new AbortController();

		void initialize(controller.signal);

		return () => {
			controller?.abort();
		};
	});
</script>

<svelte:head>
	<title>
		{region?.name ?? 'Region'} — Orelunza
	</title>

	<meta name="description" content={region?.description ?? 'Explore a region of Orelunza.'} />
</svelte:head>

<div class="grid gap-6">
	<nav
		class="flex flex-wrap items-center gap-2 text-sm text-[var(--orelunza-text-muted)]"
		aria-label="Breadcrumb"
	>
		<a href="/city" class="transition hover:text-[var(--orelunza-text)]"> City </a>

		<span aria-hidden="true">/</span>

		<span class="text-[var(--orelunza-text-soft)]">
			{region?.name ?? 'Region'}
		</span>
	</nav>

	<ErrorNotice
		error={pageError}
		title="The region could not be opened"
		dismissible
		onDismiss={() => {
			pageError = null;
			worldState.clearError();
			natureState.clearError();
		}}
	/>

	{#if loading}
		<section
			class="rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]"
		>
			<LoadingScreen
				message="Opening the region…"
				detail="Loading its places and natural environment."
			/>
		</section>
	{:else if region}
		<section
			class="relative overflow-hidden rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] px-5 py-7 sm:px-7 sm:py-9"
		>
			<div
				class="pointer-events-none absolute top-[-9rem] right-[-5rem] size-80 rounded-full bg-[color-mix(in_srgb,var(--orelunza-accent)_13%,transparent)] blur-3xl"
				aria-hidden="true"
			></div>

			<div class="relative max-w-4xl">
				<div class="mb-5 flex flex-wrap items-center gap-2">
					<span
						class="rounded-full border border-[color-mix(in_srgb,var(--orelunza-accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_11%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--orelunza-accent)]"
					>
						Region
					</span>

					{#if worldState.position?.region_id === region.id}
						<span
							class="rounded-full border border-[color-mix(in_srgb,var(--orelunza-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-success)_10%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--orelunza-success)]"
						>
							You are here
						</span>
					{/if}
				</div>

				<h1
					class="m-0 text-4xl font-semibold tracking-[-0.045em] text-[var(--orelunza-text)] sm:text-5xl"
				>
					{region.name}
				</h1>

				<p class="mt-5 mb-0 max-w-3xl text-base leading-8 text-[var(--orelunza-text-soft)]">
					{region.description || 'This region does not have a description yet.'}
				</p>

				<div class="mt-7 flex flex-wrap gap-3 text-sm">
					<div
						class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-4 py-3"
					>
						<p class="m-0 text-xs text-[var(--orelunza-text-muted)]">Identifier</p>

						<p class="mt-1 mb-0 font-mono text-[var(--orelunza-text)]">
							{region.id}
						</p>
					</div>

					<div
						class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-4 py-3"
					>
						<p class="m-0 text-xs text-[var(--orelunza-text-muted)]">Places</p>

						<p class="mt-1 mb-0 font-semibold text-[var(--orelunza-text)]">
							{worldState.places.length}
						</p>
					</div>
				</div>
			</div>
		</section>

		<div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
			<section
				class="min-w-0 rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4 sm:p-5"
			>
				<PlaceList
					places={worldState.places}
					selectedPlaceId={worldState.selectedPlace?.id}
					currentPlaceId={worldState.position?.place_id}
					{movingPlaceId}
					loading={worldState.loading === 'places'}
					onSelect={selectPlace}
					onMove={moveToPlace}
				/>
			</section>

			<aside class="grid gap-5 xl:sticky xl:top-24">
				<PositionPanel
					position={worldState.position}
					{region}
					place={currentPlace}
					onRefresh={async () => {
						await worldState.loadPosition();
					}}
					refreshing={worldState.loading === 'position'}
				/>

				<BiomePanel
					biome={natureState.currentBiome}
					area={natureState.selectedArea}
					loading={natureState.loading === 'region'}
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
			<h1 class="m-0 text-2xl font-semibold text-[var(--orelunza-text)]">Region not found</h1>

			<p class="mx-auto mt-3 mb-0 max-w-lg text-sm leading-6 text-[var(--orelunza-text-muted)]">
				This region does not exist or is no longer available.
			</p>

			<a
				href="/city"
				class="mt-6 inline-flex rounded-xl bg-[var(--orelunza-accent)] px-5 py-3 text-sm font-semibold text-[var(--orelunza-accent-contrast)]"
			>
				Return to the city
			</a>
		</section>
	{/if}
</div>
