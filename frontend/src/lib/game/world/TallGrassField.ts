import { tallGrassTintAt, vegetationRandom01 } from './VegetationPalette';
import type { VegetationZone } from './VegetationPalette';

export interface TallGrassPlacement {
	x: number;
	y: number;
	z: number;
	rotationY: number;
	width: number;
	height: number;
	color: number;
}

const ZONE_DENSITY: Record<string, number> = {
	'Central City': 0.025,
	Riverbank: 0.2,
	'Forest Edge': 0.52,
	'Free Build Meadow': 0.24,
	'Spawn Meadow': 0.38,
	'Amazon Rainforest': 0.34,
	'Pine Highlands': 0.2
};

const DEFAULT_DENSITY = ZONE_DENSITY['Spawn Meadow'];

/** Returns the maximum deterministic coverage for a biome and quality profile. */
export function tallGrassDensityForZone(zone: VegetationZone, qualityDensity: number): number {
	return clamp01((ZONE_DENSITY[zone] ?? DEFAULT_DENSITY) * clamp01(qualityDensity));
}

/** Stable seed conversion so separate worlds do not share the same grass field. */
export function tallGrassSeedValue(seed: string): number {
	let hash = 2166136261;

	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
}

/**
 * Creates one deterministic tall-grass transform for a terrain column.
 * Returning null means that column intentionally remains clear.
 */
export function tallGrassPlacementAt(
	x: number,
	surfaceY: number,
	z: number,
	zone: VegetationZone,
	qualityDensity: number,
	seedValue: number
): TallGrassPlacement | null {
	const density = tallGrassDensityForZone(zone, qualityDensity);
	const patch = vegetationRandom01(
		Math.floor(x / 5),
		seedValue ^ 0x41a7,
		Math.floor(z / 5),
		0x61c3
	);
	const clusteredDensity = clamp01(density * (0.48 + patch * 0.9));
	const roll = vegetationRandom01(x, seedValue ^ 0x2f53, z, 0x7b19);

	if (roll >= clusteredDensity) {
		return null;
	}

	const jitterX = (vegetationRandom01(x, seedValue ^ 0x1911, z, 0x93a1) - 0.5) * 0.64;
	const jitterZ = (vegetationRandom01(z, seedValue ^ 0x2b27, x, 0xa6d5) - 0.5) * 0.64;
	const width = 0.72 + vegetationRandom01(x, seedValue ^ 0x3d4f, z, 0xb8e7) * 0.48;
	const height = 0.66 + vegetationRandom01(z, seedValue ^ 0x4f61, x, 0xcaf9) * 0.72;
	const rotationY = vegetationRandom01(x, seedValue ^ 0x5173, z, 0xdc0b) * Math.PI * 2;

	return {
		x: x + 0.5 + jitterX,
		y: surfaceY + 1.002,
		z: z + 0.5 + jitterZ,
		rotationY,
		width,
		height,
		color: tallGrassTintAt({ x, y: surfaceY, z }, zone)
	};
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}
