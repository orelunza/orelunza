import type { BuildTarget } from './BuildTarget';
import type { BlockBreakingSystem } from './BlockBreakingSystem';
import type { VegetationInteractionInstance } from '../vegetation/VegetationInteractionIndex';
import type { VoxelWorld } from '../world/VoxelWorld';

export interface VegetationRemovalRenderer {
	removeVegetation(world: VoxelWorld, instanceId: string): VegetationInteractionInstance | null;
}

export interface CreationRemovalResult {
	kind: 'block' | 'vegetation';
	label: string;
}

/** Routes the universal hammer action to the target's authoritative subsystem. */
export class CreationRemovalSystem {
	constructor(
		private readonly world: VoxelWorld,
		private readonly blocks: BlockBreakingSystem,
		private readonly vegetation: VegetationRemovalRenderer,
		private readonly onVegetationChanged: () => void
	) {}

	remove(target: BuildTarget | null): CreationRemovalResult | null {
		if (!target) {
			return null;
		}

		if (target.kind === 'vegetation') {
			const removed = this.vegetation.removeVegetation(this.world, target.instanceId);

			if (!removed) {
				return null;
			}

			this.onVegetationChanged();
			return { kind: 'vegetation', label: removed.label };
		}

		if (!this.blocks.break(target.block)) {
			return null;
		}

		return { kind: 'block', label: target.block.type };
	}
}
