import { Euler, PerspectiveCamera, Vector3 } from 'three';
import type { MouseDelta } from '../input/MouseInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { PlayerState } from './PlayerState';

/**
 * Independent third-person camera for Orelunza.
 *
 * Camera rotation is immediate and deterministic. Only zoom recovery and
 * shoulder framing are eased. Collision contraction is never eased: when a
 * wall enters the camera path, the eye is moved in front of it during the same
 * frame so the near plane cannot cut through voxel faces.
 */

const SENSITIVITY = 0.0024;
const MAX_MOUSE_DELTA = 240;
export const MIN_CAMERA_PITCH = -1.48;
export const MAX_CAMERA_PITCH = 1.48;
export const MIN_CAMERA_DISTANCE = 2.2;
export const MAX_CAMERA_DISTANCE = 10;

const DEFAULT_CAMERA_DISTANCE = 6.4;
const DEFAULT_PITCH = 0.34;
const TARGET_HEIGHT = 1.42;
const CAMERA_BOOM_PITCH = 0.22;
const ZOOM_STEP = 0.0018;
const MAX_DELTA = 0.05;

// MIN_CAMERA_DISTANCE is the user's zoom limit. Camera collision must be able
// to pull much closer than that, otherwise a wall less than 2.2 m behind the
// player is skipped and the camera ends up inside it.
const MIN_COLLISION_DISTANCE = 0.08;
const CAMERA_COLLISION_RADIUS = 0.2;
const TARGET_COLLISION_RADIUS = 0.1;
const COLLISION_STEP = 0.1;
const COLLISION_MARGIN = 0.04;
const COLLISION_REFINEMENT_STEPS = 6;

const SHOULDER_OFFSET_EXPLORE = 0.55;
const SHOULDER_OFFSET_BUILD = 0.72;
const SHOULDER_RESPONSE = 8;
const SHOULDER_SWEEP_STEP = 0.08;

