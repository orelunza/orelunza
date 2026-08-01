import type { VoxelWorld } from '../world/VoxelWorld';
import type { BlockCoordinate, WorldCoordinate } from '../world/voxel-types';
import type { PlayerState } from './PlayerState';

export class PlayerCollider {
	constructor(private readonly world: VoxelWorld) {}

	intersectsPlayerBlock(player: PlayerState, block: BlockCoordinate): boolean {
		return intersectsAabb(
			{
				minX: player.position.x - player.radius,
				maxX: player.position.x + player.radius,
				minY: player.position.y,
				maxY: player.position.y + player.height,
				minZ: player.position.z - player.radius,
				maxZ: player.position.z + player.radius
			},
			{
				minX: block.x,
				maxX: block.x + 1,
				minY: block.y,
				maxY: block.y + 1,
				minZ: block.z,
				maxZ: block.z + 1
			}
		);
	}

	wouldCollide(player: PlayerState, position: WorldCoordinate): boolean {
		const minX = Math.floor(position.x - player.radius);
		const maxX = Math.floor(position.x + player.radius);
		const minY = Math.floor(position.y);
		const maxY = Math.floor(position.y + player.height);
		const minZ = Math.floor(position.z - player.radius);
		const maxZ = Math.floor(position.z + player.radius);

		for (let x = minX; x <= maxX; x += 1) {
			for (let y = minY; y <= maxY; y += 1) {
				for (let z = minZ; z <= maxZ; z += 1) {
					if (this.world.isSolidAt({ x, y, z })) {
						return true;
					}
				}
			}
		}

		return false;
	}
}

function intersectsAabb(
	a: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
	b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
): boolean {
	return (
		a.minX < b.maxX &&
		a.maxX > b.minX &&
		a.minY < b.maxY &&
		a.maxY > b.minY &&
		a.minZ < b.maxZ &&
		a.maxZ > b.minZ
	);
}
