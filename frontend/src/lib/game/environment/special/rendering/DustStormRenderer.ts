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
import type { EnvironmentState } from '../../EnvironmentState';
import type { SpecialWeatherFrameState } from '../SpecialWeatherState';
import { SpecialWeatherParticlePool } from './SpecialWeatherParticlePool';

const RADIUS = 36;
const HEIGHT = 15;

/** Horizontal, camera-local dust pool driven by the unified environment wind. */
export class DustStormRenderer {
	private pool: SpecialWeatherParticlePool;
	private positions: Float32Array;
	private geometry: BufferGeometry;
	private readonly material = new PointsMaterial({
		color: 0xb27a42,
		size: 0.16,
		transparent: true,
		opacity: 0,
		depthWrite: false,
		sizeAttenuation: true,
		toneMapped: false
	});
	private readonly points: Points;
	private disposed = false;
	private activeCount = 0;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality,
		private readonly seed: number
	) {
		this.pool = new SpecialWeatherParticlePool(quality.dustParticleCount, seed ^ 0x44555354);
		this.positions = new Float32Array(this.pool.count * 3);
		this.geometry = createGeometry(this.positions);
		this.points = new Points(this.geometry, this.material);
		this.points.name = 'orelunzaDustStorm';
		this.points.frustumCulled = false;
		this.points.renderOrder = 32;
		this.scene.add(this.points);
	}

	get visibleCount(): number {
		return this.activeCount;
	}

	applyQuality(quality: EnvironmentQuality): void {
		if (this.disposed || quality.dustParticleCount === this.pool.count) {
			return;
		}
		this.pool = new SpecialWeatherParticlePool(quality.dustParticleCount, this.seed ^ 0x44555354);
		this.positions = new Float32Array(this.pool.count * 3);
		const next = createGeometry(this.positions);
		this.points.geometry = next;
		this.geometry.dispose();
		this.geometry = next;
	}

	update(
		frame: Readonly<SpecialWeatherFrameState>,
		environment: Readonly<EnvironmentState>,
		cameraPosition: Readonly<Vector3>
	): void {
		if (this.disposed) {
			return;
		}
		const intensity = clamp01(frame.parameters.dust * frame.parameters.particleIntensity);
		this.activeCount = Math.min(this.pool.count, Math.ceil(this.pool.count * intensity));
		this.geometry.setDrawRange(0, this.activeCount);
		this.material.opacity = lerp(0.12, 0.66, intensity) * Math.min(1, intensity * 2.8);
		this.material.size = lerp(0.1, 0.28, intensity);
		this.points.visible = this.activeCount > 0 && this.material.opacity > 0.004;
		if (!this.points.visible) {
			return;
		}

		const directionX = Math.cos(environment.windDirection);
		const directionZ = Math.sin(environment.windDirection);
		const speed = lerp(4, 16, clamp01(environment.windStrength * frame.parameters.windMultiplier));
		const time = frame.elapsedSeconds;
		for (let index = 0; index < this.activeCount; index += 1) {
			const phase = fract((this.pool.phase[index] ?? 0) + (time * speed) / (RADIUS * 2));
			const lateral = this.pool.x[index] ?? 0;
			const perpendicularX = -directionZ;
			const perpendicularZ = directionX;
			const travel = (phase * 2 - 1) * RADIUS;
			const cross = lateral * RADIUS;
			const offset = index * 3;
			this.positions[offset] = cameraPosition.x + directionX * travel + perpendicularX * cross;
			this.positions[offset + 1] =
				cameraPosition.y - 3 + (this.pool.y[index] ?? 0) * HEIGHT + Math.sin(time + index) * 0.4;
			this.positions[offset + 2] = cameraPosition.z + directionZ * travel + perpendicularZ * cross;
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
