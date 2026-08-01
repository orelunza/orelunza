import { Vector3 } from 'three';
import { GameLoop } from './GameLoop';
import type {
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
import { PlayerController } from './player/PlayerController';
import { GameRenderer } from './rendering/GameRenderer';
import { createStarterWorld } from './world/WorldGenerator';
import { STARTER_WORLD_SEED, worldToChunk } from './world/voxel-types';

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
	private mobileLimited = false;

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
		this.persistence = new GamePersistence(
			options.worldId,
			options.seed,
			this.world,
			this.player,
			this.inventory,
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
		this.status = 'loading-world';
		this.emitSnapshot();

		try {
			await this.persistence.load();
			this.world.ensureChunksAround(this.player.state.position, 2);
			this.renderer.rebuildWorld(this.world);
			this.needsWorldRebuild = false;
			this.status = 'playing';
			this.emitSnapshot();
			this.loop.start();
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
		this.status = 'destroyed';
		this.loop.stop();
		void this.persistence.save(true);
		this.resizeObserver.disconnect();
		document.removeEventListener('visibilitychange', this.handleVisibility);
		window.removeEventListener('beforeunload', this.handleBeforeUnload);
		this.keyboard.destroy();
		this.mouse.destroy();
		this.pointerLock.destroy();
		this.renderer.dispose();
		this.emitSnapshot();
	}

	private update(deltaSeconds: number): void {
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

		if (commands.hotbarIndex !== null) {
			this.hotbar.select(commands.hotbarIndex);
		}

		const wheel = this.mouse.consumeWheel();

		if (wheel !== 0) {
			this.hotbar.next(wheel);
		}

		if (this.status === 'playing' && this.pointerLock.isLocked) {
			this.player.applyMouse(this.mouse.consumeDelta());
			this.player.step(this.keyboard.getMovement(), deltaSeconds);
			this.syncBackendPosition();
		} else {
			this.mouse.consumeDelta();
		}

		if (this.world.ensureChunksAround(this.player.state.position, 2)) {
			this.needsWorldRebuild = true;
		}

		if (this.needsWorldRebuild) {
			this.renderer.rebuildWorld(this.world);
			this.needsWorldRebuild = false;
		}

		this.target = this.raycaster.raycast(this.player.camera.camera, this.renderer.lookups);
		this.renderer.setSelection(this.target?.block ?? null);

		const action = this.mouse.consumeAction();

		if (this.status === 'playing' && action === 'break') {
			this.breakTarget();
		} else if (this.status === 'playing' && action === 'place') {
			this.placeSelectedBlock();
		}

		void this.persistence.save(false);
		this.emitSnapshot();
	}

	private render(): void {
		this.renderer.render(this.player.camera.camera);
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

	private findSafeSpawn(): Vector3 {
		const height = this.world.terrainGenerator.heightAt(0, 0);

		return new Vector3(0.5, height + 2, 0.5);
	}

	private syncBackendPosition(): void {
		const now = performance.now();

		if (now - this.lastBackendSync < 5000) {
			return;
		}

		this.lastBackendSync = now;
		void this.options.onMove?.(
			this.player.state.position,
			this.player.state.yaw,
			this.player.state.pitch
		);
		void this.worldSync
			.syncPosition(this.options.worldId, this.player.state.position)
			.catch(() => undefined);
	}

	private emitSnapshot(): void {
		this.options.onSnapshot?.(this.snapshot());
	}

	private snapshot(): GameSnapshot {
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
			targetedBlock: this.target,
			message: this.message,
			error: this.error,
			mobileLimited: this.mobileLimited
		};
	}
}
