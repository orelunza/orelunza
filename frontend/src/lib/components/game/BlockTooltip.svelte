<script lang="ts">
	import type { CatalogEntry } from '$lib/game/build/build-catalog';
	import { BUILD_CATEGORY_LABELS } from '$lib/game/build/build-types';

	interface Props {
		entry: CatalogEntry;
	}

	let { entry }: Props = $props();

	let categoryLabel = $derived(BUILD_CATEGORY_LABELS[entry.category] ?? entry.category);
	let kindLabel = $derived(entry.kind.replace('-', ' '));
	let placementLabel = $derived(entry.placementMode.replace('-', ' '));
</script>

<div class="tooltip" role="tooltip">
	<div class="title-row">
		<p class="name">{entry.label}</p>
		<span class="kind">{kindLabel}</span>
	</div>
	<p class="description">{entry.description}</p>
	<div class="metadata">
		<span>{categoryLabel}</span>
		<span>{placementLabel}</span>
		<span class="id">{entry.type}</span>
	</div>
</div>

<style>
	.tooltip {
		pointer-events: none;
		width: 13.5rem;
		border: 1px solid rgba(249, 115, 22, 0.28);
		border-radius: 0.48rem;
		background: rgba(20, 23, 26, 0.97);
		padding: 0.48rem 0.56rem;
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
	}

	.title-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.name {
		margin: 0;
		font-size: 0.76rem;
		font-weight: 650;
		color: #f4f1ea;
	}

	.kind {
		font-size: 0.54rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #fb923c;
	}

	.description {
		margin: 0.25rem 0 0;
		font-size: 0.62rem;
		line-height: 1.38;
		color: rgba(244, 241, 234, 0.55);
	}

	.metadata {
		display: flex;
		flex-wrap: wrap;
		gap: 0.22rem 0.45rem;
		margin-top: 0.38rem;
		font-size: 0.52rem;
		letter-spacing: 0.045em;
		text-transform: uppercase;
		color: rgba(244, 241, 234, 0.36);
	}

	.id {
		font-family:
			ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
		text-transform: none;
	}
</style>
