import type { BlockCoordinate, BlockType } from './voxel-types';
import { CENTRAL_CITY_CENTER } from './voxel-types';
import {
	CIVIC_ELEVATOR_LAYOUT,
	CIVIC_TOWER,
	URBAN_BUILDINGS,
	type UrbanBuildingDefinition
} from './civilization/UrbanBuildingRegistry';

export interface CityBlock {
	position: BlockCoordinate;
	type: BlockType;
}

interface BuildingSpec {
	x: number;
	z: number;
	halfWidth: number;
	halfDepth: number;
	height: number;
	wall: BlockType;
	accent: BlockType;
}

const SHOW_HOME: BuildingSpec = {
	x: 0,
	z: 14,
	halfWidth: 6,
	halfDepth: 5,
	height: 5,
	wall: 'brick',
	accent: 'wooden_plank'
};

const SUPERMARKET: BuildingSpec = {
	x: -21,
	z: 16,
	halfWidth: 8,
	halfDepth: 6,
	height: 5,
	wall: 'concrete',
	accent: 'brick'
};

const CORNER_SHOP: BuildingSpec = {
	x: 20,
	z: 16,
	halfWidth: 5,
	halfDepth: 5,
	height: 4,
	wall: 'brick',
	accent: 'marble'
};

const POOL_CENTER = { x: 23, z: -20 };
const POOL_HALF_WIDTH = 7;
const POOL_HALF_DEPTH = 5;

const RESIDENTIAL_BUILDINGS: readonly BuildingSpec[] = URBAN_BUILDINGS.filter(
	(building) => building.id !== CIVIC_TOWER.id
).map((building) => ({
	x: building.localX,
	z: building.localZ,
	halfWidth: building.halfWidth,
	halfDepth: building.halfDepth,
	height: building.floors * building.floorHeight,
	wall: building.wall,
	accent: building.accent
}));

const CIVIC_BUILDING_SPEC: BuildingSpec = {
	x: CIVIC_TOWER.localX,
	z: CIVIC_TOWER.localZ,
	halfWidth: CIVIC_TOWER.halfWidth,
	halfDepth: CIVIC_TOWER.halfDepth,
	height: CIVIC_TOWER.floors * CIVIC_TOWER.floorHeight,
	wall: CIVIC_TOWER.wall,
	accent: CIVIC_TOWER.accent
};

/**
 * Native city generator shared by the authored starter city and player-visible
 * voxel world. Lot Ville 3 adds the public layer: streets, sidewalks,
 * supermarket/shop interiors, parking, street furniture and a real generated
 * swimming pool using the same water blocks as the rest of Orelunza.
 */
export class CityGenerator {
	generateForColumn(x: number, groundY: number, z: number): CityBlock[] {
		const blocks: CityBlock[] = [];
		const localX = x - CENTRAL_CITY_CENTER.x;
		const localZ = z - CENTRAL_CITY_CENTER.z;

		this.addPublicGround(blocks, x, groundY, z, localX, localZ);
		this.addCivicPlaza(blocks, x, groundY, z, localX, localZ);
		this.addCivicTower(blocks, x, groundY, z, localX, localZ);
		this.addBuilding(blocks, x, groundY, z, SHOW_HOME, true);
		for (const building of URBAN_BUILDINGS) {
			if (building.id === CIVIC_TOWER.id) continue;
			this.addVerticalBuilding(blocks, x, groundY, z, building, localX, localZ);
		}
		this.addSupermarket(blocks, x, groundY, z, localX, localZ);
		this.addCornerShop(blocks, x, groundY, z, localX, localZ);
		this.addSwimmingPool(blocks, x, groundY, z, localX, localZ);
		this.addStreetFurniture(blocks, x, groundY, z, localX, localZ);

		return blocks;
	}

