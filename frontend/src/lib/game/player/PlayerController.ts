import type { MovementInput } from '../input/KeyboardInput';
import type { MouseDelta } from '../input/MouseInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { WorldCoordinate } from '../world/voxel-types';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { PlayerPhysics } from './PlayerPhysics';
import { createPlayerState, type PlayerState } from './PlayerState';

/**
 * Orelunza player controller — rebuilt from scratch.
 *
 * Single source of truth for the body orientation. It owns bodyYaw, yaw and
 * desiredMovementYaw. It derives the desired movement direction from the raw
 * input relative to the camera, then turns the body toward that direction along
 * the shortest angular path. It never reads anything back from the animator, and
 * the camera is fully independent (no recentring), so there is no feedback loop.
 */

const DEFAULT_YAW = Math.PI;
const DEFAULT_PITCH = 0.34;
const MAX_DELTA_SECONDS = 0.05;
const MOVEMENT_DEAD_ZONE = 0.04;

/** Turn responses, in per-second exponential constants. */
const MOVING_TURN_RESPONSE = 18;
const TURN_IN_PLACE_RESPONSE = 12;

/**
 * When the camera has swung this far from the body while the player is idle and
 * actively mouse-looking, the body turns in place to face the camera. Below it,
 * the body stays put so small look-around does not spin the avatar.
 */
const TURN_IN_PLACE_THRESHOLD = 0.62;
const MAX_HEAD_YAW = 0.78;

export class PlayerController {
	readonly state: PlayerState;
	readonly camera: ThirdPersonCamera;
	readonly physics: PlayerPhysics;

	constructor(
		world: VoxelWorld,
		playerId: string,
		worldId: string,
		spawn: WorldCoordinate,
		aspect: number
	) {
		this.state = createPlayerState(playerId, worldId, spawn);
		this.physics = new PlayerPhysics(world);
		this.camera = new ThirdPersonCamera(aspect, world);

		this.resetOrientation(DEFAULT_YAW, DEFAULT_PITCH);
		this.camera.update(this.state, 1 / 60);
	}

	applyMouse(delta: MouseDelta): void {
		this.camera.applyMouse(this.state, delta);
		this.syncCameraState();
	}

	step(input: MovementInput, deltaSeconds: number): void {
		const delta = safeDelta(deltaSeconds);

		this.syncCameraState();

		const movementYaw = this.movementYaw(input);

		if (movementYaw !== null) {
			this.state.desiredMovementYaw = movementYaw;
		}

		// Physics owns position and velocity.
		this.physics.step(this.state, input, delta);

		// Controller owns body orientation.
		this.updateBodyFacing(movementYaw, delta);
		this.updateLocomotionTelemetry();

		// Camera follows last so it sees the final position this frame.
		this.camera.update(this.state, delta);
		this.syncCameraState();
	}

	setTransform(position: WorldCoordinate, yaw = 0, pitch = 0): void {
		const resolvedYaw = finiteAngle(yaw, 0);
		const resolvedPitch = Number.isFinite(pitch) && pitch !== 0 ? pitch : DEFAULT_PITCH;

		this.state.position = { ...position };
		this.state.velocity = { x: 0, y: 0, z: 0 };
		this.state.stepEvent = null;
		this.state.onGround = false;

		this.resetOrientation(resolvedYaw, resolvedPitch);
		this.camera.update(this.state, 1 / 60);
	}

	private resetOrientation(yaw: number, pitch: number): void {
		const normalizedYaw = normalizeAngle(yaw);

		this.camera.setOrientation(normalizedYaw, pitch);
		this.state.yaw = normalizedYaw;
		this.state.bodyYaw = normalizedYaw;
		this.state.cameraYaw = normalizedYaw;
		this.state.desiredMovementYaw = normalizedYaw;
		this.state.pitch = pitch;
		this.state.headYaw = 0;
		this.state.localForwardSpeed = 0;
		this.state.localSideSpeed = 0;
		this.state.verticalSpeed = 0;
		this.state.mouseLookActive = false;
		this.state.cameraRecentering = false;
	}

