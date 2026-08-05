import type { Inventory } from '../inventory/Inventory';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { BlockCoordinate } from '../world/voxel-types';
import type { TargetedBlock } from '../game-types';

export class BlockBreakingSystem {
	constructor(
		private readonly world: VoxelWorld,
		private readonly inventory: Inventory,
		private readonly onChanged: (position: BlockCoordinate) => void
	) {}

	break(target: TargetedBlock | null): boolean {
		if (!target || target.type === 'water') {
			return false;
		}

		const collected = this.world.removeBlock(target.block);

		if (!collected) {
			return false;
		}

		this.inventory.addItem(collected, 1);
		this.onChanged(target.block);

		return true;
	}
}