	isProtectedColumn(x: number, z: number): boolean {
		const localX = x - CENTRAL_CITY_CENTER.x;
		const localZ = z - CENTRAL_CITY_CENTER.z;
		if (this.insideBuilding(localX, localZ)) return true;
		if (isRoad(localX, localZ) || isSidewalk(localX, localZ) || isParking(localX, localZ))
			return true;
		if (Math.abs(localX) <= 8 && Math.abs(localZ) <= 8) return true;
		if (
			Math.abs(localX - POOL_CENTER.x) <= POOL_HALF_WIDTH + 3 &&
			Math.abs(localZ - POOL_CENTER.z) <= POOL_HALF_DEPTH + 3
		)
			return true;
		if (localX === SUPERMARKET.x && localZ === SUPERMARKET.z + SUPERMARKET.halfDepth + 1)
			return true;
		if (localX === CORNER_SHOP.x && localZ === CORNER_SHOP.z + CORNER_SHOP.halfDepth + 1)
			return true;
		return false;
	}

	/** Pool columns are lowered two metres so generated water is actually swimmable. */
	isPoolInterior(x: number, z: number): boolean {
		const localX = x - CENTRAL_CITY_CENTER.x;
		const localZ = z - CENTRAL_CITY_CENTER.z;
		return (
			Math.abs(localX - POOL_CENTER.x) < POOL_HALF_WIDTH &&
			Math.abs(localZ - POOL_CENTER.z) < POOL_HALF_DEPTH
		);
	}

	private addPublicGround(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		localX: number,
		localZ: number
	): void {
		// Pool construction owns its lowered floor/water/stair columns. Keeping
		// public-ground generation out avoids duplicate floor blocks and lets the
		// submerged entrance replace water with real steps.
		if (this.isPoolInterior(x, z)) return;

		if (this.insideBuilding(localX, localZ)) return;
		if (isRoad(localX, localZ) || isParking(localX, localZ)) {
			blocks.push({ position: { x, y: groundY, z }, type: 'asphalt' });
			if (isRoadStripe(localX, localZ) || isParkingStripe(localX, localZ)) {
				blocks.push({ position: { x, y: groundY + 1, z }, type: 'road_marking' });
			}
			return;
		}

		if (isSidewalk(localX, localZ) || (Math.abs(localX) <= 8 && Math.abs(localZ) <= 8)) {
			blocks.push({ position: { x, y: groundY, z }, type: 'sidewalk' });
		}
	}

	private addCivicPlaza(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		localX: number,
		localZ: number
	): void {
		if (Math.abs(localX) <= 8 && Math.abs(localZ) <= 8 && !isRoad(localX, localZ)) {
			blocks.push({ position: { x, y: groundY, z }, type: 'sidewalk' });
		}
	}

	private addCivicTower(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		localX: number,
		localZ: number
	): void {
		this.addVerticalBuilding(blocks, x, groundY, z, CIVIC_TOWER, localX, localZ);
	}

	private addVerticalBuilding(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		building: UrbanBuildingDefinition,
		localX: number,
		localZ: number
	): void {
		const dx = localX - building.localX;
		const dz = localZ - building.localZ;
		if (Math.abs(dx) > building.halfWidth || Math.abs(dz) > building.halfDepth) return;
		const height = building.floors * building.floorHeight;
		const onEdge = Math.abs(dx) === building.halfWidth || Math.abs(dz) === building.halfDepth;
		const front = dz === building.halfDepth;
		const entrance = front && dx === 0;

		if (onEdge) {
			for (let level = 1; level <= height; level += 1) {
				if (entrance && level === 1) {
					blocks.push({
						position: { x, y: groundY + level, z },
						type: building.kind === 'civic' ? 'glass_door' : 'wooden_door'
					});
					continue;
				}
				if (entrance && level === 2) continue;
				const withinStorey = (level - 1) % building.floorHeight;
				const floorBand = withinStorey === building.floorHeight - 1;
				const structuralColumn = (Math.abs(dx) + Math.abs(dz)) % 3 === 0;
				const window = !floorBand && !structuralColumn && level % building.floorHeight >= 1;
				blocks.push({
					position: { x, y: groundY + level, z },
					type: window ? 'glass' : floorBand ? building.accent : building.wall
				});
			}
		}

		// Every storey gets a real structural floor. Elevator and stair voids stay open.
		if (!onEdge) {
			for (let floor = 2; floor <= building.floors; floor += 1) {
				const floorY = groundY + (floor - 1) * building.floorHeight;
				if (!this.isVerticalCirculationVoid(building, dx, dz)) {
					blocks.push({ position: { x, y: floorY, z }, type: 'concrete' });
				}
			}
			this.addEmergencyStairs(blocks, x, groundY, z, building, dx, dz);
			this.addVerticalInterior(blocks, x, groundY, z, building, dx, dz);
		}

		blocks.push({ position: { x, y: groundY + height + 1, z }, type: 'concrete' });
		if (building.hasElevator)
			this.addElevatorInfrastructure(blocks, x, groundY, z, building, dx, dz);
	}

