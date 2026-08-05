<script lang="ts">
	import type { InventorySnapshot } from '$lib/game/inventory/Inventory';
	import type { BlockType } from '$lib/game/world/voxel-types';
	import BuildCatalog from './BuildCatalog.svelte';
	import OwnedBlocksPanel from './OwnedBlocksPanel.svelte';

	interface Props {
		inventory: InventorySnapshot;
		selectedBlock: BlockType | null;
		onSelect: (type: BlockType) => void;
		onClose: () => void;
	}

	let { inventory, selectedBlock, onSelect, onClose }: Props = $props();

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}
</script>

<div
	class="overlay"
	role="dialog"
	aria-modal="false"
	aria-label="Build workspace"
	data-testid="build-catalog-overlay"
	tabindex="-1"
	onkeydown={handleKeydown}
>
	<div class="workspace">
		<OwnedBlocksPanel {inventory} {selectedBlock} {onSelect} />
		<BuildCatalog {selectedBlock} {onSelect} {onClose} />
	</div>
</div>

<style>
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 30;
		display: grid;
		place-items: center;
		box-sizing: border-box;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.16);
		pointer-events: auto;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(330px, 390px) minmax(430px, 540px);
		align-items: stretch;
		gap: 0.8rem;
		width: min(960px, calc(100vw - 2rem));
		max-height: 66vh;
	}

	@media (max-width: 900px) {
		.overlay {
			place-items: end center;
			padding: 0.65rem;
		}

		.workspace {
			grid-template-columns: 1fr;
			width: min(560px, 100%);
			max-height: calc(100vh - 1.3rem);
			overflow-y: auto;
		}
	}
</style>
