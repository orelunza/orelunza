<script lang="ts">
	import { BUILD_CATEGORY_LABELS } from '$lib/game/build/build-types';
	import type { CatalogEntry } from '$lib/game/build/build-catalog';

	interface Props {
		entry: CatalogEntry;
	}

	let { entry }: Props = $props();

	let categoryLabel = $derived(BUILD_CATEGORY_LABELS[entry.category] ?? entry.category);
</script>

<div class="tooltip" role="tooltip">
	<p class="name">{entry.label}</p>
	<p class="category">{categoryLabel}</p>
	<p class="id">{entry.type}</p>
</div>

<style>
	.tooltip {
		pointer-events: none;
		width: max-content;
		max-width: 12rem;
		border: 1px solid rgba(249, 115, 22, 0.28);
		border-radius: 0.4rem;
		background: rgba(20, 23, 26, 0.94);
		padding: 0.4rem 0.55rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
	}

	.name {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 600;
		color: #f4f1ea;
	}

	.category {
		margin: 0.1rem 0 0;
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #f97316;
	}

	.id {
		margin: 0.15rem 0 0;
		font-family:
			ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
		font-size: 0.6rem;
		color: rgba(244, 241, 234, 0.42);
	}
</style>
