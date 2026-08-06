import type { GeographicSample, GeographicTile } from './GeographicTile';

export function sampleGeographicTile(
	tile: Readonly<GeographicTile>,
	u: number,
	v: number
): GeographicSample {
	const clampedU = clamp01(u);
	const clampedV = clamp01(v);
	const resolution = tile.resolution;
	const x = clampedU * (resolution - 1);
	const y = clampedV * (resolution - 1);
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const x1 = Math.min(resolution - 1, x0 + 1);
	const y1 = Math.min(resolution - 1, y0 + 1);
	const fx = x - x0;
	const fy = y - y0;
	const e00 = tile.elevationMeters[y0 * resolution + x0];
	const e10 = tile.elevationMeters[y0 * resolution + x1];
	const e01 = tile.elevationMeters[y1 * resolution + x0];
	const e11 = tile.elevationMeters[y1 * resolution + x1];
	const m00 = tile.landMask[y0 * resolution + x0] / 255;
	const m10 = tile.landMask[y0 * resolution + x1] / 255;
	const m01 = tile.landMask[y1 * resolution + x0] / 255;
	const m11 = tile.landMask[y1 * resolution + x1] / 255;
	const elevationMeters = bilerp(e00, e10, e01, e11, fx, fy);
	const land = clamp01(bilerp(m00, m10, m01, m11, fx, fy));
	const coastProximity = 1 - Math.min(1, Math.abs(land - 0.5) * 2);
	return {
		elevationMeters,
		land,
		bathymetryMeters: Math.min(0, elevationMeters),
		coastProximity
	};
}

function bilerp(a: number, b: number, c: number, d: number, x: number, y: number): number {
	return (a + (b - a) * x) * (1 - y) + (c + (d - c) * x) * y;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
