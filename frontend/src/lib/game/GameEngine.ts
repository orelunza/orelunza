import { Vector3 } from 'three';
import { GameLoop } from './GameLoop';
import type {
	GameDiagnosticsSnapshot,
	GameEngineOptions,
	GameSnapshot,
	GameStatus,
	SaveStatus,
	TargetedBlock
} from './game-types';
import {
	createBuildWorkspaceState,
	cycleBuildPaletteSlot,
	loadBuildWorkspaceState,
	persistBuildWorkspaceState,
	recordRecentBuildBlock,
	resolveSelectedBuildBlock,
	serializeBuildWorkspaceState,
	selectBuildPaletteSlot,
	selectBuildWorkspaceBlock,
	subscribeBuildWorkspaceState,
	type BuildWorkspaceState
} from './build/build-workspace';
import { BlockBreakingSystem } from './interaction/BlockBreakingSystem';
import { BlockPlacementSystem } from './interaction/BlockPlacementSystem';
import { CreationRaycaster } from './interaction/CreationRaycaster';
import { CreationRemovalSystem } from './interaction/CreationRemovalSystem';
import type { BuildTarget } from './interaction/BuildTarget';
import { Hotbar } from './inventory/Hotbar';
import { Inventory } from './inventory/Inventory';
import { ItemRegistry } from './inventory/ItemRegistry';
import { BuildCursor } from './input/BuildCursor';
import { KeyboardInput, type MovementInput } from './input/KeyboardInput';
import { MouseInput } from './input/MouseInput';
import { PointerLockController } from './input/PointerLockController';
import { GamePersistence } from './persistence/GamePersistence';
import { WorldSyncService } from './persistence/WorldSyncService';
import { PlayerAvatar } from './player/PlayerAvatar';
import { PlayerController } from './player/PlayerController';
import { GameRenderer } from './rendering/GameRenderer';
import { Sky } from './rendering/Sky';
import type { WorldDayAnnouncement } from './environment/time/WorldDate';
import { BlockRegistry } from './world/BlockRegistry';
import { VegetationRemovalState } from './vegetation/VegetationRemovalState';
import { ChunkStreamingSystem } from './world/ChunkStreamingSystem';
import {
	FlatWorldSession,
	PlanetWorldSession,
	type ActiveWorldSession
} from './world/ActiveWorldSession';
import { PlanetCoordinateSystem } from './planet/PlanetCoordinateSystem';
import { PlanetGeographyQuery } from './geography/PlanetGeographyQuery';
import { CountryResolver } from './geography/countries/CountryResolver';
import { PlanetEcologyQuery } from './geography/ecology/PlanetEcologyQuery';
import { PlanetSurfaceContextResolver } from './geography/ecology/PlanetSurfaceContextResolver';
import { PlanetSurfaceSpawnResolver } from './planet/surface/PlanetSurfaceSpawnResolver';
import type { PlanetTravelRequest } from './planet/surface/PlanetTravelRequest';
import type { TravelPlan } from './world/travel/TravelPlan';
import { createTravelPlan } from './world/travel/TravelPlan';
import type { WorldLocation } from './world/geography/WorldLocation';
import { LocalWaterSystem, type LocalWaterDebugApi } from './world/water';
import { CivilizationInteractionSystem } from './world/civilization/CivilizationInteractionSystem';
import { nextWardrobeOutfit } from './world/civilization/OutfitWardrobe';
import { CivilizationRadioAudio } from './world/civilization/CivilizationRadioAudio';
import { UrbanPowerSystem } from './world/civilization/UrbanPowerSystem';
import { UrbanElevatorSystem } from './world/civilization/UrbanElevatorSystem';
import { buildingAtWorld } from './world/civilization/UrbanBuildingRegistry';
import { HumanConditionSystem, sampleHumanExposure, type HumanConditionDebugApi } from './human';
import {
	STARTER_WORLD_SEED,
	WORLD_MAX_Y,
	WORLD_MIN_Y,
	type BlockCoordinate,
	type BlockType,
	worldToChunk
} from './world/voxel-types';

const CHUNK_RENDER_INTERVAL_MS = 120;
const SNAPSHOT_INTERVAL_MS = 100;
const AVATAR_METRICS_INTERVAL_MS = 250;
const AUTO_SAVE_INTERVAL_MS = 1500;
const BACKEND_SYNC_INTERVAL_MS = 5000;

export class GameEngine {
	private readonly renderer: GameRenderer;
	private readonly sky: Sky;
	private activeSession: ActiveWorldSession;
	private world;
	private localWater: LocalWaterSystem;
	private readonly human: HumanConditionSystem;
	private readonly chunkStreaming: ChunkStreamingSystem;
	private player: PlayerController;
	private readonly keyboard: KeyboardInput;
	private readonly mouse: MouseInput;
	private readonly buildCursor = new BuildCursor();
	private readonly pointerLock: PointerLockController;
	private readonly inventory = new Inventory();
	private readonly hotbar = new Hotbar();
	private readonly vegetationRemovals = new VegetationRemovalState();
	private readonly raycaster: CreationRaycaster;
	private placementSystem: BlockPlacementSystem;
	private civilizationInteractions: CivilizationInteractionSystem;
	private readonly civilizationRadioAudio = new CivilizationRadioAudio();
	private urbanPower: UrbanPowerSystem;
	private urbanElevator: UrbanElevatorSystem;
	private elevatorPanelOpen = false;
	private breakingSystem: BlockBreakingSystem;
	private removalSystem: CreationRemovalSystem;
	private readonly loop: GameLoop;
	private persistence: GamePersistence;
	private readonly avatar: PlayerAvatar;
	private readonly worldSync = new WorldSyncService();
	private readonly resizeObserver: ResizeObserver;
	private readonly handleVisibility = (): void => {
		if (document.hidden) {
			void this.persistence.save(true);
		}
	};
	private readonly handleBeforeUnload = (): void => {
		void this.persistence.save(true);
	};

	private status: GameStatus = 'booting';
	private saveStatus: SaveStatus = 'idle';
	private target: BuildTarget | null = null;
	private blockTarget: TargetedBlock | null = null;
	private message: string | null = null;
	private error: string | null = null;
	private needsWorldRebuild = true;
	private lastBackendSync = 0;
	private lastBackendPosition = new Vector3(Number.POSITIVE_INFINITY, 0, 0);
	private lastAutoSaveAttempt = 0;
	private lastSnapshotAt = 0;
	private lastSnapshotKey = '';
	private lastAvatarMetricsAt = Number.NEGATIVE_INFINITY;
	private lastWorldRebuildAt = Number.NEGATIVE_INFINITY;
	private startPromise: Promise<void> | null = null;
	private destroyed = false;
	private travelling = false;
	private readonly planetSessions = new Map<string, PlanetWorldSession>();
	private currentGeographicLocation: import('./game-types').GeographicLocationSnapshot | null =
		null;
	private travelPlan: TravelPlan | null = null;
	private lastMiniMapAt = Number.NEGATIVE_INFINITY;
	private miniMap: import('./game-types').MiniMapSnapshot = {
		size: 9,
		cells: [],
		playerYaw: 0,
		northRadians: 0,
		zoneName: 'Loading'
	};
	private mobileLimited = false;
	private buildMode = false;
	private selectedBuildBlock: BlockType | null = null;
	private buildWorkspace: BuildWorkspaceState = createBuildWorkspaceState();
	private buildWorkspaceUnsubscribe: (() => void) | null = null;
	private readonly validBuildTypes = new Set<BlockType>(
		BlockRegistry.all()
			.filter((definition) => definition.placeable && definition.type !== 'air')
			.map((definition) => definition.type)
	);
	private readonly creativeBuild = true;
	private introVisible = true;
	private lastObservedWorldDayNumber = 0;
	private dayAnnouncement: WorldDayAnnouncement | null = null;
	private dayAnnouncementExpiresAt = 0;
	private readonly interactionPoint = new Vector3();
	private diagnosticsWindowStartedAt = performance.now();
	private diagnosticsFrameCount = 0;
	private diagnosticsCallbacks = 0;
	private diagnosticsBackendCalls = 0;
	private diagnosticsHudUpdates = 0;
	private diagnostics: GameDiagnosticsSnapshot = {
		startCount: 0,
		activeLoops: 0,
		fps: 0,
		frameTimeMs: 0,
		physicsMs: 0,
		collisionCells: 0,
		cameraMs: 0,
		renderMs: 0,
		svelteCallbacksPerSecond: 0,
		backendCallsPerSecond: 0,
		hudUpdatesPerSecond: 0,
		chunksActive: 0,
		threeObjects: 0,
		drawCalls: 0,
		triangles: 0,
		worldRebuilds: 0,
		chunkRefreshes: 0,
		avatarUpdateMs: 0,
		avatarObjects: 0,
		avatarTriangles: 0,
		avatarDrawCalls: 0,
		avatarSkinnedMeshes: 0,
		avatarMaterials: 0,
		avatarBones: 0,
		avatarModelSource: 'loading',
		avatarAnimationClips: 0,
		avatarRetargetedClipCount: 0,
		avatarTargetSkeletonBoneCount: 0,
		avatarReady: false,
		avatarCurrentAnimation: 'idle',
		avatarError: null,
		avatarPreviousAnimation: null,
		avatarMixerTime: 0,
		avatarActionTime: 0,
		avatarActionWeight: 0,
		avatarActiveActionCount: 0,
		locomotionCameraYaw: 0,
		locomotionBodyYaw: 0,
		locomotionDesiredMovementYaw: 0,
		locomotionHeadYaw: 0,
		locomotionLocalForwardSpeed: 0,
		locomotionLocalSideSpeed: 0,
		locomotionVerticalSpeed: 0,
		locomotionGrounded: false,
		locomotionStepActive: false,
		locomotionStepHeight: 0,
		locomotionLeadingFoot: null,
		locomotionMouseLookActive: false,
		locomotionCameraRecentering: false,
		avatarTotalTrackCount: 0,
		avatarMatchedTrackCount: 0,
		avatarUnmatchedTrackCount: 0,
		avatarHipsBoneName: '',
		avatarLeftUpperLegBoneName: '',
		avatarRightUpperLegBoneName: '',
		avatarLeftHandBoneName: '',
		avatarRightHandBoneName: '',
		avatarHipsQuaternion: [0, 0, 0, 1],
		avatarLeftUpperLegQuaternion: [0, 0, 0, 1],
		avatarRightUpperLegQuaternion: [0, 0, 0, 1],
		avatarLeftHandQuaternion: [0, 0, 0, 1],
		avatarRightHandQuaternion: [0, 0, 0, 1]
	};