const EASE_OUT_RESPONSE = 7;

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

	private readonly baseTarget = new Vector3();
	private readonly target = new Vector3();
	private readonly direction = new Vector3();
	private readonly desired = new Vector3();
	private readonly orientation = new Euler(0, 0, 0, 'YXZ');
	private readonly sample = new Vector3();
	private readonly shoulder = new Vector3();

	constructor(
		aspect: number,
		private readonly world: VoxelWorld
	) {
		this.camera = new PerspectiveCamera(62, aspect, 0.05, 1200);
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

	get mouseLookActive(): boolean {
		return this.mouseActiveTimer > 0;
	}

	get cameraRecentering(): boolean {
		return false;
	}

	get shoulderFramingOffset(): number {
		return this.shoulderCurrent;
	}

	setOrientation(yaw: number, pitch = DEFAULT_PITCH): void {
		this.yaw = normalizeAngle(yaw);
		this.pitch = clamp(pitch, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH);
		this.mouseActiveTimer = 0;
	}

	setShoulderFraming(mode: 'explore' | 'build'): void {
		this.shoulderTarget = mode === 'build' ? SHOULDER_OFFSET_BUILD : SHOULDER_OFFSET_EXPLORE;
	}

	/**
	 * The player parameter is retained for call-site compatibility only.
	 * Camera mouse input never mutates PlayerState.
	 */
	applyMouse(_player: Readonly<PlayerState>, delta: MouseDelta): void {
		const deltaX = clamp(finiteOr(delta.x, 0), -MAX_MOUSE_DELTA, MAX_MOUSE_DELTA);
		const deltaY = clamp(finiteOr(delta.y, 0), -MAX_MOUSE_DELTA, MAX_MOUSE_DELTA);

		if (deltaX !== 0 || deltaY !== 0) {
			this.mouseActiveTimer = 0.12;
		}

		this.yaw = normalizeAngle(this.yaw - deltaX * SENSITIVITY);
		this.pitch = clamp(this.pitch + deltaY * SENSITIVITY, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH);
	}

	applyZoom(delta: number): void {
		this.distance = clamp(
			this.distance + delta * ZOOM_STEP,
			MIN_CAMERA_DISTANCE,
			MAX_CAMERA_DISTANCE
		);
	}

	update(player: Readonly<PlayerState>, deltaSeconds = 1 / 60): void {
		const startedAt = now();
		const delta = clamp(deltaSeconds, 0, MAX_DELTA);

		if (this.mouseActiveTimer > 0) {
			this.mouseActiveTimer = Math.max(0, this.mouseActiveTimer - delta);
		}

		this.shoulderCurrent = damp(
			this.shoulderCurrent,
			this.shoulderTarget,
			SHOULDER_RESPONSE,
			delta
		);

		this.baseTarget.set(player.position.x, player.position.y + TARGET_HEIGHT, player.position.z);

		// The shoulder offset is swept before use. Standing next to a wall can
		// therefore collapse the framing toward the player's centre instead of
		// moving both the target and camera axis into that wall.
		this.shoulder
			.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw))
			.multiplyScalar(this.shoulderCurrent);

		const shoulderScale = this.safeShoulderScale(this.baseTarget, this.shoulder);
		this.target.copy(this.baseTarget).addScaledVector(this.shoulder, shoulderScale);

		// The camera boom keeps a stable elevation around the player. Full pitch
		// is applied only to the view orientation below. Looking up can therefore
		// aim at upper floors without dragging the camera down into water, while
		// wall collision still follows one deterministic boom path.
		const boomHorizontal = Math.cos(CAMERA_BOOM_PITCH);
		this.direction
			.set(
				-Math.sin(this.yaw) * boomHorizontal,
				Math.sin(CAMERA_BOOM_PITCH),
				-Math.cos(this.yaw) * boomHorizontal
			)
			.normalize();

		const safeDistance = this.safeDistance(this.target, this.direction, this.distance);

		// Pull in immediately so the camera never interpolates through a wall.
		// Only recovery back to the requested zoom distance is eased.
		if (safeDistance < this.correctedDistance) {
			this.correctedDistance = safeDistance;
		} else {
			this.correctedDistance = damp(this.correctedDistance, safeDistance, EASE_OUT_RESPONSE, delta);
		}

		this.correctedDistance = clamp(this.correctedDistance, MIN_COLLISION_DISTANCE, this.distance);

		this.desired.copy(this.direction).multiplyScalar(this.correctedDistance).add(this.target);

		// Do not lerp the eye in world space while yaw changes. That interpolation
		// cuts the corner of the orbit and can cross nearby voxels. Mouse rotation
		// should move around the player immediately, like a voxel-game camera.
		this.camera.position.copy(this.desired);

		this.orientation.set(-this.pitch, normalizeAngle(this.yaw + Math.PI), 0, 'YXZ');
		this.camera.quaternion.setFromEuler(this.orientation).normalize();
		this.updateMs = now() - startedAt;
	}

	resize(width: number, height: number): void {
		this.camera.aspect = Math.max(1, width) / Math.max(1, height);
		this.camera.updateProjectionMatrix();
	}

	private safeShoulderScale(base: Vector3, offset: Vector3): number {
		const length = offset.length();

		if (length <= Number.EPSILON) {
			return 0;
		}

		let safeScale = 0;

		for (
			let travelled = SHOULDER_SWEEP_STEP;
			travelled <= length + SHOULDER_SWEEP_STEP;
			travelled += SHOULDER_SWEEP_STEP
		) {
			const scale = Math.min(1, travelled / length);
			this.sample.copy(base).addScaledVector(offset, scale);

			if (this.isVolumeBlocked(this.sample, TARGET_COLLISION_RADIUS)) {
				return safeScale;
			}

			safeScale = scale;

			if (scale === 1) {
				break;
			}
		}

		return safeScale;
	}

	private safeDistance(target: Vector3, direction: Vector3, desiredDistance: number): number {
		let previousDistance = 0;

		for (
			let travelled = COLLISION_STEP;
			travelled <= desiredDistance + COLLISION_STEP;
			travelled += COLLISION_STEP
		) {
			const candidateDistance = Math.min(desiredDistance, travelled);
			this.sample.copy(direction).multiplyScalar(candidateDistance).add(target);

			if (this.isVolumeBlocked(this.sample, CAMERA_COLLISION_RADIUS)) {
				const refined = this.refineSafeDistance(
					target,
					direction,
					previousDistance,
					candidateDistance
				);

				return Math.max(MIN_COLLISION_DISTANCE, refined - COLLISION_MARGIN);
			}

			previousDistance = candidateDistance;

			if (candidateDistance === desiredDistance) {
				break;
			}
		}

		return desiredDistance;
	}

	private refineSafeDistance(
		target: Vector3,
		direction: Vector3,
		safeDistance: number,
		blockedDistance: number
	): number {
		let low = safeDistance;
		let high = blockedDistance;

		for (let index = 0; index < COLLISION_REFINEMENT_STEPS; index += 1) {
			const middle = (low + high) * 0.5;
			this.sample.copy(direction).multiplyScalar(middle).add(target);

			if (this.isVolumeBlocked(this.sample, CAMERA_COLLISION_RADIUS)) {
				high = middle;
			} else {
				low = middle;
			}
		}

		return low;
	}

	private isVolumeBlocked(center: Vector3, radius: number): boolean {
		if (this.isSolid(center.x, center.y, center.z)) {
			return true;
		}

		return (
			this.isSolid(center.x + radius, center.y, center.z) ||
			this.isSolid(center.x - radius, center.y, center.z) ||
			this.isSolid(center.x, center.y + radius, center.z) ||
			this.isSolid(center.x, center.y - radius, center.z) ||
			this.isSolid(center.x, center.y, center.z + radius) ||
			this.isSolid(center.x, center.y, center.z - radius)
		);
	}

	private isSolid(x: number, y: number, z: number): boolean {
		return this.world.isSolidLoadedAt({ x, y, z });
	}
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
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
