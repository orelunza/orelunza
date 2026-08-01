<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { resolve } from '$app/paths';

	import type { HumanPosition, WorldPlace, WorldRegion } from '$lib/api/contracts/world';

	import { worldState } from '$lib/state/world.svelte';

	interface Props {
		position?: HumanPosition | null;
		region?: WorldRegion | null;
		place?: WorldPlace | null;
		refreshing?: boolean;
		onRefresh?: () => void | Promise<void>;
		class?: string;
	}

	let {
		position,
		region,
		place,
		refreshing = false,
		onRefresh,
		class: className = ''
	}: Props = $props();

	const currentPosition = $derived(position === undefined ? worldState.position : position);

	const currentRegion = $derived(
		region === undefined
			? (worldState.selectedRegion ??
					worldState.regions.find((candidate) => candidate.id === currentPosition?.region_id) ??
					null)
			: region
	);

	const currentPlace = $derived(
		place === undefined
			? (worldState.selectedPlace ??
					worldState.places.find((candidate) => candidate.id === currentPosition?.place_id) ??
					null)
			: place
	);

	const locationName = $derived(currentPlace?.name ?? currentRegion?.name ?? 'Unknown place');

	const locationDescription = $derived(
		currentPlace?.description ??
			currentRegion?.description ??
			'Your position exists, but this location has not been loaded yet.'
	);

	function normalizeTimestamp(value: number): number {
		return value < 10_000_000_000 ? value * 1000 : value;
	}

	function formatUpdatedAt(value: number | undefined): string {
		if (!value) {
			return 'Unknown';
		}

		const timestamp = normalizeTimestamp(value);

		const date = new Date(timestamp);

		if (Number.isNaN(date.getTime())) {
			return 'Unknown';
		}

		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	function refresh(): void {
		void onRefresh?.();
	}
</script>

<section
	class={[
		'overflow-hidden rounded-[var(--orelunza-radius-medium)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]',
		className
	]
		.filter(Boolean)
		.join(' ')}
	aria-label="Current position"
>
	<header
		class="flex items-start justify-between gap-4 border-b border-[var(--orelunza-border)] px-5 py-4"
	>
		<div>
			<p
				class="mb-1 text-xs font-semibold tracking-[0.16em] text-[var(--orelunza-accent)] uppercase"
			>
				Position
			</p>

			<h2 class="m-0 text-base font-semibold text-[var(--orelunza-text)]">Your current location</h2>
		</div>

		{#if onRefresh}
			<Button
				variant="ghost"
				size="small"
				loading={refreshing}
				disabled={refreshing}
				onclick={refresh}
				aria-label="Refresh current position"
			>
				Refresh
			</Button>
		{/if}
	</header>

	{#if currentPosition}
		<div class="p-5">
			<div class="flex items-start gap-4">
				<div
					class="relative flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--orelunza-accent)_38%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_13%,transparent)] text-[var(--orelunza-accent)]"
					aria-hidden="true"
				>
					<span
						class="absolute -top-1 -right-1 size-3 rounded-full border-2 border-[var(--orelunza-surface)] bg-[var(--orelunza-success)]"
					></span>

					<svg
						viewBox="0 0 24 24"
						class="size-7"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
					>
						<path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" stroke-linejoin="round" />

						<circle cx="12" cy="9" r="2.5" />
					</svg>
				</div>

				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h3
							class="m-0 truncate text-lg font-semibold tracking-[-0.02em] text-[var(--orelunza-text)]"
						>
							{locationName}
						</h3>

						<span
							class="rounded-full border border-[color-mix(in_srgb,var(--orelunza-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-success)_10%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--orelunza-success)]"
						>
							Active
						</span>
					</div>

					<p class="mt-2 mb-0 line-clamp-2 text-sm leading-6 text-[var(--orelunza-text-soft)]">
						{locationDescription}
					</p>
				</div>
			</div>

			<dl class="mt-6 grid grid-cols-2 gap-3">
				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-3"
				>
					<dt class="text-xs text-[var(--orelunza-text-muted)]">Region</dt>

					<dd
						class="mt-1 mb-0 truncate text-sm font-medium text-[var(--orelunza-text)]"
						title={currentRegion?.name ?? currentPosition.region_id}
					>
						{currentRegion?.name ?? currentPosition.region_id}
					</dd>
				</div>

				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-3"
				>
					<dt class="text-xs text-[var(--orelunza-text-muted)]">Place</dt>

					<dd
						class="mt-1 mb-0 truncate text-sm font-medium text-[var(--orelunza-text)]"
						title={currentPlace?.name ?? currentPosition.place_id ?? 'Outside a named place'}
					>
						{currentPlace?.name ??
							(currentPosition.place_id ? currentPosition.place_id : 'Open region')}
					</dd>
				</div>

				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-3"
				>
					<dt class="text-xs text-[var(--orelunza-text-muted)]">Coordinates</dt>

					<dd class="mt-1 mb-0 font-mono text-sm font-medium text-[var(--orelunza-text)]">
						{currentPosition.position_x.toFixed(1)},
						{currentPosition.position_y.toFixed(1)}
					</dd>
				</div>

				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-3"
				>
					<dt class="text-xs text-[var(--orelunza-text-muted)]">Last movement</dt>

					<dd class="mt-1 mb-0 text-sm font-medium text-[var(--orelunza-text)]">
						{formatUpdatedAt(currentPosition.updated_at)}
					</dd>
				</div>
			</dl>

			{#if currentPlace}
				<a
					href={resolve(`/city/places/${encodeURIComponent(currentPlace.id)}`)}
					class="mt-4 flex items-center justify-between rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-4 py-3 text-sm font-semibold text-[var(--orelunza-text-soft)] transition hover:border-[var(--orelunza-border-strong)] hover:bg-[var(--orelunza-surface-hover)] hover:text-[var(--orelunza-text)]"
				>
					<span>Open this place</span>

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
			{:else if currentRegion}
				<a
					href={resolve(`/city/regions/${encodeURIComponent(currentRegion.id)}`)}
					class="mt-4 flex items-center justify-between rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-4 py-3 text-sm font-semibold text-[var(--orelunza-text-soft)] transition hover:border-[var(--orelunza-border-strong)] hover:bg-[var(--orelunza-surface-hover)] hover:text-[var(--orelunza-text)]"
				>
					<span>Open this region</span>

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
	{:else}
		<div class="px-5 py-8 text-center">
			<div
				class="mx-auto flex size-12 items-center justify-center rounded-2xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] text-[var(--orelunza-text-muted)]"
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

					<path d="M9.5 9.5l5-5M14.5 9.5l-5-5" stroke-linecap="round" />
				</svg>
			</div>

			<h3 class="mt-4 mb-2 text-base font-semibold text-[var(--orelunza-text)]">No position yet</h3>

			<p class="mx-auto mb-0 max-w-sm text-sm leading-6 text-[var(--orelunza-text-muted)]">
				Choose a region or visit a place to create your first position inside Orelunza.
			</p>

			{#if onRefresh}
				<Button
					class="mt-5"
					variant="secondary"
					size="small"
					loading={refreshing}
					disabled={refreshing}
					onclick={refresh}
				>
					Check again
				</Button>
			{/if}
		</div>
	{/if}
</section>
