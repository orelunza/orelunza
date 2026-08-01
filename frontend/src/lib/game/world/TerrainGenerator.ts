import { type BlockCoordinate, type BlockType, CHUNK_SIZE, WATER_LEVEL } from './voxel-types';

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

	constructor(readonly seed: string) {
		this.seedValue = hashString(seed);
	}

	heightAt(x: number, z: number): number {
		const soft = smoothNoise(this.seedValue, x / 18, z / 18);
		const detail = smoothNoise(this.seedValue + 17, x / 8, z / 8);
		const river = Math.abs(Math.sin((x + z * 0.42) / 18));
		const riverCut = river < 0.18 ? -3 : 0;

		return Math.max(4, Math.round(8 + soft * 5 + detail * 2 + riverCut));
	}

	isWater(x: number, z: number): boolean {
		return this.heightAt(x, z) < WATER_LEVEL;
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
				const nearWater = height <= WATER_LEVEL + 1;

				for (let y = 0; y <= height; y += 1) {
					let type: BlockType = 'stone';

					if (y === height) {
						type = nearWater ? 'sand' : 'grass';
					} else if (y >= height - 3) {
						type = 'dirt';
					}

					blocks.push({ position: { x, y, z }, type });
				}

				if (height < WATER_LEVEL) {
					for (let y = height + 1; y <= WATER_LEVEL; y += 1) {
						blocks.push({ position: { x, y, z }, type: 'water' });
					}
				}

				this.addPlants(blocks, x, height, z, nearWater);
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

		const clearing = smoothNoise(this.seedValue + 29, x / 22, z / 22) > 0.68;
		const treeRoll = hash2(this.seedValue + 71, x, z);

		if (!clearing && treeRoll > 0.986) {
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

		if (clearing && hash2(this.seedValue + 113, x, z) > 0.965) {
			blocks.push({ position: { x, y: height + 1, z }, type: 'flower' });
		}
	}
}
