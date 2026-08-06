<script lang="ts">
	import PlanetPreviewCanvas from '$lib/components/game/PlanetPreviewCanvas.svelte';
</script>

<svelte:head>
	<title>Real Earth Geography Preview — Orelunza</title>
	<meta
		name="description"
		content="Streamed Natural Earth continents, coastlines, global relief and ocean bathymetry preview for Orelunza."
	/>
</svelte:head>

<main class="h-dvh w-screen overflow-hidden bg-[#020711]" aria-label="Orelunza planet preview">
	<PlanetPreviewCanvas />
</main>
