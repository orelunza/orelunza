import { WatershedResolver, type WatershedGrid } from './WatershedResolver';

export interface PlanetHydrologyTerrainSource {
	halfExtentMeters: number;
	elevationAt(xMeters: number, zMeters: number): number;
	landAt(xMeters: number, zMeters: number): number;
}

export interface PlanetHydrologyOptions {
	resolution?: number;
	moisture?: number;
	seed?: number;
}

export type InlandWaterKind = 'none' | 'river' | 'lake';

export interface PlanetHydrologySample {
	kind: InlandWaterKind;
	basinId: number;
	discharge: number;
	riverStrength: number;
	riverWidthMeters: number;
	riverInfluence: number;
	lakeDepthMeters: number;
	waterSurfaceElevationMeters: number | null;
	bedElevationMeters: number | null;
	waterfallDropMeters: number;
	flowsToOcean: boolean;
	riverMouth: boolean;
	flowDirectionX: number;
	flowDirectionZ: number;
}

interface SegmentSample {
	index: number;
	distanceMeters: number;
	projection: number;
}

const EMPTY_SAMPLE: Readonly<PlanetHydrologySample> = Object.freeze({
	kind: 'none',
	basinId: -1,
	discharge: 0,
	riverStrength: 0,
	riverWidthMeters: 0,
	riverInfluence: 0,
	lakeDepthMeters: 0,
	waterSurfaceElevationMeters: null,
	bedElevationMeters: null,
	waterfallDropMeters: 0,
	flowsToOcean: false,
	riverMouth: false,
	flowDirectionX: 0,
	flowDirectionZ: 0
});

/** Local continuous river/lake sampler generated once from the prepared relief. */
export class PlanetHydrologyModel {
	readonly grid: WatershedGrid;
	private readonly landMask: Uint8Array;
	private readonly halfExtentMeters: number;
	private readonly resolution: number;

	constructor(
		source: Readonly<PlanetHydrologyTerrainSource>,
		options: Readonly<PlanetHydrologyOptions> = {}
	) {
		this.halfExtentMeters = normalizeExtent(source.halfExtentMeters);
		this.resolution = normalizeResolution(options.resolution ?? 65);
		const count = this.resolution * this.resolution;
		const sourceElevationMeters = new Float32Array(count);
		this.landMask = new Uint8Array(count);
		const runoff = new Float32Array(count);
		const moisture = clamp01(options.moisture ?? 0.55);
		const seed = options.seed ?? 0;

		for (let row = 0; row < this.resolution; row += 1) {
			for (let column = 0; column < this.resolution; column += 1) {
				const index = row * this.resolution + column;
				const x = this.coordinateAt(column);
				const z = this.coordinateAt(row);
				const elevation = source.elevationAt(x, z);
				const land = source.landAt(x, z) >= 0.5;
				sourceElevationMeters[index] = Number.isFinite(elevation) ? elevation : 0;
				this.landMask[index] = land ? 1 : 0;
				const variation = 0.72 + hash2(seed, column, row) * 0.56;
				runoff[index] = land ? (0.18 + moisture * 0.82) * variation : 0;
			}
		}

		this.grid = new WatershedResolver().resolve({
			resolution: this.resolution,
			halfExtentMeters: this.halfExtentMeters,
			elevationMeters: sourceElevationMeters,
			landMask: this.landMask,
			runoff,
			riverThreshold: 7 + (1 - moisture) * 22,
			minimumLakeDepthMeters: 1.25,
			minimumWaterfallDropMeters: 4
		});
	}

	sample(xMeters: number, zMeters: number): PlanetHydrologySample {
		if (!Number.isFinite(xMeters) || !Number.isFinite(zMeters)) return { ...EMPTY_SAMPLE };
		const u = clamp01((xMeters + this.halfExtentMeters) / (this.halfExtentMeters * 2));
		const v = clamp01((zMeters + this.halfExtentMeters) / (this.halfExtentMeters * 2));
		const column = Math.round(u * (this.resolution - 1));
		const row = Math.round(v * (this.resolution - 1));
		const index = row * this.resolution + column;
		if (this.landMask[index] === 0) return { ...EMPTY_SAMPLE };

		const lakeDepth = bilinear(this.grid.lakeDepthMeters, this.resolution, u, v);
		if (lakeDepth > 0.35) {
			const waterSurface = bilinear(this.grid.filledElevationMeters, this.resolution, u, v);
			return {
				kind: 'lake',
				basinId: this.grid.basinId[index] ?? -1,
				discharge: normalizedDischarge(this.grid, index),
				riverStrength: 0,
				riverWidthMeters: 0,
				riverInfluence: 1,
				lakeDepthMeters: lakeDepth,
				waterSurfaceElevationMeters: waterSurface,
				bedElevationMeters: waterSurface - Math.max(1.5, lakeDepth),
				waterfallDropMeters: 0,
				flowsToOcean: this.grid.oceanConnected[index] === 1,
				riverMouth: false,
				flowDirectionX: 0,
				flowDirectionZ: 0
			};
		}

		const segment = this.nearestRiverSegment(xMeters, zMeters, column, row);
		if (!segment) return { ...EMPTY_SAMPLE, basinId: this.grid.basinId[index] ?? -1 };
		const riverStrength = this.grid.riverStrength[segment.index] ?? 0;
		const riverWidthMeters = 1.4 + riverStrength * 6.6;
		if (segment.distanceMeters > riverWidthMeters) {
			return { ...EMPTY_SAMPLE, basinId: this.grid.basinId[index] ?? -1 };
		}
		const downstream = this.grid.flowTo[segment.index] ?? -1;
		const sourceElevation = this.grid.filledElevationMeters[segment.index] ?? 0;
		const downstreamElevation =
			downstream >= 0
				? (this.grid.filledElevationMeters[downstream] ?? sourceElevation)
				: sourceElevation;
		const waterSurface = lerp(sourceElevation, downstreamElevation, segment.projection) - 0.15;
		const riverInfluence = clamp01(1 - segment.distanceMeters / Math.max(0.1, riverWidthMeters));
		const carveDepth = 1.2 + riverStrength * 3.2 * (0.45 + smoothStep(riverInfluence) * 0.55);
		const direction = this.flowDirection(segment.index);
		return {
			kind: 'river',
			basinId: this.grid.basinId[segment.index] ?? -1,
			discharge: normalizedDischarge(this.grid, segment.index),
			riverStrength,
			riverWidthMeters,
			riverInfluence,
			lakeDepthMeters: 0,
			waterSurfaceElevationMeters: waterSurface,
			bedElevationMeters: waterSurface - carveDepth,
			waterfallDropMeters: this.grid.waterfallDropMeters[segment.index] ?? 0,
			flowsToOcean: this.grid.oceanConnected[segment.index] === 1,
			riverMouth: this.grid.riverMouth[segment.index] === 1,
			flowDirectionX: direction.x,
			flowDirectionZ: direction.z
		};
	}

