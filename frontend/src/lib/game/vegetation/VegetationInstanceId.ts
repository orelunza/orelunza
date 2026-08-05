import type { GroundSpeciesId } from './VegetationFamily';

/**
 * Stable identifiers for generated vegetation.
 *
 * IDs are based on the terrain column rather than Three.js instance indexes, so
 * they survive chunk rebuilds, quality changes and save/load cycles.
 */
export function tallGrassInstanceId(x: number, surfaceY: number, z: number): string {
	return `tall-grass:${integer(x)}:${integer(surfaceY)}:${integer(z)}`;
}

export function groundVegetationInstanceId(
	speciesId: GroundSpeciesId,
	x: number,
	surfaceY: number,
	z: number
): string {
	return `ground:${speciesId}:${integer(x)}:${integer(surfaceY)}:${integer(z)}`;
}

function integer(value: number): number {
	return Number.isFinite(value) ? Math.trunc(value) : 0;
}
