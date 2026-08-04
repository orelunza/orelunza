import type { WorldCoordinate } from '../world/voxel-types';

export type LeadingFoot = 'left' | 'right';

export interface PlayerStepEvent {
	height: number;
	directionX: number;
	directionZ: number;
	leadingFoot: LeadingFoot;
	startedAt: number;
}

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
	cameraYaw: number;
	bodyYaw: number;
	desiredMovementYaw: number;
	headYaw: number;
	localForwardSpeed: number;
	localSideSpeed: number;
	verticalSpeed: number;
	stepEvent: PlayerStepEvent | null;
	mouseLookActive: boolean;
	cameraRecentering: boolean;
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
		radius: 0.32,
		cameraYaw: 0,
		bodyYaw: 0,
		desiredMovementYaw: 0,
		headYaw: 0,
		localForwardSpeed: 0,
		localSideSpeed: 0,
		verticalSpeed: 0,
		stepEvent: null,
		mouseLookActive: false,
		cameraRecentering: false
	};
}
