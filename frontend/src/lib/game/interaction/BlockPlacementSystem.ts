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
		private readonly onChanged: (position: BlockCoordinate) => void
	) {}

	place(target: TargetedBlock | null, selected: BlockType | null, creative = false): boolean {
		if (!target || !selected || selected === 'air') {
			return false;
		}

		const definition = BlockRegistry.get(selected);

		if (!definition.placeable || !isCardinalNormal(target.normal)) {
			return false;
		}

		const targetedBlock = this.world.getLoadedBlock(target.block);

		if (!targetedBlock || targetedBlock.type === 'air') {
			return false;
		}

		let consumed = false;

		if (!creative) {
			consumed = this.inventory.removeItem(selected, 1);

			if (!consumed) {
				return false;
			}
		}

		const replacesTarget = target.type === 'water';
		const position: BlockCoordinate = replacesTarget
			? { ...target.block }
			: {
					x: target.block.x + target.normal.x,
					y: target.block.y + target.normal.y,
					z: target.block.z + target.normal.z
				};

		const destination = this.world.getLoadedBlock(position);

		if (!destination || (destination.type !== 'air' && destination.type !== 'water')) {
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

		this.onChanged(position);

		return true;
	}

	private refund(type: BlockType, consumed: boolean): void {
		if (consumed) {
			this.inventory.addItem(type, 1);
		}
	}
}

function isCardinalNormal(normal: BlockCoordinate): boolean {
	if (!Number.isInteger(normal.x) || !Number.isInteger(normal.y) || !Number.isInteger(normal.z)) {
		return false;
	}

	return Math.abs(normal.x) + Math.abs(normal.y) + Math.abs(normal.z) === 1;
}