	private syncCameraState(): void {
		this.state.cameraYaw = normalizeAngle(this.camera.orientationYaw);
		this.state.pitch = this.camera.orientationPitch;
		this.state.mouseLookActive = this.camera.mouseLookActive;
		this.state.cameraRecentering = this.camera.cameraRecentering;
	}

	/**
	 * Desired movement direction from raw input, relative to the camera.
	 * Returns null when there is effectively no input.
	 */
	private movementYaw(input: MovementInput): number | null {
		const forward = finiteOr(input.forward, 0);
		const right = finiteOr(input.right, 0);
		const magnitude = Math.hypot(forward, right);

		if (magnitude <= MOVEMENT_DEAD_ZONE) {
			return null;
		}

		const normalizedForward = forward / magnitude;
		const normalizedRight = right / magnitude;
		const cameraYaw = this.state.cameraYaw;

		// Orelunza uses +Z as yaw 0. At camera yaw PI, forward points toward -Z
		// and right toward +X.
		const directionX =
			Math.sin(cameraYaw) * normalizedForward - Math.cos(cameraYaw) * normalizedRight;
		const directionZ =
			Math.cos(cameraYaw) * normalizedForward + Math.sin(cameraYaw) * normalizedRight;

		return Math.atan2(directionX, directionZ);
	}

	private updateBodyFacing(movementYaw: number | null, delta: number): void {
		if (movementYaw !== null) {
			// Moving: turn toward the movement direction along the shortest path.
			this.state.bodyYaw = dampAngle(this.state.bodyYaw, movementYaw, MOVING_TURN_RESPONSE, delta);
		} else if (this.state.mouseLookActive) {
			// Idle but actively looking: once the camera swings past a threshold,
			// turn the body in place to face it. Small look-around leaves the body
			// still. The camera itself never chases the body, so this is one-way.
			const offset = angleDelta(this.state.bodyYaw, this.state.cameraYaw);

			if (Math.abs(offset) > TURN_IN_PLACE_THRESHOLD) {
				this.state.bodyYaw = dampAngle(
					this.state.bodyYaw,
					this.state.cameraYaw,
					TURN_IN_PLACE_RESPONSE,
					delta
				);
				this.state.desiredMovementYaw = this.state.bodyYaw;
			}
		}

		this.state.yaw = this.state.bodyYaw;
	}

	private updateLocomotionTelemetry(): void {
		const bodyYaw = this.state.bodyYaw;
		const velocityX = finiteOr(this.state.velocity.x, 0);
		const velocityY = finiteOr(this.state.velocity.y, 0);
		const velocityZ = finiteOr(this.state.velocity.z, 0);

		this.state.localForwardSpeed = Math.sin(bodyYaw) * velocityX + Math.cos(bodyYaw) * velocityZ;
		this.state.localSideSpeed = -Math.cos(bodyYaw) * velocityX + Math.sin(bodyYaw) * velocityZ;
		this.state.verticalSpeed = velocityY;
		this.state.headYaw = clamp(
			angleDelta(bodyYaw, this.state.cameraYaw),
			-MAX_HEAD_YAW,
			MAX_HEAD_YAW
		);
	}
}

function dampAngle(
	current: number,
	target: number,
	response: number,
	deltaSeconds: number
): number {
	const amount = 1 - Math.exp(-Math.max(0, response) * deltaSeconds);

	return normalizeAngle(current + angleDelta(current, target) * amount);
}

function angleDelta(from: number, to: number): number {
	return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function normalizeAngle(value: number): number {
	return Math.atan2(Math.sin(value), Math.cos(value));
}

function finiteAngle(value: number, fallback: number): number {
	return normalizeAngle(Number.isFinite(value) ? value : fallback);
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function safeDelta(value: number): number {
	return clamp(finiteOr(value, 0), 0, MAX_DELTA_SECONDS);
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
