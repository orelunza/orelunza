import type { MovementInput } from '../input/KeyboardInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { WorldCoordinate } from '../world/voxel-types';
import { PlayerCollider } from './PlayerCollider';
import type { PlayerState } from './PlayerState';

const GRAVITY = -24;
const WALK_SPEED = 4.4;
const SPRINT_SPEED = 6.4;
const JUMP_SPEED = 8.2;
const MAX_DELTA = 0.05;

export class PlayerPhysics {
	readonly collider: PlayerCollider;

	constructor(private readonly world: VoxelWorld) {
		this.collider = new PlayerCollider(world);
	}

	step(player: PlayerState, input: MovementInput, deltaSeconds: number): void {
		const delta = Math.min(deltaSeconds, MAX_DELTA);
		const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
		const sin = Math.sin(player.yaw);
		const cos = Math.cos(player.yaw);
		const moveX = (input.right * cos + input.forward * sin) * speed;
		const moveZ = (input.right * -sin + input.forward * cos) * speed;

		player.velocity.x = moveX;
		player.velocity.z = moveZ;

		if (input.jump && player.onGround) {
			player.velocity.y = JUMP_SPEED;
			player.onGround = false;
		}

		player.velocity.y += GRAVITY * delta;

		this.moveAxis(player, 'x', player.velocity.x * delta);
		this.moveAxis(player, 'z', player.velocity.z * delta);
		this.moveAxis(player, 'y', player.velocity.y * delta);

		if (player.position.y < 1) {
			player.position.y = 16;
			player.velocity.y = 0;
		}
	}

	private moveAxis(player: PlayerState, axis: keyof WorldCoordinate, amount: number): void {
		if (amount === 0) {
			if (axis === 'y') {
				player.onGround = this.collider.wouldCollide(player, {
					...player.position,
					y: player.position.y - 0.04
				});
			}

			return;
		}

		const next = {
			...player.position,
			[axis]: player.position[axis] + amount
		};

		if (!this.collider.wouldCollide(player, next)) {
			player.position = next;

			if (axis === 'y') {
				player.onGround = false;
			}

			return;
		}

		const direction = Math.sign(amount);
		const step = 0.02 * direction;
		let remaining = amount;

		while (Math.abs(remaining) > Math.abs(step)) {
			const partial = {
				...player.position,
				[axis]: player.position[axis] + step
			};

			if (this.collider.wouldCollide(player, partial)) {
				break;
			}

			player.position = partial;
			remaining -= step;
		}

		if (axis === 'y') {
			player.onGround = amount < 0;
			player.velocity.y = 0;
		} else {
			player.velocity[axis] = 0;
		}
	}
}
