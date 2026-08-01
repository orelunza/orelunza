import { PerspectiveCamera } from 'three';
import type { MouseDelta } from '../input/MouseInput';
import type { PlayerState } from './PlayerState';

const SENSITIVITY = 0.0024;
const MAX_PITCH = Math.PI / 2 - 0.08;

export class FirstPersonCamera {
	readonly camera: PerspectiveCamera;

	constructor(aspect: number) {
		this.camera = new PerspectiveCamera(72, aspect, 0.05, 360);
	}

	applyMouse(player: PlayerState, delta: MouseDelta): void {
		player.yaw -= delta.x * SENSITIVITY;
		player.pitch -= delta.y * SENSITIVITY;
		player.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, player.pitch));
	}

	update(player: PlayerState): void {
		this.camera.position.set(
			player.position.x,
			player.position.y + player.height * 0.9,
			player.position.z
		);
		this.camera.rotation.order = 'YXZ';
		this.camera.rotation.y = player.yaw;
		this.camera.rotation.x = player.pitch;
	}

	resize(width: number, height: number): void {
		this.camera.aspect = Math.max(1, width) / Math.max(1, height);
		this.camera.updateProjectionMatrix();
	}
}
