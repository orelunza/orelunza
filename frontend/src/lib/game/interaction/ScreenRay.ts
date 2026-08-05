import { MathUtils, PerspectiveCamera, Quaternion, Vector3, type Camera } from 'three';

/** Reusable camera ray for the free build cursor. */
export class ScreenRay {
	readonly origin = new Vector3();
	readonly direction = new Vector3();

	private readonly worldQuaternion = new Quaternion();

	set(camera: Camera, screenPoint: Readonly<{ x: number; y: number }> = { x: 0, y: 0 }): this {
		camera.updateMatrixWorld(true);
		camera.getWorldPosition(this.origin);

		if (!(camera instanceof PerspectiveCamera)) {
			camera.getWorldDirection(this.direction).normalize();
			return this;
		}

		const x = clamp(finiteOrZero(screenPoint.x), -1, 1);
		const y = clamp(finiteOrZero(screenPoint.y), -1, 1);
		const halfHeight = Math.tan(MathUtils.degToRad(camera.fov) * 0.5);
		this.direction.set(x * halfHeight * camera.aspect, y * halfHeight, -1).normalize();
		camera.getWorldQuaternion(this.worldQuaternion);
		this.direction.applyQuaternion(this.worldQuaternion).normalize();

		return this;
	}
}

function finiteOrZero(value: number): number {
	return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}
