import type { Inventory } from '../../inventory/Inventory';
import { ItemRegistry } from '../../inventory/ItemRegistry';
import { BlockRegistry } from '../BlockRegistry';
import type { VoxelWorld } from '../VoxelWorld';
import type { BlockCoordinate, BlockType } from '../voxel-types';

export type CivilizationExternalAction = 'sleep' | 'wardrobe' | 'eat' | 'drink' | 'wash' | 'radio';

export interface CivilizationInteractionResult {
	handled: boolean;
	worldChanged: boolean;
	action?: CivilizationExternalAction;
	message?: string;
	nutrition?: number;
	hydration?: number;
	active?: boolean;
	position?: BlockCoordinate;
	itemAdded?: BlockType;
}

export class CivilizationInteractionSystem {
	constructor(
		private readonly world: VoxelWorld,
		private readonly inventory?: Inventory
	) {}

	interact(position: BlockCoordinate): CivilizationInteractionResult {
		const block = this.world.getLoadedBlock(position);
		if (!block) return { handled: false, worldChanged: false };
		const definition = BlockRegistry.get(block.type);
		switch (definition.interaction) {
			case 'door':
			case 'curtain': {
				const open = block.state?.open !== true;
				const changed = this.world.updateBlockState(position, { open });
				return {
					handled: true,
					worldChanged: changed,
					message: `${definition.label} ${open ? 'opened' : 'closed'}`
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
			case 'container': {
				const opening = block.state?.open !== true;
				let stock = Math.max(0, block.state?.stock ?? definition.defaultState?.stock ?? 0);
				let itemAdded: BlockType | undefined;
				let extra = '';
				const providedItem = containerItemFor(block.type, stock, definition.providesItem);
				if (opening && providedItem && stock > 0 && this.inventory) {
					if (this.inventory.addItem(providedItem, 1)) {
						itemAdded = providedItem;
						stock -= 1;
						extra = ` · took ${ItemRegistry.get(providedItem).label}`;
					} else {
						extra = ' · inventory full';
					}
				}
				const changed = this.world.updateBlockState(position, { open: opening, stock });
				return {
					handled: true,
					worldChanged: changed,
					itemAdded,
					message: `${definition.label} ${opening ? 'opened' : 'closed'}${extra}`
				};
			}
			case 'water': {
				const running = block.state?.running !== true;
				const changed = this.world.updateBlockState(position, { running });
				return {
					handled: true,
					worldChanged: changed,
					action: running ? 'drink' : undefined,
					hydration: running ? (definition.hydration ?? 0) : 0,
					message: running ? 'Tap opened · drank clean water' : 'Tap closed'
				};
			}
			case 'shower': {
				const running = block.state?.running !== true;
				const changed = this.world.updateBlockState(position, { running });
				return {
					handled: true,
					worldChanged: changed,
					action: running ? 'wash' : undefined,
					message: running ? 'Shower switched on' : 'Shower switched off'
				};
			}
			case 'toilet':
				return { handled: true, worldChanged: false, message: 'Toilet flushed' };
			case 'radio': {
				if (block.state?.powered === false) {
					return { handled: true, worldChanged: false, message: 'Radio has no power' };
				}
				const running = block.state?.running !== true;
				const changed = this.world.updateBlockState(position, { running });
				return {
					handled: true,
					worldChanged: changed,
					action: 'radio',
					active: running,
					position: { ...position },
					message: running ? 'Radio switched on' : 'Radio switched off'
				};
			}
			case 'food': {
				const stock = Math.max(0, block.state?.stock ?? definition.defaultState?.stock ?? 0);
				if (stock <= 0)
					return { handled: true, worldChanged: false, message: `${definition.label} is empty` };
				const changed = this.world.updateBlockState(position, { stock: stock - 1 });
				return {
					handled: true,
					worldChanged: changed,
					action: 'eat',
					nutrition: definition.nutrition ?? 0,
					hydration: definition.hydration ?? 0,
					message: `Ate from ${definition.label}`
				};
			}
			default:
				return { handled: false, worldChanged: false };
		}
	}
}

function containerItemFor(
	type: BlockType,
	stock: number,
	fallback?: BlockType
): BlockType | undefined {
	if (type === 'refrigerator') return stock % 2 === 0 ? 'fresh_fruit' : 'bottled_water';
	if (type === 'kitchen_cabinet') return stock % 2 === 0 ? 'rice_meal' : 'bread_loaf';
	return fallback;
}
