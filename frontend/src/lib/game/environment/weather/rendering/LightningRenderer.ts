import {
	BufferAttribute,
	BufferGeometry,
	DynamicDrawUsage,
	Line,
	LineBasicMaterial,
	Scene,
	type Vector3
} from 'three';
import { hashUint32 } from '../../EnvironmentMath';
import type { LightningFrameState } from '../LightningState';

const SEGMENTS = 10;
const CLOUD_HEIGHT = 78;

/** One reusable bolt line. World illumination is handled by EnvironmentState. */
export class LightningRenderer {
	private readonly positions = new Float32Array((SEGMENTS + 1) * 3);
	private readonly geometry = new BufferGeometry();
	private readonly material = new LineBasicMaterial({
		color: 0xe8f2ff,
		transparent: true,
		opacity: 0,
		depthWrite: false,
		toneMapped: false
	});
	private readonly line: Line;
	private renderedStrikeId = -1;
	private disposed = false;

	constructor(private readonly scene: Scene) {
		const attribute = new BufferAttribute(this.positions, 3);
		attribute.setUsage(DynamicDrawUsage);
		this.geometry.setAttribute('position', attribute);
		this.line = new Line(this.geometry, this.material);
		this.line.name = 'orelunzaLightningBolt';
		this.line.frustumCulled = false;
		this.line.renderOrder = 40;
		this.scene.add(this.line);
	}

	update(lightning: Readonly<LightningFrameState>, cameraPosition: Readonly<Vector3>): void {
		if (this.disposed) {
			return;
		}
		if (lightning.strikeId !== this.renderedStrikeId) {
			this.renderedStrikeId = lightning.strikeId;
			this.rebuild(lightning, cameraPosition);
		}
		this.material.opacity = lightning.boltVisibility;
		this.line.visible = lightning.boltVisibility > 0.01;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.scene.remove(this.line);
		this.geometry.dispose();
		this.material.dispose();
	}

	private rebuild(
		lightning: Readonly<LightningFrameState>,
		cameraPosition: Readonly<Vector3>
	): void {
		const distance = Math.max(16, lightning.distanceMeters);
		const endX = cameraPosition.x + Math.cos(lightning.bearingRadians) * distance;
		const endZ = cameraPosition.z + Math.sin(lightning.bearingRadians) * distance;
		const startY = cameraPosition.y + CLOUD_HEIGHT;
		const endY = cameraPosition.y - 2;

		for (let index = 0; index <= SEGMENTS; index += 1) {
			const t = index / SEGMENTS;
			const taper = Math.sin(Math.PI * t);
			const jitterX = (unit(lightning.strikeId, index, 0x78) * 2 - 1) * 4.5 * taper;
			const jitterZ = (unit(lightning.strikeId, index, 0x7a) * 2 - 1) * 4.5 * taper;
			const offset = index * 3;
			this.positions[offset] = endX + jitterX;
			this.positions[offset + 1] = startY + (endY - startY) * t;
			this.positions[offset + 2] = endZ + jitterZ;
		}
		const attribute = this.geometry.getAttribute('position') as BufferAttribute;
		attribute.needsUpdate = true;
		this.geometry.computeBoundingSphere();
	}
}

function unit(strikeId: number, index: number, salt: number): number {
	return hashUint32((strikeId >>> 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ salt) / 4294967296;
}
