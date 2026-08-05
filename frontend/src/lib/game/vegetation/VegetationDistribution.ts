import { biomeVegetationProfile, type WeightedSpecies } from './BiomeVegetationProfile';
import type { GroundSpeciesId, TreeSpeciesId } from './VegetationFamily';
import { VegetationRegistry } from './VegetationRegistry';

export const TREE_CELL_SIZE = 7;
export const TREE_CANOPY_MARGIN = 5;

export interface TreeAnchor {
	x: number;
	z: number;
	cellX: number;
	cellZ: number;
}

export interface GroundVegetationPlacement {
	speciesId: GroundSpeciesId;
	x: number;
	y: number;
	z: number;
	rotationY: number;
	scale: number;
	color: number;
}

export function vegetationSeedValue(seed: string): number {
	let hash = 2166136261;

	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
}

export function vegetationRandom(seed: number, x: number, z: number, salt = 0): number {
	let hash = seed ^ Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(z | 0, 0x5f356495) ^ salt;
	hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
	hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39);

	return ((hash ^ (hash >>> 15)) >>> 0) / 0xffffffff;
}

export function treeAnchorForCell(cellX: number, cellZ: number, seed: number): TreeAnchor {
	const inset = 1;
	const span = TREE_CELL_SIZE - inset * 2;
	const jitterX = Math.floor(vegetationRandom(seed, cellX, cellZ, 0x1741) * span);
	const jitterZ = Math.floor(vegetationRandom(seed, cellZ, cellX, 0x28b3) * span);

	return {
		x: cellX * TREE_CELL_SIZE + inset + jitterX,
		z: cellZ * TREE_CELL_SIZE + inset + jitterZ,
		cellX,
		cellZ
	};
}

export function selectTreeSpecies(
	zone: string,
	cellX: number,
	cellZ: number,
	seed: number
): TreeSpeciesId | null {
	const profile = biomeVegetationProfile(zone);
	const spawnRoll = vegetationRandom(seed, cellX, cellZ, 0x391d);

	if (spawnRoll >= profile.treeDensity || profile.trees.length === 0) {
		return null;
	}

	return weightedPick(profile.trees, vegetationRandom(seed, cellZ, cellX, 0x4a2f));
}

export function groundVegetationPlacementAt(
	x: number,
	surfaceY: number,
	z: number,
	zone: string,
	qualityDensity: number,
	seed: number
): GroundVegetationPlacement | null {
	const profile = biomeVegetationProfile(zone);
	const density = clamp01(profile.groundDensity * clamp01(qualityDensity));
	const patch = vegetationRandom(seed, Math.floor(x / 4), Math.floor(z / 4), 0x5b41);
	const localDensity = clamp01(density * (0.48 + patch * 0.92));

	if (vegetationRandom(seed, x, z, 0x6c53) >= localDensity || profile.ground.length === 0) {
		return null;
	}

	const speciesId = weightedPick(profile.ground, vegetationRandom(seed, z, x, 0x7d65));
	const species = VegetationRegistry.ground(speciesId);
	const scaleRandom = vegetationRandom(seed, x, z, 0x8e77);
	const scale = species.minScale + (species.maxScale - species.minScale) * scaleRandom;
	const jitterX = (vegetationRandom(seed, x, z, 0x9f89) - 0.5) * 0.68;
	const jitterZ = (vegetationRandom(seed, z, x, 0xa09b) - 0.5) * 0.68;
	const colorAmount = vegetationRandom(seed, x, z, 0xb1ad);

	return {
		speciesId,
		x: x + 0.5 + jitterX,
		y: surfaceY + 1.002,
		z: z + 0.5 + jitterZ,
		rotationY: vegetationRandom(seed, z, x, 0xc2bf) * Math.PI * 2,
		scale,
		color: sampleRamp(species.colorRamp, colorAmount)
	};
}

function weightedPick<T extends string>(entries: readonly WeightedSpecies<T>[], roll: number): T {
	const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);

	if (total <= 0) {
		return entries[0].id;
	}

	let cursor = clamp01(roll) * total;

	for (const entry of entries) {
		cursor -= Math.max(0, entry.weight);

		if (cursor <= 0) {
			return entry.id;
		}
	}

	return entries[entries.length - 1].id;
}

function sampleRamp(
	ramp: { shadow: number; base: number; sunlit: number },
	amount: number
): number {
	return amount <= 0.5
		? mixRgb(ramp.shadow, ramp.base, amount * 2)
		: mixRgb(ramp.base, ramp.sunlit, (amount - 0.5) * 2);
}

function mixRgb(from: number, to: number, amount: number): number {
	const t = clamp01(amount);
	const fromR = (from >> 16) & 0xff;
	const fromG = (from >> 8) & 0xff;
	const fromB = from & 0xff;
	const toR = (to >> 16) & 0xff;
	const toG = (to >> 8) & 0xff;
	const toB = to & 0xff;
	const r = Math.round(fromR + (toR - fromR) * t);
	const g = Math.round(fromG + (toG - fromG) * t);
	const b = Math.round(fromB + (toB - fromB) * t);

	return (r << 16) | (g << 8) | b;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}
