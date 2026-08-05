import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import type { BlockCoordinate } from '../world/voxel-types';

const VALID_COLOR = 0xf97316;
const INVALID_COLOR = 0xef4444;

/** Transparent voxel showing exactly where the next block will be placed. */
export class PlacementPreview {
	readonly object: Mesh<BoxGeometry, MeshBasicMaterial>;

	constructor() {
		const geometry = new BoxGeometry(0.97, 0.97, 0.97);
		const material = new MeshBasicMaterial({
			color: VALID_COLOR,
			transparent: true,
			opacity: 0.24,
			depthWrite: false
		});

		this.object = new Mesh(geometry, material);
		this.object.name = 'buildPlacementPreview';
		this.object.renderOrder = 4;
		this.object.visible = false;
	}

	setTarget(position: BlockCoordinate | null, allowed: boolean): void {
		this.object.visible = position !== null;

		if (!position) {
			return;
		}

		this.object.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
		this.object.material.color.setHex(allowed ? VALID_COLOR : INVALID_COLOR);
		this.object.material.opacity = allowed ? 0.24 : 0.3;
	}

	dispose(): void {
		this.object.geometry.dispose();
		this.object.material.dispose();
	}
}
