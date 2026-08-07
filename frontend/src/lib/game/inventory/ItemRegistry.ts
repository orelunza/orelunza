import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockType } from '../world/voxel-types';

export interface ConsumableDefinition {
	nutrition: number;
	hydration: number;
	contamination: number;
}

export interface ItemDefinition {
	id: BlockType;
	label: string;
	placeable: boolean;
	consumable: ConsumableDefinition | null;
}

export class ItemRegistry {
	static get(type: BlockType): ItemDefinition {
		const block = BlockRegistry.get(type);
		const nutrition = Math.max(0, block.nutrition ?? 0);
		const hydration = Math.max(0, block.hydration ?? 0);

		return {
			id: type,
			label: block.label,
			placeable: block.placeable,
			consumable: nutrition > 0 || hydration > 0 ? { nutrition, hydration, contamination: 0 } : null
		};
	}
}
