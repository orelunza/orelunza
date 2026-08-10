<script lang="ts">
	import type { PlanetSurfaceDestination } from '$lib/game/planet/surface/PlanetSurfaceDestination';

	interface Props {
		destination: PlanetSurfaceDestination | null;
		loading?: boolean;
		message?: string | null;
		onEnter?: () => void;
	}

	let { destination, loading = false, message = null, onEnter }: Props = $props();
</script>

<section
	class="pointer-events-auto w-[min(25rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-black/65 p-4 text-white shadow-2xl backdrop-blur-md"
	aria-label="Planet travel controls"
>
	<p class="m-0 text-xs font-semibold tracking-[0.24em] text-amber-300 uppercase">Destination</p>
	{#if destination}
		{#if destination.ecology?.country}
			<h2 class="mt-2 mb-0 text-xl font-semibold">{destination.ecology.country.name}</h2>
			<p class="mt-1 mb-0 text-xs text-white/48">{destination.ecology.country.continent}</p>
		{/if}
		<button
			type="button"
			class="mt-4 w-full rounded-md border border-amber-300/35 bg-amber-300/12 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-40"
			disabled={loading || destination.status !== 'land'}
			onclick={onEnter}
		>
			{loading ? 'Planning journey…' : 'Plan journey'}
		</button>
	{:else}
		<p class="mt-3 mb-0 text-sm leading-6 text-white/60">
			Select a country on land to plan a journey.
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
