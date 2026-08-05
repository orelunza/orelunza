import type { Inventory } from '../inventory/Inventory';
import type { PlayerController } from '../player/PlayerController';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { WorldSave, WorldSaveV3 } from '../world/WorldSave';
import type { SaveStatus } from '../game-types';
import { IndexedDbWorldStore } from './IndexedDbWorldStore';
import type { CharacterAppearanceV1 } from '../character/CharacterAppearance';
import type { EnvironmentSaveState } from '../environment/EnvironmentSystem';

/**
 * Minimal environment surface the persistence layer talks to. The concrete
 * implementation is the {@link Sky} façade; typing it structurally here avoids
 * a hard import cycle between persistence and rendering.
 */
export interface PersistableEnvironment {
	serialize(): EnvironmentSaveState;
	restore(save: EnvironmentSaveState | null | undefined): void;
}

export class GamePersistence {
	private dirty = false;
	private status: SaveStatus = 'idle';
	private lastSavedPayload = '';
	private lastSaveAt = 0;
	private environment: PersistableEnvironment | null = null;
	private readonly store = new IndexedDbWorldStore();

	constructor(
		private readonly worldId: string,
		private readonly seed: string,
		private readonly world: VoxelWorld,
		private readonly player: PlayerController,
		private readonly inventory: Inventory,
		private readonly character: CharacterAppearanceV1,
		private readonly onStatus: (status: SaveStatus) => void
	) {}

	get saveStatus(): SaveStatus {
		return this.status;
	}

	markDirty(): void {
		this.dirty = true;
		this.setStatus('dirty');
	}

	/** Registers the environment so its clock/weather are saved and restored. */
	setEnvironment(environment: PersistableEnvironment): void {
		this.environment = environment;
	}

	async load(): Promise<WorldSave | null> {
		const save = await this.store.load(this.worldId);

		if (!save || save.seed !== this.seed) {
			return null;
		}

		this.world.loadModifications({
			placedBlocks: save.placedBlocks,
			removedBlocks: save.removedBlocks,
			changes: save.changes
		});
		this.inventory.load(save.inventory);
		const position = this.world.safeRestorePosition(save.player.position);
		this.player.setTransform(position, save.player.yaw, save.player.pitch);

		// Only V3 saves carry an environment block; older saves start the sky at
		// its default time, which the environment system already initializes.
		if (save.version === 3) {
			this.environment?.restore(save.environment);
		}

		this.lastSavedPayload = JSON.stringify(this.buildSave(save.updatedAt));
		this.dirty = false;
		this.setStatus('saved');

		return save;
	}

	async save(force = false): Promise<boolean> {
		const now = Date.now();

		if (!force && (!this.dirty || now - this.lastSaveAt < 1500)) {
			return false;
		}

		const save = this.buildSave(now);
		const payload = JSON.stringify(save);

		if (!force && payload === this.lastSavedPayload) {
			this.dirty = false;
			this.setStatus('saved');
			return false;
		}

		this.setStatus('saving');

		try {
			await this.store.save(save);
			this.lastSaveAt = now;
			this.lastSavedPayload = payload;
			this.dirty = false;
			this.setStatus('saved');

			return true;
		} catch {
			this.setStatus('error');
			return false;
		}
	}

	private buildSave(updatedAt: number): WorldSaveV3 {
		const modifications = this.world.exportModifications();

		return {
			version: 3,
			worldId: this.worldId,
			seed: this.seed,
			player: {
				playerId: this.player.state.playerId,
				worldId: this.worldId,
				position: { ...this.player.state.position },
				yaw: this.player.state.yaw,
				pitch: this.player.state.pitch
			},
			character: this.character,
			inventory: this.inventory.snapshot(),
			placedBlocks: modifications.placedBlocks,
			removedBlocks: modifications.removedBlocks,
			changes: modifications.changes,
			environment: this.buildEnvironmentSave(),
			updatedAt
		};
	}

	/**
	 * Produces the environment block for the save. When no environment is
	 * registered (headless tests), a neutral default is written so the V3 shape
	 * is always valid and round-trips cleanly.
	 */
	private buildEnvironmentSave(): EnvironmentSaveState {
		if (this.environment) {
			return this.environment.serialize();
		}

		return {
			version: 1,
			clock: { timeOfDaySeconds: 0, dayNumber: 0 },
			dayLengthSeconds: 1200,
			weather: { current: 'clear', next: 'clear', transition: 0, seed: 0 }
		};
	}

	private setStatus(status: SaveStatus): void {
		this.status = status;
		this.onStatus(status);
	}
}
