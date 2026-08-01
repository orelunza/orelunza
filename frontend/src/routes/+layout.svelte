<script lang="ts">
	import '../app.css';

	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<svelte:head>
	<meta name="theme-color" content="#0b1310" />

	<meta name="color-scheme" content="dark" />
</svelte:head>

{@render children()}
