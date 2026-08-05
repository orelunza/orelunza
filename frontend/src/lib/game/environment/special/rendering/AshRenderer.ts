import {
	BufferAttribute,
	BufferGeometry,
	Color,
	DynamicDrawUsage,
	Points,
	PointsMaterial,
	Scene,
	type Vector3
} from 'three';
import { clamp01, lerp } from '../../EnvironmentMath';
import type { EnvironmentQuality } from '../../EnvironmentQuality';
import type { SpecialWeatherFrameState } from '../SpecialWeatherState';
import { SpecialWeatherParticlePool } from './SpecialWeatherParticlePool';

const RADIUS = 30;
const HEIGHT = 28;

/** Fixed ash/smoke particle pool centred on the active camera. */
export class AshRenderer {
	private pool: SpecialWeatherParticlePool;
	private positions: Float32Array;
	private geometry: BufferGeometry;
	private readonly material = new PointsMaterial({
		color: 0x68625e,
		size: 0.12,
		transparent: true,
		opacity: 0,
		depthWrite: false,
		sizeAttenuation: true,
		toneMapped: false
	});
	private readonly points: Points;
	private readonly color = new Color();
	private disposed = false;
	private activeCount = 0;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality,
		private readonly seed: number
	) {
		this.pool = new SpecialWeatherParticlePool(quality.ashParticleCount, seed ^ 0x41534820);
		this.positions = new Float32Array(this.pool.count * 3);
		this.geometry = createGeometry(this.positions);
		this.points = new Points(this.geometry, this.material);
		this.points.name = 'orelunzaVolcanicAsh';
		this.points.frustumCulled = false;
		this.points.renderOrder = 31;
		this.scene.add(this.points);
	}

	get visibleCount(): number {
		return this.activeCount;
	}

	applyQuality(quality: EnvironmentQuality): void {
		if (this.disposed || quality.ashParticleCount === this.pool.count) {
			return;
		}
		this.pool = new SpecialWeatherParticlePool(quality.ashParticleCount, this.seed ^ 0x41534820);
		this.positions = new Float32Array(this.pool.count * 3);
		const next = createGeometry(this.positions);
		this.points.geometry = next;
		this.geometry.dispose();
		this.geometry = next;
	}

	update(frame: Readonly<SpecialWeatherFrameState>, cameraPosition: Readonly<Vector3>): void {
		if (this.disposed) {
			return;
		}
		const ash = clamp01(frame.parameters.ash);
		const smoke = clamp01(frame.parameters.smoke);
		const intensity = clamp01(Math.max(ash, smoke * 0.82) * frame.parameters.particleIntensity);
		this.activeCount = Math.min(this.pool.count, Math.ceil(this.pool.count * intensity));
		this.geometry.setDrawRange(0, this.activeCount);
		this.material.opacity = lerp(0.2, 0.82, intensity) * Math.min(1, intensity * 2.5);
		this.material.size = lerp(0.07, smoke > ash ? 0.24 : 0.16, intensity);
		this.color.setRGB(lerp(0.42, 0.2, smoke), lerp(0.39, 0.21, smoke), lerp(0.37, 0.2, smoke));
		this.material.color.copy(this.color);
		this.points.visible = this.activeCount > 0 && this.material.opacity > 0.004;
		if (!this.points.visible) {
			return;
		}

		const time = frame.elapsedSeconds;
		for (let index = 0; index < this.activeCount; index += 1) {
			const phase = fract((this.pool.phase[index] ?? 0) + time * (0.018 + smoke * 0.009));
			const scale = this.pool.scale[index] ?? 1;
			const drift = this.pool.drift[index] ?? 0;
			const offset = index * 3;
			const swirl = Math.sin(time * 0.28 + index * 1.713) * (0.7 + smoke * 1.1);
			this.positions[offset] =
				cameraPosition.x +
				(this.pool.x[index] ?? 0) * RADIUS +
				Math.cos(frame.elapsedSeconds * 0.07) * phase * 4 +
				swirl;
			this.positions[offset + 1] =
				cameraPosition.y + HEIGHT * (1 - phase) - 8 + drift * 2.2 * scale;
			this.positions[offset + 2] =
				cameraPosition.z +
				(this.pool.z[index] ?? 0) * RADIUS +
				Math.sin(frame.elapsedSeconds * 0.07) * phase * 4 -
				swirl * 0.4;
		}
		(this.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.activeCount = 0;
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
