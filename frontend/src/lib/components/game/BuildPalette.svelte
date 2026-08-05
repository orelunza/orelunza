<script lang="ts">
	import { BlockRegistry } from '$lib/game/world/BlockRegistry';
	import type { BlockType } from '$lib/game/world/voxel-types';
	import BlockIcon from './BlockIcon.svelte';

	interface Props {
		palette: readonly (BlockType | null)[];
		activeSlotIndex: number;
		selectedBlock: BlockType | null;
		onSelect: (type: BlockType, index: number) => void;
		onPin: (type: BlockType, index: number) => void;
		onRemove: (index: number) => void;
	}

	let { palette, activeSlotIndex, selectedBlock, onSelect, onPin, onRemove }: Props = $props();

	function handleDragStart(event: DragEvent, type: BlockType): void {
		if (!event.dataTransfer) {
			return;
		}

		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('application/x-orelunza-block', type);
		event.dataTransfer.setData('text/plain', type);
	}

	function handleDrop(event: DragEvent, index: number): void {
		event.preventDefault();
		const raw =
			event.dataTransfer?.getData('application/x-orelunza-block') ||
			event.dataTransfer?.getData('text/plain');

		if (!raw) {
			return;
		}

		const definition = BlockRegistry.all().find((candidate) => candidate.type === raw);

		if (definition?.placeable && definition.type !== 'air') {
			onPin(definition.type, index);
		}
	}

	function paletteDropTarget(node: HTMLElement, index: number) {
		const handleDragOver = (event: DragEvent) => {
			event.preventDefault();
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'move';
			}
		};
		const drop = (event: DragEvent) => handleDrop(event, index);

		node.addEventListener('dragover', handleDragOver);
		node.addEventListener('drop', drop);

		return {
			update(nextIndex: number) {
				index = nextIndex;
			},
			destroy() {
				node.removeEventListener('dragover', handleDragOver);
				node.removeEventListener('drop', drop);
			}
		};
	}
</script>

<section class="palette" aria-label="Active build palette">
	<div class="palette-heading">
		<div>
			<h3>Active palette</h3>
			<p>Drag creations here for instant access.</p>
		</div>
		<span class="shortcut">1–9</span>
	</div>

	<div class="palette-grid">
		{#each palette as type, index (index)}
			{@const definition = type ? BlockRegistry.get(type) : null}
			<div
				class="palette-slot"
				class:selected={index === activeSlotIndex && type !== null && type === selectedBlock}
				class:empty={type === null}
				use:paletteDropTarget={index}
			>
				<span class="slot-number">{index + 1}</span>

				{#if type && definition}
					<button
						type="button"
						class="slot-main"
						aria-label={`Select ${definition.label} from palette slot ${index + 1}`}
						draggable="true"
						onclick={() => onSelect(type, index)}
						ondragstart={(event) => handleDragStart(event, type)}
					>
						<BlockIcon {type} size={29} />
					</button>
					<button
						type="button"
						class="remove"
						aria-label={`Remove ${definition.label} from active palette`}
						title="Remove from active palette"
						onclick={() => onRemove(index)}
					>
						×
					</button>
				{:else}
					<span class="empty-mark" aria-hidden="true">+</span>
				{/if}
			</div>
		{/each}
	</div>
</section>

<style>
	.palette {
		border-bottom: 1px solid rgba(244, 241, 234, 0.08);
		padding: 0.62rem 0.72rem 0.72rem;
	}

	.palette-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
		margin-bottom: 0.48rem;
	}

	h3 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 650;
		letter-spacing: 0.025em;
		color: rgba(244, 241, 234, 0.9);
	}

	p {
		margin: 0.12rem 0 0;
		font-size: 0.58rem;
		color: rgba(244, 241, 234, 0.38);
	}

	.shortcut {
		border: 1px solid rgba(244, 241, 234, 0.1);
		border-radius: 999px;
		padding: 0.15rem 0.38rem;
		font-size: 0.54rem;
		color: rgba(244, 241, 234, 0.38);
	}

	.palette-grid {
		display: grid;
		grid-template-columns: repeat(9, minmax(0, 1fr));
		gap: 0.26rem;
	}

	.palette-slot {
		position: relative;
		display: grid;
		aspect-ratio: 1;
		min-width: 0;
		place-items: center;
		border: 1px solid rgba(244, 241, 234, 0.09);
		border-radius: 0.38rem;
		background: rgba(244, 241, 234, 0.035);
		transition:
			border-color 0.12s ease,
			background 0.12s ease;
	}

	.palette-slot:hover {
		border-color: rgba(244, 241, 234, 0.2);
		background: rgba(244, 241, 234, 0.065);
	}

	.palette-slot.selected {
		border-color: #f97316;
		background: rgba(249, 115, 22, 0.15);
		box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.42);
	}

	.palette-slot.empty {
		border-style: dashed;
		background: rgba(0, 0, 0, 0.1);
	}

	.slot-main {
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
		border: 0;
		background: transparent;
		cursor: grab;
	}

	.slot-main:active {
		cursor: grabbing;
	}

	.slot-main:focus-visible {
		outline: 2px solid #f97316;
		outline-offset: 1px;
	}

	.slot-number {
		position: absolute;
		top: 0.1rem;
		left: 0.18rem;
		z-index: 1;
		font-size: 0.47rem;
		color: rgba(244, 241, 234, 0.3);
		pointer-events: none;
	}

	.remove {
		position: absolute;
		top: -0.18rem;
		right: -0.16rem;
		display: none;
		width: 0.9rem;
		height: 0.9rem;
		place-items: center;
		border: 1px solid rgba(244, 241, 234, 0.18);
		border-radius: 999px;
		background: rgba(20, 23, 26, 0.96);
		color: rgba(244, 241, 234, 0.72);
		font-size: 0.66rem;
		line-height: 1;
		cursor: pointer;
	}

	.palette-slot:hover .remove,
	.remove:focus-visible {
		display: grid;
	}

	.remove:hover {
		border-color: rgba(249, 115, 22, 0.45);
		color: #fb923c;
	}

	.empty-mark {
		font-size: 0.75rem;
		font-weight: 300;
		color: rgba(244, 241, 234, 0.18);
	}

	@media (max-width: 540px) {
		.palette-grid {
			gap: 0.2rem;
		}

		p {
			display: none;
		}
	}
</style>
