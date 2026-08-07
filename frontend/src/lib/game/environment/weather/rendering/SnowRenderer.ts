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
import { WeatherParticlePool } from './WeatherParticlePool';
import { RainOcclusionSystem } from './RainOcclusionSystem';

const SNOW_RADIUS = 22;
const SNOW_HEIGHT = 25;

/** Fixed, deterministic flake pool centred on the camera. */
export class SnowRenderer {
	private pool: WeatherParticlePool;
	private positions: Float32Array;
	private geometry: BufferGeometry;
	private readonly material = new PointsMaterial({
		color: 0xf4f8ff,
		size: 0.11,
		transparent: true,
		opacity: 0,
		depthWrite: false,
		sizeAttenuation: true,
		toneMapped: false
	});
	private readonly points: Points;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality,
		private readonly seed: number,
		private readonly occlusion: RainOcclusionSystem
	) {
		this.pool = new WeatherParticlePool(quality.snowFlakeCount, seed ^ 0x736e6f77);
		this.positions = new Float32Array(this.pool.count * 3);
		this.geometry = createGeometry(this.positions);
		this.points = new Points(this.geometry, this.material);
		this.points.name = 'orelunzaSnow';
		this.points.frustumCulled = false;
		this.points.renderOrder = 30;
		this.scene.add(this.points);
	}

	applyQuality(quality: EnvironmentQuality): void {
		if (this.disposed || quality.snowFlakeCount === this.pool.count) {
			return;
		}

		this.pool = new WeatherParticlePool(quality.snowFlakeCount, this.seed ^ 0x736e6f77);
		this.positions = new Float32Array(this.pool.count * 3);
		const next = createGeometry(this.positions);
		this.points.geometry = next;
		this.geometry.dispose();
		this.geometry = next;
	}

	update(
		precipitation: Readonly<PrecipitationFrameState>,
		cameraPosition: Readonly<Vector3>
	): void {
		if (this.disposed) {
			return;
		}

		const intensity = clamp01(precipitation.snowIntensity);
		const active = Math.min(this.pool.count, Math.ceil(this.pool.count * intensity));
		this.geometry.setDrawRange(0, active);
		this.material.opacity = lerp(0.38, 0.92, intensity) * Math.min(1, intensity * 2.2);
		this.material.size = lerp(0.08, 0.16, intensity);
		this.points.visible = active > 0 && this.material.opacity > 0.005;

		if (!this.points.visible) {
			return;
		}

		const time = precipitation.elapsedSeconds;
		const fall = precipitation.snowFallSpeed;
		let visible = 0;
		for (let index = 0; index < active; index += 1) {
			const scale = this.pool.scale[index] ?? 1;
			const phase = fract((this.pool.phase[index] ?? 0) + (time * fall * scale) / SNOW_HEIGHT);
			const flutter = Math.sin(time * 0.9 + index * 1.713) * (0.32 + scale * 0.18);
			const windAge = 1 - phase;
			const x =
				cameraPosition.x +
				(this.pool.x[index] ?? 0) * SNOW_RADIUS +
				precipitation.windX * windAge * 0.42 +
				flutter;
			const z =
				cameraPosition.z +
				(this.pool.z[index] ?? 0) * SNOW_RADIUS +
				precipitation.windZ * windAge * 0.42 +
				Math.cos(time * 0.73 + index * 1.117) * 0.28;
			if (this.occlusion.exposureAt(x, z) < 0.16) continue;
			const offset = visible * 3;
			this.positions[offset] = x;
			this.positions[offset + 1] = cameraPosition.y + SNOW_HEIGHT * (1 - phase) - 4;
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

function fract(value: number): number {
	return value - Math.floor(value);
}
