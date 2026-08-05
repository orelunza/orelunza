import type { Vector3 } from 'three';
import { clamp01, lerp } from '../../EnvironmentMath';
import type { WeatherWorldQuery } from '../WeatherWorldQuery';

const SAMPLE_INTERVAL_SECONDS = 0.22;
const GRID_RADIUS = 2;
const GRID_SIZE = GRID_RADIUS * 2 + 1;
const GRID_SPACING = 5;

/** Coarse cached roof sampling; never raycasts once per drop. */
export class RainOcclusionSystem {
	private readonly occlusion = new Float32Array(GRID_SIZE * GRID_SIZE);
	private elapsedSinceSample = Number.POSITIVE_INFINITY;
	private centerX = Number.NaN;
	private centerZ = Number.NaN;
	private cameraY = 0;
	private shelter = 0;

	constructor(private readonly worldQuery?: WeatherWorldQuery) {}

	update(cameraPosition: Readonly<Vector3>, deltaSeconds: number): void {
		this.elapsedSinceSample += Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
		const snappedX = Math.round(cameraPosition.x / GRID_SPACING) * GRID_SPACING;
		const snappedZ = Math.round(cameraPosition.z / GRID_SPACING) * GRID_SPACING;
		const moved = snappedX !== this.centerX || snappedZ !== this.centerZ;

		if (!this.worldQuery) {
			this.shelter = 0;
			this.occlusion.fill(0);
			return;
		}

		if (!moved && this.elapsedSinceSample < SAMPLE_INTERVAL_SECONDS) {
			return;
		}

		this.elapsedSinceSample = 0;
		this.centerX = snappedX;
		this.centerZ = snappedZ;
		this.cameraY = cameraPosition.y;

		let sum = 0;
		let index = 0;
		for (let gridZ = -GRID_RADIUS; gridZ <= GRID_RADIUS; gridZ += 1) {
			for (let gridX = -GRID_RADIUS; gridX <= GRID_RADIUS; gridX += 1) {
				const x = snappedX + gridX * GRID_SPACING;
				const z = snappedZ + gridZ * GRID_SPACING;
				const value = clamp01(this.worldQuery.rainOcclusionAt(x, cameraPosition.y, z));
				this.occlusion[index] = value;
				sum += value;
				index += 1;
			}
		}

		const center = this.occlusion[GRID_RADIUS * GRID_SIZE + GRID_RADIUS] ?? 0;
		const average = sum / this.occlusion.length;
		this.shelter = clamp01(center * 0.82 + average * 0.18);
	}

	get shelterFactor(): number {
		return this.shelter;
	}

	exposureAt(x: number, z: number): number {
		if (!this.worldQuery || !Number.isFinite(this.centerX) || !Number.isFinite(this.centerZ)) {
			return 1;
		}

		const localX = (x - this.centerX) / GRID_SPACING + GRID_RADIUS;
		const localZ = (z - this.centerZ) / GRID_SPACING + GRID_RADIUS;
		const x0 = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(localX)));
		const z0 = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(localZ)));
		const x1 = Math.min(GRID_SIZE - 1, x0 + 1);
		const z1 = Math.min(GRID_SIZE - 1, z0 + 1);
		const tx = clamp01(localX - x0);
		const tz = clamp01(localZ - z0);
		const top = lerp(this.sample(x0, z0), this.sample(x1, z0), tx);
		const bottom = lerp(this.sample(x0, z1), this.sample(x1, z1), tx);

		return 1 - clamp01(lerp(top, bottom, tz));
	}

	surfaceHeightAt(x: number, z: number, maxY = this.cameraY + 10): number | null {
		return this.worldQuery?.surfaceHeightAt(x, z, maxY) ?? null;
	}

	private sample(x: number, z: number): number {
		return this.occlusion[z * GRID_SIZE + x] ?? 0;
	}
}
