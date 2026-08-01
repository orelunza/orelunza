import type {
	BlockCoordinate,
	BlockType,
	ChunkCoordinate,
	WorldCoordinate
} from './world/voxel-types';
import type { InventorySnapshot } from './inventory/Inventory';
import type { CharacterAppearanceV1 } from './character/CharacterAppearance';

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
	zoneName: string;
	targetedBlock: TargetedBlock | null;
	buildMode: boolean;
	introVisible: boolean;
	message: string | null;
	error: string | null;
	mobileLimited: boolean;
	diagnostics?: GameDiagnosticsSnapshot;
}

export interface GameEngineOptions {
	canvas: HTMLCanvasElement;
	worldId: string;
	playerId: string;
	regionName: string;
	seed: string;
	appearance: CharacterAppearanceV1;
	onSnapshot?: (snapshot: GameSnapshot) => void;
	onError?: (error: Error) => void;
	onMove?: (position: WorldCoordinate, yaw: number, pitch: number) => void | Promise<void>;
}

export interface GameDiagnosticsSnapshot {
	startCount: number;
	activeLoops: number;
	fps: number;
	frameTimeMs: number;
	physicsMs: number;
	collisionCells: number;
	cameraMs: number;
	renderMs: number;
	svelteCallbacksPerSecond: number;
	backendCallsPerSecond: number;
	hudUpdatesPerSecond: number;
	chunksActive: number;
	threeObjects: number;
	drawCalls: number;
	triangles: number;
	worldRebuilds: number;
	chunkRefreshes: number;
}
