<script lang="ts">
	import type { Biome, NaturalArea } from '$lib/api/contracts/nature';

	import { natureState } from '$lib/state/nature.svelte';

	interface Props {
		biome?: Biome | null;
		area?: NaturalArea | null;
		loading?: boolean;
		class?: string;
	}

	let { biome, area, loading = false, class: className = '' }: Props = $props();

	const currentArea = $derived(area === undefined ? natureState.selectedArea : area);

	const currentBiome = $derived.by(() => {
		if (biome !== undefined) {
			return biome;
		}

		if (natureState.currentBiome) {
			return natureState.currentBiome;
		}

		if (!currentArea) {
			return null;
		}

		return natureState.biomes.find((candidate) => candidate.id === currentArea.biome_id) ?? null;
	});

	const areaScope = $derived(currentArea?.place_id ? 'Place environment' : 'Regional environment');

	function formatLabel(value: string): string {
		return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
	}
</script>

<section
	class={[
		'overflow-hidden rounded-[var(--orelunza-radius-medium)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]',
		className
	]
		.filter(Boolean)
		.join(' ')}
	aria-label="Current biome"
>
	<header
		class="flex items-start justify-between gap-4 border-b border-[var(--orelunza-border)] px-5 py-4"
	>
		<div>
			<p
				class="mb-1 text-xs font-semibold tracking-[0.16em] text-[var(--orelunza-accent)] uppercase"
			>
				Nature
			</p>

			<h2 class="m-0 text-base font-semibold text-[var(--orelunza-text)]">Current biome</h2>
		</div>

		{#if currentArea}
			<span
				class="rounded-full border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-2.5 py-1 text-xs text-[var(--orelunza-text-muted)]"
			>
				{areaScope}
			</span>
		{/if}
	</header>

	{#if loading && !currentBiome}
		<div class="grid gap-4 p-5" aria-label="Loading biome">
			<div class="flex items-center gap-4">
				<div class="size-14 animate-pulse rounded-2xl bg-[var(--orelunza-background-soft)]"></div>

				<div class="flex-1">
					<div class="h-4 w-36 animate-pulse rounded bg-[var(--orelunza-background-soft)]"></div>

					<div
						class="mt-3 h-3 w-24 animate-pulse rounded bg-[var(--orelunza-background-soft)]"
					></div>
				</div>
			</div>

			<div class="h-16 animate-pulse rounded-xl bg-[var(--orelunza-background-soft)]"></div>
		</div>
	{:else if currentBiome}
		<div class="p-5">
			<div class="flex items-start gap-4">
				<div
					class="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--orelunza-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_12%,transparent)] text-[var(--orelunza-accent)]"
					aria-hidden="true"
				>
					<svg
						viewBox="0 0 24 24"
						class="size-7"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
					>
						<path d="M12 21V10" stroke-linecap="round" />

						<path d="M12 14c-4.2 0-7-2.6-7-6 4.5 0 7 2.2 7 6Z" stroke-linejoin="round" />

						<path d="M12 11c3.8 0 6-2.3 6-5.5-3.9 0-6 1.9-6 5.5Z" stroke-linejoin="round" />

						<path d="M8 21h8" stroke-linecap="round" />
					</svg>
				</div>

				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h3 class="m-0 text-lg font-semibold tracking-[-0.02em] text-[var(--orelunza-text)]">
							{currentBiome.name}
						</h3>

						{#if currentBiome.enabled}
							<span
								class="rounded-full border border-[color-mix(in_srgb,var(--orelunza-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-success)_10%,transparent)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--orelunza-success)]"
							>
								Active
							</span>
						{/if}
					</div>

					<p class="mt-1 mb-0 text-xs text-[var(--orelunza-text-muted)]">
						{currentBiome.slug}
					</p>
				</div>
			</div>

			<p class="mt-5 mb-0 text-sm leading-6 text-[var(--orelunza-text-soft)]">
				{currentBiome.description || 'This biome has no description yet.'}
			</p>

			<dl class="mt-5 grid gap-3 sm:grid-cols-2">
				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-3.5"
				>
					<dt class="flex items-center gap-2 text-xs text-[var(--orelunza-text-muted)]">
						<svg
							viewBox="0 0 24 24"
							class="size-4"
							fill="none"
							stroke="currentColor"
							stroke-width="1.7"
							aria-hidden="true"
						>
							<path d="M3 18l5-7 4 4 3-5 6 8" stroke-linecap="round" stroke-linejoin="round" />

							<path d="M3 20h18" stroke-linecap="round" />
						</svg>

						Terrain
					</dt>

					<dd class="mt-2 mb-0 text-sm font-medium text-[var(--orelunza-text)]">
						{formatLabel(currentBiome.terrain_type)}
					</dd>
				</div>

				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-3.5"
				>
					<dt class="flex items-center gap-2 text-xs text-[var(--orelunza-text-muted)]">
						<svg
							viewBox="0 0 24 24"
							class="size-4"
							fill="none"
							stroke="currentColor"
							stroke-width="1.7"
							aria-hidden="true"
						>
							<path
								d="M12 20V9M12 13c-3.7 0-6-2.3-6-5.5 3.8 0 6 1.9 6 5.5ZM12 10c3.2 0 5-2 5-4.8-3.3 0-5 1.7-5 4.8Z"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>

						Vegetation
					</dt>

					<dd class="mt-2 mb-0 text-sm font-medium text-[var(--orelunza-text)]">
						{formatLabel(currentBiome.vegetation_type)}
					</dd>
				</div>
			</dl>

			{#if currentArea}
				<div
					class="mt-4 rounded-xl border border-[var(--orelunza-border)] bg-[color-mix(in_srgb,var(--orelunza-accent)_5%,var(--orelunza-background-soft))] p-4"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="m-0 text-xs font-semibold text-[var(--orelunza-accent)]">
								{areaScope}
							</p>

							<p class="mt-1 mb-0 truncate text-sm font-semibold text-[var(--orelunza-text)]">
								{currentArea.name}
							</p>
						</div>

						<span
							class="size-2 shrink-0 rounded-full bg-[var(--orelunza-success)]"
							aria-hidden="true"
						></span>
					</div>

					{#if currentArea.description}
						<p class="mt-2 mb-0 text-xs leading-5 text-[var(--orelunza-text-muted)]">
							{currentArea.description}
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<div class="px-5 py-9 text-center">
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
					<path
						d="M12 21V10M12 14c-4.2 0-7-2.6-7-6 4.5 0 7 2.2 7 6Z"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>

			<h3 class="mt-4 mb-2 text-base font-semibold text-[var(--orelunza-text)]">
				No biome selected
			</h3>

			<p class="mx-auto mb-0 max-w-sm text-sm leading-6 text-[var(--orelunza-text-muted)]">
				Choose a region or move to a place to discover its natural environment.
			</p>
		</div>
	{/if}
</section>