	private isVerticalCirculationVoid(
		building: UrbanBuildingDefinition,
		dx: number,
		dz: number
	): boolean {
		if (
			building.hasElevator &&
			dx === CIVIC_ELEVATOR_LAYOUT.shaftLocalX &&
			dz === CIVIC_ELEVATOR_LAYOUT.shaftLocalZ
		)
			return true;
		const stairX = -building.halfWidth + 2;
		const stairStartZ = building.halfDepth - 5;
		return (dx === stairX || dx === stairX + 1) && dz >= stairStartZ && dz <= stairStartZ + 3;
	}

	private addEmergencyStairs(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		building: UrbanBuildingDefinition,
		dx: number,
		dz: number
	): void {
		// Four visible one-metre stair blocks climb each four-metre storey. The
		// stair run sits just inside the front lobby so players immediately see a
		// non-electric route to the floors above instead of finding hidden steps in
		// a rear corner.
		const stairX = -building.halfWidth + 2;
		const stairStartZ = building.halfDepth - 5;
		if ((dx !== stairX && dx !== stairX + 1) || dz < stairStartZ || dz > stairStartZ + 3) return;
		const step = dz - stairStartZ;
		for (let floor = 1; floor < building.floors; floor += 1) {
			const base = groundY + (floor - 1) * building.floorHeight;
			// Two parallel one-metre lanes create a real two-metre stair flight. The
			// top step meets the next structural floor, so the same staircase is
			// naturally usable both upward and downward.
			blocks.push({ position: { x, y: base + step + 1, z }, type: 'stone_stairs' });
		}
	}

	private addInteriorPartition(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		building: UrbanBuildingDefinition,
		dx: number,
		dz: number,
		floor: number
	): boolean {
		if (
			building.kind !== 'hotel' &&
			building.kind !== 'apartments' &&
			building.kind !== 'residential'
		)
			return false;
		if (dz !== 0 || Math.abs(dx) >= building.halfWidth) return false;
		const base = groundY + (floor - 1) * building.floorHeight;
		if (dx === 0) {
			blocks.push({ position: { x, y: base + 1, z }, type: 'wooden_door' });
			return true;
		}
		// Keep a second metre beside the door completely clear. Large furniture
		// must never turn an apartment doorway into a one-person bottleneck.
		if (dx === 1) return true;
		for (let level = 1; level < building.floorHeight; level += 1) {
			blocks.push({
				position: { x, y: base + level, z },
				type: building.kind === 'hotel' ? 'concrete' : 'brick'
			});
		}
		return true;
	}

