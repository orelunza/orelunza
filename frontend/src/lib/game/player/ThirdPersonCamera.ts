import { PerspectiveCamera, Vector3 } from 'three';
import type { MouseDelta } from '../input/MouseInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { PlayerState } from './PlayerState';

/**
 * Orelunza third-person camera — rebuilt from scratch.
 *
 * Responsibilities (and only these):
 *   - own the camera orbit (yaw, pitch, distance);
 *   - follow the player position with an over-the-shoulder lateral offset so the
 *     avatar never sits under the central reticle;
 *   - pull in smoothly in front of obstacles and terrain and ease back out.
 *
 * Explicitly NOT done here (this was the source of the old camera↔body fight):
 *   - no automatic recentring toward the body yaw. The camera never chases the
 *     player's facing. Mouse input is the only thing that rotates the camera, so
 *     the camera stays perfectly independent of PlayerController's body yaw.
 *
 * The lateral offset is applied identically to the look target and to the camera
 * eye, so the central aiming ray (used by the block raycaster) still points
 * exactly where yaw/pitch point — only the avatar is pushed to the side.
 */

const SENSITIVITY = 0.0024;
export const MIN_CAMERA_PITCH = -0.17;
export const MAX_CAMERA_PITCH = 1.13;
export const MIN_CAMERA_DISTANCE = 2.2;
export const MAX_CAMERA_DISTANCE = 10;

const DEFAULT_CAMERA_DISTANCE = 6.4;
const DEFAULT_PITCH = 0.34;
const TARGET_HEIGHT = 1.42;
const CAMERA_MARGIN = 0.34;
const ZOOM_STEP = 0.0018;
const MAX_DELTA = 0.05;

const SHOULDER_OFFSET_EXPLORE = 0.55;
const SHOULDER_OFFSET_BUILD = 0.95;
const SHOULDER_RESPONSE = 8;

/** Frame-rate independent smoothing weights (per second response constants). */
const FOLLOW_RESPONSE = 14;
const PULL_IN_RESPONSE = 26;
const EASE_OUT_RESPONSE = 6;

export class ThirdPersonCamera {
	readonly camera: PerspectiveCamera;

	private yaw = Math.PI;
	private pitch = DEFAULT_PITCH;
	private distance = DEFAULT_CAMERA_DISTANCE;
	private correctedDistance = DEFAULT_CAMERA_DISTANCE;

	private shoulderTarget = SHOULDER_OFFSET_EXPLORE;
	private shoulderCurrent = SHOULDER_OFFSET_EXPLORE;

	private mouseActiveTimer = 0;
	private updateMs = 0;
	private initialized = false;

	private readonly current = new Vector3();
	private readonly target = new Vector3();
	private readonly direction = new Vector3();
	private readonly desired = new Vector3();
	private readonly sample = new Vector3();
	private readonly origin = new Vector3();
	private readonly shoulder = new Vector3();

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

	/** True only while the user is actively moving the mouse this frame window. */
	get mouseLookActive(): boolean {
		return this.mouseActiveTimer > 0;
	}

	/**
	 * The camera never auto-recentres, so it is never "recentering". Kept for the
	 * PlayerState/diagnostics contract.
	 */
	get cameraRecentering(): boolean {
		return false;
	}

	get shoulderFramingOffset(): number {
		return this.shoulderCurrent;
	}

	setOrientation(yaw: number, pitch = DEFAULT_PITCH): void {
		this.yaw = yaw;
		this.pitch = clamp(pitch, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH);
		this.mouseActiveTimer = 0;
	}

	/** Choose over-the-shoulder framing. Build mode pushes the avatar further aside. */
	setShoulderFraming(mode: 'explore' | 'build'): void {
		this.shoulderTarget = mode === 'build' ? SHOULDER_OFFSET_BUILD : SHOULDER_OFFSET_EXPLORE;
	}

	applyMouse(_player: PlayerState, delta: MouseDelta): void {
		if (delta.x !== 0 || delta.y !== 0) {
			this.mouseActiveTimer = 0.12;
		}

		this.yaw = normalizeAngle(this.yaw - delta.x * SENSITIVITY);
		this.pitch = clamp(this.pitch + delta.y * SENSITIVITY, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH);
	}

	applyZoom(delta: number): void {
		this.distance = clamp(
			this.distance + delta * ZOOM_STEP,
			MIN_CAMERA_DISTANCE,
			MAX_CAMERA_DISTANCE
		);
	}

	update(player: PlayerState, deltaSeconds = 1 / 60): void {
		const startedAt = now();
		const delta = Math.min(Math.max(deltaSeconds, 0), MAX_DELTA);

		if (this.mouseActiveTimer > 0) {
			this.mouseActiveTimer = Math.max(0, this.mouseActiveTimer - delta);
		}

		// The camera orbit is authoritative and independent. Write orientation to
		// PlayerState for movement/aim; never read bodyYaw back into the camera.
		player.cameraYaw = this.yaw;
		player.pitch = this.pitch;
		player.mouseLookActive = this.mouseActiveTimer > 0;
		player.cameraRecentering = false;

		this.shoulderCurrent = damp(
			this.shoulderCurrent,
			this.shoulderTarget,
			SHOULDER_RESPONSE,
			delta
		);

		// World-space right vector on the horizontal plane for the current yaw.
		this.shoulder
			.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw))
			.multiplyScalar(this.shoulderCurrent);

		this.target.set(
			player.position.x + this.shoulder.x,
			player.position.y + TARGET_HEIGHT,
			player.position.z + this.shoulder.z
		);

		const horizontal = Math.cos(this.pitch);
		this.direction
			.set(-Math.sin(this.yaw) * horizontal, Math.sin(this.pitch), -Math.cos(this.yaw) * horizontal)
			.normalize();

		const safeDistance = this.safeDistance(this.target, this.direction, this.distance);
		// Pull in quickly when an obstacle appears; ease back out slowly. Both are
		// exponential (frame-rate independent) so the distance never jitters.
		const distanceResponse =
			safeDistance < this.correctedDistance ? PULL_IN_RESPONSE : EASE_OUT_RESPONSE;
		this.correctedDistance = damp(this.correctedDistance, safeDistance, distanceResponse, delta);

		this.desired.copy(this.direction).multiplyScalar(this.correctedDistance).add(this.target);

		if (!this.initialized) {
			this.current.copy(this.desired);
			this.initialized = true;
		} else {
			const follow = 1 - Math.exp(-FOLLOW_RESPONSE * delta);
			this.current.lerp(this.desired, follow);
		}

		const floorY = this.world.terrainGenerator.heightAt(this.current.x, this.current.z) + 0.45;

		if (this.current.y < floorY) {
			this.current.y = floorY;
		}

		this.camera.position.copy(this.current);
		this.camera.lookAt(this.target);
		this.updateMs = now() - startedAt;
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

function damp(current: number, target: number, response: number, deltaSeconds: number): number {
	return current + (target - current) * (1 - Math.exp(-response * deltaSeconds));
}

export function dampAngle(
	current: number,
	target: number,
	speed: number,
	deltaSeconds: number
): number {
	return normalizeAngle(
		current + angleDelta(current, target) * (1 - Math.exp(-speed * deltaSeconds))
	);
}

export function angleDelta(current: number, target: number): number {
	return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function normalizeAngle(value: number): number {
	return Math.atan2(Math.sin(value), Math.cos(value));
}

function now(): number {
	return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
