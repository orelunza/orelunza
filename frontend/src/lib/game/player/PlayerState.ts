import type { WorldCoordinate } from '../world/voxel-types';

/**
 * Player runtime state — rewritten.
 *
 * This is the single shared record passed between the controller, physics,
 * camera and avatar. The public interface is unchanged (save/format contract),
 * but the factory is restructured around explicit orientation and locomotion
 * groups so the ownership of each field is obvious:
 *
 *   - position / velocity / onGround         -> owned by PlayerPhysics
 *   - yaw / bodyYaw / desiredMovementYaw      -> owned by PlayerController
 *   - cameraYaw / pitch / mouseLookActive     -> owned by ThirdPersonCamera
 *   - headYaw / local + vertical speed        -> derived telemetry
 *
 * HumanoidAnimator and PlayerAvatar treat this record as read-only.
 */

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

export const PLAYER_HEIGHT = 1.78;
export const PLAYER_RADIUS = 0.32;

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

		// Orientation (PlayerController owns these).
		yaw: 0,
		bodyYaw: 0,
		desiredMovementYaw: 0,

		// Camera (ThirdPersonCamera owns these).
		cameraYaw: 0,
		pitch: 0,
		mouseLookActive: false,
		cameraRecentering: false,

		// Physical body.
		onGround: false,
		height: PLAYER_HEIGHT,
		radius: PLAYER_RADIUS,
		stepEvent: null,

		// Derived telemetry (read-only for the animator/avatar).
		headYaw: 0,
		localForwardSpeed: 0,
		localSideSpeed: 0,
		verticalSpeed: 0
	};
}
