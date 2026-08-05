import {
	BufferAttribute,
	BufferGeometry,
	DynamicDrawUsage,
	Group,
	Points,
	PointsMaterial
} from 'three';
import { clamp01 } from '../environment/EnvironmentMath';

const PARTICLE_COUNT = 10;
const CYCLE_SECONDS = 2.4;

/** Tiny pooled breath plume attached to the avatar head joint. */
export class ColdBreathEmitter {
	readonly object = new Group();

	private readonly positions = new Float32Array(PARTICLE_COUNT * 3);
	private readonly geometry = createGeometry(this.positions);
	private readonly material = new PointsMaterial({
		color: 0xf3f7ff,
		size: 0.055,
		transparent: true,
		opacity: 0,
		depthWrite: false,
		sizeAttenuation: true,
		toneMapped: false
	});
	private readonly points = new Points(this.geometry, this.material);
	private elapsedSeconds = 0;
	private intensity = 0;
	private windLocalX = 0;
	private disposed = false;

	constructor() {
		this.object.name = 'orelunzaColdBreath';
		this.object.position.set(0, -0.02, -0.23);
		this.points.frustumCulled = false;
		this.points.renderOrder = 29;
		this.object.add(this.points);
	}

	setEnvironment(intensity: number, windLocalX: number): void {
		this.intensity = clamp01(intensity);
		this.windLocalX = Number.isFinite(windLocalX) ? Math.max(-1, Math.min(1, windLocalX)) : 0;
	}

	update(deltaSeconds: number): void {
		if (this.disposed) {
			return;
		}

		if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
			this.elapsedSeconds += deltaSeconds;
		}

		const active = Math.ceil(PARTICLE_COUNT * this.intensity);
		this.geometry.setDrawRange(0, active);
		this.material.opacity = this.intensity * 0.42;
		this.points.visible = active > 0 && this.material.opacity > 0.01;
		if (!this.points.visible) {
			return;
		}

		for (let index = 0; index < active; index += 1) {
			const phase = fract(this.elapsedSeconds / CYCLE_SECONDS + index / PARTICLE_COUNT);
			const pulse = Math.sin(phase * Math.PI);
			const spread = 0.025 + phase * 0.075;
			const offset = index * 3;
			this.positions[offset] =
				Math.sin(index * 2.31 + this.elapsedSeconds * 0.7) * spread +
				this.windLocalX * phase * 0.08;
			this.positions[offset + 1] = phase * 0.12 + Math.sin(index * 1.71) * 0.01;
			this.positions[offset + 2] = -phase * 0.34 - pulse * 0.035;
		}

		const attribute = this.geometry.getAttribute('position') as BufferAttribute;
		attribute.needsUpdate = true;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.geometry.dispose();
		this.material.dispose();
		this.object.clear();
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
