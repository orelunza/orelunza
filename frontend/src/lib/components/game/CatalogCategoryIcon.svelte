<script lang="ts">
	import type { CatalogIconId } from '$lib/game/build/build-catalog';

	interface Props {
		icon: CatalogIconId;
		size?: number;
	}

	let { icon, size = 18 }: Props = $props();
</script>

<svg
	class="icon"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if icon === 'all'}
		<rect x="4" y="4" width="6" height="6" rx="1" />
		<rect x="14" y="4" width="6" height="6" rx="1" />
		<rect x="4" y="14" width="6" height="6" rx="1" />
		<rect x="14" y="14" width="6" height="6" rx="1" />
	{:else if icon === 'owned'}
		<path d="M4 8.5 12 4l8 4.5v8L12 21l-8-4.5z" />
		<path d="m4 8.5 8 4.5 8-4.5M12 13v8" />
	{:else if icon === 'favorites'}
		<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" />
	{:else if icon === 'recent'}
		<circle cx="12" cy="12" r="8" />
		<path d="M12 7v5l3 2" />
	{:else if icon === 'terrain'}
		<path d="m3 18 5.5-8 3.2 4.2L15.5 8 21 18z" />
		<path d="M3 18h18" />
	{:else if icon === 'nature'}
		<path
			d="M19.5 4.5C13 4.4 7.3 7.2 5.3 12.1c-1.1 2.7.1 5.6 2.7 6.5 2.9 1 5.9-.7 7.2-3.7 1.5-3.5 1.4-7.2 4.3-10.4Z"
		/>
		<path d="M6.5 18c2.2-3.5 5.1-6.2 9-8" />
	{:else if icon === 'construction'}
		<path d="M4 5h7v5H4zM13 5h7v5h-7zM7.5 12h7v5h-7zM4 19h7M13 19h7" />
	{:else if icon === 'decoration'}
		<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z" />
		<path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
		<path d="m6 15 1 2.8 2.8 1L7 19.7 6 22.5 5 19.7l-2.8-1L5 17.8z" />
	{:else if icon === 'light'}
		<path d="M9 17h6M10 20h4" />
		<path d="M8.2 14.5A6 6 0 1 1 15.8 14.5c-.8.7-1.2 1.3-1.3 2.5h-5c-.1-1.2-.5-1.8-1.3-2.5Z" />
	{:else}
		<path d="m14.5 5.5 4 4M13 7l4 4M5 19l6.5-6.5" />
		<path d="m4 20 2.8-.7L19 7.1 16.9 5 4.7 17.2z" />
	{/if}
</svg>

<style>
	.icon {
		display: block;
		flex: none;
	}
</style>
