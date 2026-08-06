export interface PlanetSurfaceElevationGrid {
	resolution: number;
	halfExtentMeters: number;
	referenceElevationMeters: number;
	elevationMeters: Float32Array;
	landMask: Uint8Array;
	minimumElevationMeters: number;
	maximumElevationMeters: number;
}

export interface PlanetTerrainColumnSample {
	elevationMeters: number;
	relativeHeightMeters: number;
	land: number;
	coastProximity: number;
}

export class PlanetTerrainColumnSampler {
	constructor(readonly grid: Readonly<PlanetSurfaceElevationGrid>) {
		validateGrid(grid);
	}

	sample(xMeters: number, zMeters: number): PlanetTerrainColumnSample {
		if (!Number.isFinite(xMeters) || !Number.isFinite(zMeters)) {
			throw new RangeError('Planet terrain column coordinates must be finite.');
		}
		const u = clamp01((xMeters + this.grid.halfExtentMeters) / (this.grid.halfExtentMeters * 2));
		const v = clamp01((zMeters + this.grid.halfExtentMeters) / (this.grid.halfExtentMeters * 2));
		const elevationMeters = bilinear(this.grid.elevationMeters, this.grid.resolution, u, v);
		const land = bilinear(this.grid.landMask, this.grid.resolution, u, v) / 255;
		return {
			elevationMeters,
			relativeHeightMeters: elevationMeters - this.grid.referenceElevationMeters,
			land: clamp01(land),
			coastProximity: 1 - Math.min(1, Math.abs(land - 0.5) * 2)
		};
	}
}

function validateGrid(grid: Readonly<PlanetSurfaceElevationGrid>): void {
	const count = grid.resolution * grid.resolution;
	if (
		!Number.isInteger(grid.resolution) ||
		grid.resolution < 2 ||
		!Number.isFinite(grid.halfExtentMeters) ||
		grid.halfExtentMeters <= 0 ||
		!Number.isFinite(grid.referenceElevationMeters) ||
		grid.elevationMeters.length !== count ||
		grid.landMask.length !== count ||
		![grid.minimumElevationMeters, grid.maximumElevationMeters].every(Number.isFinite)
	) {
		throw new TypeError('Invalid planet surface elevation grid.');
	}
}

function bilinear(values: ArrayLike<number>, resolution: number, u: number, v: number): number {
	const x = u * (resolution - 1);
	const y = v * (resolution - 1);
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
