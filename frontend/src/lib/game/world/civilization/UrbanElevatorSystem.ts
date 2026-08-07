import type { PlayerState } from '../../player/PlayerState';
import type { VoxelWorld } from '../VoxelWorld';
import { CENTRAL_CITY_CENTER, type BlockCoordinate } from '../voxel-types';
import { CIVIC_ELEVATOR_LAYOUT, CIVIC_TOWER, buildingFloorBlockY } from './UrbanBuildingRegistry';
import type { UrbanPowerSystem } from './UrbanPowerSystem';
import { isUrbanElevatorSaveState, type UrbanElevatorSaveState } from './UrbanElevatorState';

export type ElevatorPhase = 'idle' | 'moving' | 'stopped';

export interface UrbanElevatorSnapshot {
	id: string;
	label: string;
	floors: number[];
	currentFloor: number;
	targetFloor: number;
	cabinY: number;
	phase: ElevatorPhase;
	powered: boolean;
	playerInside: boolean;
}

export interface ElevatorActionResult {
	handled: boolean;
	message: string;
	changed: BlockCoordinate[];
}

const SPEED = 5.2;
const SHAFT_X = CENTRAL_CITY_CENTER.x + CIVIC_ELEVATOR_LAYOUT.shaftLocalX;
const SHAFT_Z = CENTRAL_CITY_CENTER.z + CIVIC_ELEVATOR_LAYOUT.shaftLocalZ;
const LANDING_DOOR_X = CENTRAL_CITY_CENTER.x + CIVIC_ELEVATOR_LAYOUT.doorLocalX;
const LANDING_DOOR_Z = CENTRAL_CITY_CENTER.z + CIVIC_ELEVATOR_LAYOUT.doorLocalZ;
const FLOOR_COUNT = CIVIC_TOWER.floors;

export class UrbanElevatorSystem {
	private readonly groundY: number;
	private cabinY: number;
	private currentFloor = 1;
	private targetFloor = 1;
	private phase: ElevatorPhase = 'idle';
	private riding = false;
	private occupantOffset = 0.04;
	private initialized = false;

	constructor(
		private readonly world: VoxelWorld,
		private readonly power: UrbanPowerSystem
	) {
		this.groundY = Math.floor(world.terrainGenerator.heightAt(SHAFT_X, SHAFT_Z));
		this.cabinY = buildingFloorBlockY(CIVIC_TOWER, this.groundY, 1);
	}

	initialize(): BlockCoordinate[] {
		if (this.initialized) return [];
		this.initialized = true;
		const changed: BlockCoordinate[] = [];
		const platform = this.platformPosition(this.currentFloor);
		if (this.world.setRuntimeBlock(platform, 'elevator_platform')) changed.push(platform);
		changed.push(...this.syncLandingDoors());
		return changed;
	}

	serialize(): UrbanElevatorSaveState {
		return { version: 1, currentFloor: this.currentFloor };
	}

	restore(state: UrbanElevatorSaveState | null | undefined): void {
		const floor =
			state && isUrbanElevatorSaveState(state) ? Math.min(FLOOR_COUNT, state.currentFloor) : 1;
		this.clearKnownPlatforms();
		this.currentFloor = floor;
		this.targetFloor = floor;
		this.cabinY = buildingFloorBlockY(CIVIC_TOWER, this.groundY, floor);
		this.phase = 'idle';
		this.riding = false;
		this.occupantOffset = 0.04;
		this.initialized = false;
	}

	get snapshot(): UrbanElevatorSnapshot {
		return {
			id: 'civic-elevator',
			label: 'Civic Tower Elevator',
			floors: Array.from({ length: FLOOR_COUNT }, (_, index) => index + 1),
			currentFloor: this.currentFloor,
			targetFloor: this.targetFloor,
			cabinY: this.cabinY,
			phase: this.phase,
			powered: this.power.isPoweredAt({ x: SHAFT_X, z: SHAFT_Z }),
			playerInside: false
		};
	}

	snapshotFor(player: Pick<PlayerState, 'position'>): UrbanElevatorSnapshot {
		return { ...this.snapshot, playerInside: this.isPlayerInside(player.position) };
	}

	callFrom(position: BlockCoordinate): ElevatorActionResult {
		const floor = this.floorFromFixture(position);
		if (!floor) return { handled: false, message: 'No elevator here', changed: [] };
		return this.requestFloor(floor, false);
	}

	selectFloor(floor: number, player: PlayerState): ElevatorActionResult {
		if (!this.isPlayerInside(player.position)) {
			return { handled: true, message: 'Enter the elevator first', changed: [] };
		}
		this.riding = true;
		this.occupantOffset = player.position.y - (this.cabinY + 1);
		return this.requestFloor(floor, true);
	}

	canUsePanel(position: BlockCoordinate, player: Pick<PlayerState, 'position'>): boolean {
		return (
			this.floorFromFixture(position) === this.currentFloor &&
			this.phase === 'idle' &&
			this.isPlayerInside(player.position)
		);
	}

