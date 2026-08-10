import type {
	BlockCoordinate,
	BlockType,
	ChunkCoordinate,
	WorldCoordinate
} from './world/voxel-types';
import type { InventorySnapshot } from './inventory/Inventory';
import type { CharacterAppearanceV1 } from './character/CharacterAppearance';
import type { PerformanceSnapshot } from './debug/PerformanceMonitor';
import type { HumanoidAnimationSnapshot } from './player/HumanoidPose';
import type { RenderQuality } from './rendering/QualitySettings';
import type { WeatherKind } from './environment/weather/WeatherState';
import type { WorldDayAnnouncement, WorldTimeSnapshot } from './environment/time/WorldDate';
import type { HumanConditionSnapshot } from './human/HumanConditionState';
import type { UrbanElevatorSnapshot } from './world/civilization/UrbanElevatorSystem';
import type { WorldLocation } from './world/geography/WorldLocation';

export type GameStatus =
	| 'booting'
	| 'loading-world'
	| 'playing'
	| 'paused'
	| 'inventory'
	| 'calendar'
	| 'elevator'
	| 'build-catalog'
	| 'world-map'
	| 'globe'
	| 'travelling'
	| 'error'
	| 'destroyed';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export type WorldGeometry = 'local-flat' | 'planet-earth';

export interface GeographicLocationSnapshot {
	latitude: number;
	longitude: number;
	elevationMeters: number;
	countryName?: string | null;
	biomeName?: string | null;
	settlementId?: string | null;
	settlementName?: string | null;
}

export interface MiniMapCell {
	x: number;
	z: number;
	terrain: 'land' | 'water';
}

export interface MiniMapSnapshot {
	size: number;
	cells: MiniMapCell[];
	playerYaw: number;
	northRadians: number;
	zoneName: string;
}

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
	/** HUD-only live state for openable blocks; raycasters may omit it. */
	open?: boolean;
}

export interface WorldEnvironmentSnapshot {
	time: WorldTimeSnapshot;
	weather: WeatherKind;
	temperatureCelsius: number;
	windChillCelsius: number;
	lunarPhase: number;
	lunarIllumination: number;
}

export interface UrbanSystemsSnapshot {
	elevator: UrbanElevatorSnapshot;
	elevatorPanelOpen: boolean;
	buildingName: string | null;
	buildingPowered: boolean;
}

export interface GameSnapshot {
	status: GameStatus;
	player: PlayerTransform;
	chunk: ChunkCoordinate;
	inventory: InventorySnapshot;
	selectedHotbarIndex: number;
	buildPalette: Array<BlockType | null>;
	selectedBuildPaletteIndex: number;
	pointerLocked: boolean;
	saveStatus: SaveStatus;
	regionName: string;
	zoneName: string;
	geographicLocation: GeographicLocationSnapshot | null;
	travel: import('./world/travel/TravelPlan').TravelPlan | null;
	miniMap: MiniMapSnapshot;
	environment: WorldEnvironmentSnapshot;
	human: HumanConditionSnapshot;
	urban: UrbanSystemsSnapshot;
	dayAnnouncement: WorldDayAnnouncement | null;
	targetedBlock: TargetedBlock | null;
	buildMode: boolean;
	buildCatalogOpen: boolean;
	selectedBuildBlock: BlockType | null;
	creativeBuild: boolean;
	introVisible: boolean;
	message: string | null;
	error: string | null;
	mobileLimited: boolean;
	diagnostics?: GameDiagnosticsSnapshot;
	avatar?: HumanoidAnimationSnapshot;
	debugPerformance?: boolean;
	performance?: PerformanceSnapshot | null;
}

export interface GameEngineOptions {
	canvas: HTMLCanvasElement;
	buildCursorElement?: HTMLElement;
	worldId: string;
	playerId: string;
	regionName: string;
	seed: string;
	quality?: RenderQuality;
	worldGeometry?: WorldGeometry;
	appearance: CharacterAppearanceV1;
	homeLocation?: WorldLocation | null;
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
	avatarUpdateMs: number;
	avatarObjects: number;
	avatarTriangles: number;
	avatarDrawCalls: number;
	avatarSkinnedMeshes: number;
	avatarMaterials: number;
	avatarBones: number;
	avatarModelSource: string;
	avatarAnimationClips: number;
	avatarRetargetedClipCount: number;
	avatarTargetSkeletonBoneCount: number;
	avatarReady: boolean;
	avatarCurrentAnimation: string;
	avatarError: string | null;
	avatarPreviousAnimation: string | null;
	avatarMixerTime: number;
	avatarActionTime: number;
	avatarActionWeight: number;
	avatarActiveActionCount: number;
	locomotionCameraYaw: number;
	locomotionBodyYaw: number;
	locomotionDesiredMovementYaw: number;
	locomotionHeadYaw: number;
	locomotionLocalForwardSpeed: number;
	locomotionLocalSideSpeed: number;
	locomotionVerticalSpeed: number;
	locomotionGrounded: boolean;
	locomotionStepActive: boolean;
	locomotionStepHeight: number;
	locomotionLeadingFoot: 'left' | 'right' | null;
	locomotionMouseLookActive: boolean;
	locomotionCameraRecentering: boolean;
	avatarTotalTrackCount: number;
	avatarMatchedTrackCount: number;
	avatarUnmatchedTrackCount: number;
	avatarHipsBoneName: string;
	avatarLeftUpperLegBoneName: string;
	avatarRightUpperLegBoneName: string;
	avatarLeftHandBoneName: string;
	avatarRightHandBoneName: string;
	avatarHipsQuaternion: number[];
	avatarLeftUpperLegQuaternion: number[];
	avatarRightUpperLegQuaternion: number[];
	avatarLeftHandQuaternion: number[];
	avatarRightHandQuaternion: number[];
}
