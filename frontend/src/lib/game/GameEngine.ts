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
import { createStarterWorld } from './world/WorldGenerator';
import { STARTER_WORLD_SEED, worldToChunk } from './world/voxel-types';

const CHUNK_RADIUS = 1;
const SNAPSHOT_INTERVAL_MS = 100;
const AUTO_SAVE_INTERVAL_MS = 1500;
const BACKEND_SYNC_INTERVAL_MS = 5000;

export class GameEngine {
	private readonly renderer: GameRenderer;
	private readonly world;
	private readonly player: PlayerController;
	private readonly keyboard: KeyboardInput;
	private readonly mouse: MouseInput;
	private readonly pointerLock: PointerLockController;
	private readonly inventory = new Inventory();
	private readonly hotbar = new Hotbar();
	private readonly raycaster = new BlockRaycaster(6);
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
	private lastChunk: { x: number; z: number } | null = null;
	private startPromise: Promise<void> | null = null;
	private destroyed = false;
	private mobileLimited = false;
	private buildMode = false;
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
		avatarDrawCalls: 0
	};

	constructor(private readonly options: GameEngineOptions) {
		this.world = createStarterWorld(options.seed || STARTER_WORLD_SEED);
		this.renderer = new GameRenderer(options.canvas);
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
			this.refreshChunksForPlayer(true);
			this.renderer.rebuildWorld(this.world);
			this.diagnostics.worldRebuilds += 1;
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

	selectHotbar(index: number): void {
		this.hotbar.select(index);
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
		this.renderer.dispose();
		this.emitSnapshot();
	}

	private update(deltaSeconds: number): void {
		const frameStartedAt = performance.now();
		const commands = this.keyboard.consumeCommands();

		if (commands.pause) {
			if (this.status === 'playing') {
				this.pause();
			} else {
				this.resume();
			}
		}

		if (commands.inventory && this.status === 'playing') {
			this.openInventory();
		}

		if (commands.build && this.status === 'playing') {
			this.buildMode = !this.buildMode;
			this.message = this.buildMode ? 'Build Mode' : 'Exploration Mode';
		}

		if (commands.hotbarIndex !== null) {
			this.hotbar.select(commands.hotbarIndex);
		}

		const wheel = this.mouse.consumeWheel();

		if (wheel !== 0) {
			if (this.buildMode) {
				this.hotbar.next(wheel);
			} else {
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

		if (this.refreshChunksForPlayer(false)) {
			this.needsWorldRebuild = true;
		}

		if (this.needsWorldRebuild) {
			this.renderer.rebuildWorld(this.world);
			this.diagnostics.worldRebuilds += 1;
			this.needsWorldRebuild = false;
		}

		this.avatar.update(
			this.player.state,
			Math.hypot(this.player.state.velocity.x, this.player.state.velocity.z) > 0.1,
			deltaSeconds
		);
		this.recordAvatarMetrics();

		this.target = this.buildMode
			? this.raycaster.raycast(this.player.camera.camera, this.renderer.lookups)
			: null;
		this.renderer.setSelection(this.buildMode ? (this.target?.block ?? null) : null);

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

	private recordAvatarMetrics(): void {
		const avatarMetrics = this.avatar.diagnostics;
		this.diagnostics.avatarUpdateMs = avatarMetrics.updateMs;
		this.diagnostics.avatarObjects = avatarMetrics.objectCount;
		this.diagnostics.avatarTriangles = avatarMetrics.triangles;
		this.diagnostics.avatarDrawCalls = avatarMetrics.meshCount;
	}

	private breakTarget(): void {
		const system = new BlockBreakingSystem(this.world, this.inventory, () =>
			this.markWorldChanged()
		);

		if (system.break(this.target)) {
			this.message = 'Block collected';
		}
	}

	private placeSelectedBlock(): void {
		const stack = this.inventory.getSelectedStack(this.hotbar.selectedIndex);
		const system = new BlockPlacementSystem(
			this.world,
			this.inventory,
			this.player.state,
			this.player.physics.collider,
			() => this.markWorldChanged()
		);

		if (system.place(this.target, stack?.type ?? null)) {
			this.message = `Placed ${stack?.type ?? 'block'}`;
		} else {
			this.message = 'Cannot place here';
		}
	}

	private markWorldChanged(): void {
		this.needsWorldRebuild = true;
		this.persistence.markDirty();
	}

	private resize(): void {
		const box = this.options.canvas.getBoundingClientRect();
		this.renderer.resize(box.width, box.height);
		this.player.camera.resize(box.width, box.height);
	}

	private refreshChunksForPlayer(force: boolean): boolean {
		const chunk = worldToChunk(this.player.state.position);

		if (
			!force &&
			this.lastChunk !== null &&
			this.lastChunk.x === chunk.x &&
			this.lastChunk.z === chunk.z
		) {
			return false;
		}

		this.lastChunk = { x: chunk.x, z: chunk.z };
		this.diagnostics.chunkRefreshes += 1;

		return this.world.ensureChunksAround(this.player.state.position, CHUNK_RADIUS);
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