	private addVerticalInterior(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		building: UrbanBuildingDefinition,
		dx: number,
		dz: number
	): void {
		for (let floor = 1; floor <= building.floors; floor += 1) {
			const base = groundY + (floor - 1) * building.floorHeight;
			if (floor === 1 && dx === -2 && dz === 1)
				blocks.push({ position: { x, y: base + 1, z }, type: 'power_panel' });
			if (this.isVerticalCirculationVoid(building, dx, dz)) continue;
			if (this.addInteriorPartition(blocks, x, groundY, z, building, dx, dz, floor)) continue;

			// One central-ish ceiling fixture per floor is enough for emissive visual
			// feedback; the renderer activates only a small nearby light budget.
			if (dx === 2 && dz === -2)
				blocks.push({ position: { x, y: base + 3, z }, type: 'ceiling_light' });

			if (building.kind === 'office') {
				for (const desk of [
					{ x: -3, z: -2 },
					{ x: 3, z: -2 },
					{ x: 3, z: 2 }
				]) {
					if (dx === desk.x && dz === desk.z)
						blocks.push({ position: { x, y: base + 1, z }, type: 'table' });
					if (dx === desk.x && dz === desk.z + 1)
						blocks.push({ position: { x, y: base + 1, z }, type: 'chair' });
				}
				if (dx === building.halfWidth - 2 && dz === -building.halfDepth + 2 && floor % 2 === 0)
					blocks.push({ position: { x, y: base + 1, z }, type: 'bookshelf' });
			} else if (building.kind === 'hotel') {
				// Rear half = bedroom, front half = lounge. The partition at dz=0
				// makes those rooms physically distinct while retaining a usable door.
				if (dx === -2 && dz === -3) blocks.push({ position: { x, y: base + 1, z }, type: 'bed' });
				if (dx === 3 && dz === -3)
					blocks.push({ position: { x, y: base + 1, z }, type: 'wardrobe' });
				if (dx === 2 && dz === 2) blocks.push({ position: { x, y: base + 1, z }, type: 'sofa' });
				if (dx === 4 && dz === 2) blocks.push({ position: { x, y: base + 1, z }, type: 'table' });
				if (dx === 4 && dz === 3) blocks.push({ position: { x, y: base + 1, z }, type: 'chair' });
				if (dx === 5 && dz === 1)
					blocks.push({ position: { x, y: base + 1, z }, type: 'floor_lamp' });
			} else if (building.kind === 'apartments' || building.kind === 'residential') {
				// A large rear bedroom and a broad front living/kitchen area make each
				// floor visibly residential instead of placing three props together.
				if (dx === -2 && dz === -3) blocks.push({ position: { x, y: base + 1, z }, type: 'bed' });
				if (dx === 3 && dz === -3)
					blocks.push({ position: { x, y: base + 1, z }, type: 'wardrobe' });
				if (dx === 2 && dz === 2) blocks.push({ position: { x, y: base + 1, z }, type: 'sofa' });
				if (dx === -2 && dz === 3) blocks.push({ position: { x, y: base + 1, z }, type: 'table' });
				if (dx === -2 && dz === 2) blocks.push({ position: { x, y: base + 1, z }, type: 'chair' });
				if (dx === 4 && dz === 1)
					blocks.push({ position: { x, y: base + 1, z }, type: 'kitchen_counter' });
				if (dx === 5 && dz === 2)
					blocks.push({ position: { x, y: base + 1, z }, type: 'refrigerator' });
				if (dx === 4 && dz === -2)
					blocks.push({ position: { x, y: base + 1, z }, type: 'bookshelf' });
			} else if (building.kind === 'civic') {
				if (floor === 1) {
					if (dx === -3 && dz === 1) blocks.push({ position: { x, y: base + 1, z }, type: 'sofa' });
					if (dx === -2 && dz === 2)
						blocks.push({ position: { x, y: base + 1, z }, type: 'table' });
					if (dx === 5 && dz === 1)
						blocks.push({ position: { x, y: base + 1, z }, type: 'bookshelf' });
				} else {
					if ((dx === -3 || dx === 0) && dz === -2)
						blocks.push({ position: { x, y: base + 1, z }, type: 'table' });
					if ((dx === -3 || dx === 0) && dz === -1)
						blocks.push({ position: { x, y: base + 1, z }, type: 'chair' });
				}
			}
		}
	}

	private addElevatorInfrastructure(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		building: UrbanBuildingDefinition,
		dx: number,
		dz: number
	): void {
		for (let floor = 1; floor <= building.floors; floor += 1) {
			const base = groundY + (floor - 1) * building.floorHeight;
			if (dx === CIVIC_ELEVATOR_LAYOUT.doorLocalX && dz === CIVIC_ELEVATOR_LAYOUT.doorLocalZ)
				blocks.push({ position: { x, y: base + 1, z }, type: 'elevator_door' });
			if (dx === CIVIC_ELEVATOR_LAYOUT.callLocalX && dz === CIVIC_ELEVATOR_LAYOUT.callLocalZ)
				blocks.push({ position: { x, y: base + 1, z }, type: 'elevator_call_button' });
			if (dx === CIVIC_ELEVATOR_LAYOUT.panelLocalX && dz === CIVIC_ELEVATOR_LAYOUT.panelLocalZ)
				blocks.push({ position: { x, y: base + 1, z }, type: 'elevator_panel' });

			// Bright marble portal around the landing makes the lift obvious from
			// the front lobby and at every upper floor.
			if (
				dz === CIVIC_ELEVATOR_LAYOUT.doorLocalZ &&
				(dx === CIVIC_ELEVATOR_LAYOUT.doorLocalX - 1 || dx === CIVIC_ELEVATOR_LAYOUT.doorLocalX + 1)
			) {
				for (let level = 2; level < building.floorHeight; level += 1)
					blocks.push({ position: { x, y: base + level, z }, type: 'marble' });
			}

			// Narrow concrete shaft walls, leaving the lobby-side opening clear.
			if (
				(dx === CIVIC_ELEVATOR_LAYOUT.shaftLocalX - 1 ||
					dx === CIVIC_ELEVATOR_LAYOUT.shaftLocalX + 1) &&
				dz === CIVIC_ELEVATOR_LAYOUT.shaftLocalZ
			) {
				for (let level = 1; level < building.floorHeight; level += 1)
					blocks.push({ position: { x, y: base + level, z }, type: 'concrete' });
			}
		}
	}

