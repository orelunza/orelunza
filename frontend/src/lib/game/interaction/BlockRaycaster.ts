import { Vector3, type Camera } from 'three';
import type { TargetedBlock } from '../game-types';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { BlockCoordinate, VoxelBlock } from '../world/voxel-types';

const RAY_EPSILON = 1e-7;
const ZERO_NORMAL: BlockCoordinate = { x: 0, y: 0, z: 0 };

/**
 * Grid-based voxel raycaster.
 *
 * Targeting is deliberately independent from rendered meshes. Decorative
 * geometry, instancing, transparent materials and chunk mesh replacement can
 * therefore never change which voxel the reticle selects.
 */
export class BlockRaycaster {
	private readonly origin = new Vector3();
	private readonly direction = new Vector3();
	private readonly start = new Vector3();

	constructor(private readonly reachDistance = 6) {}

	raycast(camera: Camera, world: VoxelWorld, cameraDistance = 0): TargetedBlock | null {
		camera.updateMatrixWorld(true);
		camera.getWorldPosition(this.origin);
		camera.getWorldDirection(this.direction).normalize();

		// In third person, the camera sits behind the player. Camera distance must
		// not consume the player's actual building reach.
		const maxDistance = this.reachDistance + Math.max(0, finiteOrZero(cameraDistance));

		return this.raycastFrom(this.origin, this.direction, world, maxDistance);
	}

	/**
	 * Public deterministic entry point used by tests and non-camera callers.
	 */
	raycastFrom(
		origin: Vector3,
		direction: Vector3,
		world: VoxelWorld,
		maxDistance = this.reachDistance
	): TargetedBlock | null {
		if (
			!isFiniteVector(origin) ||
			!isFiniteVector(direction) ||
			direction.lengthSq() === 0 ||
			!Number.isFinite(maxDistance) ||
			maxDistance <= 0
		) {
			return null;
		}

		this.direction.copy(direction).normalize();
		this.start.copy(origin).addScaledVector(this.direction, RAY_EPSILON);

		let x = Math.floor(this.start.x);
		let y = Math.floor(this.start.y);
		let z = Math.floor(this.start.z);

		const stepX = Math.sign(this.direction.x);
		const stepY = Math.sign(this.direction.y);
		const stepZ = Math.sign(this.direction.z);

		const deltaX = stepX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / this.direction.x);
		const deltaY = stepY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / this.direction.y);
		const deltaZ = stepZ === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / this.direction.z);

		let maxX = firstBoundaryDistance(this.start.x, this.direction.x);
		let maxY = firstBoundaryDistance(this.start.y, this.direction.y);
		let maxZ = firstBoundaryDistance(this.start.z, this.direction.z);
		let travelled = 0;
		let normal = initialNormal(this.direction);

		while (travelled <= maxDistance) {
			const position = { x, y, z };
			const block = world.getLoadedBlock(position);

			// Never generate or interact with a chunk merely because the reticle
			// points towards it. Streaming remains the only chunk owner.
			if (block === null) {
				return null;
			}

			if (isTargetable(block)) {
				return {
					block: position,
					normal: { ...normal },
					type: block.type
				};
			}

			if (maxX <= maxY && maxX <= maxZ) {
				travelled = maxX;
				maxX += deltaX;
				x += stepX;
				normal = { x: -stepX, y: 0, z: 0 };
			} else if (maxY <= maxZ) {
				travelled = maxY;
				maxY += deltaY;
				y += stepY;
				normal = { x: 0, y: -stepY, z: 0 };
			} else {
				travelled = maxZ;
				maxZ += deltaZ;
				z += stepZ;
				normal = { x: 0, y: 0, z: -stepZ };
			}
		}

		return null;
	}
}

function firstBoundaryDistance(position: number, direction: number): number {
	if (direction > 0) {
		return (Math.floor(position) + 1 - position) / direction;
	}

	if (direction < 0) {
		return (position - Math.floor(position)) / -direction;
	}

	return Number.POSITIVE_INFINITY;
}

function initialNormal(direction: Vector3): BlockCoordinate {
	const absoluteX = Math.abs(direction.x);
	const absoluteY = Math.abs(direction.y);
	const absoluteZ = Math.abs(direction.z);

	if (absoluteX >= absoluteY && absoluteX >= absoluteZ) {
		return { x: -Math.sign(direction.x), y: 0, z: 0 };
	}

	if (absoluteY >= absoluteZ) {
		return { x: 0, y: -Math.sign(direction.y), z: 0 };
	}

	if (absoluteZ > 0) {
		return { x: 0, y: 0, z: -Math.sign(direction.z) };
	}

	return ZERO_NORMAL;
}

function isTargetable(block: VoxelBlock): boolean {
	if (block.type === 'air') {
		return false;
	}

	// Fluid cells are crossed like Minecraft's normal block raycast. Solid
	// blocks and collectable decorations such as flowers remain targetable.
	return block.solid || block.collectable;
}

function isFiniteVector(vector: Vector3): boolean {
	return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function finiteOrZero(value: number): number {
	return Number.isFinite(value) ? value : 0;
}
