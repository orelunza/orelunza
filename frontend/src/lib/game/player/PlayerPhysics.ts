import type { MovementInput } from '../input/KeyboardInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { WorldCoordinate } from '../world/voxel-types';
import { PlayerCollider } from './PlayerCollider';
import type { LeadingFoot, PlayerState } from './PlayerState';

/**
 * Player physics — rewritten.
 *
 * Owns velocity, acceleration/deceleration, gravity, jump, collisions and the
 * one-block step-up. It never touches the camera and never sets a visual
 * rotation. Horizontal motion is camera-relative and normalized so diagonals do
 * not move faster. All motion is integrated per-axis with swept collision, so a
 * held key can never wedge or busy-loop the browser.
 */

export const WALK_SPEED = 5;
export const SPRINT_SPEED = 8;
export const ACCELERATION = 18;
export const DECELERATION = 22;
export const JUMP_SPEED = 7;
export const GRAVITY_ACCELERATION = -20;
export const STEP_HEIGHT = 1.05;

const MAX_DELTA = 0.05;
const GROUND_SNAP = 0.32;
const SLIDE_STEP = 0.02;
const VOID_FLOOR_Y = 1;

export interface HorizontalMovement {
	x: number;
	z: number;
}

/**
 * Camera-relative, normalized horizontal movement direction.
 *
 * yaw 0 faces +Z; at yaw PI, forward is -Z and right is +X. Returns the zero
 * vector when there is no input so a stationary player never drifts.
 */
export function cameraRelativeMovement(yaw: number, input: MovementInput): HorizontalMovement {
	const forwardX = Math.sin(yaw);
	const forwardZ = Math.cos(yaw);
	const rightX = -forwardZ;
	const rightZ = forwardX;
	const x = forwardX * input.forward + rightX * input.right;
	const z = forwardZ * input.forward + rightZ * input.right;
	const length = Math.hypot(x, z);

	if (length <= 0.0001) {
		return { x: 0, z: 0 };
	}

	return { x: x / length, z: z / length };
}

export class PlayerPhysics {
	readonly collider: PlayerCollider;

	private readonly probe: WorldCoordinate = { x: 0, y: 0, z: 0 };
	private stepSequence = 0;

	constructor(private readonly world: VoxelWorld) {
		this.collider = new PlayerCollider(world);
	}

	step(player: PlayerState, input: MovementInput, deltaSeconds: number): void {
		this.collider.resetFrameStats();
		const delta = clampDelta(deltaSeconds);

		player.stepEvent = null;

		this.integrateHorizontalVelocity(player, input, delta);
		this.integrateVerticalVelocity(player, input, delta);

		// Move each axis independently with swept collision so walls slide and a
		// single step is climbed rather than blocking motion.
		this.sweep(player, 'x', player.velocity.x * delta);
		this.sweep(player, 'z', player.velocity.z * delta);
		this.sweep(player, 'y', player.velocity.y * delta);

		this.settleGround(player, input);
		this.recoverFromVoid(player);

		player.verticalSpeed = player.velocity.y;
	}

	private integrateHorizontalVelocity(
		player: PlayerState,
		input: MovementInput,
		delta: number
	): void {
		const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
		const movement = cameraRelativeMovement(player.cameraYaw ?? player.yaw, input);
		const moving = Math.hypot(input.forward, input.right) > 0.001;
		const rate = moving ? ACCELERATION : DECELERATION;

		// Physics records the desired movement direction for telemetry only; the
		// controller owns bodyYaw. This never rotates anything visual.
		if (movement.x !== 0 || movement.z !== 0) {
			player.desiredMovementYaw = Math.atan2(movement.x, movement.z);
		}

		player.velocity.x = approach(player.velocity.x, movement.x * speed, rate * delta);
		player.velocity.z = approach(player.velocity.z, movement.z * speed, rate * delta);
	}

	private integrateVerticalVelocity(
		player: PlayerState,
		input: MovementInput,
		delta: number
	): void {
		if (input.jump && player.onGround) {
			player.velocity.y = JUMP_SPEED;
			player.onGround = false;
		}

		player.velocity.y += GRAVITY_ACCELERATION * delta;
	}

	private settleGround(player: PlayerState, input: MovementInput): void {
		if (!input.jump && player.velocity.y <= 0 && this.snapToGround(player)) {
			player.onGround = true;
			player.velocity.y = 0;
		}
	}

