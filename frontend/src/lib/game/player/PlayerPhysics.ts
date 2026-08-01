import type { MovementInput } from '../input/KeyboardInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { WorldCoordinate } from '../world/voxel-types';
import { PlayerCollider } from './PlayerCollider';
import type { PlayerState } from './PlayerState';

export const WALK_SPEED = 5;
export const SPRINT_SPEED = 8;
export const ACCELERATION = 18;
export const DECELERATION = 22;
export const JUMP_SPEED = 7;
export const GRAVITY_ACCELERATION = -20;
export const STEP_HEIGHT = 1.05;
const MAX_DELTA = 0.05;
const GROUND_SNAP = 0.32;

export interface HorizontalMovement {
	x: number;
	z: number;
}

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

	return {
		x: x / length,
		z: z / length
	};
}

export class PlayerPhysics {
	readonly collider: PlayerCollider;
	private readonly candidate = { x: 0, y: 0, z: 0 };

	constructor(private readonly world: VoxelWorld) {
		this.collider = new PlayerCollider(world);
	}

	step(player: PlayerState, input: MovementInput, deltaSeconds: number): void {
		this.collider.resetFrameStats();
		const delta = Math.min(deltaSeconds, MAX_DELTA);
		const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
		const movement = cameraRelativeMovement(player.yaw, input);
		const targetX = movement.x * speed;
		const targetZ = movement.z * speed;
		const horizontalInput = Math.hypot(input.forward, input.right) > 0.001;
		const rate = horizontalInput ? ACCELERATION : DECELERATION;

		player.velocity.x = approach(player.velocity.x, targetX, rate * delta);
		player.velocity.z = approach(player.velocity.z, targetZ, rate * delta);

		if (input.jump && player.onGround) {
			player.velocity.y = JUMP_SPEED;
			player.onGround = false;
		}

		player.velocity.y += GRAVITY_ACCELERATION * delta;

		this.moveAxis(player, 'x', player.velocity.x * delta);
		this.moveAxis(player, 'z', player.velocity.z * delta);
		this.moveAxis(player, 'y', player.velocity.y * delta);

		if (!input.jump && player.velocity.y <= 0 && this.snapToGround(player)) {
			player.onGround = true;
			player.velocity.y = 0;
		}

		if (player.position.y < 1) {
			player.position = this.world.findSafeSpawnPosition(player.radius, player.height);
			player.velocity.y = 0;
			player.onGround = false;
		}
	}

	private moveAxis(player: PlayerState, axis: keyof WorldCoordinate, amount: number): void {
		if (amount === 0) {
			if (axis === 'y') {
				player.onGround = this.collider.isGrounded(player);
			}

			return;
		}

		this.candidate.x = player.position.x;
		this.candidate.y = player.position.y;
		this.candidate.z = player.position.z;
		this.candidate[axis] = player.position[axis] + amount;

		if (!this.collider.wouldCollide(player, this.candidate)) {
			player.position[axis] = this.candidate[axis];

			if (axis === 'y') {
				player.onGround = false;
			}

			return;
		}

		if ((axis === 'x' || axis === 'z') && this.tryStepUp(player, axis, amount)) {
			return;
		}

		const direction = Math.sign(amount);
		const step = 0.02 * direction;
		let remaining = amount;

		while (Math.abs(remaining) > Math.abs(step)) {
			this.candidate.x = player.position.x;
			this.candidate.y = player.position.y;
			this.candidate.z = player.position.z;
			this.candidate[axis] = player.position[axis] + step;

			if (this.collider.wouldCollide(player, this.candidate)) {
				break;
			}

			player.position[axis] = this.candidate[axis];
			remaining -= step;
		}

		if (axis === 'y') {
			player.onGround = amount < 0;
			player.velocity.y = 0;
		} else {
			player.velocity[axis] = 0;
		}
	}

	private tryStepUp(player: PlayerState, axis: 'x' | 'z', amount: number): boolean {
		if (!player.onGround || Math.abs(amount) < 0.0001) {
			return false;
		}

		this.candidate.x = player.position.x;
		this.candidate.y = player.position.y + STEP_HEIGHT;
		this.candidate.z = player.position.z;

		if (this.collider.wouldCollide(player, this.candidate)) {
			return false;
		}

		this.candidate[axis] = player.position[axis] + amount;

		if (this.collider.wouldCollide(player, this.candidate)) {
			return false;
		}

		player.position.x = this.candidate.x;
		player.position.y = this.candidate.y;
		player.position.z = this.candidate.z;
		player.velocity.y = 0;
		player.onGround = false;

		return true;
	}

	private snapToGround(player: PlayerState): boolean {
		if (this.collider.isGrounded(player)) {
			return true;
		}

		this.candidate.x = player.position.x;
		this.candidate.y = player.position.y - GROUND_SNAP;
		this.candidate.z = player.position.z;

		if (!this.collider.wouldCollide(player, this.candidate)) {
			return false;
		}

		let low = this.candidate.y;
		let high = player.position.y;

		for (let index = 0; index < 8; index += 1) {
			const mid = (low + high) / 2;
			this.candidate.x = player.position.x;
			this.candidate.y = mid;
			this.candidate.z = player.position.z;

			if (this.collider.wouldCollide(player, this.candidate)) {
				low = mid;
			} else {
				high = mid;
			}
		}

		player.position.y = high;

		return true;
	}
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
