<script lang="ts">
	import PlanetPreviewCanvas from '$lib/components/game/PlanetPreviewCanvas.svelte';
</script>

<svelte:head>
	<title>Planet Surface Travel — Orelunza</title>
	<meta
		name="description"
		content="Select real land on Earth and descend into local editable voxel terrain in Orelunza."
	/>
</svelte:head>

<main
	class="h-dvh w-screen overflow-hidden bg-[#020711]"
	aria-label="Orelunza planet travel preview"
>
	<PlanetPreviewCanvas />
</main>
