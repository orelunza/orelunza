import { BlockRegistry } from '../BlockRegistry';
import type { VoxelWorld } from '../VoxelWorld';
import type { BlockCoordinate } from '../voxel-types';

export type CivilizationExternalAction = 'sleep' | 'wardrobe';

export interface CivilizationInteractionResult {
	handled: boolean;
	worldChanged: boolean;
	action?: CivilizationExternalAction;
	message?: string;
}

export class CivilizationInteractionSystem {
	constructor(private readonly world: VoxelWorld) {}

	interact(position: BlockCoordinate): CivilizationInteractionResult {
		const block = this.world.getLoadedBlock(position);
		if (!block) return { handled: false, worldChanged: false };
		const definition = BlockRegistry.get(block.type);
		switch (definition.interaction) {
			case 'door': {
				const open = block.state?.open !== true;
				const changed = this.world.updateBlockState(position, { open });
				return {
					handled: true,
					worldChanged: changed,
					message: open ? 'Door opened' : 'Door closed'
				};
			}
			case 'curtain': {
				const open = block.state?.open !== true;
				const changed = this.world.updateBlockState(position, { open });
				return {
					handled: true,
					worldChanged: changed,
					message: open ? 'Curtain opened' : 'Curtain closed'
				};
			}
			case 'lamp': {
				if (block.state?.powered === false) {
					return { handled: true, worldChanged: false, message: 'Lamp has no power' };
				}
				const lit = block.state?.lit !== true;
				const changed = this.world.updateBlockState(position, { lit });
				return {
					handled: true,
					worldChanged: changed,
					message: lit ? 'Lamp switched on' : 'Lamp switched off'
				};
			}
			case 'fire': {
				const lit = block.state?.lit !== true;
				const changed = this.world.updateBlockState(position, { lit });
				return {
					handled: true,
					worldChanged: changed,
					message: lit ? 'Fire lit' : 'Fire extinguished'
				};
			}
			case 'bed':
				return { handled: true, worldChanged: false, action: 'sleep', message: 'Bed selected' };
			case 'wardrobe':
				return {
					handled: true,
					worldChanged: false,
					action: 'wardrobe',
					message: 'Wardrobe opened'
				};
			default:
				return { handled: false, worldChanged: false };
		}
	}
}