	private addBuilding(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		spec: BuildingSpec,
		furnished: boolean
	): void {
		const dx = x - (CENTRAL_CITY_CENTER.x + spec.x);
		const dz = z - (CENTRAL_CITY_CENTER.z + spec.z);
		if (Math.abs(dx) > spec.halfWidth || Math.abs(dz) > spec.halfDepth) return;

		const edgeX = Math.abs(dx) === spec.halfWidth;
		const edgeZ = Math.abs(dz) === spec.halfDepth;
		const onEdge = edgeX || edgeZ;
		const front = dz === spec.halfDepth;
		const entrance = front && dx === 0;

		if (onEdge) {
			for (let level = 1; level <= spec.height; level += 1) {
				if (entrance && level === 1) {
					blocks.push({ position: { x, y: groundY + level, z }, type: 'wooden_door' });
					continue;
				}
				if (entrance && level === 2) continue;
				const window =
					level >= 2 &&
					level <= spec.height - 1 &&
					((edgeX && Math.abs(dz) % 2 === 0) || (edgeZ && Math.abs(dx) % 2 === 0));
				blocks.push({
					position: { x, y: groundY + level, z },
					type: window ? 'glass' : level === 1 ? spec.accent : spec.wall
				});
			}
		}

		if (!onEdge && spec.height >= 8) {
			for (let level = 4; level <= spec.height; level += 4) {
				blocks.push({ position: { x, y: groundY + level, z }, type: 'concrete' });
			}
		}
		blocks.push({ position: { x, y: groundY + spec.height + 1, z }, type: 'stone_slab' });
		if (furnished && !onEdge) this.addShowHomeInterior(blocks, x, groundY, z, dx, dz);
	}

	private addShowHomeInterior(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		dx: number,
		dz: number
	): void {
		const prop = (px: number, pz: number, type: BlockType, yOffset = 1): void => {
			if (dx === px && dz === pz) blocks.push({ position: { x, y: groundY + yOffset, z }, type });
		};

		// The starter home uses a 13 x 11 m footprint with a two-metre circulation
		// axis from the exterior door through the interior partition.
		if (dz === 0 && Math.abs(dx) < SHOW_HOME.halfWidth) {
			if (dx === 0) {
				blocks.push({ position: { x, y: groundY + 1, z }, type: 'wooden_door' });
			} else if (dx !== 1) {
				for (let level = 1; level <= 3; level += 1)
					blocks.push({ position: { x, y: groundY + level, z }, type: 'brick' });
			}
			return;
		}

		// Rear bedroom / bathroom. Furniture hugs perimeter walls; the centre stays
		// clear so the player can turn around a full-size bed.
		prop(-4, -3, 'bed');
		prop(3, -3, 'wardrobe');
		prop(4, -1, 'toilet');
		prop(5, -2, 'shower');
		prop(5, -1, 'mirror', 2);
		prop(-5, -1, 'floor_lamp');

		// Front living room / kitchen. x=-1..1 is intentionally a clear route from
		// the front door to the bedroom door.
		prop(-4, 3, 'sofa');
		prop(-4, 1, 'rug');
		prop(-5, 2, 'radio');
		prop(-5, 1, 'bookshelf');
		prop(-3, 3, 'table');
		prop(-3, 2, 'chair');
		prop(4, 3, 'refrigerator');
		prop(5, 1, 'sink');
		prop(5, 1, 'glass_cup', 2);
		prop(4, 1, 'kitchen_counter');
		prop(4, 1, 'cooking_pot', 2);
		prop(3, 3, 'kitchen_counter');
		prop(3, 3, 'frying_pan', 2);
		prop(3, 1, 'kitchen_cabinet');
		prop(3, 1, 'plate_stack', 2);
		prop(3, 2, 'fruit_bowl', 2);
	}

