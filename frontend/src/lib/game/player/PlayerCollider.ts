import type { VoxelWorld } from '../world/VoxelWorld';
import type { BlockCoordinate, WorldCoordinate } from '../world/voxel-types';
import type { PlayerState } from './PlayerState';

/**
 * Axis-aligned voxel collision queries — rewritten.
 *
 * The collider only ever reads already-loaded blocks (`isSolidLoadedAt`) so a
 * movement or camera query can never trigger chunk generation. It counts the
 * cells it tests per frame for the performance HUD.
 */

interface Aabb {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
}

const GROUND_PROBE = 0.06;

export class PlayerCollider {
	private cellsTested = 0;

	constructor(private readonly world: VoxelWorld) {}

	get lastCellsTested(): number {
		return this.cellsTested;
	}

	resetFrameStats(): void {
		this.cellsTested = 0;
	}

	intersectsPlayerBlock(player: PlayerState, block: BlockCoordinate): boolean {
		return overlaps(this.playerAabb(player.position, player.radius, player.height), {
			minX: block.x,
			maxX: block.x + 1,
			minY: block.y,
			maxY: block.y + 1,
			minZ: block.z,
			maxZ: block.z + 1
		});
	}

	wouldCollide(player: PlayerState, position: WorldCoordinate): boolean {
		return this.wouldCollideAabb(position, player.radius, player.height);
	}

	wouldCollideAabb(position: WorldCoordinate, radius: number, height: number): boolean {
		const box = this.playerAabb(position, radius, height);
		const minX = Math.floor(box.minX);
		const maxX = Math.floor(box.maxX);
		const minY = Math.floor(box.minY);
		const maxY = Math.floor(box.maxY);
		const minZ = Math.floor(box.minZ);
		const maxZ = Math.floor(box.maxZ);

		for (let x = minX; x <= maxX; x += 1) {
			for (let y = minY; y <= maxY; y += 1) {
				for (let z = minZ; z <= maxZ; z += 1) {
					this.cellsTested += 1;

					if (this.world.isSolidLoadedAt({ x, y, z })) {
						return true;
					}
				}
			}
		}

		return false;
	}

	isGrounded(player: PlayerState, position = player.position): boolean {
		return this.wouldCollide(player, {
			x: position.x,
			y: position.y - GROUND_PROBE,
			z: position.z
		});
	}

	private playerAabb(position: WorldCoordinate, radius: number, height: number): Aabb {
		return {
			minX: position.x - radius,
			maxX: position.x + radius,
			minY: position.y,
			maxY: position.y + height,
			minZ: position.z - radius,
			maxZ: position.z + radius
		};
	}
}

function overlaps(a: Aabb, b: Aabb): boolean {
	return (
		a.minX < b.maxX &&
		a.maxX > b.minX &&
		a.minY < b.maxY &&
		a.maxY > b.minY &&
		a.minZ < b.maxZ &&
		a.maxZ > b.minZ
	);
}
