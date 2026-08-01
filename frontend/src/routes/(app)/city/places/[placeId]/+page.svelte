<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	import { ApiError } from '$lib/api/ApiError';

	import type { NaturalArea } from '$lib/api/contracts/nature';

	import type { WorldPlace, WorldRegion } from '$lib/api/contracts/world';

	import BiomePanel from '$lib/components/nature/BiomePanel.svelte';
	import EnvironmentPanel from '$lib/components/nature/EnvironmentPanel.svelte';

	import Button from '$lib/components/ui/Button.svelte';
	import ErrorNotice from '$lib/components/ui/ErrorNotice.svelte';
	import LoadingScreen from '$lib/components/ui/LoadingScreen.svelte';

	import PositionPanel from '$lib/components/world/PositionPanel.svelte';

	import { natureState } from '$lib/state/nature.svelte';
	import { worldState } from '$lib/state/world.svelte';

	let loading = $state(true);
	let moving = $state(false);
	let refreshingEnvironment = $state(false);
	let pageError = $state<ApiError | null>(null);

	let controller: AbortController | null = null;

	const placeId = $derived(page.params.placeId?.trim() ?? '');

	const place = $derived.by(() => {
		if (worldState.selectedPlace?.id === placeId) {
			return worldState.selectedPlace;
		}

		return worldState.places.find((candidate) => candidate.id === placeId) ?? null;
	});

	const region = $derived.by(() => {
		const regionId = place?.region_id;

		if (!regionId) {
			return null;
		}

		if (worldState.selectedRegion?.id === regionId) {
			return worldState.selectedRegion;
		}

		return worldState.regions.find((candidate) => candidate.id === regionId) ?? null;
	});

	const isCurrentPlace = $derived(worldState.position?.place_id === place?.id);

	async function loadNature(
		currentPlace: WorldPlace,
		signal?: AbortSignal
	): Promise<NaturalArea | null> {
		let area = await natureState.loadPlaceNature(currentPlace.id, signal);

		if (!area) {
			area = await natureState.loadRegionNature(currentPlace.region_id, signal);
		}

		if (area) {
			await natureState.loadEnvironment(area.id, signal);
		}

		return area;
	}

	async function initialize(signal?: AbortSignal): Promise<void> {
		loading = true;
		pageError = null;

		try {
			if (!placeId) {
				throw new ApiError('The place identifier is missing.', {
					code: 'invalid_place_id'
				});
			}

			const selectedPlace = await worldState.selectPlace(placeId, signal);

			if (worldState.regions.length === 0) {
				await worldState.loadRegions(signal);
			}

			const selectedRegion = await worldState.selectRegion(selectedPlace.region_id, signal);

			await Promise.all([
				worldState.loadRegionPlaces(selectedRegion.id, signal),
				worldState.loadPosition(signal),
				natureState.biomes.length === 0
					? natureState.loadBiomes(signal)
					: Promise.resolve(natureState.biomes)
			]);

			worldState.selectedRegion = selectedRegion;

			worldState.selectedPlace = selectedPlace;

			await loadNature(selectedPlace, signal);
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

	async function moveHere(): Promise<void> {
		if (!place || moving || isCurrentPlace) {
			return;
		}

		moving = true;
		pageError = null;

		try {
			await worldState.moveToPlace(place);

			await loadNature(place);
		} catch (error) {
			pageError = ApiError.fromUnknown(error);
		} finally {
			moving = false;
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
		{place?.name ?? 'Place'} — Orelunza
	</title>

	<meta name="description" content={place?.description ?? 'Visit a place inside Orelunza.'} />
</svelte:head>

<div class="grid gap-6">
	<nav
		class="flex flex-wrap items-center gap-2 text-sm text-[var(--orelunza-text-muted)]"
		aria-label="Breadcrumb"
	>
		<a href="/city" class="transition hover:text-[var(--orelunza-text)]"> City </a>

		<span aria-hidden="true">/</span>

		{#if region}
			<a
				href={`/city/regions/${encodeURIComponent(region.id)}`}
				class="transition hover:text-[var(--orelunza-text)]"
			>
				{region.name}
			</a>

			<span aria-hidden="true">/</span>
		{/if}

		<span class="text-[var(--orelunza-text-soft)]">
			{place?.name ?? 'Place'}
		</span>
	</nav>

	<ErrorNotice
		error={pageError}
		title="The place could not be opened"
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
				message="Opening the place…"
				detail="Loading its region, position and natural environment."
			/>
		</section>
	{:else if place}
		<section
			class="relative overflow-hidden rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]"
		>
			<div
				class="relative min-h-72 overflow-hidden bg-[linear-gradient(145deg,#20382b_0%,#17271f_55%,#101b16_100%)] px-5 py-8 sm:px-8 sm:py-10"
			>
				<div
					class="pointer-events-none absolute top-[-8rem] right-[-4rem] size-80 rounded-full bg-[color-mix(in_srgb,var(--orelunza-accent)_16%,transparent)] blur-3xl"
					aria-hidden="true"
				></div>

				<div
					class="pointer-events-none absolute bottom-[-6rem] left-[-4rem] size-64 rounded-full bg-[rgb(47_94_69_/_0.24)] blur-3xl"
					aria-hidden="true"
				></div>

				<div class="relative flex min-h-56 flex-col justify-between gap-8">
					<div>
						<div class="mb-5 flex flex-wrap gap-2">
							<span
								class="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/75 backdrop-blur"
							>
								{place.type || 'Place'}
							</span>

							{#if isCurrentPlace}
								<span
									class="rounded-full border border-[color-mix(in_srgb,var(--orelunza-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-success)_14%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--orelunza-success)] backdrop-blur"
								>
									You are here
								</span>
							{/if}
						</div>

						<h1
							class="m-0 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl"
						>
							{place.name}
						</h1>

						<p class="mt-5 mb-0 max-w-3xl text-base leading-8 text-white/72">
							{place.description || 'This place does not have a description yet.'}
						</p>
					</div>

					<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
						<div class="flex flex-wrap gap-3 text-sm">
							<div class="rounded-xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur">
								<p class="m-0 text-xs text-white/55">Region</p>

								<p class="mt-1 mb-0 font-semibold text-white">
									{region?.name ?? place.region_id}
								</p>
							</div>

							<div class="rounded-xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur">
								<p class="m-0 text-xs text-white/55">Coordinates</p>

								<p class="mt-1 mb-0 font-mono font-semibold text-white">
									{place.position_x.toFixed(1)},
									{place.position_y.toFixed(1)}
								</p>
							</div>
						</div>

						<Button
							size="large"
							variant={isCurrentPlace ? 'secondary' : 'primary'}
							disabled={isCurrentPlace || moving}
							loading={moving}
							onclick={moveHere}
						>
							{#if isCurrentPlace}
								You are here
							{:else if moving}
								Moving…
							{:else}
								Go to this place
							{/if}
						</Button>
					</div>
				</div>
			</div>
		</section>

		<div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
			<div class="grid gap-6">
				<section
					class="rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] p-5 sm:p-7"
				>
					<p
						class="mb-2 text-xs font-semibold tracking-[0.17em] text-[var(--orelunza-accent)] uppercase"
					>
						About this place
					</p>

					<h2 class="m-0 text-2xl font-semibold tracking-[-0.03em] text-[var(--orelunza-text)]">
						{place.name}
					</h2>

					<p class="mt-4 mb-0 text-base leading-8 text-[var(--orelunza-text-soft)]">
						{place.description || 'No additional information has been written for this place.'}
					</p>

					<dl class="mt-7 grid gap-3 sm:grid-cols-2">
						<div
							class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
						>
							<dt class="text-xs text-[var(--orelunza-text-muted)]">Place ID</dt>

							<dd class="mt-2 mb-0 font-mono text-sm break-all text-[var(--orelunza-text)]">
								{place.id}
							</dd>
						</div>

						<div
							class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
						>
							<dt class="text-xs text-[var(--orelunza-text-muted)]">Type</dt>

							<dd class="mt-2 mb-0 text-sm font-semibold text-[var(--orelunza-text)] capitalize">
								{place.type || 'Unspecified'}
							</dd>
						</div>
					</dl>
				</section>

				{#if region}
					<section
						class="rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] p-5 sm:p-7"
					>
						<p
							class="mb-2 text-xs font-semibold tracking-[0.17em] text-[var(--orelunza-accent)] uppercase"
						>
							Region
						</p>

						<h2 class="m-0 text-xl font-semibold text-[var(--orelunza-text)]">
							{region.name}
						</h2>

						<p class="mt-3 mb-0 text-sm leading-7 text-[var(--orelunza-text-soft)]">
							{region.description}
						</p>

						<a
							href={`/city/regions/${encodeURIComponent(region.id)}`}
							class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--orelunza-accent)] transition hover:text-[var(--orelunza-accent-strong)]"
						>
							Explore the entire region

							<span aria-hidden="true">→</span>
						</a>
					</section>
				{/if}
			</div>

			<aside class="grid gap-5 xl:sticky xl:top-24">
				<PositionPanel
					position={worldState.position}
					{region}
					place={isCurrentPlace ? place : null}
					onRefresh={async () => {
						await worldState.loadPosition();
					}}
					refreshing={worldState.loading === 'position'}
				/>

				<BiomePanel
					biome={natureState.currentBiome}
					area={natureState.selectedArea}
					loading={natureState.loading === 'place' || natureState.loading === 'region'}
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
			<h1 class="m-0 text-2xl font-semibold text-[var(--orelunza-text)]">Place not found</h1>

			<p class="mx-auto mt-3 mb-0 max-w-lg text-sm leading-6 text-[var(--orelunza-text-muted)]">
				This place does not exist or is no longer available.
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