	private addSupermarket(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		localX: number,
		localZ: number
	): void {
		const dx = localX - SUPERMARKET.x;
		const dz = localZ - SUPERMARKET.z;
		if (Math.abs(dx) > SUPERMARKET.halfWidth || Math.abs(dz) > SUPERMARKET.halfDepth) {
			// Store sign projects one block in front of the facade.
			if (dx === 0 && dz === SUPERMARKET.halfDepth + 1)
				blocks.push({ position: { x, y: groundY + 3, z }, type: 'store_sign' });
			return;
		}

		const edgeX = Math.abs(dx) === SUPERMARKET.halfWidth;
		const edgeZ = Math.abs(dz) === SUPERMARKET.halfDepth;
		const onEdge = edgeX || edgeZ;
		const front = dz === SUPERMARKET.halfDepth;
		const entrance = front && (dx === 0 || dx === 1);
		if (onEdge) {
			for (let level = 1; level <= SUPERMARKET.height; level += 1) {
				if (entrance && level === 1) {
					blocks.push({ position: { x, y: groundY + level, z }, type: 'glass_door' });
					continue;
				}
				if (entrance && level === 2) continue;
				const storefront = front && level >= 1 && level <= 3 && Math.abs(dx) <= 6;
				blocks.push({
					position: { x, y: groundY + level, z },
					type: storefront ? 'glass' : level === 1 ? 'brick' : 'concrete'
				});
			}
		}
		blocks.push({ position: { x, y: groundY + SUPERMARKET.height + 1, z }, type: 'concrete' });

		if (onEdge) return;
		// Aisles with enough spacing for the player to walk between them.
		if ((dx === -5 || dx === -2 || dx === 1 || dx === 4) && dz >= -3 && dz <= 2 && dz % 2 !== 0)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'store_shelf' });
		if (dx === -6 && dz === -4)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'produce_crate' });
		if (dx === -4 && dz === -4)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'produce_crate' });
		if (dx === 6 && (dz === -4 || dz === -2 || dz === 0))
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'drink_cooler' });
		if ((dx === -3 || dx === 0 || dx === 3) && dz === 4)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'checkout_counter' });
		if ((dx === -6 || dx === -5) && dz === 4)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'shopping_cart' });
	}

	private addCornerShop(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		localX: number,
		localZ: number
	): void {
		const dx = localX - CORNER_SHOP.x;
		const dz = localZ - CORNER_SHOP.z;
		if (Math.abs(dx) > CORNER_SHOP.halfWidth || Math.abs(dz) > CORNER_SHOP.halfDepth) {
			if (dx === 0 && dz === CORNER_SHOP.halfDepth + 1)
				blocks.push({ position: { x, y: groundY + 3, z }, type: 'store_sign' });
			return;
		}
		const onEdge = Math.abs(dx) === CORNER_SHOP.halfWidth || Math.abs(dz) === CORNER_SHOP.halfDepth;
		const front = dz === CORNER_SHOP.halfDepth;
		const entrance = front && dx === 0;
		if (onEdge) {
			for (let level = 1; level <= CORNER_SHOP.height; level += 1) {
				if (entrance && level === 1) {
					blocks.push({ position: { x, y: groundY + 1, z }, type: 'glass_door' });
					continue;
				}
				if (entrance && level === 2) continue;
				const storefront = front && level <= 3 && Math.abs(dx) <= 3;
				blocks.push({
					position: { x, y: groundY + level, z },
					type: storefront ? 'glass' : 'brick'
				});
			}
		}
		blocks.push({ position: { x, y: groundY + CORNER_SHOP.height + 1, z }, type: 'stone_slab' });
		if (onEdge) return;
		if ((dx === -3 || dx === 3) && dz >= -3 && dz <= 2)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'store_shelf' });
		if (dx === -1 && dz === -3)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'produce_crate' });
		if (dx === 1 && dz === -3)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'drink_cooler' });
		if (dx === 2 && dz === 3)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'checkout_counter' });
	}

	private addSwimmingPool(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		localX: number,
		localZ: number
	): void {
		const dx = localX - POOL_CENTER.x;
		const dz = localZ - POOL_CENTER.z;
		if (Math.abs(dx) > POOL_HALF_WIDTH + 4 || Math.abs(dz) > POOL_HALF_DEPTH + 4) return;

		const interior = Math.abs(dx) < POOL_HALF_WIDTH && Math.abs(dz) < POOL_HALF_DEPTH;
		const edge = Math.abs(dx) === POOL_HALF_WIDTH || Math.abs(dz) === POOL_HALF_DEPTH;
		const deck = Math.abs(dx) <= POOL_HALF_WIDTH + 2 && Math.abs(dz) <= POOL_HALF_DEPTH + 2;
		if (interior) {
			// A three-metre-wide submerged stair enters from the south deck. Each
			// successive row rises one metre and replaces water in that cell, so the
			// staircase is both visible and physically usable.
			const stairRow = dz >= POOL_HALF_DEPTH - 3 && dz <= POOL_HALF_DEPTH - 1 && Math.abs(dx) <= 1;
			if (stairRow) {
				const rise = dz - (POOL_HALF_DEPTH - 3);
				blocks.push({ position: { x, y: groundY + rise, z }, type: 'stone_stairs' });
				for (let waterY = groundY + rise + 1; waterY <= groundY + 2; waterY += 1)
					blocks.push({ position: { x, y: waterY, z }, type: 'water' });
				return;
			}
			blocks.push({ position: { x, y: groundY, z }, type: 'pool_tile' });
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'water' });
			blocks.push({ position: { x, y: groundY + 2, z }, type: 'water' });
			return;
		}
		if (edge) blocks.push({ position: { x, y: groundY, z }, type: 'pool_tile' });
		else if (deck) blocks.push({ position: { x, y: groundY, z }, type: 'sidewalk' });

		if (dx === -POOL_HALF_WIDTH && dz === 0)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'pool_ladder' });
		if ((dx === -POOL_HALF_WIDTH - 2 || dx === POOL_HALF_WIDTH + 2) && (dz === -2 || dz === 2))
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'bench' });
		if (dx === -3 && dz === POOL_HALF_DEPTH + 2)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'changing_bench' });
		if (dx === 3 && dz === POOL_HALF_DEPTH + 2)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'shower' });

		const fenceEdge =
			(Math.abs(dx) === POOL_HALF_WIDTH + 3 && Math.abs(dz) <= POOL_HALF_DEPTH + 3) ||
			(Math.abs(dz) === POOL_HALF_DEPTH + 3 && Math.abs(dx) <= POOL_HALF_WIDTH + 3);
		const entranceGap = dz === POOL_HALF_DEPTH + 3 && Math.abs(dx) <= 1;
		if (fenceEdge && !entranceGap)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'metal_fence' });
	}

	private addStreetFurniture(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		localX: number,
		localZ: number
	): void {
		// Never place street fixtures inside a building footprint or directly in
		// front of an entrance. City furniture must preserve pedestrian flow.
		if (
			this.insideBuilding(localX, localZ) ||
			this.isEntranceClearance(localX, localZ) ||
			isRoad(localX, localZ)
		)
			return;

		const alongMain = Math.abs(localX) === 4 && localZ >= -34 && localZ <= 29 && localZ % 8 === 0;
		const alongCross = Math.abs(localZ) === 4 && localX >= -32 && localX <= 32 && localX % 8 === 0;
		const alongCommercial =
			(localZ === 21 || localZ === 29) && localX >= -32 && localX <= 32 && localX % 8 === 0;
		if (alongMain || alongCross || alongCommercial)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'street_lamp' });

		if ((localX === -7 || localX === 7) && (localZ === -7 || localZ === 7)) {
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'bench' });
		}
		if (localX === -7 && localZ === 4)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'trash_bin' });
		if (localX === 6 && localZ === 22)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'bus_shelter' });

		// Bollards separate the supermarket storefront from its parking area.
		if (localZ === 23 && localX >= -28 && localX <= -14 && localX % 2 === 0)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'bollard' });
	}

	private isEntranceClearance(localX: number, localZ: number): boolean {
		const entrances = [
			{ x: CIVIC_TOWER.localX, z: CIVIC_TOWER.localZ + CIVIC_TOWER.halfDepth },
			{ x: SHOW_HOME.x, z: SHOW_HOME.z + SHOW_HOME.halfDepth },
			{ x: SUPERMARKET.x, z: SUPERMARKET.z + SUPERMARKET.halfDepth },
			{ x: SUPERMARKET.x + 1, z: SUPERMARKET.z + SUPERMARKET.halfDepth },
			{ x: CORNER_SHOP.x, z: CORNER_SHOP.z + CORNER_SHOP.halfDepth },
			...RESIDENTIAL_BUILDINGS.map((building) => ({
				x: building.x,
				z: building.z + building.halfDepth
			}))
		];
		return entrances.some(
			(entrance) =>
				Math.abs(localX - entrance.x) <= 1 && localZ >= entrance.z && localZ <= entrance.z + 2
		);
	}

	private insideBuilding(localX: number, localZ: number): boolean {
		const specs = [
			CIVIC_BUILDING_SPEC,
			SHOW_HOME,
			SUPERMARKET,
			CORNER_SHOP,
			...RESIDENTIAL_BUILDINGS
		];
		return specs.some(
			(spec) =>
				Math.abs(localX - spec.x) <= spec.halfWidth && Math.abs(localZ - spec.z) <= spec.halfDepth
		);
	}
}

