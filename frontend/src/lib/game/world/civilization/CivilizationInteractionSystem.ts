import type { Inventory } from '../../inventory/Inventory';
import { ItemRegistry } from '../../inventory/ItemRegistry';
import { BlockRegistry } from '../BlockRegistry';
import type { VoxelWorld } from '../VoxelWorld';
import type { BlockCoordinate, BlockType, WorldCoordinate } from '../voxel-types';

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

export interface DoorApproachState {
	moving: boolean;
	directionX: number;
	directionZ: number;
}

export interface NearbyDoor {
	position: BlockCoordinate;
	type: Extract<BlockType, 'wooden_door' | 'glass_door'>;
	open: boolean;
	distance: number;
}

export class CivilizationInteractionSystem {
	private readonly automaticDoors = new Map<string, BlockCoordinate>();

	constructor(
		private readonly world: VoxelWorld,
		private readonly inventory?: Inventory
	) {}

	/**
	 * Door behavior is intentionally forgiving in third person:
	 * - glass shop doors open from proximity before collision;
	 * - a closed wooden door also opens when the player is actively walking into it;
	 * - E can use the nearest door even when the eye-level ray passes above the
	 *   lower door voxel (doors are visually ~1.86 m tall but stored in one cell).
	 */
	updateAutomaticDoors(
		player: Pick<WorldCoordinate, 'x' | 'y' | 'z'>,
		approach?: DoorApproachState
	): BlockCoordinate[] {
		const changed: BlockCoordinate[] = [];
		const baseX = Math.floor(player.x);
		const baseY = Math.floor(player.y);
		const baseZ = Math.floor(player.z);

		for (let x = baseX - 3; x <= baseX + 3; x += 1) {
			for (let z = baseZ - 3; z <= baseZ + 3; z += 1) {
				for (let y = baseY - 2; y <= baseY + 2; y += 1) {
					const position = { x, y, z };
					const block = this.world.getLoadedBlock(position);
					if (block?.type !== 'glass_door' && block?.type !== 'wooden_door') continue;
					if (Math.abs(player.y - position.y) > 2.35) continue;

					const distanceSquared = horizontalDistanceSquared(player, position);
					if (block.type === 'glass_door') {
						if (distanceSquared > 2.8 * 2.8) continue;
						const key = blockKey(position);
						this.automaticDoors.set(key, position);
						if (
							block.state?.open !== true &&
							this.world.updateBlockState(position, { open: true }, false)
						) {
							changed.push({ ...position });
						}
						continue;
					}

					if (
						block.state?.open !== true &&
						distanceSquared <= 1.55 * 1.55 &&
						isApproachingDoor(player, position, approach) &&
						this.world.updateBlockState(position, { open: true })
					) {
						changed.push({ ...position });
					}
				}
			}
		}

		for (const [key, position] of this.automaticDoors) {
			const block = this.world.getLoadedBlock(position);
			if (block?.type !== 'glass_door') {
				this.automaticDoors.delete(key);
				continue;
			}

			const stillNear =
				horizontalDistanceSquared(player, position) <= 3.25 * 3.25 &&
				Math.abs(player.y - position.y) <= 2.5;
			if (stillNear) continue;

			if (
				block.state?.open === true &&
				this.world.updateBlockState(position, { open: false }, false)
			) {
				changed.push({ ...position });
			}
			this.automaticDoors.delete(key);
		}

		return changed;
	}

	findNearbyDoor(
		player: Pick<WorldCoordinate, 'x' | 'y' | 'z'>,
		maximumDistance = 2.65
	): NearbyDoor | null {
		const baseX = Math.floor(player.x);
		const baseY = Math.floor(player.y);
		const baseZ = Math.floor(player.z);
		const maximumDistanceSquared = maximumDistance * maximumDistance;
		let nearest: NearbyDoor | null = null;

		for (let x = baseX - 3; x <= baseX + 3; x += 1) {
			for (let z = baseZ - 3; z <= baseZ + 3; z += 1) {
				for (let y = baseY - 2; y <= baseY + 2; y += 1) {
					const position = { x, y, z };
					const block = this.world.getLoadedBlock(position);
					if (block?.type !== 'wooden_door' && block?.type !== 'glass_door') continue;
					if (Math.abs(player.y - position.y) > 2.35) continue;
					const distanceSquared = horizontalDistanceSquared(player, position);
					if (distanceSquared > maximumDistanceSquared) continue;
					const distance = Math.sqrt(distanceSquared);
					if (nearest && nearest.distance <= distance) continue;
					nearest = {
						position: { ...position },
						type: block.type,
						open: block.state?.open === true,
						distance
					};
				}
			}
		}
		return nearest;
	}

	interactNearestDoor(
		player: Pick<WorldCoordinate, 'x' | 'y' | 'z'>,
		maximumDistance = 2.65
	): CivilizationInteractionResult {
		const door = this.findNearbyDoor(player, maximumDistance);
		if (!door) return { handled: false, worldChanged: false };
		return this.interact(door.position);
	}

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
					position: { ...position },
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

function horizontalDistanceSquared(
	player: Pick<WorldCoordinate, 'x' | 'z'>,
	position: BlockCoordinate
): number {
	const dx = player.x - (position.x + 0.5);
	const dz = player.z - (position.z + 0.5);
	return dx * dx + dz * dz;
}

function isApproachingDoor(
	player: Pick<WorldCoordinate, 'x' | 'z'>,
	position: BlockCoordinate,
	approach: DoorApproachState | undefined
): boolean {
	if (!approach?.moving) return false;
	const length = Math.hypot(approach.directionX, approach.directionZ);
	if (length <= 1e-5) return false;
	const toDoorX = position.x + 0.5 - player.x;
	const toDoorZ = position.z + 0.5 - player.z;
	const doorDistance = Math.hypot(toDoorX, toDoorZ);
	if (doorDistance <= 1e-5) return true;
	const dot =
		(approach.directionX / length) * (toDoorX / doorDistance) +
		(approach.directionZ / length) * (toDoorZ / doorDistance);
	return dot >= 0.35;
}

function blockKey(position: BlockCoordinate): string {
	return `${position.x},${position.y},${position.z}`;
}
