import type { MovementInput } from '../input/KeyboardInput';
import type { MouseDelta } from '../input/MouseInput';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { WorldCoordinate } from '../world/voxel-types';
import { FirstPersonCamera } from './FirstPersonCamera';
import { PlayerPhysics } from './PlayerPhysics';
import { createPlayerState, type PlayerState } from './PlayerState';

export class PlayerController {
	readonly state: PlayerState;
	readonly camera: FirstPersonCamera;
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
		this.camera = new FirstPersonCamera(aspect);
		this.camera.update(this.state);
	}

	applyMouse(delta: MouseDelta): void {
		this.camera.applyMouse(this.state, delta);
	}

	step(input: MovementInput, deltaSeconds: number): void {
		this.physics.step(this.state, input, deltaSeconds);
		this.camera.update(this.state);
	}

	setTransform(position: WorldCoordinate, yaw = 0, pitch = 0): void {
		this.state.position = { ...position };
		this.state.yaw = yaw;
		this.state.pitch = pitch;
		this.state.velocity = { x: 0, y: 0, z: 0 };
		this.camera.update(this.state);
	}
}
