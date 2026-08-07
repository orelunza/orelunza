import { BlockRegistry } from '../world/BlockRegistry';
import type { VoxelWorld } from '../world/VoxelWorld';
import type {
	BlockCoordinate,
	BlockState,
	BlockType,
	VoxelBlock,
	WorldCoordinate
} from '../world/voxel-types';
import type { PlayerState } from './PlayerState';

/**
 * Axis-aligned voxel collision queries.
 *
 * City-kit blocks can occupy only part of a voxel (slabs, beds, tables,
 * windows). Collision therefore uses the block registry's local AABB instead
 * of assuming every solid voxel is a full metre cube.
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
const FIXTURE_NEIGHBOR_MARGIN = 1;

export class PlayerCollider {
	private cellsTested = 0;

	constructor(private readonly world: VoxelWorld) {}

	get lastCellsTested(): number {
		return this.cellsTested;
	}

	resetFrameStats(): void {
		this.cellsTested = 0;
	}

	intersectsPlayerBlock(
		player: PlayerState,
		block: BlockCoordinate,
		type: BlockType = 'stone',
		state?: BlockState
	): boolean {
		const voxel = BlockRegistry.create(type, block, undefined, state);
		const blockBox = collisionAabb(voxel);
		return (
			blockBox !== null &&
			overlaps(this.playerAabb(player.position, player.radius, player.height), blockBox)
		);
	}

	wouldCollide(player: PlayerState, position: WorldCoordinate): boolean {
		return this.wouldCollideAabb(position, player.radius, player.height);
	}

	wouldCollideAabb(position: WorldCoordinate, radius: number, height: number): boolean {
		const box = this.playerAabb(position, radius, height);
		// Large city furniture can overhang its one-metre anchor voxel. Scan one
		// horizontal neighbour ring so collision follows the visible fixture.
		const minX = Math.floor(box.minX) - FIXTURE_NEIGHBOR_MARGIN;
		const maxX = Math.floor(box.maxX) + FIXTURE_NEIGHBOR_MARGIN;
		const minY = Math.floor(box.minY);
		const maxY = Math.floor(box.maxY);
		const minZ = Math.floor(box.minZ) - FIXTURE_NEIGHBOR_MARGIN;
		const maxZ = Math.floor(box.maxZ) + FIXTURE_NEIGHBOR_MARGIN;

		for (let x = minX; x <= maxX; x += 1) {
			for (let y = minY; y <= maxY; y += 1) {
				for (let z = minZ; z <= maxZ; z += 1) {
					this.cellsTested += 1;
					const block = this.world.getLoadedBlock({ x, y, z });
					if (!block) continue;
					const blockBox = collisionAabb(block);
					if (blockBox && overlaps(box, blockBox)) return true;
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

function collisionAabb(block: VoxelBlock): Aabb | null {
	const local = BlockRegistry.collisionBox(block);
	if (!local) return null;
	return {
		minX: block.position.x + local.minX,
		maxX: block.position.x + local.maxX,
		minY: block.position.y + local.minY,
		maxY: block.position.y + local.maxY,
		minZ: block.position.z + local.minZ,
		maxZ: block.position.z + local.maxZ
	};
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
