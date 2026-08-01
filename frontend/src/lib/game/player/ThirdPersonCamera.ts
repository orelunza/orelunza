import { PerspectiveCamera, Vector3 } from 'three';
import type { MouseDelta } from '../input/MouseInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { PlayerState } from './PlayerState';

const SENSITIVITY = 0.0024;
export const MIN_CAMERA_PITCH = -0.17;
export const MAX_CAMERA_PITCH = 1.13;
export const MIN_CAMERA_DISTANCE = 2.2;
export const MAX_CAMERA_DISTANCE = 10;
const DEFAULT_CAMERA_DISTANCE = 6.4;
const TARGET_HEIGHT = 1.42;
const CAMERA_MARGIN = 0.34;
const ZOOM_STEP = 0.0018;

export class ThirdPersonCamera {
	readonly camera: PerspectiveCamera;
	private yaw = Math.PI;
	private pitch = 0.34;
	private distance = DEFAULT_CAMERA_DISTANCE;
	private correctedDistance = DEFAULT_CAMERA_DISTANCE;
	private readonly current = new Vector3();
	private readonly target = new Vector3();
	private readonly direction = new Vector3();
	private readonly desired = new Vector3();
	private readonly sample = new Vector3();
	private readonly origin = new Vector3();
	private updateMs = 0;

	constructor(
		aspect: number,
		private readonly world: VoxelWorld
	) {
		this.camera = new PerspectiveCamera(62, aspect, 0.05, 420);
	}

	get orientationYaw(): number {
		return this.yaw;
	}

	get orientationPitch(): number {
		return this.pitch;
	}

	get orbitDistance(): number {
		return this.distance;
	}

	get currentDistance(): number {
		return this.correctedDistance;
	}

	get lastUpdateMs(): number {
		return this.updateMs;
	}

	setOrientation(yaw: number, pitch = 0.34): void {
		this.yaw = yaw;
		this.pitch = clamp(pitch, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH);
	}

	applyMouse(_player: PlayerState, delta: MouseDelta): void {
		this.yaw -= delta.x * SENSITIVITY;
		this.pitch = clamp(this.pitch + delta.y * SENSITIVITY, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH);
	}

	applyZoom(delta: number): void {
		this.distance = clamp(
			this.distance + delta * ZOOM_STEP,
			MIN_CAMERA_DISTANCE,
			MAX_CAMERA_DISTANCE
		);
	}

	update(player: PlayerState): void {
		const startedAt = performance.now();
		this.target.set(player.position.x, player.position.y + TARGET_HEIGHT, player.position.z);
		const horizontal = Math.cos(this.pitch);
		this.direction
			.set(-Math.sin(this.yaw) * horizontal, Math.sin(this.pitch), -Math.cos(this.yaw) * horizontal)
			.normalize();
		const safeDistance = this.safeDistance(this.target, this.direction, this.distance);
		const distanceLerp = safeDistance < this.correctedDistance ? 0.55 : 0.12;
		this.correctedDistance += (safeDistance - this.correctedDistance) * distanceLerp;
		this.desired.copy(this.direction).multiplyScalar(this.correctedDistance).add(this.target);

		if (this.current.lengthSq() === 0) {
			this.current.copy(this.desired);
		} else {
			this.current.lerp(this.desired, 0.2);
		}

		const floorY = this.world.terrainGenerator.heightAt(this.current.x, this.current.z) + 0.45;

		if (this.current.y < floorY) {
			this.current.y = floorY;
		}

		this.camera.position.copy(this.current);
		this.camera.lookAt(this.target);
		this.updateMs = performance.now() - startedAt;
	}

	resize(width: number, height: number): void {
		this.camera.aspect = Math.max(1, width) / Math.max(1, height);
		this.camera.updateProjectionMatrix();
	}

	private safeDistance(target: Vector3, direction: Vector3, desiredDistance: number): number {
		let safe = desiredDistance;

		for (let index = 0; index < 4; index += 1) {
			this.origin.copy(target);

			if (index === 1) {
				this.origin.x += 0.22;
			} else if (index === 2) {
				this.origin.x -= 0.22;
			} else if (index === 3) {
				this.origin.y += 0.22;
			}

			const hit = this.castToObstacle(this.origin, direction, desiredDistance);

			if (hit !== null) {
				safe = Math.min(safe, Math.max(MIN_CAMERA_DISTANCE, hit - CAMERA_MARGIN));
			}
		}

		this.desired.copy(direction).multiplyScalar(safe).add(target);
		const terrainFloor =
			this.world.terrainGenerator.heightAt(this.desired.x, this.desired.z) + 0.45;

		if (this.desired.y < terrainFloor) {
			for (let distance = safe; distance >= MIN_CAMERA_DISTANCE; distance -= 0.2) {
				this.sample.copy(direction).multiplyScalar(distance).add(target);

				if (
					this.sample.y >=
					this.world.terrainGenerator.heightAt(this.sample.x, this.sample.z) + 0.45
				) {
					return distance;
				}
			}

			return MIN_CAMERA_DISTANCE;
		}

		return safe;
	}

	private castToObstacle(origin: Vector3, direction: Vector3, maxDistance: number): number | null {
		const step = 0.22;

		for (let distance = MIN_CAMERA_DISTANCE; distance <= maxDistance; distance += step) {
			this.sample.copy(direction).multiplyScalar(distance).add(origin);

			if (this.world.isSolidLoadedAt({ x: this.sample.x, y: this.sample.y, z: this.sample.z })) {
				return distance;
			}
		}

		return null;
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
