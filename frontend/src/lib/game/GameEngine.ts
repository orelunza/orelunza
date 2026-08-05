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
import { BlockBreakingSystem } from './interaction/BlockBreakingSystem';
import { BlockPlacementSystem } from './interaction/BlockPlacementSystem';
import { BlockRaycaster } from './interaction/BlockRaycaster';
import { Hotbar } from './inventory/Hotbar';
import { Inventory } from './inventory/Inventory';
import { KeyboardInput } from './input/KeyboardInput';
import { MouseInput } from './input/MouseInput';
import { PointerLockController } from './input/PointerLockController';
import { GamePersistence } from './persistence/GamePersistence';
import { WorldSyncService } from './persistence/WorldSyncService';
import { PlayerAvatar } from './player/PlayerAvatar';
import { PlayerController } from './player/PlayerController';
import { GameRenderer } from './rendering/GameRenderer';
import { Sky } from './rendering/Sky';
import { BlockRegistry } from './world/BlockRegistry';
import { ChunkStreamingSystem } from './world/ChunkStreamingSystem';
import { createStarterWorld } from './world/WorldGenerator';
import {
	STARTER_WORLD_SEED,
	type BlockCoordinate,
	type BlockType,
	worldToChunk
} from './world/voxel-types';

const CHUNK_RENDER_INTERVAL_MS = 120;
const SNAPSHOT_INTERVAL_MS = 100;
const AVATAR_METRICS_INTERVAL_MS = 250;
const AUTO_SAVE_INTERVAL_MS = 1500;
const BACKEND_SYNC_INTERVAL_MS = 5000;
const AVATAR_HIDE_CAMERA_DISTANCE = 0.55;

export class GameEngine {
	private readonly renderer: GameRenderer;
	private readonly sky: Sky;
	private readonly world;
	private readonly chunkStreaming: ChunkStreamingSystem;
	private readonly player: PlayerController;
	private readonly keyboard: KeyboardInput;
	private readonly mouse: MouseInput;
	private readonly pointerLock: PointerLockController;
	private readonly inventory = new Inventory();
	private readonly hotbar = new Hotbar();
	private readonly raycaster = new BlockRaycaster(8);
	private readonly loop: GameLoop;
	private readonly persistence: GamePersistence;
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
	private target: TargetedBlock | null = null;
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
	private mobileLimited = false;
	private buildMode = false;
	private selectedBuildBlock: BlockType | null = null;
	private readonly creativeBuild = true;
	private introVisible = true;
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
		this.world = createStarterWorld(options.seed || STARTER_WORLD_SEED);
		this.chunkStreaming = new ChunkStreamingSystem({
			visibleRadius: 2,
			retainRadius: 3,
			maxLoadsPerUpdate: 1,
			maxUnloadsPerUpdate: 2,
			timeBudgetMs: 3,
			loadChunk: (chunk) => this.world.loadChunk(chunk),
			unloadChunk: (chunk) => this.world.unloadChunk(chunk)
		});
		this.renderer = new GameRenderer(options.canvas);
		this.sky = new Sky(this.renderer.scene);
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
			this.recordAvatarMetrics();

			this.world.loadChunk(worldToChunk(this.player.state.position));
			this.chunkStreaming.synchronizeLoaded(this.world.getLoadedChunks());

			this.renderer.rebuildWorld(this.world);
			this.diagnostics.worldRebuilds += 1;
			this.lastWorldRebuildAt = performance.now();
			this.needsWorldRebuild = false;
			this.status = 'playing';
			this.emitSnapshot();
			this.loop.start();
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

	enterBuildMode(): void {
		if (this.status !== 'playing' || this.buildMode) {
			return;
		}

		this.buildMode = true;
		this.player.camera.setShoulderFraming('build');
		this.selectBuildBlockFromHotbar();
		this.message = this.selectedBuildBlock
			? 'Build Mode — C: blocks · B: exit'
			: 'Build Mode — C: choose a block · B: exit';
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
		this.renderer.setSelection(null);
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
		this.message = this.buildMode ? 'Build Mode — C: blocks · B: exit' : 'Exploration Mode';
		this.emitSnapshot();
	}

	selectBuildBlock(type: BlockType): boolean {
		const definition = BlockRegistry.get(type);

		if (type === 'air' || !definition.placeable) {
			return false;
		}

		this.selectedBuildBlock = type;
		this.buildMode = true;
		this.target = null;
		this.renderer.setSelection(null);
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
		this.selectedBuildBlock = null;
		this.target = null;
		this.player.camera.setShoulderFraming('explore');
		this.renderer.setSelection(null);

		if (this.status === 'build-catalog') {
			this.status = 'playing';
			this.pointerLock.request();
		}

		this.message = 'Exploration Mode';
		this.emitSnapshot();
	}

	selectHotbar(index: number): void {
		this.hotbar.select(index);

		if (this.buildMode) {
			this.selectBuildBlockFromHotbar();
		}

		this.emitSnapshot();
	}

	async saveNow(): Promise<void> {
		await this.persistence.save(true);
		this.emitSnapshot();
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
		this.keyboard.destroy();
		this.mouse.destroy();
		this.pointerLock.destroy();
		this.avatar.dispose();
		this.chunkStreaming.dispose();
		this.sky.dispose();
		this.renderer.dispose();
		this.emitSnapshot();
	}

