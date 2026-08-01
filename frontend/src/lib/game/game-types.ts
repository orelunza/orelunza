import type {
	BlockCoordinate,
	BlockType,
	ChunkCoordinate,
	WorldCoordinate
} from './world/voxel-types';
import type { InventorySnapshot } from './inventory/Inventory';

export type GameStatus =
	'booting' | 'loading-world' | 'playing' | 'paused' | 'inventory' | 'error' | 'destroyed';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface PlayerTransform {
	playerId: string;
	worldId: string;
	position: WorldCoordinate;
	yaw: number;
	pitch: number;
}

export interface TargetedBlock {
	block: BlockCoordinate;
	normal: BlockCoordinate;
	type: BlockType;
}

export interface GameSnapshot {
	status: GameStatus;
	player: PlayerTransform;
	chunk: ChunkCoordinate;
	inventory: InventorySnapshot;
	selectedHotbarIndex: number;
	pointerLocked: boolean;
	saveStatus: SaveStatus;
	regionName: string;
	targetedBlock: TargetedBlock | null;
	message: string | null;
	error: string | null;
	mobileLimited: boolean;
}

export interface GameEngineOptions {
	canvas: HTMLCanvasElement;
	worldId: string;
	playerId: string;
	regionName: string;
	seed: string;
	onSnapshot?: (snapshot: GameSnapshot) => void;
	onError?: (error: Error) => void;
	onMove?: (position: WorldCoordinate, yaw: number, pitch: number) => void | Promise<void>;
}