	private recoverFromVoid(player: PlayerState): void {
		if (player.position.y < VOID_FLOOR_Y) {
			player.position = this.world.findSafeSpawnPosition(player.radius, player.height);
			player.velocity.y = 0;
			player.onGround = false;
		}
	}

	private sweep(player: PlayerState, axis: keyof WorldCoordinate, amount: number): void {
		if (amount === 0) {
			if (axis === 'y') {
				player.onGround = this.collider.isGrounded(player);
			}

			return;
		}

		if (this.tryMove(player, axis, amount)) {
			if (axis === 'y') {
				player.onGround = false;
			}

			return;
		}

		if ((axis === 'x' || axis === 'z') && this.tryStepUp(player, axis, amount)) {
			return;
		}

		this.slidePartial(player, axis, amount);

		if (axis === 'y') {
			player.onGround = amount < 0;
			player.velocity.y = 0;
		} else {
			player.velocity[axis] = 0;
		}
	}

	private tryMove(player: PlayerState, axis: keyof WorldCoordinate, amount: number): boolean {
		this.setProbe(player.position);
		this.probe[axis] = player.position[axis] + amount;

		if (this.collider.wouldCollide(player, this.probe)) {
			return false;
		}

		player.position[axis] = this.probe[axis];

		return true;
	}

	private slidePartial(player: PlayerState, axis: keyof WorldCoordinate, amount: number): void {
		const direction = Math.sign(amount);
		const step = SLIDE_STEP * direction;
		let remaining = amount;

		while (Math.abs(remaining) > Math.abs(step)) {
			this.setProbe(player.position);
			this.probe[axis] = player.position[axis] + step;

			if (this.collider.wouldCollide(player, this.probe)) {
				break;
			}

			player.position[axis] = this.probe[axis];
			remaining -= step;
		}
	}

	private tryStepUp(player: PlayerState, axis: 'x' | 'z', amount: number): boolean {
		if (!player.onGround || Math.abs(amount) < 0.0001) {
			return false;
		}

		const startY = player.position.y;

		this.setProbe(player.position);
		this.probe.y = player.position.y + STEP_HEIGHT;

		if (this.collider.wouldCollide(player, this.probe)) {
			return false;
		}

		this.probe[axis] = player.position[axis] + amount;

		if (this.collider.wouldCollide(player, this.probe)) {
			return false;
		}

		player.position.x = this.probe.x;
		player.position.y = this.probe.y;
		player.position.z = this.probe.z;
		player.velocity.y = 0;
		player.onGround = false;
		player.verticalSpeed = 0;
		player.stepEvent = {
			height: Math.max(0, player.position.y - startY),
			directionX: axis === 'x' ? Math.sign(amount) : 0,
			directionZ: axis === 'z' ? Math.sign(amount) : 0,
			leadingFoot: nextLeadingFoot(player, this.stepSequence),
			startedAt: ++this.stepSequence
		};

		return true;
	}

	private snapToGround(player: PlayerState): boolean {
		if (this.collider.isGrounded(player)) {
			return true;
		}

		this.setProbe(player.position);
		this.probe.y = player.position.y - GROUND_SNAP;

		if (!this.collider.wouldCollide(player, this.probe)) {
			return false;
		}

		// Binary search the exact resting height within the snap window.
		let low = this.probe.y;
		let high = player.position.y;

		for (let index = 0; index < 8; index += 1) {
			const mid = (low + high) / 2;
			this.setProbe(player.position);
			this.probe.y = mid;

			if (this.collider.wouldCollide(player, this.probe)) {
				low = mid;
			} else {
				high = mid;
			}
		}

		player.position.y = high;

		return true;
	}

	private setProbe(position: WorldCoordinate): void {
		this.probe.x = position.x;
		this.probe.y = position.y;
		this.probe.z = position.z;
	}
}

function nextLeadingFoot(player: PlayerState, sequence: number): LeadingFoot {
	const bodyYaw = player.bodyYaw ?? player.yaw;
	const side = -Math.cos(bodyYaw) * player.velocity.x + Math.sin(bodyYaw) * player.velocity.z;

	if (Math.abs(side) > 0.2) {
		return side > 0 ? 'right' : 'left';
	}

	return sequence % 2 === 0 ? 'left' : 'right';
}

function approach(current: number, target: number, amount: number): number {
	if (current < target) {
		return Math.min(current + amount, target);
	}

	if (current > target) {
		return Math.max(current - amount, target);
	}

	return current;
}

function clampDelta(value: number): number {
	if (!Number.isFinite(value) || value <= 0) {
		return 0;
	}

	return Math.min(value, MAX_DELTA);
}
