<script lang="ts">
	import PlanetPreviewCanvas from '$lib/components/game/PlanetPreviewCanvas.svelte';
</script>

<svelte:head>
	<title>Planet Earth Preview — Orelunza</title>
	<meta
		name="description"
		content="Experimental cube-sphere, planetary LOD and geodetic foundation for Orelunza."
	/>
</svelte:head>

<main class="h-dvh w-screen overflow-hidden bg-[#020711]" aria-label="Orelunza planet preview">
	<PlanetPreviewCanvas />
</main>