	constructor(private readonly options: GameEngineOptions) {
		this.activeSession = new FlatWorldSession(options.seed || STARTER_WORLD_SEED);
		this.world = this.activeSession.world;
		this.chunkStreaming = new ChunkStreamingSystem({
			visibleRadius: 2,
			retainRadius: 3,
			maxLoadsPerUpdate: 1,
			maxUnloadsPerUpdate: 2,
			timeBudgetMs: 3,
			loadChunk: (chunk) => this.world.loadChunk(chunk),
			unloadChunk: (chunk) => this.world.unloadChunk(chunk)
		});
		const quality = options.quality ?? 'medium';

		this.renderer = new GameRenderer(options.canvas, quality, this.vegetationRemovals);
		this.raycaster = new CreationRaycaster(this.renderer.vegetationInteractions, 8);
		this.sky = new Sky(this.renderer.scene, {
			renderer: this.renderer.renderer,
			seed: options.seed || STARTER_WORLD_SEED,
			quality,
			worldQuery: {
				surfaceHeightAt: (x, z, maxY) => this.weatherSurfaceHeightAt(x, z, maxY),
				rainOcclusionAt: (x, y, z) => this.weatherRainOcclusionAt(x, y, z),
				opennessAt: (x, y, z) => this.weatherOpennessAt(x, y, z),
				climateZoneAt: (x, z) => this.world.terrainGenerator.zoneAt(x, z)
			}
		});
		if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
			(
				globalThis as typeof globalThis & {
					__ORELUNZA_WEATHER__?: ReturnType<Sky['createDebugApi']>;
				}
			).__ORELUNZA_WEATHER__ = this.sky.createDebugApi();
		}
		this.keyboard = new KeyboardInput(window);
		this.mouse = new MouseInput(options.canvas);
		this.pointerLock = new PointerLockController(options.canvas, () => this.emitSnapshot());
		const spawn = this.findSafeSpawn();
		const bounds = options.canvas.getBoundingClientRect();
		this.player = new PlayerController(
			this.world,
			options.playerId,
			options.worldId,
			spawn,
			Math.max(1, bounds.width) / Math.max(1, bounds.height)
		);
		this.localWater = new LocalWaterSystem(this.world);
		this.human = new HumanConditionSystem();
		this.civilizationInteractions = new CivilizationInteractionSystem(this.world, this.inventory);
		this.urbanPower = new UrbanPowerSystem(this.world);
		this.urbanElevator = new UrbanElevatorSystem(this.world, this.urbanPower);
		this.placementSystem = new BlockPlacementSystem(
			this.world,
			this.inventory,
			this.player.state,
			this.player.physics.collider,
			(position) => this.markBlockChanged(position)
		);
		this.breakingSystem = new BlockBreakingSystem(this.world, this.inventory, (position) =>
			this.markBlockChanged(position)
		);
		this.avatar = new PlayerAvatar(options.appearance, {
			groundHeightAt: (x, z) => this.world.terrainGenerator.heightAt(x, z)
		});
		this.renderer.scene.add(this.avatar.object);
		this.recordAvatarMetrics();
		this.persistence = new GamePersistence(
			options.worldId,
			options.seed,
			this.world,
			this.player,
			this.inventory,
			options.appearance,
			(status) => {
				this.saveStatus = status;
				this.emitSnapshot();
			}
		);
		this.persistence.setEnvironment(this.sky);
		this.persistence.setLocalWater(this.localWater);
		this.persistence.setHumanCondition(this.human);
		this.persistence.setUrbanElevator(this.urbanElevator);
		this.persistence.setVegetationRemovals(this.vegetationRemovals);
		if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
			const debugGlobal = globalThis as typeof globalThis & {
				__ORELUNZA_WATER__?: LocalWaterDebugApi;
				__ORELUNZA_HUMAN__?: HumanConditionDebugApi;
			};
			debugGlobal.__ORELUNZA_WATER__ = this.localWater.createDebugApi();
			debugGlobal.__ORELUNZA_HUMAN__ = this.human.createDebugApi();
		}
		this.removalSystem = new CreationRemovalSystem(
			this.world,
			this.breakingSystem,
			this.renderer,
			() => {
				this.diagnostics.chunkRefreshes += 1;
				this.persistence.markDirty();
			}
		);
		this.loop = new GameLoop({
			update: (delta) => this.update(delta),
			render: () => this.render()
		});
		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(options.canvas);
		document.addEventListener('visibilitychange', this.handleVisibility);
		window.addEventListener('beforeunload', this.handleBeforeUnload);
		this.mobileLimited = matchMedia('(pointer: coarse)').matches;
	}

	async start(): Promise<void> {
		if (this.startPromise) {
			return this.startPromise;
		}

		this.startPromise = this.startInternal();

		return this.startPromise;
	}

	private async startInternal(): Promise<void> {
		if (this.destroyed) {
			return;
		}

		this.diagnostics.startCount += 1;
		this.status = 'loading-world';
		this.emitSnapshot();

		try {
			await this.persistence.load();
			await this.avatar.updateAppearance(this.options.appearance);
			this.lastObservedWorldDayNumber = this.sky.worldTime.dayNumber;
			this.dayAnnouncement = null;
			this.restoreBuildWorkspace();
			this.recordAvatarMetrics();

			this.world.loadChunk(worldToChunk(this.player.state.position));
			this.chunkStreaming.synchronizeLoaded(this.world.getLoadedChunks());
			this.localWater.activate(this.player.state.position);
			for (const position of this.urbanElevator.initialize()) this.refreshBlockRendering(position);

			this.renderer.rebuildWorld(this.world);
			this.diagnostics.worldRebuilds += 1;
			this.lastWorldRebuildAt = performance.now();
			this.needsWorldRebuild = false;
			this.status = 'playing';
			this.emitSnapshot();
			this.loop.start();
			if (this.options.homeLocation && this.activeSession instanceof FlatWorldSession) {
				this.status = 'world-map';
				await this.travelToPlanet({
					coordinate: {
						latitudeRadians: (this.options.homeLocation.latitude * Math.PI) / 180,
						longitudeRadians: (this.options.homeLocation.longitude * Math.PI) / 180,
						altitudeMeters: this.options.homeLocation.elevationMeters
					},
					elevationMeters: this.options.homeLocation.elevationMeters,
					countryId: this.options.homeLocation.countryId,
					countryName: this.options.homeLocation.countryName,
					settlementId: this.options.homeLocation.settlementId,
					settlementName: this.options.homeLocation.settlementName
				});
			}
			this.diagnostics.activeLoops = this.loop.isRunning ? 1 : 0;
			this.emitSnapshot();
		} catch (error) {
			this.status = 'error';
			this.error = error instanceof Error ? error.message : 'Unable to open the game world.';
			this.emitSnapshot();
			this.options.onError?.(error instanceof Error ? error : new Error(this.error));
		}
	}

	pause(): void {
		if (this.status === 'destroyed') {
			return;
		}

		this.status = 'paused';
		this.pointerLock.exit();
		void this.persistence.save(true);
		this.emitSnapshot();
	}

	resume(): void {
		if (this.status !== 'paused' && this.status !== 'inventory') {
			return;
		}

		this.status = 'playing';
		this.pointerLock.request();
		this.emitSnapshot();
	}

	openInventory(): void {
		if (this.status === 'destroyed') {
			return;
		}

		this.status = 'inventory';
		this.pointerLock.exit();
		this.emitSnapshot();
	}

	closeInventory(): void {
		if (this.status !== 'inventory') {
			return;
		}

		this.status = 'playing';
		this.emitSnapshot();
	}

	openCalendar(): void {
		if (this.status !== 'playing') {
			return;
		}

		this.status = 'calendar';
		this.pointerLock.exit();
		this.emitSnapshot();
	}

	closeCalendar(): void {
		if (this.status !== 'calendar') {
			return;
		}

		this.status = 'playing';
		this.pointerLock.request();
		this.emitSnapshot();
	}

	openElevatorPanel(): void {
		if (this.status !== 'playing' || !this.human.canAct) return;
		const elevator = this.urbanElevator.snapshotFor(this.player.state);
		if (!elevator.playerInside || elevator.phase !== 'idle') {
			this.message = 'Enter the stopped elevator first';
			return;
		}
		this.elevatorPanelOpen = true;
		this.status = 'elevator';
		this.pointerLock.exit();
		this.emitSnapshot();
	}

	closeElevatorPanel(): void {
		if (this.status !== 'elevator') return;
		this.elevatorPanelOpen = false;
		this.status = 'playing';
		this.pointerLock.request();
		this.emitSnapshot();
	}

	selectElevatorFloor(floor: number): boolean {
		if (this.status !== 'elevator') return false;
		const result = this.urbanElevator.selectFloor(floor, this.player.state);
		for (const position of result.changed) this.refreshBlockRendering(position);
		this.message = result.message;
		if (result.handled && result.message.startsWith('Elevator →')) {
			this.elevatorPanelOpen = false;
			this.status = 'playing';
			this.pointerLock.request();
		}
		this.emitSnapshot();
		return result.handled;
	}

	enterBuildMode(): void {
		if (this.status !== 'playing' || this.buildMode) {
			return;
		}

		this.buildMode = true;
		this.buildCursor.reset();
		this.avatar.setBuildMode(true);
		this.player.camera.setShoulderFraming('build');
		this.restoreBuildSelection();
		this.message = this.selectedBuildBlock
			? 'Build Mode — C: blocks · R: center cursor · B: exit'
			: 'Build Mode — C: choose a block · R: center cursor · B: exit';
		this.emitSnapshot();
	}

	openBuildCatalog(): void {
		if (this.status !== 'playing') {
			return;
		}

		if (!this.buildMode) {
			this.message = 'Press B to enter Build Mode';
			this.emitSnapshot();
			return;
		}

		this.status = 'build-catalog';
		this.target = null;
		this.blockTarget = null;
		this.renderer.setSelection(null);
		this.renderer.setVegetationSelection(null);
		this.renderer.setPlacementPreview(null);
		this.updateBuildCursorElement(false, null, null);
		this.pointerLock.exit();
		this.message = 'Choose a block';
		this.emitSnapshot();
	}

	closeBuildCatalog(): void {
		if (this.status !== 'build-catalog') {
			return;
		}

		this.status = 'playing';
		this.pointerLock.request();
		this.message = this.buildMode
			? 'Build Mode — C: blocks · R: center cursor · B: exit'
			: 'Exploration Mode';
		this.emitSnapshot();
	}

	selectBuildBlock(type: BlockType): boolean {
		const definition = BlockRegistry.get(type);

		if (type === 'air' || !definition.placeable) {
			return false;
		}

		this.setBuildWorkspace(
			recordRecentBuildBlock(selectBuildWorkspaceBlock(this.buildWorkspace, type), type)
		);
		this.buildMode = true;
		this.avatar.setBuildMode(true);
		this.target = null;
		this.blockTarget = null;
		this.renderer.setSelection(null);
		this.renderer.setVegetationSelection(null);
		this.player.camera.setShoulderFraming('build');

		// Choosing a block finishes catalog interaction.
		// The next click must happen in the world and place the selected block.
		if (this.status === 'build-catalog') {
			this.status = 'playing';
			this.pointerLock.request();
		}

		this.message = `Selected ${definition.label} — click the world to place`;
		this.emitSnapshot();

		return true;
	}

	exitBuildMode(): void {
		if (this.status === 'destroyed') {
			return;
		}

		this.buildMode = false;
		this.avatar.setBuildMode(false);
		this.target = null;
		this.blockTarget = null;
		this.player.camera.setShoulderFraming('explore');
		this.renderer.setSelection(null);
		this.renderer.setVegetationSelection(null);
		this.renderer.setPlacementPreview(null);
		this.updateBuildCursorElement(false, null, null);

		if (this.status === 'build-catalog') {
			this.status = 'playing';
			this.pointerLock.request();
		}

		this.message = 'Exploration Mode';
		this.emitSnapshot();
	}

	selectHotbar(index: number): void {
		if (this.buildMode) {
			this.selectBuildPaletteIndex(index);
		} else {
			this.hotbar.select(index);
		}

		this.emitSnapshot();
	}

	useInventorySlot(index: number): boolean {
		if (this.status !== 'inventory' || !this.human.canAct) return false;
		const stack = this.inventory.getSelectedStack(index);
		if (!stack) return false;
		const item = ItemRegistry.get(stack.type);
		if (!item.consumable) {
			this.message = `${item.label} cannot be consumed`;
			this.emitSnapshot();
			return false;
		}
		if (item.consumable.nutrition > 0) {
			this.human.consumeFood(item.consumable.nutrition, item.consumable.contamination);
		}
		if (item.consumable.hydration > 0) {
			this.human.drinkWater(item.consumable.hydration, item.consumable.contamination);
		}
		this.inventory.removeItem(stack.type, 1);
		this.persistence.markDirty();
		this.message = `Used ${item.label}`;
		this.emitSnapshot();
		return true;
	}

	async saveNow(): Promise<void> {
		await this.persistence.save(true);
		this.emitSnapshot();
	}

	respawn(): boolean {
		if (this.status === 'destroyed' || !this.human.respawn()) {
			return false;
		}

		if (this.buildMode) {
			this.exitBuildMode();
		}
		const spawn = this.findSafeSpawn();
		this.player.setTransform(spawn, this.player.state.cameraYaw, this.player.state.pitch);
		this.avatar.reset(this.player.state.bodyYaw);
		this.world.loadChunk(worldToChunk(spawn));
		this.chunkStreaming.synchronizeLoaded(this.world.getLoadedChunks());
		this.localWater.activate(spawn);
		this.renderer.rebuildWorld(this.world);
		this.diagnostics.worldRebuilds += 1;
		this.lastWorldRebuildAt = performance.now();
		this.needsWorldRebuild = false;
		this.lastBackendSync = 0;
		this.lastBackendPosition.set(Number.POSITIVE_INFINITY, 0, 0);
		this.message = 'Respawned safely — click the world to continue';
		this.persistence.markDirty();
		this.emitSnapshot();
		return true;
	}

	openWorldMap(): void {
		if (this.status !== 'playing' && this.status !== 'paused') return;
		this.status = 'world-map';
		this.pointerLock.exit();
		this.emitSnapshot();
	}

	openGlobe(): void {
		if (this.status !== 'playing' && this.status !== 'world-map' && this.status !== 'paused')
			return;
		this.status = 'globe';
		this.pointerLock.exit();
		this.emitSnapshot();
	}

	planRoute(request: PlanetTravelRequest): void {
		if (this.status !== 'globe') return;
		const origin = this.worldLocation();
		const destination: WorldLocation = {
			countryId: request.countryId ?? 'unknown',
			countryName: request.countryName ?? 'Unknown',
			settlementId: request.settlementId ?? 'surface',
			settlementName: request.settlementName ?? 'Destination',
			latitude: (request.coordinate.latitudeRadians * 180) / Math.PI,
			longitude: (request.coordinate.longitudeRadians * 180) / Math.PI,
			elevationMeters: request.elevationMeters,
			worldAnchorId: request.settlementId ?? 'surface',
			biomeName: request.biomeName
		};
		this.travelPlan = createTravelPlan(origin, destination, request.totalDistanceKm ?? 0);
		this.status = 'world-map';
		this.emitSnapshot();
	}

	closeWorldMap(): void {
		if (this.status !== 'world-map' && this.status !== 'globe') return;
		this.status = 'playing';
		this.pointerLock.request();
		this.emitSnapshot();
	}

	async travelToPlanet(request: PlanetTravelRequest): Promise<void> {
		if (this.travelling || (this.status !== 'world-map' && this.status !== 'globe')) return;
		this.travelling = true;
		this.status = 'travelling';
		this.error = null;
		this.pointerLock.exit();
		this.emitSnapshot();
		const previousSession = this.activeSession;
		const previousWorld = this.world;
		const origin = this.worldLocation();
		const destinationLocation: WorldLocation = {
			countryId: request.countryId ?? 'unknown',
			countryName: request.countryName ?? 'Unknown',
			settlementId: request.settlementId ?? 'surface',
			settlementName: request.settlementName ?? 'Destination',
			latitude: (request.coordinate.latitudeRadians * 180) / Math.PI,
			longitude: (request.coordinate.longitudeRadians * 180) / Math.PI,
			elevationMeters: request.elevationMeters,
			worldAnchorId: request.settlementId ?? 'surface',
			biomeName: request.biomeName
		};
		this.travelPlan = createTravelPlan(origin, destinationLocation, request.totalDistanceKm ?? 0);
		this.travelPlan.status = 'active';
		try {
			await this.persistence.save(true);
			const coordinateSystem = new PlanetCoordinateSystem();
			const geography = new PlanetGeographyQuery();
			const countries = new CountryResolver();
			const ecology = new PlanetEcologyQuery();
			try {
				const resolver = new PlanetSurfaceSpawnResolver(
					coordinateSystem,
					geography,
					new PlanetSurfaceContextResolver(countries, ecology)
				);
				const prepared = await resolver.resolve({
					...request.coordinate,
					altitudeMeters: request.elevationMeters
				});
				let next = this.planetSessions.get(prepared.coordinates.anchor.id);
				if (!next) {
					next = new PlanetWorldSession(prepared, request);
					this.planetSessions.set(prepared.coordinates.anchor.id, next);
				}
				await this.activateWorldSession(next, next.region.spawnPosition);
				this.currentGeographicLocation = this.geographicLocationFor(next);
				if (this.travelPlan) {
					this.travelPlan.travelledDistanceKm = this.travelPlan.totalDistanceKm;
					this.travelPlan.remainingDistanceKm = 0;
					this.travelPlan.progress = 1;
					this.travelPlan.status = 'completed';
				}
				this.status = 'playing';
				this.message = `Travelled to ${request.countryName ?? next.region.ecology.zoneName}`;
				this.emitSnapshot();
			} finally {
				geography.dispose();
				countries.dispose();
				ecology.dispose();
			}
		} catch (cause) {
			this.activeSession = previousSession;
			this.world = previousWorld;
			this.status = 'world-map';
			this.error = cause instanceof Error ? cause.message : 'Unable to travel to that destination.';
			if (this.travelPlan) this.travelPlan.status = 'blocked';
			this.emitSnapshot();
			throw cause;
		} finally {
			this.travelling = false;
		}
	}

	private async activateWorldSession(session: ActiveWorldSession, spawn: Vector3): Promise<void> {
		this.activeSession = session;
		this.world = session.world;
		const bounds = this.options.canvas.getBoundingClientRect();
		const previous = this.player.state;
		this.player = new PlayerController(
			this.world,
			this.options.playerId,
			this.options.worldId,
			spawn,
			Math.max(1, bounds.width) / Math.max(1, bounds.height)
		);
		this.player.setTransform(spawn, previous.yaw, previous.pitch);
		this.localWater = new LocalWaterSystem(this.world);
		this.civilizationInteractions = new CivilizationInteractionSystem(this.world, this.inventory);
		this.urbanPower = new UrbanPowerSystem(this.world);
		this.urbanElevator = new UrbanElevatorSystem(this.world, this.urbanPower);
		this.placementSystem = new BlockPlacementSystem(
			this.world,
			this.inventory,
			this.player.state,
			this.player.physics.collider,
			(position) => this.markBlockChanged(position)
		);
		this.breakingSystem = new BlockBreakingSystem(this.world, this.inventory, (position) =>
			this.markBlockChanged(position)
		);
		this.removalSystem = new CreationRemovalSystem(
			this.world,
			this.breakingSystem,
			this.renderer,
			() => {
				this.diagnostics.chunkRefreshes += 1;
				this.persistence.markDirty();
			}
		);
		this.persistence = this.createPersistence(session);
		await this.persistence.load();
		this.world.loadChunk(worldToChunk(spawn));
		this.chunkStreaming.synchronizeLoaded(this.world.getLoadedChunks());
		this.renderer.rebuildWorld(this.world);
		this.needsWorldRebuild = false;
	}

	private createPersistence(session: ActiveWorldSession): GamePersistence {
		const suffix =
			session instanceof PlanetWorldSession ? `:${session.region.coordinates.anchor.id}` : '';
		const persistence = new GamePersistence(
			`${this.options.worldId}${suffix}`,
			this.options.seed,
			this.world,
			this.player,
			this.inventory,
			this.options.appearance,
			(status) => {
				this.saveStatus = status;
				this.emitSnapshot();
			}
		);
		persistence.setEnvironment(this.sky);
		persistence.setLocalWater(this.localWater);
		persistence.setHumanCondition(this.human);
		persistence.setUrbanElevator(this.urbanElevator);
		persistence.setRoutePlan({
			get: () => this.travelPlan,
			restore: (plan) => {
				this.travelPlan = plan ?? null;
			}
		});
		persistence.setVegetationRemovals(this.vegetationRemovals);
		if (session instanceof PlanetWorldSession) persistence.setPlanetSurface(session.session);
		return persistence;
	}

	private geographicLocationFor(
		session: PlanetWorldSession
	): import('./game-types').GeographicLocationSnapshot {
		const position = this.player.state.position;
		const coordinate = session.session.updatePlayerLocalPosition(
			new Vector3(position.x, position.y, position.z)
		).geodetic;
		return {
			latitude: (coordinate.latitudeRadians * 180) / Math.PI,
			longitude: (coordinate.longitudeRadians * 180) / Math.PI,
			elevationMeters: coordinate.altitudeMeters,
			countryName: session.request.countryName ?? session.region.ecology.country?.name ?? null,
			biomeName: session.request.biomeName ?? session.region.ecology.biomeLabel,
			settlementId: session.request.settlementId ?? session.region.coordinates.anchor.id,
			settlementName: session.request.settlementName ?? session.region.ecology.zoneName
		};
	}

	private worldLocation(): WorldLocation {
		const current = this.currentGeographicLocation;
		return {
			countryId: current?.countryName ?? 'local',
			countryName: current?.countryName ?? this.options.regionName,
			settlementId: current?.settlementId ?? 'local-flat',
			settlementName: current?.settlementName ?? this.options.regionName,
			latitude: current?.latitude ?? 0,
			longitude: current?.longitude ?? 0,
			elevationMeters: current?.elevationMeters ?? 0,
			worldAnchorId: current?.settlementId ?? 'local-flat',
			biomeName: current?.biomeName
		};
	}

	destroy(): void {
		if (this.destroyed) {
			return;
		}

		this.destroyed = true;
		this.status = 'destroyed';
		this.loop.stop();
		this.diagnostics.activeLoops = 0;
		void this.persistence.save(true);
		this.resizeObserver.disconnect();
		document.removeEventListener('visibilitychange', this.handleVisibility);
		window.removeEventListener('beforeunload', this.handleBeforeUnload);
		this.buildWorkspaceUnsubscribe?.();
		this.buildWorkspaceUnsubscribe = null;
		this.keyboard.destroy();
		this.mouse.destroy();
		this.pointerLock.destroy();
		this.updateBuildCursorElement(false, null, null);
		this.avatar.dispose();
		this.chunkStreaming.dispose();
		if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
			const debugGlobal = globalThis as typeof globalThis & {
				__ORELUNZA_WEATHER__?: ReturnType<Sky['createDebugApi']>;
				__ORELUNZA_WATER__?: LocalWaterDebugApi;
				__ORELUNZA_HUMAN__?: HumanConditionDebugApi;
			};
			delete debugGlobal.__ORELUNZA_WEATHER__;
			delete debugGlobal.__ORELUNZA_WATER__;
			delete debugGlobal.__ORELUNZA_HUMAN__;
		}
		this.localWater.dispose();
		for (const session of this.planetSessions.values()) session.dispose();
		this.activeSession.dispose();
		this.civilizationRadioAudio.dispose();
		this.sky.dispose();
		this.renderer.dispose();
		this.emitSnapshot();
	}

	private update(deltaSeconds: number): void {
		const frameStartedAt = performance.now();
		const commands = this.keyboard.consumeCommands();

		if (commands.respawn && this.human.snapshot.lifeState === 'dead') {
			this.respawn();
		}

		if (commands.pause) {
			if (this.status === 'playing') {
				this.pause();
			} else if (this.status === 'build-catalog') {
				this.closeBuildCatalog();
			} else if (this.status === 'calendar') {
				this.closeCalendar();
			} else if (this.status === 'elevator') {
				this.closeElevatorPanel();
			} else {
				this.resume();
			}
		}

		if (commands.calendar && this.human.canAct) {
			if (this.status === 'calendar') {
				this.closeCalendar();
			} else if (this.status === 'playing') {
				this.openCalendar();
			}
		}

		if (commands.sleep && this.status === 'playing' && this.human.canAct) {
			this.human.requestSleepToggle();
			this.persistence.markDirty();
		}

		if (commands.inventory && this.status === 'playing' && this.human.canAct) {
			this.openInventory();
		}

		if (commands.build && this.human.canAct) {
			if (this.status === 'build-catalog') {
				this.closeBuildCatalog();
				this.exitBuildMode();
			} else if (this.status === 'playing') {
				if (this.buildMode) {
					this.exitBuildMode();
				} else {
					this.enterBuildMode();
				}
			}
		}

		if (commands.catalog && this.human.canAct) {
			if (this.status === 'build-catalog') {
				this.closeBuildCatalog();
			} else if (this.status === 'playing') {
				this.openBuildCatalog();
			}
		}

		if (commands.recenterBuildCursor && this.status === 'playing' && this.buildMode) {
			this.buildCursor.reset();
		}

		if (commands.hotbarIndex !== null && this.human.canAct) {
			if (this.buildMode) {
				this.selectBuildPaletteIndex(commands.hotbarIndex);
			} else {
				this.hotbar.select(commands.hotbarIndex);
			}
		}

		const wheel = this.mouse.consumeWheel();

		if (wheel !== 0) {
			if (this.status === 'playing' && this.buildMode) {
				this.setBuildWorkspace(cycleBuildPaletteSlot(this.buildWorkspace, wheel));
			} else if (this.status === 'playing' && this.human.canAct) {
				this.player.camera.applyZoom(wheel);
			}
		}

		let humanMovement: MovementInput = { forward: 0, right: 0, jump: false, sprint: false };
		const elevatorBefore = this.urbanElevator.snapshotFor(this.player.state);
		const elevatorCarryingPlayer =
			elevatorBefore.playerInside &&
			(elevatorBefore.phase === 'moving' || elevatorBefore.phase === 'stopped');
		if (this.status === 'playing' && this.pointerLock.isLocked) {
			const mouseDelta = this.mouse.consumeDelta();
			const cameraDelta = this.buildMode
				? this.buildCursor.move(
						mouseDelta,
						this.options.canvas.clientWidth,
						this.options.canvas.clientHeight
					).cameraDelta
				: mouseDelta;

			if (this.human.canAct) {
				this.player.applyMouse(cameraDelta);
			}
			const requestedMovement = this.keyboard.getMovement();
			humanMovement =
				this.human.canAct && !elevatorCarryingPlayer
					? { ...requestedMovement, sprint: requestedMovement.sprint && this.human.canSprint }
					: { forward: 0, right: 0, jump: false, sprint: false };
			const physicsStartedAt = performance.now();
			if (!elevatorCarryingPlayer) this.player.step(humanMovement, deltaSeconds);
			this.diagnostics.physicsMs = performance.now() - physicsStartedAt;
			this.diagnostics.collisionCells = this.player.physics.collider.lastCellsTested;
			this.diagnostics.cameraMs = this.player.camera.lastUpdateMs;
			this.introVisible = false;
			this.syncBackendPosition();
		} else {
			this.mouse.consumeDelta();
			this.diagnostics.physicsMs = 0;
			this.diagnostics.collisionCells = 0;
			this.diagnostics.cameraMs = 0;
		}

		for (const position of this.urbanElevator.update(deltaSeconds, this.player.state)) {
			this.refreshBlockRendering(position);
		}
		const elevatorAfter = this.urbanElevator.snapshotFor(this.player.state);
		if (
			elevatorBefore.phase !== 'idle' &&
			elevatorAfter.phase === 'idle' &&
			elevatorAfter.currentFloor !== elevatorBefore.currentFloor
		) {
			this.persistence.markDirty();
		}
		if (elevatorCarryingPlayer) this.player.updateCamera(deltaSeconds);

		if (this.chunkStreaming.update(this.player.state.position)) {
			const changes = this.chunkStreaming.lastChanges;

			this.renderer.applyStreamingChanges(this.world, changes);
			this.diagnostics.chunkRefreshes += changes.loaded.length + changes.unloaded.length;
		}

		// Full rebuilds are now reserved for rare global edits such as block
		// placement/removal. Chunk streaming is rendered incrementally above.
		const shouldRebuildWorld =
			this.needsWorldRebuild &&
			frameStartedAt - this.lastWorldRebuildAt >= CHUNK_RENDER_INTERVAL_MS;

		if (shouldRebuildWorld) {
			this.renderer.rebuildWorld(this.world);
			this.diagnostics.worldRebuilds += 1;
			this.lastWorldRebuildAt = frameStartedAt;
			this.needsWorldRebuild = false;
		}

		if (this.status === 'playing' && this.human.canAct) {
			const movementActive = Math.hypot(humanMovement.forward, humanMovement.right) > 0.05;
			const movementYaw = this.player.state.desiredMovementYaw;
			for (const position of this.civilizationInteractions.updateAutomaticDoors(
				this.player.state.position,
				{
					moving: movementActive,
					directionX: Math.sin(movementYaw),
					directionZ: Math.cos(movementYaw)
				}
			)) {
				this.refreshBlockRendering(position);
			}
		}

		const canTargetCreation =
			this.status === 'playing' && this.human.canAct && this.buildMode && this.pointerLock.isLocked;
		const canTargetInteraction =
			this.status === 'playing' &&
			this.human.canAct &&
			!this.buildMode &&
			this.pointerLock.isLocked;
		const raycastResult =
			canTargetCreation || canTargetInteraction
				? this.raycaster.raycast(
						this.player.camera.camera,
						this.world,
						this.player.camera.currentDistance,
						canTargetCreation ? this.buildCursor.position : { x: 0, y: 0 }
					)
				: { target: null, blockTarget: null };
		this.target = raycastResult.target;
		this.blockTarget = raycastResult.blockTarget;
		this.renderer.setSelection(
			canTargetCreation && this.target?.kind === 'block' ? this.target.block.block : null
		);
		this.renderer.setVegetationSelection(
			canTargetCreation && this.target?.kind === 'vegetation' ? this.target : null
		);

		const selected = this.currentSelectedBlock();
		const placementPreview = canTargetCreation
			? this.placementSystem.preview(this.blockTarget, selected)
			: null;
		this.renderer.setPlacementPreview(
			placementPreview?.position ?? null,
			placementPreview?.allowed ?? false
		);
		this.updateBuildCursorElement(
			canTargetCreation,
			this.target,
			placementPreview ? placementPreview.allowed : null
		);
		this.updateBuildPose(
			canTargetCreation,
			this.resolveInteractionPoint(placementPreview?.position ?? null)
		);

		if (commands.interact && canTargetInteraction) {
			this.interactWithCivilization();
		}

		this.sky.update(this.player.camera.camera.position, deltaSeconds);
		if (this.activeSession instanceof PlanetWorldSession) {
			this.currentGeographicLocation = this.geographicLocationFor(this.activeSession);
		}
		this.updateMiniMap(frameStartedAt);
		this.updateWorldDayAnnouncement(frameStartedAt);
		this.renderer.updateSurfaceWeather(this.sky.surfaceWeather);

		if (this.status === 'playing') {
			const waterUpdate = this.localWater.update(
				this.player.state.position,
				deltaSeconds,
				this.sky.localWaterForcing
			);
			for (const chunk of waterUpdate.changedChunks) {
				this.renderer.refreshChunk(this.world, chunk);
				this.diagnostics.chunkRefreshes += 1;
			}
			if (waterUpdate.persistenceDirty) this.persistence.markDirty();

			const position = this.player.state.position;
			const eyeY = position.y + this.player.state.height * 0.92;
			const water = this.localWater.sampleAt(position.x, position.z);
			const forcing = this.sky.localWaterForcing;
			const exposure = sampleHumanExposure(this.world, this.player.state, this.sky.windDirection);
			const humanUpdate = this.human.update(deltaSeconds, {
				player: this.player.state,
				movement: humanMovement,
				environment: {
					temperatureCelsius: this.sky.temperatureCelsius,
					windChillCelsius: this.sky.windChillCelsius,
					rainIntensity: forcing.rainIntensity,
					snowIntensity: forcing.snowIntensity,
					windStrength: forcing.windStrength,
					daylight: forcing.daylight,
					humidity: forcing.humidity
				},
				exposure,
				water: { waterSurfaceY: water.waterSurfaceY, waterDepth: water.waterDepth },
				headObstructed: this.world.isSolidLoadedAt({
					x: Math.floor(position.x),
					y: Math.floor(eyeY),
					z: Math.floor(position.z)
				})
			});
			if (humanUpdate.persistenceDirty) this.persistence.markDirty();
			if (!this.human.canAct && this.pointerLock.isLocked) {
				this.pointerLock.exit();
			}
			if (this.human.snapshot.lifeState === 'dead' && this.buildMode) {
				this.exitBuildMode();
			}
			if (humanUpdate.deathOccurred) {
				this.message = null;
			}
		}
		this.avatar.setColdBreath(
			this.sky.breathVisibility,
			this.sky.windDirection,
			this.sky.windStrength
		);

		// In cramped spaces the automatic camera becomes the player's eyes. Hide
		// only the head/hair so the body can still be seen when looking downward.
		this.avatar.object.visible = true;
		this.avatar.setFirstPersonView(this.player.camera.firstPersonActive);
		this.avatar.update(
			this.player.state,
			Math.hypot(this.player.state.velocity.x, this.player.state.velocity.z) > 0.1,
			deltaSeconds,
			this.human.snapshot.lifeState
		);
		this.renderer.updateCivilization(
			this.player.camera.camera.position,
			this.sky.daylight,
			this.urbanElevator.snapshotFor(this.player.state)
		);
		this.civilizationRadioAudio.update(this.player.state.position);
		this.renderer.updateVegetation(
			this.player.camera.camera.position,
			deltaSeconds,
			this.sky.windDirection,
			Math.min(1, this.sky.windStrength + this.sky.windGust * 0.35)
		);
		this.recordAvatarMetricsThrottled(frameStartedAt);

		const action = this.mouse.consumeAction();

		if (this.status === 'playing' && this.human.canAct && this.buildMode && action === 'break') {
			this.breakTarget();
		} else if (
			this.status === 'playing' &&
			this.human.canAct &&
			this.buildMode &&
			action === 'place'
		) {
			this.placeSelectedBlock();
		}

		this.autoSaveIfDirty(frameStartedAt);
		this.emitSnapshotThrottled(frameStartedAt);
		this.diagnostics.frameTimeMs = performance.now() - frameStartedAt + this.diagnostics.renderMs;
		this.recordFrame(frameStartedAt);
	}

	private render(): void {
		const renderStartedAt = performance.now();
		this.renderer.render(this.player.camera.camera);
		this.diagnostics.renderMs = performance.now() - renderStartedAt;
	}

	private recordAvatarMetricsThrottled(now: number): void {
		if (now - this.lastAvatarMetricsAt < AVATAR_METRICS_INTERVAL_MS) {
			return;
		}

		this.lastAvatarMetricsAt = now;
		this.recordAvatarMetrics();
	}

	private recordAvatarMetrics(): void {
		const avatarMetrics = this.avatar.diagnostics;
		const debug = avatarMetrics.debug;
		this.diagnostics.avatarUpdateMs = avatarMetrics.updateMs;
		this.diagnostics.avatarObjects = avatarMetrics.objectCount;
		this.diagnostics.avatarTriangles = avatarMetrics.triangles;
		this.diagnostics.avatarDrawCalls = avatarMetrics.meshCount;
		this.diagnostics.avatarSkinnedMeshes = avatarMetrics.skinnedMeshCount;
		this.diagnostics.avatarMaterials = avatarMetrics.materialCount;
		this.diagnostics.avatarBones = avatarMetrics.boneCount;
		this.diagnostics.avatarModelSource = avatarMetrics.modelSource;
		this.diagnostics.avatarAnimationClips = avatarMetrics.animationBlend.clipCount;
		this.diagnostics.avatarRetargetedClipCount = avatarMetrics.retargetedClipCount;
		this.diagnostics.avatarTargetSkeletonBoneCount = avatarMetrics.targetSkeletonBoneCount;
		this.diagnostics.avatarReady = avatarMetrics.ready;
		this.diagnostics.avatarCurrentAnimation = avatarMetrics.animationBlend.currentAction;
		this.diagnostics.avatarError = avatarMetrics.error;
		this.diagnostics.avatarPreviousAnimation = debug.previousAction;
		this.diagnostics.avatarMixerTime = debug.mixerTime;
		this.diagnostics.avatarActionTime = debug.actionTime;
		this.diagnostics.avatarActionWeight = debug.actionWeight;
		this.diagnostics.avatarActiveActionCount = debug.activeActionCount;
		this.diagnostics.locomotionCameraYaw = debug.cameraYaw;
		this.diagnostics.locomotionBodyYaw = debug.bodyYaw;
		this.diagnostics.locomotionDesiredMovementYaw = debug.desiredMovementYaw;
		this.diagnostics.locomotionHeadYaw = debug.headYaw;
		this.diagnostics.locomotionLocalForwardSpeed = debug.localForwardSpeed;
		this.diagnostics.locomotionLocalSideSpeed = debug.localSideSpeed;
		this.diagnostics.locomotionVerticalSpeed = debug.verticalSpeed;
		this.diagnostics.locomotionGrounded = debug.grounded;
		this.diagnostics.locomotionStepActive = debug.stepActive;
		this.diagnostics.locomotionStepHeight = debug.stepHeight;
		this.diagnostics.locomotionLeadingFoot = debug.leadingFoot;
		this.diagnostics.locomotionMouseLookActive = debug.mouseLookActive;
		this.diagnostics.locomotionCameraRecentering = debug.cameraRecentering;
		this.diagnostics.avatarTotalTrackCount = debug.totalTrackCount;
		this.diagnostics.avatarMatchedTrackCount = debug.matchedTrackCount;
		this.diagnostics.avatarUnmatchedTrackCount = debug.unmatchedTrackCount;
		this.diagnostics.avatarHipsBoneName = debug.hipsBoneName;
		this.diagnostics.avatarLeftUpperLegBoneName = debug.leftUpperLegBoneName;
		this.diagnostics.avatarRightUpperLegBoneName = debug.rightUpperLegBoneName;
		this.diagnostics.avatarLeftHandBoneName = debug.leftHandBoneName;
		this.diagnostics.avatarRightHandBoneName = debug.rightHandBoneName;
		this.diagnostics.avatarHipsQuaternion = debug.hipsQuaternion;
		this.diagnostics.avatarLeftUpperLegQuaternion = debug.leftUpperLegQuaternion;
		this.diagnostics.avatarRightUpperLegQuaternion = debug.rightUpperLegQuaternion;
		this.diagnostics.avatarLeftHandQuaternion = debug.leftHandQuaternion;
		this.diagnostics.avatarRightHandQuaternion = debug.rightHandQuaternion;

		if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
			(
				globalThis as typeof globalThis & {
					__ORELUNZA_AVATAR_DEBUG__?: typeof debug;
					__ORELUNZA_LOCOMOTION_DEBUG__?: {
						cameraYaw: number;
						bodyYaw: number;
						desiredMovementYaw: number;
						headYaw: number;
						localForwardSpeed: number;
						localSideSpeed: number;
						verticalSpeed: number;
						grounded: boolean;
						currentAction: string;
						previousAction: string | null;
						activeActionCount: number;
						actionTime: number;
						actionWeight: number;
						mixerTime: number;
						mouseLookActive: boolean;
						cameraRecentering: boolean;
						stepActive: boolean;
						stepHeight: number;
						leadingFoot: 'left' | 'right' | null;
					};
				}
			).__ORELUNZA_AVATAR_DEBUG__ = debug;
			(
				globalThis as typeof globalThis & {
					__ORELUNZA_LOCOMOTION_DEBUG__?: {
						cameraYaw: number;
						bodyYaw: number;
						desiredMovementYaw: number;
						headYaw: number;
						localForwardSpeed: number;
						localSideSpeed: number;
						verticalSpeed: number;
						grounded: boolean;
						currentAction: string;
						previousAction: string | null;
						activeActionCount: number;
						actionTime: number;
						actionWeight: number;
						mixerTime: number;
						mouseLookActive: boolean;
						cameraRecentering: boolean;
						stepActive: boolean;
						stepHeight: number;
						leadingFoot: 'left' | 'right' | null;
					};
				}
			).__ORELUNZA_LOCOMOTION_DEBUG__ = {
				cameraYaw: debug.cameraYaw,
				bodyYaw: debug.bodyYaw,
				desiredMovementYaw: debug.desiredMovementYaw,
				headYaw: debug.headYaw,
				localForwardSpeed: debug.localForwardSpeed,
				localSideSpeed: debug.localSideSpeed,
				verticalSpeed: debug.verticalSpeed,
				grounded: debug.grounded,
				currentAction: debug.currentAction,
				previousAction: debug.previousAction,
				activeActionCount: debug.activeActionCount,
				actionTime: debug.actionTime,
				actionWeight: debug.actionWeight,
				mixerTime: debug.mixerTime,
				mouseLookActive: debug.mouseLookActive,
				cameraRecentering: debug.cameraRecentering,
				stepActive: debug.stepActive,
				stepHeight: debug.stepHeight,
				leadingFoot: debug.leadingFoot
			};
		}
	}

	private interactWithCivilization(): void {
		const targetedPosition = this.target?.kind === 'block' ? this.target.block.block : null;
		let result = targetedPosition
			? this.civilizationInteractions.interact(targetedPosition)
			: { handled: false, worldChanged: false };
		if (!result.handled) {
			result = this.civilizationInteractions.interactNearestDoor(this.player.state.position);
		}
		if (!result.handled) {
			const elevator = this.urbanElevator.snapshotFor(this.player.state);
			if (elevator.playerInside && elevator.phase === 'idle') {
				this.openElevatorPanel();
				return;
			}
			return;
		}
		const changedPosition = result.position ?? targetedPosition;
		if (result.worldChanged && changedPosition) this.markBlockChanged(changedPosition);
		if (result.action === 'sleep') {
			this.human.requestSleepToggle();
			this.persistence.markDirty();
			this.message = this.human.snapshot.canSleep
				? 'Resting in bed'
				: 'You cannot sleep safely here';
			return;
		}
		if (result.action === 'wardrobe') {
			const next = nextWardrobeOutfit(this.options.appearance);
			Object.assign(this.options.appearance, next.appearance);
			void this.avatar.updateAppearance(this.options.appearance);
			this.persistence.markDirty();
			this.message = `Changed outfit · ${next.preset.label}`;
			return;
		}
		if (result.action === 'eat') {
			if ((result.nutrition ?? 0) > 0) this.human.consumeFood(result.nutrition ?? 0);
			if ((result.hydration ?? 0) > 0) this.human.drinkWater(result.hydration ?? 0);
			this.persistence.markDirty();
		}
		if (result.action === 'drink') {
			this.human.drinkWater(result.hydration ?? 0);
			this.persistence.markDirty();
		}
		if (result.action === 'wash') {
			this.human.applyExternalWetness(32);
			this.persistence.markDirty();
		}
		if (result.action === 'radio' && result.position) {
			this.civilizationRadioAudio.setRadio(result.position, result.active === true);
		}
		if (result.action === 'elevator-call' && result.position) {
			const elevator = this.urbanElevator.callFrom(result.position);
			for (const position of elevator.changed) this.refreshBlockRendering(position);
			this.message = elevator.message;
			return;
		}
		if (result.action === 'elevator-panel' && result.position) {
			if (this.urbanElevator.canUsePanel(result.position, this.player.state)) {
				this.openElevatorPanel();
			} else {
				this.message = 'Wait for the elevator and step inside';
			}
			return;
		}
		if (result.action === 'power' && result.position) {
			const power = this.urbanPower.toggleAt(result.position);
			for (const position of power.changed) this.refreshBlockRendering(position);
			if (power.handled) this.persistence.markDirty();
			this.message = power.handled
				? `${power.buildingLabel} · power ${power.powered ? 'online' : 'offline'}`
				: 'No building power circuit';
			return;
		}
		this.message = result.message ?? 'Used';
	}

	private breakTarget(): void {
		if (
			this.target?.kind === 'block' &&
			this.world.isProtectedBuildPosition(this.target.block.block)
		) {
			this.message = 'Native city is protected';
			return;
		}

		const removed = this.removalSystem.remove(this.target);

		if (!removed) {
			return;
		}

		this.avatar.swingBuildTool();
		this.target = null;
		this.message = removed.kind === 'vegetation' ? `Removed ${removed.label}` : 'Block collected';
	}

	private placeSelectedBlock(): void {
		const selected = this.currentSelectedBlock();

		if (this.placementSystem.place(this.blockTarget, selected, this.creativeBuild)) {
			this.avatar.swingBuildTool();
			this.message = `Placed ${selected ?? 'block'}`;
		} else {
			this.message = 'Cannot place here';
		}
	}

	private currentSelectedBlock(): BlockType | null {
		if (this.buildMode) {
			return this.selectedBuildBlock;
		}

		return this.inventory.getSelectedStack(this.hotbar.selectedIndex)?.type ?? null;
	}

	private updateBuildCursorElement(
		visible: boolean,
		target: BuildTarget | null,
		placementAllowed: boolean | null
	): void {
		const element = this.options.buildCursorElement;

		if (!element) {
			return;
		}

		element.hidden = !visible;

		if (!visible) {
			element.dataset.target = 'none';
			element.dataset.label = '';
			return;
		}

		const cursor = this.buildCursor.position;
		element.style.left = `${(cursor.x + 1) * 50}%`;
		element.style.top = `${(1 - cursor.y) * 50}%`;

		if (target?.kind === 'vegetation') {
			element.dataset.target = 'vegetation';
			element.dataset.state = 'valid';
			element.dataset.label = `Remove ${target.label}`;
			return;
		}

		if (target?.kind === 'block') {
			const definition = BlockRegistry.get(target.block.type);

			if (this.world.isProtectedBuildPosition(target.block.block)) {
				element.dataset.target = 'invalid';
				element.dataset.state = 'invalid';
				element.dataset.label = 'Protected native city';
			} else if (target.block.type === 'water') {
				element.dataset.target = 'invalid';
				element.dataset.state = 'invalid';
				element.dataset.label = 'Water requires a terrain tool';
			} else {
				element.dataset.target = 'block';
				element.dataset.state = 'valid';
				element.dataset.label = `Break ${definition.label}`;
			}

			return;
		}

		element.dataset.target = placementAllowed === false ? 'invalid' : 'none';
		element.dataset.state =
			placementAllowed === true ? 'valid' : placementAllowed === false ? 'invalid' : 'idle';
		element.dataset.label = placementAllowed === false ? 'Cannot place here' : '';
	}

	private resolveInteractionPoint(placementPosition: BlockCoordinate | null): Vector3 | null {
		if (this.target?.kind === 'vegetation') {
			this.interactionPoint.set(
				this.target.position.x,
				this.target.position.y,
				this.target.position.z
			);
			return this.interactionPoint;
		}

		if (placementPosition) {
			this.interactionPoint.set(
				placementPosition.x + 0.5,
				placementPosition.y + 0.5,
				placementPosition.z + 0.5
			);
			return this.interactionPoint;
		}

		if (this.target?.kind === 'block') {
			this.interactionPoint.set(
				this.target.block.block.x + 0.5,
				this.target.block.block.y + 0.5,
				this.target.block.block.z + 0.5
			);
			return this.interactionPoint;
		}

		return null;
	}

	private updateBuildPose(active: boolean, point: Vector3 | null): void {
		if (!active) {
			this.avatar.clearLookTarget();

			if (this.buildMode) {
				this.avatar.setHandTarget();
			} else {
				this.avatar.clearHandTarget();
			}

			return;
		}

		if (!point) {
			this.avatar.setHandTarget();
			this.avatar.clearLookTarget();
			return;
		}

		this.avatar.lookAtWorldPosition(point);
		this.avatar.setHandTarget(point);
	}

	private restoreBuildWorkspace(): void {
		const fallback = this.inventory.snapshot().hotbar.map((slot) => slot.stack?.type ?? null);
		this.applyBuildWorkspace(loadBuildWorkspaceState(this.validBuildTypes, fallback));
		this.buildWorkspaceUnsubscribe?.();
		this.buildWorkspaceUnsubscribe = subscribeBuildWorkspaceState(
			this.validBuildTypes,
			fallback,
			(state) => {
				if (
					serializeBuildWorkspaceState(state) === serializeBuildWorkspaceState(this.buildWorkspace)
				) {
					return;
				}

				this.applyBuildWorkspace(state);
				this.emitSnapshot();
			}
		);
	}

	private restoreBuildSelection(): void {
		this.selectedBuildBlock = resolveSelectedBuildBlock(this.buildWorkspace);
	}

	private selectBuildPaletteIndex(index: number): void {
		this.setBuildWorkspace(selectBuildPaletteSlot(this.buildWorkspace, index));
	}

	private setBuildWorkspace(state: BuildWorkspaceState): void {
		this.applyBuildWorkspace(state);
		persistBuildWorkspaceState(state);
	}

	private applyBuildWorkspace(state: BuildWorkspaceState): void {
		this.buildWorkspace = state;
		this.selectedBuildBlock = resolveSelectedBuildBlock(state);
	}

	private refreshBlockRendering(position: BlockCoordinate): void {
		this.renderer.refreshChunk(this.world, worldToChunk(position));
		this.diagnostics.chunkRefreshes += 1;
	}

	private markBlockChanged(position: BlockCoordinate): void {
		this.refreshBlockRendering(position);
		this.persistence.markDirty();
	}

	private snapshotTargetedBlock(): TargetedBlock | null {
		if (this.target?.kind === 'block') {
			const target = this.target.block;
			const block = this.world.getLoadedBlock(target.block);
			if (block && BlockRegistry.isInteractive(block.type)) {
				return block.state?.open === undefined ? target : { ...target, open: block.state.open };
			}
		}

		if (this.status === 'playing' && !this.buildMode && this.human.canAct) {
			const nearbyDoor = this.civilizationInteractions.findNearbyDoor(this.player.state.position);
			if (nearbyDoor) {
				return {
					block: { ...nearbyDoor.position },
					normal: { x: 0, y: 0, z: 0 },
					type: nearbyDoor.type,
					open: nearbyDoor.open
				};
			}
		}

		if (this.target?.kind !== 'block') return null;
		const target = this.target.block;
		const block = this.world.getLoadedBlock(target.block);
		if (block?.state?.open === undefined) return target;
		return { ...target, open: block.state.open };
	}

	private weatherSurfaceHeightAt(x: number, z: number, maxY: number): number | null {
		const blockX = Math.floor(x);
		const blockZ = Math.floor(z);
		const terrainFloor = Math.floor(this.world.terrainGenerator.heightAt(x, z));
		const startY = Math.min(WORLD_MAX_Y, Math.max(WORLD_MIN_Y, Math.floor(maxY)));
		const endY = Math.max(WORLD_MIN_Y, terrainFloor - 2);

		for (let y = startY; y >= endY; y -= 1) {
			const block = this.world.getLoadedBlock({ x: blockX, y, z: blockZ });
			if (block?.solid && !block.passable) {
				return y;
			}
		}

		return Number.isFinite(terrainFloor) ? terrainFloor : null;
	}

	private weatherRainOcclusionAt(x: number, y: number, z: number): number {
		return this.world.rainOcclusionAt(x, y, z);
	}

	private weatherOpennessAt(x: number, y: number, z: number): number {
		const directions = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
			[0.7071, 0.7071],
			[-0.7071, 0.7071],
			[0.7071, -0.7071],
			[-0.7071, -0.7071]
		] as const;
		let openRays = 0;
		for (const [dx, dz] of directions) {
			let blocked = false;
			for (let step = 1; step <= 12; step += 1) {
				const block = this.world.getLoadedBlock({
					x: Math.floor(x + dx * step),
					y: Math.floor(y),
					z: Math.floor(z + dz * step)
				});
				if (block?.solid && !block.passable) {
					blocked = true;
					break;
				}
			}
			if (!blocked) openRays += 1;
		}
		const horizontal = openRays / directions.length;
		const sky = 1 - this.world.rainOcclusionAt(x, y, z);
		return Math.max(0, Math.min(1, horizontal * 0.45 + sky * 0.55));
	}

	private resize(): void {
		const box = this.options.canvas.getBoundingClientRect();
		this.renderer.resize(box.width, box.height);
		this.player.camera.resize(box.width, box.height);
	}

	private findSafeSpawn(): Vector3 {
		const spawn = this.world.spawnPosition();

		return new Vector3(spawn.x, spawn.y, spawn.z);
	}

	private syncBackendPosition(): void {
		const now = performance.now();
		const position = this.player.state.position;

		if (now - this.lastBackendSync < BACKEND_SYNC_INTERVAL_MS) {
			return;
		}

		const movedSquared =
			(position.x - this.lastBackendPosition.x) ** 2 +
			(position.y - this.lastBackendPosition.y) ** 2 +
			(position.z - this.lastBackendPosition.z) ** 2;

		if (movedSquared < 0.25) {
			return;
		}

		this.lastBackendSync = now;
		this.lastBackendPosition.set(position.x, position.y, position.z);
		this.diagnosticsBackendCalls += 1;
		void this.options.onMove?.(
			this.player.state.position,
			this.player.state.yaw,
			this.player.state.pitch
		);
		void this.worldSync
			.syncPosition(this.options.worldId, this.player.state.position)
			.catch(() => undefined);
	}

	private autoSaveIfDirty(now: number): void {
		if (this.saveStatus !== 'dirty' || now - this.lastAutoSaveAttempt < AUTO_SAVE_INTERVAL_MS) {
			return;
		}

		this.lastAutoSaveAttempt = now;
		void this.persistence.save(false);
	}

	private emitSnapshotThrottled(now: number): void {
		if (now - this.lastSnapshotAt < SNAPSHOT_INTERVAL_MS) {
			return;
		}

		const key = this.snapshotKey();

		if (key === this.lastSnapshotKey) {
			return;
		}

		this.lastSnapshotKey = key;
		this.lastSnapshotAt = now;
		this.emitSnapshot();
	}

	private emitSnapshot(): void {
		this.diagnosticsCallbacks += 1;
		this.diagnosticsHudUpdates += 1;
		this.lastSnapshotAt = performance.now();
		this.lastSnapshotKey = this.snapshotKey();
		this.options.onSnapshot?.(this.snapshot());
	}

	private updateWorldDayAnnouncement(now: number): void {
		const time = this.sky.worldTime;

		if (time.dayNumber !== this.lastObservedWorldDayNumber) {
			const kind = time.day === 1 ? (time.month === 1 ? 'year' : 'month') : 'day';
			const title =
				kind === 'year'
					? 'A new year begins'
					: kind === 'month'
						? `${time.monthName} — Year ${time.year}`
						: `${time.weekdayName}, ${time.monthName} ${time.day}`;
			const subtitle =
				kind === 'day' ? `Year ${time.year}` : `${time.weekdayName}, ${time.monthName} ${time.day}`;

			this.dayAnnouncement = {
				id: `${time.dayNumber}:${kind}`,
				kind,
				title,
				subtitle
			};
			this.dayAnnouncementExpiresAt = now + 6000;
			this.lastObservedWorldDayNumber = time.dayNumber;
		}

		if (this.dayAnnouncement && now >= this.dayAnnouncementExpiresAt) {
			this.dayAnnouncement = null;
		}
	}

	private snapshotKey(): string {
		const position = this.player.state.position;
		const chunk = worldToChunk(position);
		const human = this.human.snapshot;
		const interactionTarget = this.snapshotTargetedBlock();
		const elevator = this.urbanElevator.snapshotFor(this.player.state);
		const building = buildingAtWorld(position.x, position.z);

		return [
			this.status,
			Math.round(position.x * 10),
			Math.round(position.y * 10),
			Math.round(position.z * 10),
			Math.round(this.player.state.yaw * 100),
			Math.round(this.player.state.pitch * 100),
			chunk.x,
			chunk.z,
			this.hotbar.selectedIndex,
			this.buildWorkspace.activeSlotIndex,
			this.buildWorkspace.palette.join(','),
			this.pointerLock.isLocked ? 1 : 0,
			this.saveStatus,
			this.sky.worldTime.minuteKey,
			this.dayAnnouncement?.id ?? '',
			this.world.terrainGenerator.zoneAt(position.x, position.z),
			interactionTarget
				? `block:${interactionTarget.block.x},${interactionTarget.block.y},${interactionTarget.block.z}:${interactionTarget.open ? 1 : 0}`
				: this.target?.kind === 'vegetation'
					? `vegetation:${this.target.instanceId}`
					: '',
			this.buildMode ? 1 : 0,
			this.status === 'build-catalog' ? 1 : 0,
			this.selectedBuildBlock ?? '',
			this.creativeBuild ? 1 : 0,
			this.chunkStreaming.snapshot.loadedChunks,
			this.chunkStreaming.snapshot.pendingLoads,
			Math.round(human.health * 2) / 2,
			Math.round(human.stamina),
			Math.round(human.oxygen),
			Math.round(human.hydration),
			Math.round(human.nutrition),
			Math.round(human.bodyTemperatureCelsius * 10) / 10,
			Math.round(human.wetness * 20) / 20,
			Math.round(human.fatigue),
			human.restState,
			human.sleeping ? 1 : 0,
			human.sheltered ? 1 : 0,
			human.effects.map((effect) => `${effect.id}:${Math.round(effect.intensity * 10)}`).join(','),
			human.injuries
				.map(
					(injury) => `${injury.kind}:${Math.round(injury.severity * 10)}:${injury.treated ? 1 : 0}`
				)
				.join(','),
			human.illnesses
				.map((illness) => `${illness.kind}:${illness.stage}:${Math.round(illness.severity * 10)}`)
				.join(','),
			human.lifeState,
			human.lastDeathCause ?? '',
			human.deathCount,
			Math.ceil(human.respawnProtectionSeconds),
			elevator.currentFloor,
			elevator.targetFloor,
			Math.round(elevator.cabinY * 10),
			elevator.phase,
			elevator.powered ? 1 : 0,
			elevator.playerInside ? 1 : 0,
			this.elevatorPanelOpen ? 1 : 0,
			building?.id ?? '',
			this.introVisible ? 1 : 0,
			this.message ?? '',
			this.error ?? ''
		].join('|');
	}

	private snapshot(): GameSnapshot {
		this.updateRenderDiagnostics();

		return {
			status: this.status,
			player: {
				playerId: this.options.playerId,
				worldId: this.options.worldId,
				position: { ...this.player.state.position },
				yaw: this.player.state.yaw,
				pitch: this.player.state.pitch
			},
			chunk: worldToChunk(this.player.state.position),
			inventory: this.inventory.snapshot(),
			selectedHotbarIndex: this.hotbar.selectedIndex,
			buildPalette: [...this.buildWorkspace.palette],
			selectedBuildPaletteIndex: this.buildWorkspace.activeSlotIndex,
			pointerLocked: this.pointerLock.isLocked,
			saveStatus: this.saveStatus,
			regionName: this.options.regionName,
			zoneName: this.world.terrainGenerator.zoneAt(
				this.player.state.position.x,
				this.player.state.position.z
			),
			geographicLocation: this.currentGeographicLocation
				? { ...this.currentGeographicLocation }
				: null,
			travel: this.travelPlan
				? {
						...this.travelPlan,
						origin: { ...this.travelPlan.origin },
						destination: { ...this.travelPlan.destination }
					}
				: null,
			miniMap: { ...this.miniMap, cells: this.miniMap.cells.map((cell) => ({ ...cell })) },
			environment: {
				time: { ...this.sky.worldTime },
				weather: this.sky.weather,
				temperatureCelsius: this.sky.temperatureCelsius,
				windChillCelsius: this.sky.windChillCelsius,
				lunarPhase: this.sky.lunarPhase,
				lunarIllumination: this.sky.lunarIllumination
			},
			human: this.human.snapshot,
			urban: {
				elevator: this.urbanElevator.snapshotFor(this.player.state),
				elevatorPanelOpen: this.elevatorPanelOpen,
				buildingName:
					buildingAtWorld(this.player.state.position.x, this.player.state.position.z)?.label ??
					null,
				buildingPowered: this.urbanPower.isPoweredAt(this.player.state.position)
			},
			dayAnnouncement: this.dayAnnouncement ? { ...this.dayAnnouncement } : null,
			targetedBlock: this.snapshotTargetedBlock(),
			buildMode: this.buildMode,
			buildCatalogOpen: this.status === 'build-catalog',
			selectedBuildBlock: this.selectedBuildBlock,
			creativeBuild: this.creativeBuild,
			introVisible: this.introVisible,
			message: this.message,
			error: this.error,
			mobileLimited: this.mobileLimited,
			diagnostics: { ...this.diagnostics },
			avatar: { ...this.avatar.diagnostics.animation }
		};
	}

	private recordFrame(now: number): void {
		this.diagnosticsFrameCount += 1;
		const elapsed = now - this.diagnosticsWindowStartedAt;

		if (elapsed < 1000) {
			return;
		}

		const scale = 1000 / elapsed;
		this.diagnostics.fps = this.diagnosticsFrameCount * scale;
		this.diagnostics.svelteCallbacksPerSecond = this.diagnosticsCallbacks * scale;
		this.diagnostics.backendCallsPerSecond = this.diagnosticsBackendCalls * scale;
		this.diagnostics.hudUpdatesPerSecond = this.diagnosticsHudUpdates * scale;
		this.diagnosticsFrameCount = 0;
		this.diagnosticsCallbacks = 0;
		this.diagnosticsBackendCalls = 0;
		this.diagnosticsHudUpdates = 0;
		this.diagnosticsWindowStartedAt = now;
	}

	private updateRenderDiagnostics(): void {
		const info = this.renderer.renderer.info;
		this.diagnostics.chunksActive = this.world.getLoadedChunks().length;
		this.diagnostics.drawCalls = info.render.calls;
		this.diagnostics.triangles = info.render.triangles;
		this.diagnostics.threeObjects = countObjects(this.renderer.scene);
		this.diagnostics.activeLoops = this.loop.isRunning ? 1 : 0;
	}

	private updateMiniMap(now: number): void {
		if (now - this.lastMiniMapAt < 500) return;
		this.lastMiniMapAt = now;
		const size = 9;
		const cells: import('./game-types').MiniMapCell[] = [];
		const centre = this.player.state.position;
		for (let z = 0; z < size; z += 1)
			for (let x = 0; x < size; x += 1) {
				const wx = Math.floor(centre.x + (x - (size - 1) / 2) * 8);
				const wz = Math.floor(centre.z + (z - (size - 1) / 2) * 8);
				const height = this.world.terrainGenerator.heightAt(wx, wz);
				cells.push({ x, z, terrain: height <= 1 ? 'water' : 'land' });
			}
		this.miniMap = {
			size,
			cells,
			playerYaw: this.player.state.bodyYaw,
			northRadians: 0,
			zoneName: this.world.terrainGenerator.zoneAt(centre.x, centre.z)
		};
	}
}

function countObjects(object: { children: unknown[] }): number {
	let count = 1;

	for (const child of object.children) {
		count += countObjects(child as { children: unknown[] });
	}

	return count;
}