	isPlayerInside(position: { x: number; y: number; z: number }): boolean {
		const dx = position.x - (SHAFT_X + 0.5);
		const dz = position.z - (SHAFT_Z + 0.5);
		return (
			Math.abs(dx) <= 0.46 &&
			Math.abs(dz) <= 0.46 &&
			Math.abs(position.y - (this.cabinY + 1.04)) <= 1.25
		);
	}

	update(deltaSeconds: number, player: PlayerState): BlockCoordinate[] {
		if (!this.initialized) this.initialize();
		const changed: BlockCoordinate[] = [];
		const powered = this.power.isPoweredAt({ x: SHAFT_X, z: SHAFT_Z });
		if (!powered) {
			if (this.phase === 'moving') this.phase = 'stopped';
			if (this.riding) this.carryPlayer(player);
			return changed;
		}
		if (this.phase === 'stopped' && this.targetFloor !== this.currentFloor) this.phase = 'moving';
		if (this.phase !== 'moving') return changed;

		const targetY = buildingFloorBlockY(CIVIC_TOWER, this.groundY, this.targetFloor);
		const direction = Math.sign(targetY - this.cabinY);
		const distance = Math.abs(targetY - this.cabinY);
		const step = Math.min(distance, SPEED * Math.max(0, Math.min(0.05, deltaSeconds)));
		this.cabinY += direction * step;
		if (this.riding) this.carryPlayer(player);

		if (distance <= step + 1e-6) {
			this.cabinY = targetY;
			this.currentFloor = this.targetFloor;
			this.phase = 'idle';
			const platform = this.platformPosition(this.currentFloor);
			if (this.world.setRuntimeBlock(platform, 'elevator_platform')) changed.push(platform);
			changed.push(...this.syncLandingDoors());
			this.riding = false;
		}
		return changed;
	}

	private clearKnownPlatforms(): void {
		for (let floor = 1; floor <= FLOOR_COUNT; floor += 1) {
			this.world.clearRuntimeBlock(this.platformPosition(floor));
		}
	}

	private carryPlayer(player: PlayerState): void {
		player.position.x = SHAFT_X + 0.5;
		player.position.z = SHAFT_Z + 0.5;
		player.position.y = this.cabinY + 1 + this.occupantOffset;
		player.velocity.x = 0;
		player.velocity.y = 0;
		player.velocity.z = 0;
		player.verticalSpeed = 0;
		player.onGround = true;
	}

	private requestFloor(floor: number, rider: boolean): ElevatorActionResult {
		if (!Number.isInteger(floor) || floor < 1 || floor > FLOOR_COUNT) {
			return { handled: true, message: 'Invalid elevator floor', changed: [] };
		}
		if (!this.power.isPoweredAt({ x: SHAFT_X, z: SHAFT_Z })) {
			return { handled: true, message: 'Elevator has no power', changed: [] };
		}
		if (floor === this.currentFloor && this.phase === 'idle') {
			return {
				handled: true,
				message: `Elevator ready · floor ${floor}`,
				changed: this.syncLandingDoors()
			};
		}
		const changed = this.closeAllLandingDoors();
		const platform = this.platformPosition(this.currentFloor);
		if (this.world.clearRuntimeBlock(platform)) changed.push(platform);
		this.targetFloor = floor;
		this.phase = 'moving';
		this.riding = rider;
		return { handled: true, message: `Elevator → floor ${floor}`, changed };
	}

	private floorFromFixture(position: BlockCoordinate): number | null {
		const relative = position.y - (this.groundY + 1);
		const floor = Math.round(relative / CIVIC_TOWER.floorHeight) + 1;
		return floor >= 1 && floor <= FLOOR_COUNT ? floor : null;
	}

	private platformPosition(floor: number): BlockCoordinate {
		return { x: SHAFT_X, y: buildingFloorBlockY(CIVIC_TOWER, this.groundY, floor), z: SHAFT_Z };
	}

	private landingDoorPosition(floor: number): BlockCoordinate {
		return {
			x: LANDING_DOOR_X,
			y: buildingFloorBlockY(CIVIC_TOWER, this.groundY, floor) + 1,
			z: LANDING_DOOR_Z
		};
	}

	private closeAllLandingDoors(): BlockCoordinate[] {
		const changed: BlockCoordinate[] = [];
		for (let floor = 1; floor <= FLOOR_COUNT; floor += 1) {
			const position = this.landingDoorPosition(floor);
			const block = this.world.getLoadedBlock(position);
			if (
				block?.type === 'elevator_door' &&
				block.state?.open === true &&
				this.world.updateBlockState(position, { open: false }, false)
			)
				changed.push(position);
		}
		return changed;
	}

	private syncLandingDoors(): BlockCoordinate[] {
		const changed = this.closeAllLandingDoors();
		const position = this.landingDoorPosition(this.currentFloor);
		const block = this.world.getLoadedBlock(position);
		if (
			block?.type === 'elevator_door' &&
			block.state?.powered !== false &&
			this.world.updateBlockState(position, { open: true }, false)
		)
			changed.push(position);
		return changed;
	}
}
