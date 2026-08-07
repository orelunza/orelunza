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

const RESIDENTIAL_BUILDINGS: readonly BuildingSpec[] = [
	{ x: -14, z: -7, halfWidth: 4, halfDepth: 4, height: 8, wall: 'brick', accent: 'concrete' },
	{ x: 14, z: -8, halfWidth: 4, halfDepth: 4, height: 10, wall: 'concrete', accent: 'marble' },
	{ x: -14, z: 7, halfWidth: 4, halfDepth: 4, height: 7, wall: 'wooden_plank', accent: 'brick' },
	{ x: 14, z: 8, halfWidth: 4, halfDepth: 4, height: 9, wall: 'brick', accent: 'concrete' }
];

/**
 * Native starter city generator.
 *
 * Lot Ville 2 keeps the city compact, but replaces the old solid boxes with
 * hollow multi-storey shells, windows, doors and one fully furnished show-home.
 * Later city lots can expand districts and high-rise systems without moving the
 * canonical anchor near the landing meadow.
 */
export class CityGenerator {
	generateForColumn(x: number, groundY: number, z: number): CityBlock[] {
		const blocks: CityBlock[] = [];
		const localX = x - CENTRAL_CITY_CENTER.x;
		const localZ = z - CENTRAL_CITY_CENTER.z;

		this.addCivicPlaza(blocks, x, groundY, z, localX, localZ);
		this.addCivicTower(blocks, x, groundY, z, localX, localZ);
		this.addBuilding(blocks, x, groundY, z, SHOW_HOME, true);
		for (const building of RESIDENTIAL_BUILDINGS) {
			this.addBuilding(blocks, x, groundY, z, building, false);
		}
		this.addStreetFurniture(blocks, x, groundY, z, localX, localZ);

		return blocks;
	}

	private addCivicPlaza(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		localX: number,
		localZ: number
	): void {
		if (Math.abs(localX) <= 8 && Math.abs(localZ) <= 8) {
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'stone_slab' });
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
					blocks.push({ position: { x, y: groundY + level, z }, type: 'wooden_door' });
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

		if (Math.abs(localX) <= halfWidth && Math.abs(localZ) <= halfDepth) {
			blocks.push({ position: { x, y: roofY, z }, type: 'concrete' });
			if (!onEdge && !(localX === 3 && localZ === 3)) {
				for (const level of [4, 8, 12, 16]) {
					blocks.push({ position: { x, y: groundY + level, z }, type: 'stone_slab' });
				}
			}
		}

		// Furnished public lobby on the ground floor.
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

		if (furnished && !onEdge) {
			this.addShowHomeInterior(blocks, x, groundY, z, dx, dz);
		}
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
			if (dx === px && dz === pz) {
				blocks.push({ position: { x, y: groundY + yOffset, z }, type });
			}
		};

		// Living room.
		prop(-2, 1, 'sofa');
		prop(-1, 1, 'rug');
		prop(-2, 0, 'radio');
		prop(-1, -1, 'bookshelf');

		// Kitchen.
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

		// Bedroom / bathroom details.
		prop(-2, -2, 'bed');
		prop(-3, -1, 'wardrobe');
		prop(1, 2, 'toilet');
		prop(2, 2, 'shower');
		prop(1, 1, 'mirror', 2);
	}

	private addStreetFurniture(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		localX: number,
		localZ: number
	): void {
		const lampPost =
			(Math.abs(localX) === 8 && (localZ === -6 || localZ === 0 || localZ === 6)) ||
			(Math.abs(localZ) === 8 && (localX === -6 || localX === 0 || localX === 6));
		if (lampPost) blocks.push({ position: { x, y: groundY + 1, z }, type: 'floor_lamp' });
	}
}