	private nearestRiverSegment(
		xMeters: number,
		zMeters: number,
		column: number,
		row: number
	): SegmentSample | null {
		let best: SegmentSample | null = null;
		for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
			for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
				const candidateX = column + offsetX;
				const candidateY = row + offsetY;
				if (!inside(candidateX, candidateY, this.resolution)) continue;
				const index = candidateY * this.resolution + candidateX;
				if ((this.grid.riverStrength[index] ?? 0) <= 0) continue;
				const downstream = this.grid.flowTo[index] ?? -1;
				if (downstream < 0) continue;
				const from = this.cellCentre(index);
				const to = this.cellCentre(downstream);
				const result = distanceToSegment(xMeters, zMeters, from.x, from.z, to.x, to.z);
				if (!best || result.distanceMeters < best.distanceMeters) {
					best = { index, ...result };
				}
			}
		}
		return best;
	}

	private flowDirection(index: number): { x: number; z: number } {
		const downstream = this.grid.flowTo[index] ?? -1;
		if (downstream < 0) return { x: 0, z: 0 };
		const from = this.cellCentre(index);
		const to = this.cellCentre(downstream);
		const length = Math.hypot(to.x - from.x, to.z - from.z);
		if (length <= 1e-6) return { x: 0, z: 0 };
		return { x: (to.x - from.x) / length, z: (to.z - from.z) / length };
	}

	private cellCentre(index: number): { x: number; z: number } {
		return {
			x: this.coordinateAt(index % this.resolution),
			z: this.coordinateAt(Math.floor(index / this.resolution))
		};
	}

	private coordinateAt(index: number): number {
		return -this.halfExtentMeters + (index / (this.resolution - 1)) * this.halfExtentMeters * 2;
	}
}

function normalizedDischarge(grid: Readonly<WatershedGrid>, index: number): number {
	return clamp01((grid.flowAccumulation[index] ?? 0) / Math.max(1, grid.maximumAccumulation));
}

function normalizeExtent(value: number): number {
	if (!Number.isFinite(value) || value < 32 || value > 4096) {
		throw new RangeError('Hydrology half extent must be between 32 and 4096 metres.');
	}
	return value;
}

function normalizeResolution(value: number): number {
	const rounded = Math.max(17, Math.min(129, Math.trunc(value)));
	return rounded % 2 === 0 ? rounded + 1 : rounded;
}

function bilinear(values: ArrayLike<number>, resolution: number, u: number, v: number): number {
	const x = clamp01(u) * (resolution - 1);
	const y = clamp01(v) * (resolution - 1);
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

function distanceToSegment(
	pointX: number,
	pointZ: number,
	fromX: number,
	fromZ: number,
	toX: number,
	toZ: number
): { distanceMeters: number; projection: number } {
	const deltaX = toX - fromX;
	const deltaZ = toZ - fromZ;
	const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
	const projection =
		lengthSquared <= 1e-9
			? 0
			: clamp01(((pointX - fromX) * deltaX + (pointZ - fromZ) * deltaZ) / lengthSquared);
	const closestX = fromX + deltaX * projection;
	const closestZ = fromZ + deltaZ * projection;
	return { distanceMeters: Math.hypot(pointX - closestX, pointZ - closestZ), projection };
}

function hash2(seed: number, x: number, z: number): number {
	let hash = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
	hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
	return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

function smoothStep(value: number): number {
	const clamped = clamp01(value);
	return clamped * clamped * (3 - 2 * clamped);
}

function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * clamp01(amount);
}

function inside(x: number, y: number, resolution: number): boolean {
	return x >= 0 && y >= 0 && x < resolution && y < resolution;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
