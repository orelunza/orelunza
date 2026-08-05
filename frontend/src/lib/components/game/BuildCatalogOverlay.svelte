<script lang="ts">
	import type { InventorySnapshot } from '$lib/game/inventory/Inventory';
	import type { BlockType } from '$lib/game/world/voxel-types';
	import BuildCatalog from './BuildCatalog.svelte';

	interface Props {
		inventory: InventorySnapshot;
		selectedBlock: BlockType | null;
		onSelect: (type: BlockType) => void;
		onClose: () => void;
	}

	let { inventory, selectedBlock, onSelect, onClose }: Props = $props();
</script>

<!-- The catalog is a non-modal creation dock: the world stays visible on the left. -->
<div class="overlay" data-testid="build-catalog-overlay">
	<BuildCatalog {inventory} {selectedBlock} {onSelect} {onClose} />
</div>

<style>
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		box-sizing: border-box;
		padding: 1rem;
		pointer-events: none;
	}

	@media (max-width: 620px) {
		.overlay {
			align-items: flex-end;
			justify-content: stretch;
			padding: 0.6rem;
		}
	}
</style>
