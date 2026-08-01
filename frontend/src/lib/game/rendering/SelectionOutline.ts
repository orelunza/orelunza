import { BoxGeometry, EdgesGeometry, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import type { BlockCoordinate } from '../world/voxel-types';

export class SelectionOutline {
	readonly object: LineSegments;

	constructor() {
		const geometry = new EdgesGeometry(new BoxGeometry(1.025, 1.025, 1.025));
		const material = new LineBasicMaterial({
			color: 0xf97316,
			transparent: true,
			opacity: 0.9
		});

		this.object = new LineSegments(geometry, material);
		this.object.visible = false;
	}

	setTarget(block: BlockCoordinate | null): void {
		this.object.visible = block !== null;

		if (block) {
			this.object.position.copy(new Vector3(block.x + 0.5, block.y + 0.5, block.z + 0.5));
		}
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
