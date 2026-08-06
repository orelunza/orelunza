<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	onMount(() => {
		void goto(resolve('/world'), { replaceState: true });
	});
</script>

<svelte:head>
	<title>Opening Orelunza</title>
</svelte:head>

<main class="grid h-dvh w-screen place-items-center bg-[#020711] text-sm text-white/60">
	Opening the world…
</main>
