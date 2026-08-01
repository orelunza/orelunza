<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';

	import type { WorldPlace } from '$lib/api/contracts/world';

	import { worldState } from '$lib/state/world.svelte';

	interface Props {
		places?: readonly WorldPlace[];
		selectedPlaceId?: string | null;
		currentPlaceId?: string | null;
		movingPlaceId?: string | null;
		loading?: boolean;
		emptyMessage?: string;
		onSelect?: (place: WorldPlace) => void | Promise<void>;
		onMove?: (place: WorldPlace) => void | Promise<void>;
		class?: string;
	}

	let {
		places,
		selectedPlaceId,
		currentPlaceId,
		movingPlaceId = null,
		loading = false,
		emptyMessage = 'This region does not contain any public place yet.',
		onSelect,
		onMove,
		class: className = ''
	}: Props = $props();

	const visiblePlaces = $derived(places ?? worldState.places);

	const activePlaceId = $derived(selectedPlaceId ?? worldState.selectedPlace?.id ?? null);

	const humanPlaceId = $derived(currentPlaceId ?? worldState.position?.place_id ?? null);

	function selectPlace(place: WorldPlace): void {
		void onSelect?.(place);
	}

	function moveToPlace(place: WorldPlace): void {
		if (humanPlaceId === place.id || movingPlaceId === place.id) {
			return;
		}

		void onMove?.(place);
	}
</script>

<section class={['grid gap-4', className].filter(Boolean).join(' ')} aria-label="Places">
	<div class="flex items-end justify-between gap-4">
		<div>
			<p
				class="mb-1 text-xs font-semibold tracking-[0.18em] text-[var(--orelunza-accent)] uppercase"
			>
				Explore
			</p>

			<h2 class="m-0 text-xl font-semibold tracking-[-0.025em] text-[var(--orelunza-text)]">
				Places
			</h2>
		</div>

		{#if visiblePlaces.length > 0}
			<p class="m-0 text-sm text-[var(--orelunza-text-muted)]">
				{visiblePlaces.length}
				{visiblePlaces.length === 1 ? ' place' : ' places'}
			</p>
		{/if}
	</div>

	{#if loading && visiblePlaces.length === 0}
		<div class="grid gap-3 sm:grid-cols-2" aria-label="Loading places">
			{#each Array(4) as _}
				<div
					class="h-52 animate-pulse rounded-[var(--orelunza-radius-medium)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]"
				></div>
			{/each}
		</div>
	{:else if visiblePlaces.length === 0}
		<div
			class="rounded-[var(--orelunza-radius-medium)] border border-dashed border-[var(--orelunza-border-strong)] bg-[var(--orelunza-background-soft)] px-5 py-10 text-center"
		>
			<div
				class="mx-auto flex size-12 items-center justify-center rounded-2xl border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] text-[var(--orelunza-text-muted)]"
				aria-hidden="true"
			>
				<svg
					viewBox="0 0 24 24"
					class="size-6"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
				>
					<path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" stroke-linejoin="round" />

					<circle cx="12" cy="9" r="2.5" />
				</svg>
			</div>

			<p class="mt-4 mb-0 text-sm text-[var(--orelunza-text-muted)]">
				{emptyMessage}
			</p>
		</div>
	{:else}
		<ul class="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
			{#each visiblePlaces as place (place.id)}
				{@const selected = place.id === activePlaceId}

				{@const current = place.id === humanPlaceId}

				{@const moving = place.id === movingPlaceId}

				<li
					class={[
						'group relative flex min-h-56 flex-col overflow-hidden rounded-[var(--orelunza-radius-medium)] border p-5 transition duration-150',
						selected || current
							? 'border-[var(--orelunza-accent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_9%,var(--orelunza-surface))]'
							: 'border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] hover:-translate-y-0.5 hover:border-[var(--orelunza-border-strong)] hover:bg-[var(--orelunza-surface-raised)]'
					].join(' ')}
				>
					<div
						class="pointer-events-none absolute top-0 right-0 size-36 translate-x-14 -translate-y-20 rounded-full bg-[color-mix(in_srgb,var(--orelunza-accent)_10%,transparent)] blur-2xl"
						aria-hidden="true"
					></div>

					<div class="relative flex items-start justify-between gap-3">
						<div
							class={[
								'flex size-11 shrink-0 items-center justify-center rounded-2xl border',
								current
									? 'border-[color-mix(in_srgb,var(--orelunza-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_17%,transparent)] text-[var(--orelunza-accent)]'
									: 'border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] text-[var(--orelunza-text-muted)]'
							].join(' ')}
							aria-hidden="true"
						>
							<svg
								viewBox="0 0 24 24"
								class="size-5"
								fill="none"
								stroke="currentColor"
								stroke-width="1.7"
							>
								<path
									d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"
									stroke-linejoin="round"
								/>

								<circle cx="12" cy="9" r="2.5" />
							</svg>
						</div>

						<div class="flex flex-wrap justify-end gap-2">
							{#if current}
								<span
									class="rounded-full border border-[color-mix(in_srgb,var(--orelunza-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--orelunza-accent)]"
								>
									You are here
								</span>
							{/if}

							{#if place.type}
								<span
									class="rounded-full border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-2.5 py-1 text-xs text-[var(--orelunza-text-muted)] capitalize"
								>
									{place.type}
								</span>
							{/if}
						</div>
					</div>

					<a
						href={`/city/places/${encodeURIComponent(place.id)}`}
						class="relative mt-4 block"
						aria-current={current ? 'location' : undefined}
						onclick={() => selectPlace(place)}
					>
						<h3
							class="m-0 text-lg font-semibold tracking-[-0.02em] text-[var(--orelunza-text)] transition group-hover:text-[var(--orelunza-accent-strong)]"
						>
							{place.name}
						</h3>

						<p class="mt-2 mb-0 line-clamp-3 text-sm leading-6 text-[var(--orelunza-text-soft)]">
							{place.description || 'A quiet place inside this region.'}
						</p>
					</a>

					<div class="relative mt-auto flex items-end justify-between gap-3 pt-5">
						<p
							class="m-0 font-mono text-xs text-[var(--orelunza-text-muted)]"
							title="World coordinates"
						>
							{place.position_x.toFixed(1)},
							{place.position_y.toFixed(1)}
						</p>

						{#if onMove}
							<Button
								size="small"
								variant={current ? 'secondary' : 'primary'}
								disabled={current || moving}
								loading={moving}
								onclick={() => moveToPlace(place)}
							>
								{#if current}
									Current place
								{:else if moving}
									Moving…
								{:else}
									Go there
								{/if}
							</Button>
						{:else}
							<a
								href={`/city/places/${encodeURIComponent(place.id)}`}
								class="inline-flex items-center gap-1 text-sm font-semibold text-[var(--orelunza-accent)] transition hover:text-[var(--orelunza-accent-strong)]"
								onclick={() => selectPlace(place)}
							>
								Open

								<svg
									viewBox="0 0 24 24"
									class="size-4"
									fill="none"
									stroke="currentColor"
									stroke-width="1.9"
									aria-hidden="true"
								>
									<path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</a>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
