import type { EcologicalSample, EcologicalTile } from './EcologicalTile';
import { landCoverFromCode } from './LandCoverClass';

export function sampleEcologicalTile(
	tile: Readonly<EcologicalTile>,
	u: number,
	v: number
): EcologicalSample {
	const resolution = tile.resolution;
	const x = clamp01(u) * (resolution - 1);
	const y = clamp01(v) * (resolution - 1);
	const nearestX = Math.max(0, Math.min(resolution - 1, Math.round(x)));
	const nearestY = Math.max(0, Math.min(resolution - 1, Math.round(y)));
	const index = nearestY * resolution + nearestX;
	return {
		landCover: landCoverFromCode(tile.landCoverCodes[index] ?? 0),
		treeCoverDensity: bilinear(tile.treeCoverDensity, resolution, x, y) / 100,
		confidence: bilinear(tile.confidence, resolution, x, y) / 255
	};
}

function bilinear(values: ArrayLike<number>, resolution: number, x: number, y: number): number {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const x1 = Math.min(resolution - 1, x0 + 1);
	const y1 = Math.min(resolution - 1, y0 + 1);
	const fx = x - x0;
	const fy = y - y0;
	const a = values[y0 * resolution + x0] ?? 0;
	const b = values[y0 * resolution + x1] ?? 0;
	const c = values[y1 * resolution + x0] ?? 0;
	const d = values[y1 * resolution + x1] ?? 0;
	return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
