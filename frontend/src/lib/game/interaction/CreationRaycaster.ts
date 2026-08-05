import type { Camera } from 'three';
import type { CreationRaycastResult } from './BuildTarget';
import { BlockRaycaster } from './BlockRaycaster';
import { ScreenRay } from './ScreenRay';
import { VegetationRaycaster } from './VegetationRaycaster';
import type { VegetationInteractionIndex } from '../vegetation/VegetationInteractionIndex';
import type { VoxelWorld } from '../world/VoxelWorld';

/** Chooses the nearest real build target across voxels and planted vegetation. */
export class CreationRaycaster {
	private readonly blockRaycaster: BlockRaycaster;
	private readonly vegetationRaycaster = new VegetationRaycaster();
	private readonly screenRay = new ScreenRay();

	constructor(
		private readonly vegetationIndex: VegetationInteractionIndex,
		private readonly reachDistance = 6
	) {
		this.blockRaycaster = new BlockRaycaster(reachDistance);
	}

	raycast(
		camera: Camera,
		world: VoxelWorld,
		cameraDistance = 0,
		screenPoint: Readonly<{ x: number; y: number }> = { x: 0, y: 0 }
	): CreationRaycastResult {
		this.screenRay.set(camera, screenPoint);
		const minimumDistance = Math.max(0, finiteOrZero(cameraDistance));
		const maximumDistance = this.reachDistance + minimumDistance;
		const blockTarget = this.blockRaycaster.raycastFrom(
			this.screenRay.origin,
			this.screenRay.direction,
			world,
			maximumDistance,
			minimumDistance
		);
		const vegetationTarget = this.vegetationRaycaster.raycastFrom(
			this.screenRay.origin,
			this.screenRay.direction,
			this.vegetationIndex,
			maximumDistance,
			minimumDistance
		);
		const blockDistance = blockTarget
			? unitBlockDistance(
					this.screenRay.origin,
					this.screenRay.direction,
					blockTarget.block,
					minimumDistance,
					maximumDistance
				)
			: null;

		if (vegetationTarget && (blockDistance === null || vegetationTarget.distance < blockDistance)) {
			return { target: vegetationTarget, blockTarget };
		}

		return {
			target:
				blockTarget && blockDistance !== null
					? { kind: 'block', distance: blockDistance, block: blockTarget }
					: null,
			blockTarget
		};
	}
}

function unitBlockDistance(
	origin: Readonly<{ x: number; y: number; z: number }>,
	direction: Readonly<{ x: number; y: number; z: number }>,
	block: Readonly<{ x: number; y: number; z: number }>,
	minimumDistance: number,
	maximumDistance: number
): number | null {
	let entry = Math.max(0, minimumDistance);
	let exit = maximumDistance;

	for (const axis of ['x', 'y', 'z'] as const) {
		const minimum = block[axis];
		const maximum = minimum + 1;
		const rayOrigin = origin[axis];
		const rayDirection = direction[axis];

		if (Math.abs(rayDirection) <= 1e-8) {
			if (rayOrigin < minimum || rayOrigin > maximum) {
				return null;
			}

			continue;
		}

		const inverse = 1 / rayDirection;
		let near = (minimum - rayOrigin) * inverse;
		let far = (maximum - rayOrigin) * inverse;

		if (near > far) {
			[near, far] = [far, near];
		}

		entry = Math.max(entry, near);
		exit = Math.min(exit, far);

		if (exit < entry) {
			return null;
		}
	}

	return entry <= maximumDistance ? entry : null;
}

function finiteOrZero(value: number): number {
	return Number.isFinite(value) ? value : 0;
}
