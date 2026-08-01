<script lang="ts">
	import { resolve } from '$app/paths';
	import type { WorldRegion } from '$lib/api/contracts/world';

	import { worldState } from '$lib/state/world.svelte';

	interface Props {
		regions?: readonly WorldRegion[];
		selectedRegionId?: string | null;
		loading?: boolean;
		emptyMessage?: string;
		onSelect?: (region: WorldRegion) => void | Promise<void>;
		class?: string;
	}

	let {
		regions,
		selectedRegionId,
		loading = false,
		emptyMessage = 'No region is available yet.',
		onSelect,
		class: className = ''
	}: Props = $props();

	const visibleRegions = $derived(regions ?? worldState.regions);

	const activeRegionId = $derived(
		selectedRegionId ?? worldState.selectedRegion?.id ?? worldState.position?.region_id ?? null
	);

	const loadingRegionCards = [0, 1, 2];

	function selectRegion(region: WorldRegion): void {
		void onSelect?.(region);
	}
</script>

<section class={['grid gap-4', className].filter(Boolean).join(' ')} aria-label="World regions">
	<div class="flex items-end justify-between gap-4">
		<div>
			<p
				class="mb-1 text-xs font-semibold tracking-[0.18em] text-[var(--orelunza-accent)] uppercase"
			>
				World
			</p>

			<h2 class="m-0 text-xl font-semibold tracking-[-0.025em] text-[var(--orelunza-text)]">
				Regions
			</h2>
		</div>

		{#if visibleRegions.length > 0}
			<p class="m-0 text-sm text-[var(--orelunza-text-muted)]">
				{visibleRegions.length}
				{visibleRegions.length === 1 ? ' region' : ' regions'}
			</p>
		{/if}
	</div>

	{#if loading && visibleRegions.length === 0}
		<div class="grid gap-3" aria-label="Loading regions">
			{#each loadingRegionCards as index (index)}
				<div
					class="h-32 animate-pulse rounded-[var(--orelunza-radius-medium)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]"
				></div>
			{/each}
		</div>
	{:else if visibleRegions.length === 0}
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
					<path d="M4 20V9l8-5 8 5v11" stroke-linejoin="round" />

					<path d="M9 20v-6h6v6" stroke-linejoin="round" />
				</svg>
			</div>

			<p class="mt-4 mb-0 text-sm text-[var(--orelunza-text-muted)]">
				{emptyMessage}
			</p>
		</div>
	{:else}
		<ul class="m-0 grid list-none gap-3 p-0">
			{#each visibleRegions as region (region.id)}
				{@const active = region.id === activeRegionId}

				<li>
					<a
						href={resolve(`/city/regions/${encodeURIComponent(region.id)}`)}
						aria-current={active ? 'location' : undefined}
						class={[
							'group relative block overflow-hidden rounded-[var(--orelunza-radius-medium)] border p-5 transition duration-150',
							active
								? 'border-[var(--orelunza-accent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_10%,var(--orelunza-surface))]'
								: 'border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] hover:-translate-y-0.5 hover:border-[var(--orelunza-border-strong)] hover:bg-[var(--orelunza-surface-raised)]'
						].join(' ')}
						onclick={() => selectRegion(region)}
					>
						<div
							class="pointer-events-none absolute top-0 right-0 size-32 translate-x-12 -translate-y-16 rounded-full bg-[color-mix(in_srgb,var(--orelunza-accent)_10%,transparent)] blur-2xl transition group-hover:bg-[color-mix(in_srgb,var(--orelunza-accent)_16%,transparent)]"
							aria-hidden="true"
						></div>

						<div class="relative flex items-start gap-4">
							<div
								class={[
									'flex size-12 shrink-0 items-center justify-center rounded-2xl border transition',
									active
										? 'border-[color-mix(in_srgb,var(--orelunza-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_16%,transparent)] text-[var(--orelunza-accent)]'
										: 'border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] text-[var(--orelunza-text-muted)] group-hover:text-[var(--orelunza-accent)]'
								].join(' ')}
								aria-hidden="true"
							>
								<svg
									viewBox="0 0 24 24"
									class="size-6"
									fill="none"
									stroke="currentColor"
									stroke-width="1.6"
								>
									<path d="M3 18l5-7 4 4 3-5 6 8" stroke-linecap="round" stroke-linejoin="round" />

									<path d="M3 20h18" stroke-linecap="round" />
								</svg>
							</div>

							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0">
										<h3 class="m-0 truncate text-base font-semibold text-[var(--orelunza-text)]">
											{region.name}
										</h3>

										<p class="mt-1 mb-0 truncate text-xs text-[var(--orelunza-text-muted)]">
											{region.slug}
										</p>
									</div>

									{#if active}
										<span
											class="shrink-0 rounded-full border border-[color-mix(in_srgb,var(--orelunza-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--orelunza-accent)]"
										>
											Current
										</span>
									{:else}
										<svg
											viewBox="0 0 24 24"
											class="mt-1 size-5 shrink-0 text-[var(--orelunza-text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--orelunza-text)]"
											fill="none"
											stroke="currentColor"
											stroke-width="1.8"
											aria-hidden="true"
										>
											<path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
										</svg>
									{/if}
								</div>

								<p
									class="mt-3 mb-0 line-clamp-2 text-sm leading-6 text-[var(--orelunza-text-soft)]"
								>
									{region.description || 'A region waiting to be explored.'}
								</p>
							</div>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
