import { type BlockCoordinate, type BlockType, CHUNK_SIZE, WATER_LEVEL } from './voxel-types';
import { CENTRAL_CITY_CENTER } from './voxel-types';
import { CityGenerator } from './CityGenerator';

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
	blocks: Array<{ position: BlockCoordinate; type: BlockType }>;
}

export class TerrainGenerator {
	private readonly seedValue: number;
	private readonly city = new CityGenerator();

	constructor(readonly seed: string) {
		this.seedValue = hashString(seed);
	}

	heightAt(x: number, z: number): number {
		const spawnDistance = Math.hypot(x, z);
		const cityDistance = Math.hypot(x - CENTRAL_CITY_CENTER.x, z - CENTRAL_CITY_CENTER.z);

		if (spawnDistance < 24) {
			return 9;
		}

		if (this.isPath(x, z) || cityDistance < 28) {
			return 9;
		}

		if (this.isRiver(x, z)) {
			return WATER_LEVEL - 1;
		}

		const soft = smoothNoise(this.seedValue, x / 34, z / 34);
		const detail = smoothNoise(this.seedValue + 17, x / 15, z / 15);

		return Math.max(5, Math.round(8 + soft * 3 + detail * 1.5));
	}

	isWater(x: number, z: number): boolean {
		return this.isRiver(x, z) || this.heightAt(x, z) < WATER_LEVEL;
	}

	zoneAt(x: number, z: number): string {
		if (Math.hypot(x - CENTRAL_CITY_CENTER.x, z - CENTRAL_CITY_CENTER.z) < 30) {
			return 'Central City';
		}

		if (this.isRiver(x, z)) {
			return 'Riverbank';
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

				this.addPlants(blocks, x, height, z, nearWater);
				blocks.push(...this.city.generateForColumn(x, height, z));
			}
		}

		return { blocks };
	}

	private addPlants(
		blocks: GeneratedChunk['blocks'],
		x: number,
		height: number,
		z: number,
		nearWater: boolean
	): void {
		if (nearWater || height <= WATER_LEVEL) {
			return;
		}

		if (Math.hypot(x, z) < 10 || this.isPath(x, z)) {
			return;
		}

		const forest = x < -28 && z < -10;
		const clearing = smoothNoise(this.seedValue + 29, x / 22, z / 22) > (forest ? 0.38 : 0.7);
		const treeRoll = hash2(this.seedValue + 71, x, z);

		if (!clearing && treeRoll > (forest ? 0.94 : 0.988)) {
			const trunkHeight = 3 + Math.floor(hash2(this.seedValue + 73, x, z) * 3);

			for (let offset = 1; offset <= trunkHeight; offset += 1) {
				blocks.push({ position: { x, y: height + offset, z }, type: 'wood' });
			}

			const crownY = height + trunkHeight;

			for (let dx = -2; dx <= 2; dx += 1) {
				for (let dz = -2; dz <= 2; dz += 1) {
					for (let dy = -1; dy <= 1; dy += 1) {
						if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) <= 4) {
							blocks.push({
								position: { x: x + dx, y: crownY + dy, z: z + dz },
								type: 'leaves'
							});
						}
					}
				}
			}

			return;
		}

		if (clearing && Math.hypot(x, z) < 35 && hash2(this.seedValue + 113, x, z) > 0.93) {
			blocks.push({ position: { x, y: height + 1, z }, type: 'flower' });
		}
	}

	isPath(x: number, z: number): boolean {
		return Math.abs(x) <= 2 && z <= 2 && z >= CENTRAL_CITY_CENTER.z - 8;
	}

	isRiver(x: number, z: number): boolean {
		const center = 24 + Math.sin(z / 18) * 5;

		return Math.abs(x - center) < 3.2 && z > -60 && z < 42;
	}
}
