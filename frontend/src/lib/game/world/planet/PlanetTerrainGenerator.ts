import type { GeneratedChunk, WorldTerrainGenerator } from '../TerrainGenerator';
import type { BlockType } from '../voxel-types';
import { CHUNK_SIZE, WORLD_MAX_Y } from '../voxel-types';
import type { PlanetSurfaceAnchor } from '../../planet/surface/PlanetSurfaceAnchor';
import { PlanetTerrainColumnSampler } from './PlanetTerrainColumnSampler';

export interface PlanetTerrainGeneratorOptions {
	baseSurfaceY?: number;
	detailAmplitudeMeters?: number;
	seed?: string;
}

/**
 * Synchronous voxel generator backed by a previously prepared geographic grid.
 * Global elevation defines the large shape; deterministic detail only fills the
 * metre-scale information absent from low-resolution world data.
 */
export class PlanetTerrainGenerator implements WorldTerrainGenerator {
	readonly baseSurfaceY: number;
	readonly detailAmplitudeMeters: number;
	private readonly seedValue: number;

	constructor(
		readonly anchor: Readonly<PlanetSurfaceAnchor>,
		readonly columns: PlanetTerrainColumnSampler,
		options: Readonly<PlanetTerrainGeneratorOptions> = {}
	) {
		this.baseSurfaceY = Math.max(12, Math.min(192, Math.round(options.baseSurfaceY ?? 40)));
		this.detailAmplitudeMeters = Math.max(0, Math.min(12, options.detailAmplitudeMeters ?? 3.5));
		this.seedValue = hashString(options.seed ?? anchor.id);
	}

	heightAt(x: number, z: number): number {
		const sample = this.columns.sample(x, z);
		const detail =
			this.localDetail(x, z) * this.detailAmplitudeMeters * (0.35 + sample.land * 0.65);
		const relative = sample.relativeHeightMeters + detail;
		return Math.max(2, Math.min(WORLD_MAX_Y - 16, Math.round(this.baseSurfaceY + relative)));
	}

	visualHeightAt(x: number, z: number): number {
		const centre = this.heightAt(x, z);
		const north = this.heightAt(x, z - 1);
		const south = this.heightAt(x, z + 1);
		const east = this.heightAt(x + 1, z);
		const west = this.heightAt(x - 1, z);
		return (centre * 2 + north + south + east + west) / 6;
	}

	isWater(x: number, z: number): boolean {
		const sample = this.columns.sample(x, z);
		return sample.land < 0.5 || sample.elevationMeters < 0;
	}

	zoneAt(x: number, z: number): string {
		const sample = this.columns.sample(x, z);
		if (sample.land < 0.5) {
			return sample.coastProximity > 0.35 ? 'Planet Coast' : 'Planet Ocean';
		}
		const latitudeDegrees = Math.abs((this.anchor.coordinate.latitudeRadians * 180) / Math.PI);
		const elevation = sample.elevationMeters;
		if (elevation > 2600 || latitudeDegrees > 66) {
			return 'Planet Alpine';
		}
		if (latitudeDegrees < 15) {
			return 'Planet Tropical';
		}
		if (latitudeDegrees < 35) {
			return 'Planet Subtropical';
		}
		return 'Planet Temperate';
	}

	isPath(_x: number, _z: number): boolean {
		return false;
	}

	generateChunk(chunkX: number, chunkZ: number): GeneratedChunk {
		const blocks: GeneratedChunk['blocks'] = [];
		const startX = chunkX * CHUNK_SIZE;
		const startZ = chunkZ * CHUNK_SIZE;
		const seaLevelY = Math.max(
			1,
			Math.min(
				WORLD_MAX_Y - 1,
				Math.round(this.baseSurfaceY - this.anchor.referenceElevationMeters)
			)
		);

		for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
			for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
				const x = startX + localX;
				const z = startZ + localZ;
				const height = this.heightAt(x, z);
				const sample = this.columns.sample(x, z);
				const water = sample.land < 0.5 || sample.elevationMeters < 0;
				const surfaceType = this.surfaceBlockType(
					sample.elevationMeters,
					water,
					sample.coastProximity
				);

				for (let y = 0; y <= height; y += 1) {
					let type: BlockType = 'stone';
					if (y === height) {
						type = surfaceType;
					} else if (y >= height - 3) {
						type = water || sample.coastProximity > 0.45 ? 'sand' : 'dirt';
					}
					blocks.push({ position: { x, y, z }, type });
				}

				if (water && height < seaLevelY) {
					for (let y = height + 1; y <= seaLevelY; y += 1) {
						blocks.push({ position: { x, y, z }, type: 'water' });
					}
				}
			}
		}

		return { blocks };
	}

	private surfaceBlockType(
		elevationMeters: number,
		water: boolean,
		coastProximity: number
	): BlockType {
		if (water || coastProximity > 0.48) {
			return 'sand';
		}
		if (elevationMeters > 2200) {
			return 'stone';
		}
		return 'grass';
	}

	private localDetail(x: number, z: number): number {
		const broad = smoothNoise(this.seedValue, x / 48, z / 48) * 2 - 1;
		const fine = smoothNoise(this.seedValue ^ 0x9e3779b9, x / 13, z / 13) * 2 - 1;
		return broad * 0.72 + fine * 0.28;
	}
}

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
	return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}
