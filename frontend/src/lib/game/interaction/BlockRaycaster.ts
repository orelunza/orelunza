import { Raycaster, Vector2, Vector3, type Camera } from 'three';
import type { BlockInstanceLookup } from '../world/BlockMeshFactory';
import type { BlockType } from '../world/voxel-types';
import type { TargetedBlock } from '../game-types';

const CENTER = new Vector2(0, 0);

export class BlockRaycaster {
	private readonly raycaster = new Raycaster();

	constructor(private readonly maxDistance = 6) {}

	raycast(camera: Camera, lookups: BlockInstanceLookup[]): TargetedBlock | null {
		this.raycaster.setFromCamera(CENTER, camera);
		this.raycaster.far = this.maxDistance;

		const intersections = this.raycaster.intersectObjects(
			lookups.map((lookup) => lookup.mesh),
			false
		);

		const hit = intersections[0];

		if (!hit || hit.instanceId === undefined) {
			return null;
		}

		const lookup = lookups.find((candidate) => candidate.mesh === hit.object);
		const block = lookup?.blocks[hit.instanceId];

		if (!lookup || !block) {
			return null;
		}

		const normal = hit.face?.normal.clone() ?? new Vector3(0, 1, 0);
		normal.transformDirection(hit.object.matrixWorld);

		return {
			block,
			normal: {
				x: Math.round(normal.x),
				y: Math.round(normal.y),
				z: Math.round(normal.z)
			},
			type: lookup.type as BlockType
		};
	}
}
