import { BoxGeometry, EdgesGeometry, LineBasicMaterial, LineSegments } from 'three';
import type { VegetationInteractionInstance } from '../vegetation/VegetationInteractionIndex';

/** Green contextual outline for instanced plants that are not voxel blocks. */
export class VegetationSelectionOutline {
	readonly object: LineSegments;

	constructor() {
		const geometry = new EdgesGeometry(new BoxGeometry(1, 1, 1));
		const material = new LineBasicMaterial({
			color: 0x84cc16,
			transparent: true,
			opacity: 0.92
		});
		this.object = new LineSegments(geometry, material);
		this.object.name = 'orelunzaVegetationSelection';
		this.object.visible = false;
		this.object.renderOrder = 1000;
	}

	setTarget(target: VegetationInteractionInstance | null): void {
		this.object.visible = target !== null;

		if (!target) {
			return;
		}

		this.object.position.set(target.position.x, target.position.y, target.position.z);
		this.object.scale.set(
			Math.max(0.08, target.halfExtents.x * 2.08),
			Math.max(0.08, target.halfExtents.y * 2.08),
			Math.max(0.08, target.halfExtents.z * 2.08)
		);
	}

	dispose(): void {
		this.object.geometry.dispose();
		const material = this.object.material;

		if (Array.isArray(material)) {
			for (const item of material) {
				item.dispose();
			}
		} else {
			material.dispose();
		}
	}
}
