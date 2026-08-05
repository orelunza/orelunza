import {
	BufferAttribute,
	BufferGeometry,
	DynamicDrawUsage,
	LineBasicMaterial,
	LineSegments,
	Scene,
	type Vector3
} from 'three';
import { clamp01, lerp } from '../../EnvironmentMath';
import type { EnvironmentQuality } from '../../EnvironmentQuality';
import type { PrecipitationFrameState } from '../PrecipitationState';
import { WeatherParticlePool } from './WeatherParticlePool';

const RAIN_RADIUS = 24;
const RAIN_HEIGHT = 30;

/** Fixed line-segment rain pool centred on the camera. */
export class RainRenderer {
	private pool: WeatherParticlePool;
	private positions: Float32Array;
	private geometry: BufferGeometry;
	private readonly material = new LineBasicMaterial({
		color: 0xb7d5e8,
		transparent: true,
		opacity: 0,
		depthWrite: false,
		toneMapped: false
	});
	private readonly lines: LineSegments;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality,
		private readonly seed: number
	) {
		this.pool = new WeatherParticlePool(quality.rainDropCount, seed ^ 0x7261696e);
		this.positions = new Float32Array(this.pool.count * 6);
		this.geometry = createGeometry(this.positions);
		this.lines = new LineSegments(this.geometry, this.material);
		this.lines.name = 'orelunzaRain';
		this.lines.frustumCulled = false;
		this.lines.renderOrder = 30;
		this.scene.add(this.lines);
	}

	applyQuality(quality: EnvironmentQuality): void {
		if (this.disposed || quality.rainDropCount === this.pool.count) {
			return;
		}

		this.pool = new WeatherParticlePool(quality.rainDropCount, this.seed ^ 0x7261696e);
		this.positions = new Float32Array(this.pool.count * 6);
		const next = createGeometry(this.positions);
		this.lines.geometry = next;
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

		const intensity = clamp01(precipitation.visibleIntensity);
		const active = Math.min(this.pool.count, Math.ceil(this.pool.count * intensity));
		this.geometry.setDrawRange(0, active * 2);
		this.material.opacity = lerp(0.24, 0.78, intensity) * Math.min(1, intensity * 2.4);
		this.lines.visible = active > 0 && this.material.opacity > 0.005;

		if (!this.lines.visible) {
			return;
		}

		const time = precipitation.elapsedSeconds;
		const windX = precipitation.windX;
		const windZ = precipitation.windZ;
		const fall = precipitation.fallSpeed;
		for (let index = 0; index < active; index += 1) {
			const scale = this.pool.scale[index] ?? 1;
			const phase = fract((this.pool.phase[index] ?? 0) + (time * fall * scale) / RAIN_HEIGHT);
			const x =
				cameraPosition.x + (this.pool.x[index] ?? 0) * RAIN_RADIUS + windX * (1 - phase) * 0.28;
			const y = cameraPosition.y + RAIN_HEIGHT * (1 - phase) - 5;
			const z =
				cameraPosition.z + (this.pool.z[index] ?? 0) * RAIN_RADIUS + windZ * (1 - phase) * 0.28;
			const streak = lerp(0.65, 1.9, intensity) * scale;
			const offset = index * 6;

			this.positions[offset] = x;
			this.positions[offset + 1] = y;
			this.positions[offset + 2] = z;
			this.positions[offset + 3] = x - windX * 0.035;
			this.positions[offset + 4] = y - streak;
			this.positions[offset + 5] = z - windZ * 0.035;
		}

		const attribute = this.geometry.getAttribute('position') as BufferAttribute;
		attribute.needsUpdate = true;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.scene.remove(this.lines);
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
