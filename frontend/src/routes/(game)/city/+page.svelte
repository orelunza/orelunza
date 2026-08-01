<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	import LoadingWorld from '$lib/components/game/LoadingWorld.svelte';

	onMount(() => {
		void goto(resolve('/world'), {
			replaceState: true
		});
	});
</script>

<LoadingWorld message="Entering the world" detail="Moving from the old city gate to /world." />
