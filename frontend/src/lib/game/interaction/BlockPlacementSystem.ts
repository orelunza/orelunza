import type { Inventory } from '../inventory/Inventory';
import { BlockRegistry } from '../world/BlockRegistry';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { BlockCoordinate, BlockType } from '../world/voxel-types';
import type { TargetedBlock } from '../game-types';
import type { PlayerCollider } from '../player/PlayerCollider';
import type { PlayerState } from '../player/PlayerState';

export class BlockPlacementSystem {
	constructor(
		private readonly world: VoxelWorld,
		private readonly inventory: Inventory,
		private readonly player: PlayerState,
		private readonly collider: PlayerCollider,
		private readonly onChanged: () => void
	) {}

	place(target: TargetedBlock | null, selected: BlockType | null, creative = false): boolean {
		if (!target || !selected || selected === 'air') {
			return false;
		}

		const definition = BlockRegistry.get(selected);

		if (!definition.placeable) {
			return false;
		}

		let consumed = false;

		if (!creative) {
			consumed = this.inventory.removeItem(selected, 1);

			if (!consumed) {
				return false;
			}
		}

		const position: BlockCoordinate = {
			x: target.block.x + target.normal.x,
			y: target.block.y + target.normal.y,
			z: target.block.z + target.normal.z
		};

		if (this.world.getBlock(position).type !== 'air') {
			this.refund(selected, consumed);
			return false;
		}

		if (definition.solid && this.collider.intersectsPlayerBlock(this.player, position)) {
			this.refund(selected, consumed);
			return false;
		}

		if (!this.world.setBlock(position, selected)) {
			this.refund(selected, consumed);
			return false;
		}

		this.onChanged();

		return true;
	}

	private refund(type: BlockType, consumed: boolean): void {
		if (consumed) {
			this.inventory.addItem(type, 1);
		}
	}
}
