<script lang="ts">
	import type { PlanetSurfaceDestination } from '$lib/game/planet/surface/PlanetSurfaceDestination';

	interface Props {
		destination: PlanetSurfaceDestination | null;
		loading?: boolean;
		message?: string | null;
		onEnter?: () => void;
	}

	let { destination, loading = false, message = null, onEnter }: Props = $props();
	let latitude = $derived(
		destination ? (destination.coordinate.latitudeRadians * 180) / Math.PI : 0
	);
	let longitude = $derived(
		destination ? (destination.coordinate.longitudeRadians * 180) / Math.PI : 0
	);
</script>

<section
	class="pointer-events-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-black/65 p-4 text-white shadow-2xl backdrop-blur-md"
	aria-label="Planet travel controls"
>
	<p class="m-0 text-xs font-semibold tracking-[0.24em] text-amber-300 uppercase">Surface travel</p>
	{#if destination}
		<div class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
			<span class="text-white/45">Latitude</span><strong class="text-right"
				>{latitude.toFixed(4)}°</strong
			>
			<span class="text-white/45">Longitude</span><strong class="text-right"
				>{longitude.toFixed(4)}°</strong
			>
			<span class="text-white/45">Elevation</span>
			<strong class="text-right">{destination.sample?.elevationMeters.toFixed(0) ?? '…'} m</strong>
			<span class="text-white/45">Surface</span>
			<strong
				class="text-right"
				class:text-emerald-300={destination.status === 'land'}
				class:text-red-300={destination.status === 'ocean' || destination.status === 'error'}
			>
				{destination.status}
			</strong>
		</div>
		<button
			type="button"
			class="mt-4 w-full rounded-md border border-amber-300/35 bg-amber-300/12 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-40"
			disabled={loading || destination.status !== 'land'}
			onclick={onEnter}
		>
			{loading ? 'Preparing local terrain…' : 'Enter region · Enter'}
		</button>
	{:else}
		<p class="mt-3 mb-0 text-sm leading-6 text-white/60">
			Double-click a continent to select a real geographic destination.
		</p>
	{/if}

	{#if message}
		<p
			class="mt-3 mb-0 rounded-md border border-white/8 bg-white/5 px-3 py-2 text-xs text-white/68"
		>
			{message}
		</p>
	{/if}
</section>
