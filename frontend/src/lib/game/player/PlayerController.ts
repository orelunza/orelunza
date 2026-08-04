import type { MovementInput } from '../input/KeyboardInput';
import type { MouseDelta } from '../input/MouseInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { WorldCoordinate } from '../world/voxel-types';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { PlayerPhysics } from './PlayerPhysics';
import { createPlayerState, type PlayerState } from './PlayerState';

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
		this.camera.setOrientation(Math.PI, 0.34);
		this.state.yaw = Math.PI;
		this.state.bodyYaw = Math.PI;
		this.state.cameraYaw = Math.PI;
		this.state.desiredMovementYaw = Math.PI;
		this.camera.update(this.state, 1 / 60);
	}

	applyMouse(delta: MouseDelta): void {
		this.camera.applyMouse(this.state, delta);
	}

	step(input: MovementInput, deltaSeconds: number): void {
		this.state.cameraYaw = this.camera.orientationYaw;
		this.state.pitch = this.camera.orientationPitch;
		this.state.mouseLookActive = this.camera.mouseLookActive;
		this.physics.step(this.state, input, deltaSeconds);
		this.camera.update(this.state, deltaSeconds);
	}

	setTransform(position: WorldCoordinate, yaw = 0, pitch = 0): void {
		this.state.position = { ...position };
		this.state.yaw = yaw;
		this.state.pitch = pitch;
		this.state.bodyYaw = yaw;
		this.state.cameraYaw = yaw;
		this.state.desiredMovementYaw = yaw;
		this.state.headYaw = 0;
		this.state.localForwardSpeed = 0;
		this.state.localSideSpeed = 0;
		this.state.verticalSpeed = 0;
		this.state.stepEvent = null;
		this.camera.setOrientation(yaw, pitch || 0.34);
		this.state.velocity = { x: 0, y: 0, z: 0 };
		this.camera.update(this.state, 1 / 60);
	}
}
