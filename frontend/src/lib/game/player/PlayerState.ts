import type { WorldCoordinate } from '../world/voxel-types';

export interface PlayerState {
	playerId: string;
	worldId: string;
	position: WorldCoordinate;
	velocity: WorldCoordinate;
	yaw: number;
	pitch: number;
	onGround: boolean;
	height: number;
	radius: number;
}

export function createPlayerState(
	playerId: string,
	worldId: string,
	position: WorldCoordinate
): PlayerState {
	return {
		playerId,
		worldId,
		position,
		velocity: { x: 0, y: 0, z: 0 },
		yaw: 0,
		pitch: 0,
		onGround: false,
		height: 1.78,
		radius: 0.32
	};
}
