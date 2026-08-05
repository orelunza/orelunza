import {
	BufferAttribute,
	BufferGeometry,
	DynamicDrawUsage,
	Points,
	PointsMaterial,
	Scene,
	type Vector3
} from 'three';
import { clamp01, lerp } from '../../EnvironmentMath';
import type { EnvironmentQuality } from '../../EnvironmentQuality';
import type { PrecipitationFrameState } from '../PrecipitationState';
import { RainOcclusionSystem } from './RainOcclusionSystem';
import { WeatherParticlePool } from './WeatherParticlePool';

const SPLASH_RADIUS = 16;
const RESAMPLE_SECONDS = 0.28;

/** Small pooled impact points sampled against nearby terrain. */
export class RainSplashRenderer {
	private pool: WeatherParticlePool;
	private positions: Float32Array;
	private geometry: BufferGeometry;
	private readonly material = new PointsMaterial({
		color: 0xd6edf7,
		size: 0.11,
		transparent: true,
		opacity: 0,
		depthWrite: false,
		sizeAttenuation: true,
		toneMapped: false
	});
	private readonly points: Points;
	private sampleElapsed = Number.POSITIVE_INFINITY;
	private lastCellX = Number.NaN;
	private lastCellZ = Number.NaN;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality,
		private readonly seed: number,
		private readonly occlusion: RainOcclusionSystem
	) {
		this.pool = new WeatherParticlePool(quality.rainSplashCount, seed ^ 0x73706c73);
		this.positions = new Float32Array(this.pool.count * 3);
		this.geometry = createGeometry(this.positions);
		this.points = new Points(this.geometry, this.material);
		this.points.name = 'orelunzaRainSplashes';
		this.points.frustumCulled = false;
		this.points.renderOrder = 31;
		this.scene.add(this.points);
	}

	applyQuality(quality: EnvironmentQuality): void {
		if (this.disposed || quality.rainSplashCount === this.pool.count) {
			return;
		}
		this.pool = new WeatherParticlePool(quality.rainSplashCount, this.seed ^ 0x73706c73);
		this.positions = new Float32Array(this.pool.count * 3);
		const next = createGeometry(this.positions);
		this.points.geometry = next;
		this.geometry.dispose();
		this.geometry = next;
		this.sampleElapsed = Number.POSITIVE_INFINITY;
	}

	update(
		precipitation: Readonly<PrecipitationFrameState>,
		cameraPosition: Readonly<Vector3>,
		deltaSeconds: number
	): void {
		if (this.disposed) {
			return;
		}

		const intensity = clamp01(precipitation.splashIntensity);
		const active = Math.min(this.pool.count, Math.ceil(this.pool.count * intensity));
		this.geometry.setDrawRange(0, active);
		this.material.opacity = lerp(0.18, 0.64, intensity) * Math.min(1, intensity * 2.5);
		this.material.size = lerp(0.08, 0.16, intensity);
		this.points.visible = active > 0 && this.material.opacity > 0.005;
		if (!this.points.visible) {
			return;
		}

		this.sampleElapsed += Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
		const cellX = Math.floor(cameraPosition.x / 3);
		const cellZ = Math.floor(cameraPosition.z / 3);
		if (
			this.sampleElapsed < RESAMPLE_SECONDS &&
			cellX === this.lastCellX &&
			cellZ === this.lastCellZ
		) {
			return;
		}

		this.sampleElapsed = 0;
		this.lastCellX = cellX;
		this.lastCellZ = cellZ;
		let visible = 0;
		for (let index = 0; index < active; index += 1) {
			const x = cameraPosition.x + (this.pool.x[index] ?? 0) * SPLASH_RADIUS;
			const z = cameraPosition.z + (this.pool.z[index] ?? 0) * SPLASH_RADIUS;
			if (this.occlusion.exposureAt(x, z) < 0.2) {
				continue;
			}
			const surface = this.occlusion.surfaceHeightAt(x, z, cameraPosition.y + 8);
			if (surface === null || surface > cameraPosition.y + 6 || surface < cameraPosition.y - 18) {
				continue;
			}
			const offset = visible * 3;
			this.positions[offset] = x;
			this.positions[offset + 1] = surface + 0.53;
			this.positions[offset + 2] = z;
			visible += 1;
		}
		this.geometry.setDrawRange(0, visible);
		const attribute = this.geometry.getAttribute('position') as BufferAttribute;
		attribute.needsUpdate = true;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.scene.remove(this.points);
		this.geometry.dispose();
		this.material.dispose();
	}
}

function createGeometry(positions: Float32Array): BufferGeometry {
	const geometry = new BufferGeometry();
	const attribute = new BufferAttribute(positions, 3);
	attribute.setUsage(DynamicDrawUsage);
	geometry.setAttribute('position', attribute);
	geometry.setDrawRange(0, 0);
	return geometry;
}
