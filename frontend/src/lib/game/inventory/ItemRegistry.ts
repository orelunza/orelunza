import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockType } from '../world/voxel-types';

export interface ItemDefinition {
	id: BlockType;
	label: string;
	placeable: boolean;
}

export class ItemRegistry {
	static get(type: BlockType): ItemDefinition {
		const block = BlockRegistry.get(type);

		return {
			id: type,
			label: block.label,
			placeable: type !== 'air'
		};
	}
}
