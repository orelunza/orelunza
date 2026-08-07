import type { BlockCoordinate, BlockType } from './voxel-types';
import { CENTRAL_CITY_CENTER } from './voxel-types';

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
	z: 12,
	halfWidth: 4,
	halfDepth: 3,
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

const RESIDENTIAL_BUILDINGS: readonly BuildingSpec[] = [
	{ x: -14, z: -7, halfWidth: 4, halfDepth: 4, height: 8, wall: 'brick', accent: 'concrete' },
	{ x: 14, z: -8, halfWidth: 4, halfDepth: 4, height: 10, wall: 'concrete', accent: 'marble' },
	{ x: -14, z: 7, halfWidth: 4, halfDepth: 4, height: 7, wall: 'wooden_plank', accent: 'brick' },
	{ x: 14, z: 7, halfWidth: 4, halfDepth: 3, height: 8, wall: 'brick', accent: 'concrete' }
];

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
		for (const building of RESIDENTIAL_BUILDINGS) {
			this.addBuilding(blocks, x, groundY, z, building, false);
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
		if (this.isPoolInterior(x, z)) {
			blocks.push({ position: { x, y: groundY, z }, type: 'pool_tile' });
			return;
		}

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
		const halfWidth = 5;
		const halfDepth = 5;
		if (Math.abs(localX) > halfWidth || Math.abs(localZ) > halfDepth) return;

		const onEdge = Math.abs(localX) === halfWidth || Math.abs(localZ) === halfDepth;
		const front = localZ === halfDepth;
		const entrance = front && localX === 0;
		const roofY = groundY + 21;

		if (onEdge) {
			for (let level = 1; level <= 20; level += 1) {
				if (entrance && level === 1) {
					blocks.push({ position: { x, y: groundY + level, z }, type: 'glass_door' });
					continue;
				}
				if (entrance && level === 2) continue;
				const windowBand = level % 4 === 2 || level % 4 === 3;
				const windowColumn = (Math.abs(localX) + Math.abs(localZ)) % 2 === 0;
				blocks.push({
					position: { x, y: groundY + level, z },
					type: windowBand && windowColumn ? 'glass' : level % 4 === 0 ? 'marble' : 'concrete'
				});
			}
		}

		blocks.push({ position: { x, y: roofY, z }, type: 'concrete' });
		if (!onEdge && !(localX === 3 && localZ === 3)) {
			for (const level of [4, 8, 12, 16]) {
				blocks.push({ position: { x, y: groundY + level, z }, type: 'stone_slab' });
			}
		}

		if (localX === 0 && localZ === 1)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'table' });
		if (localX === -2 && localZ === 1)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'sofa' });
		if (localX === 2 && localZ === 1)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'bookshelf' });
		if (localX === -3 && localZ === -2)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'floor_lamp' });
		if (localX === 3 && localZ === -2)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'radio' });
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
		prop(-2, 1, 'sofa');
		prop(-1, 1, 'rug');
		prop(-2, 0, 'radio');
		prop(-1, -1, 'bookshelf');
		prop(2, 1, 'refrigerator');
		prop(2, 0, 'sink');
		prop(2, 0, 'glass_cup', 2);
		prop(2, -1, 'kitchen_counter');
		prop(2, -1, 'cooking_pot', 2);
		prop(1, 0, 'kitchen_counter');
		prop(1, 0, 'frying_pan', 2);
		prop(1, -1, 'kitchen_cabinet');
		prop(1, -1, 'plate_stack', 2);
		prop(0, -1, 'table');
		prop(0, -1, 'fruit_bowl', 2);
		prop(0, 0, 'chair');
		prop(-2, -2, 'bed');
		prop(-3, -1, 'wardrobe');
		prop(1, 2, 'toilet');
		prop(2, 2, 'shower');
		prop(1, 1, 'mirror', 2);
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
		if (dx === 0 && dz === POOL_HALF_DEPTH + 3)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'changing_bench' });
		if (dx === 2 && dz === POOL_HALF_DEPTH + 3)
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
		if (this.insideBuilding(localX, localZ) || this.isEntranceClearance(localX, localZ)) return;

		const alongMain = Math.abs(localX) === 4 && localZ >= -34 && localZ <= 29 && localZ % 8 === 0;
		const alongCross = Math.abs(localZ) === 4 && localX >= -32 && localX <= 32 && localX % 8 === 0;
		const alongCommercial =
			(localZ === 21 || localZ === 29) && localX >= -32 && localX <= 32 && localX % 8 === 0;
		if (alongMain || alongCross || alongCommercial)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'street_lamp' });

		if ((localX === -7 || localX === 7) && (localZ === -7 || localZ === 7)) {
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'bench' });
		}
		if (localX === -8 && localZ === 0)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'trash_bin' });
		if (localX === 6 && localZ === 26)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'bus_shelter' });

		// Bollards separate the supermarket storefront from its parking area.
		if (localZ === 23 && localX >= -28 && localX <= -14 && localX % 2 === 0)
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'bollard' });
	}

	private isEntranceClearance(localX: number, localZ: number): boolean {
		const entrances = [
			{ x: 0, z: 5 },
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
		const specs = [SHOW_HOME, SUPERMARKET, CORNER_SHOP, ...RESIDENTIAL_BUILDINGS];
		if (Math.abs(localX) <= 5 && Math.abs(localZ) <= 5) return true;
		return specs.some(
			(spec) =>
				Math.abs(localX - spec.x) <= spec.halfWidth && Math.abs(localZ - spec.z) <= spec.halfDepth
		);
	}
}

function isRoad(localX: number, localZ: number): boolean {
	return (
		(Math.abs(localX) <= 2 && localZ >= -38 && localZ <= 32) ||
		(Math.abs(localZ) <= 2 && localX >= -35 && localX <= 35) ||
		(Math.abs(localZ - 26) <= 2 && localX >= -34 && localX <= 34)
	);
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
