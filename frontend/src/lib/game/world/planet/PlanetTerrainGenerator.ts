import type { GeneratedChunk, WorldTerrainGenerator } from '../TerrainGenerator';
import type { BlockCoordinate, BlockType } from '../voxel-types';
import { CHUNK_SIZE, WORLD_MAX_Y } from '../voxel-types';
import type { PlanetSurfaceAnchor } from '../../planet/surface/PlanetSurfaceAnchor';
import type { PlanetSurfaceEcology } from '../../geography/ecology/PlanetSurfaceEcology';
import { createFallbackPlanetSurfaceEcology } from '../../geography/ecology/PlanetSurfaceEcology';
import { planetBiomeProfile } from '../../geography/ecology/PlanetBiomeProfile';
import { generateTreeShape } from '../../vegetation/TreeShapeGenerator';
import {
	selectTreeSpeciesAtDensity,
	treeAnchorForCell,
	TREE_CANOPY_MARGIN,
	TREE_CELL_SIZE,
	vegetationSeedValue
} from '../../vegetation/VegetationDistribution';
import type { TreeSpeciesId } from '../../vegetation/VegetationFamily';
import { PlanetTerrainColumnSampler } from './PlanetTerrainColumnSampler';

export interface PlanetTerrainGeneratorOptions {
	baseSurfaceY?: number;
	detailAmplitudeMeters?: number;
	seed?: string;
	ecology?: PlanetSurfaceEcology;
}

/**
 * Synchronous voxel generator backed by prepared planetary elevation and ecology.
 * Geographic data owns the large-scale shape; deterministic local detail and tree
 * placement only fill metre-scale information absent from the global pack.
 */
export class PlanetTerrainGenerator implements WorldTerrainGenerator {
	readonly baseSurfaceY: number;
	readonly detailAmplitudeMeters: number;
	readonly ecology: PlanetSurfaceEcology;
	private readonly seedValue: number;
	private readonly vegetationSeed: number;

	constructor(
		readonly anchor: Readonly<PlanetSurfaceAnchor>,
		readonly columns: PlanetTerrainColumnSampler,
		options: Readonly<PlanetTerrainGeneratorOptions> = {}
	) {
		this.baseSurfaceY = Math.max(12, Math.min(192, Math.round(options.baseSurfaceY ?? 40)));
		this.detailAmplitudeMeters = Math.max(0, Math.min(12, options.detailAmplitudeMeters ?? 3.5));
		this.ecology = options.ecology ?? createFallbackPlanetSurfaceEcology();
		this.seedValue = hashString(options.seed ?? anchor.id);
		this.vegetationSeed = vegetationSeedValue(`${options.seed ?? anchor.id}:planet-ecology`);
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
		if (sample.land < 0.5) return sample.coastProximity > 0.35 ? 'Planet Coast' : 'Planet Ocean';
		if (sample.coastProximity > 0.68 && this.ecology.biome !== 'mangrove') return 'Planet Coast';
		return this.ecology.zoneName;
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
		const profile = planetBiomeProfile(this.ecology.biome);

		for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
			for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
				const x = startX + localX;
				const z = startZ + localZ;
				const height = this.heightAt(x, z);
				const sample = this.columns.sample(x, z);
				const water = sample.land < 0.5 || sample.elevationMeters < 0;
				const coastal = sample.coastProximity > 0.52;
				const surfaceType = water || coastal ? 'sand' : profile.surfaceBlock;
				const subsurfaceType = water || coastal ? 'sand' : profile.subsurfaceBlock;

				for (let y = 0; y <= height; y += 1) {
					let type: BlockType = 'stone';
					if (y === height) type = surfaceType;
					else if (y >= height - 3) type = subsurfaceType;
					blocks.push({ position: { x, y, z }, type });
				}

				if (water && height < seaLevelY) {
					for (let y = height + 1; y <= seaLevelY; y += 1) {
						blocks.push({ position: { x, y, z }, type: 'water' });
					}
				}
			}
		}

		this.addTreesForChunk(blocks, chunkX, chunkZ);
		return { blocks };
	}

	treeSpeciesAt(x: number, z: number): TreeSpeciesId | null {
		if (!this.canGrowTreeAt(x, z)) return null;
		const cellX = Math.floor(x / TREE_CELL_SIZE);
		const cellZ = Math.floor(z / TREE_CELL_SIZE);
		return selectTreeSpeciesAtDensity(
			this.zoneAt(x, z),
			cellX,
			cellZ,
			this.vegetationSeed,
			this.effectiveTreeDensity()
		);
	}

	private effectiveTreeDensity(): number {
		const profile = planetBiomeProfile(this.ecology.biome);
		return clamp01(Math.min(profile.treeDensity, this.ecology.treeCoverDensity * 0.92 + 0.01));
	}

	private addTreesForChunk(blocks: GeneratedChunk['blocks'], chunkX: number, chunkZ: number): void {
		const density = this.effectiveTreeDensity();
		if (density <= 0) return;
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
				const species = selectTreeSpeciesAtDensity(
					this.zoneAt(anchor.x, anchor.z),
					cellX,
					cellZ,
					this.vegetationSeed,
					density
				);
				if (!species || !this.canGrowTreeAt(anchor.x, anchor.z)) continue;
				const groundY = this.heightAt(anchor.x, anchor.z);
				for (const block of generateTreeShape(
					species,
					anchor.x,
					groundY,
					anchor.z,
					this.vegetationSeed
				)) {
					const { x, z } = block.position;
					if (x < startX || x > endX || z < startZ || z > endZ) continue;
					generated.set(`${x},${block.position.y},${z}`, block);
				}
			}
		}
		blocks.push(...generated.values());
	}

	private canGrowTreeAt(x: number, z: number): boolean {
		if (Math.hypot(x, z) < 8 || this.isWater(x, z)) return false;
		if (
			['desert', 'polar', 'urban', 'cropland', 'ocean', 'freshwater'].includes(this.ecology.biome)
		) {
			return false;
		}
		const center = this.heightAt(x, z);
		const neighbours = [
			this.heightAt(x + 1, z),
			this.heightAt(x - 1, z),
			this.heightAt(x, z + 1),
			this.heightAt(x, z - 1)
		];
		return neighbours.every((height) => Math.abs(height - center) <= 2);
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

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
