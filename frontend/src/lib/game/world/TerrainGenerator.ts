import { type BlockCoordinate, type BlockType, CHUNK_SIZE, WATER_LEVEL } from './voxel-types';
import { CENTRAL_CITY_CENTER } from './voxel-types';
import { CityGenerator } from './CityGenerator';
import { generateTreeShape } from '../vegetation/TreeShapeGenerator';
import {
	selectTreeSpecies,
	treeAnchorForCell,
	TREE_CANOPY_MARGIN,
	TREE_CELL_SIZE,
	vegetationSeedValue
} from '../vegetation/VegetationDistribution';
import type { TreeSpeciesId } from '../vegetation/VegetationFamily';

function hashString(value: string): number {
	let hash = 2166136261;

	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
}

function hash2(seed: number, x: number, z: number): number {
	let hash = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
	hash = Math.imul(hash ^ (hash >>> 13), 1274126177);

	return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(seed: number, x: number, z: number): number {
	const ix = Math.floor(x);
	const iz = Math.floor(z);
	const fx = x - ix;
	const fz = z - iz;
	const sx = fx * fx * (3 - 2 * fx);
	const sz = fz * fz * (3 - 2 * fz);
	const a = hash2(seed, ix, iz);
	const b = hash2(seed, ix + 1, iz);
	const c = hash2(seed, ix, iz + 1);
	const d = hash2(seed, ix + 1, iz + 1);
	const ab = a + (b - a) * sx;
	const cd = c + (d - c) * sx;

	return ab + (cd - ab) * sz;
}

export interface GeneratedChunk {
	blocks: Array<{ position: BlockCoordinate; type: BlockType; protected?: boolean }>;
}

export interface WorldTerrainGenerator {
	heightAt(x: number, z: number): number;
	visualHeightAt(x: number, z: number): number;
	isWater(x: number, z: number): boolean;
	zoneAt(x: number, z: number): string;
	isPath(x: number, z: number): boolean;
	generateChunk(chunkX: number, chunkZ: number): GeneratedChunk;
	treeSpeciesAt?(x: number, z: number): TreeSpeciesId | null;
	isProtectedBuildColumn?(x: number, z: number): boolean;
}

export class TerrainGenerator implements WorldTerrainGenerator {
	private readonly seedValue: number;
	private readonly vegetationSeed: number;
	private readonly city = new CityGenerator();

	constructor(readonly seed: string) {
		this.seedValue = hashString(seed);
		this.vegetationSeed = vegetationSeedValue(seed);
	}

	heightAt(x: number, z: number): number {
		const spawnDistance = Math.hypot(x, z);
		const cityDistance = Math.hypot(x - CENTRAL_CITY_CENTER.x, z - CENTRAL_CITY_CENTER.z);

		if (spawnDistance < 24) {
			return 9;
		}

		if (this.city.isPoolInterior(x, z)) {
			return 7;
		}

		if (this.isPath(x, z) || cityDistance < 46) {
			return 9;
		}

		if (this.isRiver(x, z)) {
			return WATER_LEVEL - 1;
		}

		const soft = smoothNoise(this.seedValue, x / 34, z / 34);
		const detail = smoothNoise(this.seedValue + 17, x / 15, z / 15);

		return Math.max(5, Math.round(8 + soft * 3 + detail * 1.5));
	}

	visualHeightAt(x: number, z: number): number {
		const base = this.heightAt(x, z);
		const north = this.heightAt(x, z - 1);
		const south = this.heightAt(x, z + 1);
		const east = this.heightAt(x + 1, z);
		const west = this.heightAt(x - 1, z);
		const variation = (smoothNoise(this.seedValue + 211, x / 8, z / 8) - 0.5) * 0.18;

		return (base * 2 + north + south + east + west) / 6 + variation;
	}

	isWater(x: number, z: number): boolean {
		return this.isRiver(x, z) || this.heightAt(x, z) < WATER_LEVEL;
	}

	zoneAt(x: number, z: number): string {
		// Keep the actual landing clearing readable as Spawn Meadow even though
		// the native city deliberately sits close enough to be visible from it.
		if (Math.hypot(x, z) < 24) {
			return 'Spawn Meadow';
		}

		// Natural river identity wins where the nearby urban district overlaps
		// the river corridor. This preserves the starter world's geography.
		if (this.isRiver(x, z)) {
			return 'Riverbank';
		}

		if (Math.hypot(x - CENTRAL_CITY_CENTER.x, z - CENTRAL_CITY_CENTER.z) < 46) {
			return 'Central City';
		}

		if (x < -72 && z > 18) {
			return 'Amazon Rainforest';
		}

		if (z > 72) {
			return 'Pine Highlands';
		}

		if (x < -28 && z < -10) {
			return 'Forest Edge';
		}

		if (x > 24 && Math.abs(z) < 28) {
			return 'Free Build Meadow';
		}

		return 'Spawn Meadow';
	}

	generateChunk(chunkX: number, chunkZ: number): GeneratedChunk {
		const blocks: GeneratedChunk['blocks'] = [];
		const startX = chunkX * CHUNK_SIZE;
		const startZ = chunkZ * CHUNK_SIZE;

		for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
			for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
				const x = startX + lx;
				const z = startZ + lz;
				const height = this.heightAt(x, z);
				const river = this.isRiver(x, z);
				const path = this.isPath(x, z);
				const nearWater = river || height <= WATER_LEVEL + 1;

				for (let y = 0; y <= height; y += 1) {
					let type: BlockType = 'stone';

					if (y === height) {
						type = path ? 'sand' : nearWater ? 'sand' : 'grass';
					} else if (y >= height - 3) {
						type = 'dirt';
					}

					blocks.push({ position: { x, y, z }, type });
				}

				if (height < WATER_LEVEL || river) {
					for (let y = height + 1; y <= WATER_LEVEL; y += 1) {
						blocks.push({ position: { x, y, z }, type: 'water' });
					}
				}

				blocks.push(
					...this.city
						.generateForColumn(x, height, z)
						.map((block) => ({ ...block, protected: true }))
				);
			}
		}

		this.addTreesForChunk(blocks, chunkX, chunkZ);

		return { blocks };
	}

	isProtectedBuildColumn(x: number, z: number): boolean {
		return this.city.isProtectedColumn(x, z);
	}

	treeSpeciesAt(x: number, z: number): TreeSpeciesId | null {
		const cellX = Math.floor(x / TREE_CELL_SIZE);
		const cellZ = Math.floor(z / TREE_CELL_SIZE);

		return selectTreeSpecies(this.zoneAt(x, z), cellX, cellZ, this.vegetationSeed);
	}

	private addTreesForChunk(blocks: GeneratedChunk['blocks'], chunkX: number, chunkZ: number): void {
		const startX = chunkX * CHUNK_SIZE;
		const startZ = chunkZ * CHUNK_SIZE;
		const endX = startX + CHUNK_SIZE - 1;
		const endZ = startZ + CHUNK_SIZE - 1;
		const minCellX = Math.floor((startX - TREE_CANOPY_MARGIN) / TREE_CELL_SIZE);
		const maxCellX = Math.floor((endX + TREE_CANOPY_MARGIN) / TREE_CELL_SIZE);
		const minCellZ = Math.floor((startZ - TREE_CANOPY_MARGIN) / TREE_CELL_SIZE);
		const maxCellZ = Math.floor((endZ + TREE_CANOPY_MARGIN) / TREE_CELL_SIZE);
		const generated = new Map<string, { position: BlockCoordinate; type: BlockType }>();

		for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
			for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
				const anchor = treeAnchorForCell(cellX, cellZ, this.vegetationSeed);
				const species = selectTreeSpecies(
					this.zoneAt(anchor.x, anchor.z),
					cellX,
					cellZ,
					this.vegetationSeed
				);

				if (!species || !this.canGrowTreeAt(anchor.x, anchor.z)) {
					continue;
				}

				const groundY = this.heightAt(anchor.x, anchor.z);
				const tree = generateTreeShape(species, anchor.x, groundY, anchor.z, this.vegetationSeed);

				for (const block of tree) {
					const { x, z } = block.position;

					if (x < startX || x > endX || z < startZ || z > endZ) {
						continue;
					}

					const blockZone = this.zoneAt(x, z);

					if (
						this.city.isProtectedColumn(x, z) ||
						blockZone === 'Central City' ||
						blockZone === 'Free Build Meadow' ||
						this.isPath(x, z)
					) {
						continue;
					}

					generated.set(`${x},${block.position.y},${z}`, block);
				}
			}
		}

		blocks.push(...generated.values());
	}

	private canGrowTreeAt(x: number, z: number): boolean {
		if (
			Math.hypot(x, z) < 14 ||
			this.city.isProtectedColumn(x, z) ||
			this.isPath(x, z) ||
			this.isRiver(x, z)
		) {
			return false;
		}

		const zone = this.zoneAt(x, z);

		if (zone === 'Central City' || zone === 'Free Build Meadow') {
			return false;
		}

		const center = this.heightAt(x, z);

		if (center <= WATER_LEVEL + 1) {
			return false;
		}

		const neighbours = [
			this.heightAt(x + 1, z),
			this.heightAt(x - 1, z),
			this.heightAt(x, z + 1),
			this.heightAt(x, z - 1)
		];

		return neighbours.every((height) => Math.abs(height - center) <= 2);
	}

	isPath(x: number, z: number): boolean {
		const center = Math.sin((z + 18) / 18) * 2.2 + Math.sin(z / 41) * 1.4;
		const width = 2.2 + smoothNoise(this.seedValue + 151, 0, z / 18) * 1.4;

		return Math.abs(x - center) <= width && z <= 4 && z >= CENTRAL_CITY_CENTER.z - 12;
	}

	isRiver(x: number, z: number): boolean {
		const center = 24 + Math.sin(z / 18) * 5 + Math.sin(z / 7) * 1.1;
		const width = 2.6 + smoothNoise(this.seedValue + 191, 0, z / 15) * 1.5;

		return Math.abs(x - center) < width && z > -60 && z < 42;
	}
}
