import type { MovementInput } from '../input/KeyboardInput';
import type { MouseDelta } from '../input/MouseInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { WorldCoordinate } from '../world/voxel-types';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { PlayerPhysics } from './PlayerPhysics';
import { createPlayerState, type PlayerState } from './PlayerState';

/**
 * Orelunza player controller.
 *
 * PlayerController is the single authority for bodyYaw, yaw and
 * desiredMovementYaw. Physics owns position and velocity. The camera owns only
 * its orbit.
 *
 * Facing rules:
 * - every movement input produces one camera-relative world direction;
 * - the body turns toward that exact direction;
 * - W, A, S, D and diagonals are all forward locomotion after turning;
 * - there is no permanent shoulder-first strafe in normal exploration;
 * - idle mouse look may turn the body in place after a large camera offset.
 */

const DEFAULT_YAW = Math.PI;
const DEFAULT_PITCH = 0.34;
const MAX_DELTA_SECONDS = 0.05;
const MOVEMENT_DEAD_ZONE = 0.04;

/** Turn responses, in per-second exponential constants. */
const MOVING_TURN_RESPONSE = 18;
const TURN_IN_PLACE_RESPONSE = 12;

/**
 * Small camera movement only moves the head. Beyond this angle the idle body may
 * turn in place. The camera itself never recentres toward the body.
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
		const facingYaw = this.facingYaw(input, movementYaw);

		if (movementYaw !== null) {
			// Actual world-space direction requested by the input.
			this.state.desiredMovementYaw = movementYaw;
		}

		this.physics.step(this.state, input, delta);
		this.updateBodyFacing(facingYaw, delta);
		this.updateLocomotionTelemetry();

		this.camera.update(this.state, delta);
		this.syncCameraState();
	}

	updateCamera(deltaSeconds: number): void {
		this.camera.update(this.state, safeDelta(deltaSeconds));
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
	 * Actual movement direction in world space, relative to the camera.
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

		const directionX =
			Math.sin(cameraYaw) * normalizedForward - Math.cos(cameraYaw) * normalizedRight;
		const directionZ =
			Math.cos(cameraYaw) * normalizedForward + Math.sin(cameraYaw) * normalizedRight;

		return Math.atan2(directionX, directionZ);
	}

	/**
	 * The visible body always faces the actual travel direction.
	 *
	 * Normal exploration therefore has directional locomotion rather than
	 * permanent strafing: A turns left, D turns right and S turns around.
	 */
	private facingYaw(_input: MovementInput, movementYaw: number | null): number | null {
		return movementYaw;
	}

	private updateBodyFacing(facingYaw: number | null, delta: number): void {
		if (facingYaw !== null) {
			this.state.bodyYaw = dampAngle(this.state.bodyYaw, facingYaw, MOVING_TURN_RESPONSE, delta);
		} else if (this.state.mouseLookActive) {
			const offset = angleDelta(this.state.bodyYaw, this.state.cameraYaw);

			if (Math.abs(offset) > TURN_IN_PLACE_THRESHOLD) {
				this.state.bodyYaw = dampAngle(
					this.state.bodyYaw,
					this.state.cameraYaw,
					TURN_IN_PLACE_RESPONSE,
					delta
				);
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
