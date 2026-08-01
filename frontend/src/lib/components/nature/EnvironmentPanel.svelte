<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';

	import type { EnvironmentState, NaturalArea } from '$lib/api/contracts/nature';

	import { natureState } from '$lib/state/nature.svelte';

	interface Props {
		environment?: EnvironmentState | null;
		area?: NaturalArea | null;
		loading?: boolean;
		refreshing?: boolean;
		onRefresh?: () => void | Promise<void>;
		class?: string;
	}

	let {
		environment,
		area,
		loading = false,
		refreshing = false,
		onRefresh,
		class: className = ''
	}: Props = $props();

	const currentEnvironment = $derived(
		environment === undefined ? natureState.environment : environment
	);

	const currentArea = $derived(area === undefined ? natureState.selectedArea : area);

	function normalizePercentage(value: number): number {
		if (!Number.isFinite(value)) {
			return 0;
		}

		const percentage = value >= 0 && value <= 1 ? value * 100 : value;

		return Math.min(100, Math.max(0, percentage));
	}

	function formatPercentage(value: number): string {
		return `${Math.round(normalizePercentage(value))}%`;
	}

	function formatLabel(value: string): string {
		return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
	}

	function formatUpdatedAt(value: number): string {
		const timestamp = value < 10_000_000_000 ? value * 1000 : value;

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
	aria-label="Natural environment"
>
	<header
		class="flex items-start justify-between gap-4 border-b border-[var(--orelunza-border)] px-5 py-4"
	>
		<div>
			<p
				class="mb-1 text-xs font-semibold tracking-[0.16em] text-[var(--orelunza-accent)] uppercase"
			>
				Atmosphere
			</p>

			<h2 class="m-0 text-base font-semibold text-[var(--orelunza-text)]">Environment</h2>
		</div>

		{#if onRefresh}
			<Button
				variant="ghost"
				size="small"
				loading={refreshing}
				disabled={refreshing}
				onclick={refresh}
			>
				Refresh
			</Button>
		{/if}
	</header>

	{#if loading && !currentEnvironment}
		<div class="grid gap-4 p-5">
			<div class="h-24 animate-pulse rounded-xl bg-[var(--orelunza-background-soft)]"></div>

			<div class="h-16 animate-pulse rounded-xl bg-[var(--orelunza-background-soft)]"></div>

			<div class="h-16 animate-pulse rounded-xl bg-[var(--orelunza-background-soft)]"></div>
		</div>
	{:else if currentEnvironment}
		<div class="p-5">
			<div
				class="relative overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--orelunza-accent)_26%,var(--orelunza-border))] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--orelunza-accent)_12%,var(--orelunza-background-soft)),var(--orelunza-background-soft))] p-5"
			>
				<div
					class="pointer-events-none absolute top-0 right-0 size-32 translate-x-10 -translate-y-16 rounded-full bg-[color-mix(in_srgb,var(--orelunza-accent)_15%,transparent)] blur-2xl"
					aria-hidden="true"
				></div>

				<div class="relative flex items-start gap-4">
					<div
						class="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--orelunza-accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_11%,transparent)] text-[var(--orelunza-accent)]"
						aria-hidden="true"
					>
						<svg
							viewBox="0 0 24 24"
							class="size-6"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
						>
							<path d="M4 9c2-2 4-2 6 0s4 2 6 0 4-2 4-2" stroke-linecap="round" />

							<path d="M4 14c2-2 4-2 6 0s4 2 6 0 4-2 4-2" stroke-linecap="round" />

							<path d="M6 19c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0" stroke-linecap="round" />
						</svg>
					</div>

					<div class="min-w-0">
						<p
							class="m-0 text-xs font-semibold tracking-[0.12em] text-[var(--orelunza-accent)] uppercase"
						>
							Ambient feeling
						</p>

						<p class="mt-2 mb-0 text-base leading-7 text-[var(--orelunza-text)]">
							{currentEnvironment.ambient_description || 'The environment is quiet.'}
						</p>
					</div>
				</div>
			</div>

			<dl class="mt-4 grid gap-3 sm:grid-cols-2">
				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
				>
					<dt class="text-xs text-[var(--orelunza-text-muted)]">Terrain condition</dt>

					<dd class="mt-2 mb-0 text-sm font-semibold text-[var(--orelunza-text)]">
						{formatLabel(currentEnvironment.terrain_condition)}
					</dd>
				</div>

				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
				>
					<dt class="text-xs text-[var(--orelunza-text-muted)]">Vegetation condition</dt>

					<dd class="mt-2 mb-0 text-sm font-semibold text-[var(--orelunza-text)]">
						{formatLabel(currentEnvironment.vegetation_condition)}
					</dd>
				</div>
			</dl>

			<div class="mt-4 grid gap-4">
				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
				>
					<div class="flex items-center justify-between gap-3">
						<p class="m-0 text-sm font-medium text-[var(--orelunza-text-soft)]">
							Vegetation density
						</p>

						<p class="m-0 text-sm font-semibold text-[var(--orelunza-text)]">
							{formatPercentage(currentEnvironment.vegetation_density)}
						</p>
					</div>

					<div
						class="mt-3 h-2 overflow-hidden rounded-full bg-[var(--orelunza-surface-raised)]"
						role="progressbar"
						aria-label="Vegetation density"
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={Math.round(normalizePercentage(currentEnvironment.vegetation_density))}
					>
						<div
							class="h-full rounded-full bg-[var(--orelunza-accent)] transition-[width] duration-500"
							style={`width: ${normalizePercentage(currentEnvironment.vegetation_density)}%`}
						></div>
					</div>
				</div>

				<div
					class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
				>
					<div class="flex items-center justify-between gap-3">
						<p class="m-0 text-sm font-medium text-[var(--orelunza-text-soft)]">Water level</p>

						<p class="m-0 text-sm font-semibold text-[var(--orelunza-text)]">
							{formatPercentage(currentEnvironment.water_level)}
						</p>
					</div>

					<div
						class="mt-3 h-2 overflow-hidden rounded-full bg-[var(--orelunza-surface-raised)]"
						role="progressbar"
						aria-label="Water level"
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={Math.round(normalizePercentage(currentEnvironment.water_level))}
					>
						<div
							class="h-full rounded-full bg-[var(--orelunza-accent-strong)] transition-[width] duration-500"
							style={`width: ${normalizePercentage(currentEnvironment.water_level)}%`}
						></div>
					</div>
				</div>
			</div>

			<div
				class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--orelunza-border)] pt-4"
			>
				<p class="m-0 text-xs text-[var(--orelunza-text-muted)]">
					Updated
					{formatUpdatedAt(currentEnvironment.updated_at)}
				</p>

				{#if currentArea}
					<p class="m-0 truncate text-xs font-medium text-[var(--orelunza-text-soft)]">
						{currentArea.name}
					</p>
				{/if}
			</div>
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
						d="M4 9c2-2 4-2 6 0s4 2 6 0 4-2 4-2M4 14c2-2 4-2 6 0s4 2 6 0 4-2 4-2"
						stroke-linecap="round"
					/>
				</svg>
			</div>

			<h3 class="mt-4 mb-2 text-base font-semibold text-[var(--orelunza-text)]">
				No environmental state
			</h3>

			<p class="mx-auto mb-0 max-w-sm text-sm leading-6 text-[var(--orelunza-text-muted)]">
				This natural area does not have a recorded environmental state yet.
			</p>
		</div>
	{/if}
</section>