	private update(deltaSeconds: number): void {
		const frameStartedAt = performance.now();
		const commands = this.keyboard.consumeCommands();

		if (commands.pause) {
			if (this.status === 'playing') {
				this.pause();
			} else if (this.status === 'build-catalog') {
				this.closeBuildCatalog();
			} else {
				this.resume();
			}
		}

		if (commands.inventory && this.status === 'playing') {
			this.openInventory();
		}

		if (commands.build) {
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

		if (commands.catalog) {
			if (this.status === 'build-catalog') {
				this.closeBuildCatalog();
			} else if (this.status === 'playing') {
				this.openBuildCatalog();
			}
		}

		if (commands.hotbarIndex !== null) {
			this.hotbar.select(commands.hotbarIndex);

			if (this.buildMode) {
				this.selectBuildBlockFromHotbar();
			}
		}

		const wheel = this.mouse.consumeWheel();

		if (wheel !== 0) {
			if (this.status === 'playing' && this.buildMode) {
				this.hotbar.next(wheel);
				this.selectBuildBlockFromHotbar();
			} else if (this.status === 'playing') {
				this.player.camera.applyZoom(wheel);
			}
		}

		if (this.status === 'playing' && this.pointerLock.isLocked) {
			this.player.applyMouse(this.mouse.consumeDelta());
			const physicsStartedAt = performance.now();
			this.player.step(this.keyboard.getMovement(), deltaSeconds);
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

		// When camera collision pulls the eye very close to the player, hide the
		// avatar instead of rendering the camera inside the head or torso.
		this.avatar.object.visible = this.player.camera.currentDistance >= AVATAR_HIDE_CAMERA_DISTANCE;

		this.avatar.update(
			this.player.state,
			Math.hypot(this.player.state.velocity.x, this.player.state.velocity.z) > 0.1,
			deltaSeconds
		);
		this.sky.update(this.player.camera.camera.position, deltaSeconds);
		this.recordAvatarMetricsThrottled(frameStartedAt);

		const canTargetBlock = this.status === 'playing' && this.buildMode;
		this.target = canTargetBlock
			? this.raycaster.raycast(
					this.player.camera.camera,
					this.world,
					this.player.camera.currentDistance
				)
			: null;
		this.renderer.setSelection(canTargetBlock ? (this.target?.block ?? null) : null);

		const action = this.mouse.consumeAction();

		if (this.status === 'playing' && this.buildMode && action === 'break') {
			this.breakTarget();
		} else if (this.status === 'playing' && this.buildMode && action === 'place') {
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

	private breakTarget(): void {
		const system = new BlockBreakingSystem(this.world, this.inventory, (position) =>
			this.markBlockChanged(position)
		);

		if (system.break(this.target)) {
			this.message = 'Block collected';
		}
	}

	private placeSelectedBlock(): void {
		const stack = this.inventory.getSelectedStack(this.hotbar.selectedIndex);
		const selected = this.selectedBuildBlock ?? stack?.type ?? null;
		const system = new BlockPlacementSystem(
			this.world,
			this.inventory,
			this.player.state,
			this.player.physics.collider,
			(position) => this.markBlockChanged(position)
		);

		if (system.place(this.target, selected, this.creativeBuild)) {
			this.message = `Placed ${selected ?? 'block'}`;
		} else {
			this.message = 'Cannot place here';
		}
	}

	private selectBuildBlockFromHotbar(): void {
		const stack = this.inventory.getSelectedStack(this.hotbar.selectedIndex);

		if (!stack) {
			return;
		}

		const definition = BlockRegistry.get(stack.type);

		if (definition.placeable) {
			this.selectedBuildBlock = stack.type;
		}
	}

	private markBlockChanged(position: BlockCoordinate): void {
		this.renderer.refreshChunk(this.world, worldToChunk(position));
		this.diagnostics.chunkRefreshes += 1;
		this.persistence.markDirty();
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

	private snapshotKey(): string {
		const position = this.player.state.position;
		const chunk = worldToChunk(position);

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
			this.pointerLock.isLocked ? 1 : 0,
			this.saveStatus,
			this.world.terrainGenerator.zoneAt(position.x, position.z),
			this.target?.block
				? `${this.target.block.x},${this.target.block.y},${this.target.block.z}`
				: '',
			this.buildMode ? 1 : 0,
			this.status === 'build-catalog' ? 1 : 0,
			this.selectedBuildBlock ?? '',
			this.creativeBuild ? 1 : 0,
			this.chunkStreaming.snapshot.loadedChunks,
			this.chunkStreaming.snapshot.pendingLoads,
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
			pointerLocked: this.pointerLock.isLocked,
			saveStatus: this.saveStatus,
			regionName: this.options.regionName,
			zoneName: this.world.terrainGenerator.zoneAt(
				this.player.state.position.x,
				this.player.state.position.z
			),
			targetedBlock: this.target,
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
}

function countObjects(object: { children: unknown[] }): number {
	let count = 1;

	for (const child of object.children) {
		count += countObjects(child as { children: unknown[] });
	}

	return count;
}