export function isCityRoad(localX: number, localZ: number): boolean {
	return (
		(Math.abs(localX) <= 2 && localZ >= -38 && localZ <= 32) ||
		(Math.abs(localZ) <= 2 && localX >= -35 && localX <= 35) ||
		(Math.abs(localZ - 26) <= 2 && localX >= -34 && localX <= 34)
	);
}
const isRoad = isCityRoad;

/**
 * Centre lines for the same road predicates used by generateForColumn.  Map
 * consumers deliberately receive this authored/generated geometry instead of
 * making a second road layout from a random stream.
 */
export function cityRoadCenterlines(): readonly (readonly { x: number; z: number }[])[] {
	return [
		[
			{ x: 0, z: -38 },
			{ x: 0, z: 32 }
		],
		[
			{ x: -35, z: 0 },
			{ x: 35, z: 0 }
		],
		[
			{ x: -34, z: 26 },
			{ x: 34, z: 26 }
		]
	];
}

function isSidewalk(localX: number, localZ: number): boolean {
	const nearMain = Math.abs(localX) <= 4 && localZ >= -38 && localZ <= 32;
	const nearCross = Math.abs(localZ) <= 4 && localX >= -35 && localX <= 35;
	const nearCommercial = Math.abs(localZ - 26) <= 4 && localX >= -34 && localX <= 34;
	return (nearMain || nearCross || nearCommercial) && !isRoad(localX, localZ);
}

function isRoadStripe(localX: number, localZ: number): boolean {
	if (Math.abs(localX) <= 2 && localZ >= -38 && localZ <= 32)
		return localX === 0 && Math.abs(localZ) % 4 < 2;
	if (Math.abs(localZ) <= 2 && localX >= -35 && localX <= 35)
		return localZ === 0 && Math.abs(localX) % 4 < 2;
	if (Math.abs(localZ - 26) <= 2 && localX >= -34 && localX <= 34)
		return localZ === 26 && Math.abs(localX) % 4 < 2;
	return false;
}

function isParking(localX: number, localZ: number): boolean {
	const supermarketParking = localX >= -31 && localX <= -12 && localZ >= 23 && localZ <= 32;
	const shopParking = localX >= 13 && localX <= 28 && localZ >= 23 && localZ <= 29;
	return supermarketParking || shopParking;
}

function isParkingStripe(localX: number, localZ: number): boolean {
	if (!isParking(localX, localZ)) return false;
	return localZ % 5 === 0 && localX % 3 === 0;
}
