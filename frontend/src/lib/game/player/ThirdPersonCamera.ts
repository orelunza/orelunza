import { PerspectiveCamera, Vector3 } from 'three';
import type { MouseDelta } from '../input/MouseInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { PlayerState } from './PlayerState';

const SENSITIVITY = 0.0024;
const MIN_PITCH = -0.55;
const MAX_PITCH = 0.88;

export class ThirdPersonCamera {
	readonly camera: PerspectiveCamera;
	private yaw = Math.PI;
	private pitch = 0.34;
	private distance = 7.2;
	private readonly current = new Vector3();

	constructor(
		aspect: number,
		private readonly world: VoxelWorld
	) {
		this.camera = new PerspectiveCamera(62, aspect, 0.05, 420);
	}

	get orientationYaw(): number {
		return this.yaw;
	}

	setOrientation(yaw: number, pitch = 0.34): void {
		this.yaw = yaw;
		this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch));
	}

	applyMouse(_player: PlayerState, delta: MouseDelta): void {
		this.yaw -= delta.x * SENSITIVITY;
		this.pitch += delta.y * SENSITIVITY;
		this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch));
	}

	update(player: PlayerState): void {
		const target = new Vector3(player.position.x, player.position.y + 1.25, player.position.z);
		const horizontal = Math.cos(this.pitch);
		const desiredOffset = new Vector3(
			-Math.sin(this.yaw) * horizontal,
			Math.sin(this.pitch),
			-Math.cos(this.yaw) * horizontal
		).multiplyScalar(this.safeDistance(target));
		const desired = target.clone().add(desiredOffset);

		this.current.lerp(desired, 0.16);
		this.camera.position.copy(this.current);
		this.camera.lookAt(target);
	}

	resize(width: number, height: number): void {
		this.camera.aspect = Math.max(1, width) / Math.max(1, height);
		this.camera.updateProjectionMatrix();
	}

	private safeDistance(target: Vector3): number {
		for (let distance = this.distance; distance >= 2.8; distance -= 0.45) {
			const horizontal = Math.cos(this.pitch);
			const candidate = target
				.clone()
				.add(
					new Vector3(
						-Math.sin(this.yaw) * horizontal,
						Math.sin(this.pitch),
						-Math.cos(this.yaw) * horizontal
					).multiplyScalar(distance)
				);

			if (!this.world.isSolidAt({ x: candidate.x, y: candidate.y, z: candidate.z })) {
				return distance;
			}
		}

		return 2.8;
	}
}
