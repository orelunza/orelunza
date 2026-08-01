import type { Inventory } from '../inventory/Inventory';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { TargetedBlock } from '../game-types';

export class BlockBreakingSystem {
	constructor(
		private readonly world: VoxelWorld,
		private readonly inventory: Inventory,
		private readonly onChanged: () => void
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
		this.onChanged();

		return true;
	}
}
