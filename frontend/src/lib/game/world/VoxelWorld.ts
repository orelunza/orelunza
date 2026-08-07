import { BlockRegistry } from './BlockRegistry';
import { TerrainGenerator, type WorldTerrainGenerator } from './TerrainGenerator';
import type {
	NaturalTerrainEditSaveState,
	NaturalTerrainOverrideType
} from './erosion/ErosionState';
import {
	type BlockChange,
	type BlockCoordinate,
	type BlockState,
	type BlockType,
	type PlacedBlockSaveState,
	type ChunkCoordinate,
	type VoxelBlock,
	WORLD_MAX_Y,
	WORLD_MIN_Y,
	WORLD_SPAWN,
	blockKey,
	chunkKey,
	worldToChunk
} from './voxel-types';

export interface WorldModificationSnapshot {
	placedBlocks: PlacedBlockSaveState[];
	removedBlocks: BlockCoordinate[];
	changes: BlockChange[];
}

export interface LoadedWaterColumnProfile {
	loaded: boolean;
	groundSurfaceY: number;
	generatedWaterBottomY: number | null;
	generatedWaterSurfaceY: number | null;
	generatedWaterDepth: number;
}

export interface ErosionSurfaceProfile {
	loaded: boolean;
	protectedByPlayer: boolean;
	surfaceY: number;
	type: BlockType;
}

interface GeneratedColumnProfile {
	highestSolidY: number;
	waterBottomY: number | null;
	waterTopY: number | null;
}

interface TransientBlock {
	type: BlockType;
	fillLevel?: number;
}

export class VoxelWorld {
	private readonly generator: WorldTerrainGenerator;
	private readonly generatedBlocks = new Map<string, BlockType>();
	private readonly generatedChunkBlocks = new Map<string, Set<string>>();
	private readonly generatedColumnProfiles = new Map<string, GeneratedColumnProfile>();
	private readonly loadedChunks = new Set<string>();
	private readonly placedBlocks = new Map<string, { type: BlockType; state?: BlockState }>();
	private readonly placedColumnBlocks = new Map<string, Map<number, BlockType>>();
	private readonly removedBlocks = new Set<string>();
	private readonly playerModifiedColumns = new Set<string>();
	private readonly naturalTerrainOverrides = new Map<string, NaturalTerrainOverrideType>();
	private readonly naturalTerrainChunkBlocks = new Map<string, Set<string>>();
	private readonly naturalTerrainColumnBlocks = new Map<
		string,
		Map<number, NaturalTerrainOverrideType>
	>();
	private readonly transientBlocks = new Map<string, TransientBlock>();
	private readonly transientAir = new Set<string>();
	private readonly transientChunkBlocks = new Map<string, Set<string>>();
	private readonly transientWaterColumns = new Map<string, Set<string>>();
	private readonly transientWaterSignatures = new Map<string, string>();
	private readonly changes: BlockChange[] = [];
	private structureVersion = 0;

	constructor(
		readonly seed: string,
		generator?: WorldTerrainGenerator
	) {
		this.generator = generator ?? new TerrainGenerator(seed);
	}

	get terrainGenerator(): WorldTerrainGenerator {
		return this.generator;
	}

	get modificationVersion(): number {
		return this.structureVersion;
	}

	getLoadedChunks(): ChunkCoordinate[] {
		return Array.from(this.loadedChunks, (key) => {
			const [x = '0', z = '0'] = key.split(',');

			return {
				x: Number.parseInt(x, 10),
				z: Number.parseInt(z, 10)
			};
		});
	}

	hasChunk(chunk: ChunkCoordinate): boolean {
		return this.loadedChunks.has(chunkKey(normalizeChunk(chunk)));
	}

	loadChunk(chunk: ChunkCoordinate): boolean {
		const normalized = normalizeChunk(chunk);
		const key = chunkKey(normalized);

		if (this.loadedChunks.has(key)) {
			return false;
		}

		this.generateChunk(normalized);
		this.structureVersion += 1;

		return true;
	}

	unloadChunk(chunk: ChunkCoordinate): boolean {
		const normalized = normalizeChunk(chunk);
		const key = chunkKey(normalized);

		if (!this.loadedChunks.delete(key)) {
			return false;
		}

		this.clearTransientOverridesInChunk(normalized);
		this.deleteGeneratedChunk(key);
		this.structureVersion += 1;

		return true;
	}

	ensureChunksAround(position: { x: number; z: number }, radius: number): boolean {
		const center = worldToChunk(position);
		const wanted = new Set<string>();
		let changed = false;

		for (let x = center.x - radius; x <= center.x + radius; x += 1) {
			for (let z = center.z - radius; z <= center.z + radius; z += 1) {
				const coordinate = { x, z };
				const key = chunkKey(coordinate);

				wanted.add(key);
				changed = this.loadChunk(coordinate) || changed;
			}
		}

		for (const key of [...this.loadedChunks]) {
			if (wanted.has(key)) {
				continue;
			}

			const [x = '0', z = '0'] = key.split(',');
			changed =
				this.unloadChunk({
					x: Number.parseInt(x, 10),
					z: Number.parseInt(z, 10)
				}) || changed;
		}

		return changed;
	}

	getVisibleBlocks(): VoxelBlock[] {
		const keys = new Set<string>();

		for (const key of this.generatedBlocks.keys()) keys.add(key);
		for (const key of this.naturalTerrainOverrides.keys()) keys.add(key);
		for (const key of this.transientBlocks.keys()) keys.add(key);
		for (const key of this.placedBlocks.keys()) keys.add(key);

		const blocks: VoxelBlock[] = [];
		for (const key of keys) {
			const position = parseKey(key);
			if (!this.isLoadedBlock(position)) continue;
			const block = this.peekLoadedBlock(position);
			if (block.type !== 'air' && this.isExposed(position)) blocks.push(block);
		}

		return blocks;
	}

	getVisibleBlocksInChunk(chunk: ChunkCoordinate): VoxelBlock[] {
		const normalized = normalizeChunk(chunk);
		const key = chunkKey(normalized);

		if (!this.loadedChunks.has(key)) {
			return [];
		}

		const keys = new Set<string>(this.generatedChunkBlocks.get(key) ?? []);
		for (const naturalKey of this.naturalTerrainChunkBlocks.get(key) ?? []) keys.add(naturalKey);
		for (const transientKey of this.transientChunkBlocks.get(key) ?? []) keys.add(transientKey);
		for (const blockPositionKey of this.placedBlocks.keys()) {
			if (chunkKey(worldToChunk(parseKey(blockPositionKey))) === key) keys.add(blockPositionKey);
		}

		const blocks: VoxelBlock[] = [];
		for (const blockPositionKey of keys) {
			const position = parseKey(blockPositionKey);
			const block = this.peekLoadedBlock(position);
			if (block.type !== 'air' && this.isExposed(position)) blocks.push(block);
		}

		return blocks;
	}

	getVisibleConstructionBlocks(): VoxelBlock[] {
		return this.getVisibleBlocks().filter((block) => {
			const key = blockKey(block.position);

			if (this.placedBlocks.has(key)) {
				return true;
			}

			return BlockRegistry.get(block.type).category === 'construction';
		});
	}

	/**
	 * Reads a voxel only when its chunk is already loaded.
	 *
	 * Unlike getBlock(), this method never generates a chunk and is therefore
	 * safe for per-frame raycasts, camera collision and interaction previews.
	 */
	getLoadedBlock(position: BlockCoordinate): VoxelBlock | null {
		const normalized = normalizeBlock(position);

		if (!this.isLoadedBlock(normalized)) {
			return null;
		}

		if (normalized.y < WORLD_MIN_Y || normalized.y > WORLD_MAX_Y) {
			return BlockRegistry.create('air', normalized);
		}

		return this.peekLoadedBlock(normalized);
	}

	getBlock(position: BlockCoordinate): VoxelBlock {
		const normalized = normalizeBlock(position);

		if (normalized.y < WORLD_MIN_Y || normalized.y > WORLD_MAX_Y) {
			return BlockRegistry.create('air', normalized);
		}

		const key = blockKey(normalized);
		if (!this.isLoadedBlock(normalized)) this.loadChunk(worldToChunk(normalized));

		const placed = this.placedBlocks.get(key);
		if (placed) return BlockRegistry.create(placed.type, normalized, undefined, placed.state);

		const transient = this.transientBlocks.get(key);
		if (transient) return BlockRegistry.create(transient.type, normalized, transient.fillLevel);
		if (this.transientAir.has(key) || this.removedBlocks.has(key)) {
			return BlockRegistry.create('air', normalized);
		}

		const naturalOverride = this.naturalTerrainOverrides.get(key);
		if (naturalOverride) return BlockRegistry.create(naturalOverride, normalized);

		const generated = this.generatedBlocks.get(key) ?? this.generateBlock(normalized);

		return BlockRegistry.create(generated, normalized);
	}

	setBlock(position: BlockCoordinate, type: BlockType, track = true, state?: BlockState): boolean {
		const normalized = normalizeBlock(position);

		if (type === 'air' || normalized.y < WORLD_MIN_Y || normalized.y > WORLD_MAX_Y) {
			return false;
		}

		const key = blockKey(normalized);
		const current = this.getBlock(normalized).type;

		if (current === type) {
			return false;
		}

		this.removedBlocks.delete(key);
		const normalizedState = BlockRegistry.normalizeState(type, state);
		this.placedBlocks.set(key, { type, state: normalizedState });
		this.indexPlacedBlock(normalized, type);
		this.playerModifiedColumns.add(columnKey(normalized.x, normalized.z));
		this.structureVersion += 1;

		if (track) {
			this.changes.push({
				type: 'placed',
				block: normalized,
				blockType: type,
				state: normalizedState ? { ...normalizedState } : undefined,
				updatedAt: Date.now()
			});
		}

		return true;
	}

	updateBlockState(position: BlockCoordinate, patch: BlockState, track = true): boolean {
		const normalized = normalizeBlock(position);
		if (normalized.y < WORLD_MIN_Y || normalized.y > WORLD_MAX_Y) return false;
		const current = this.getBlock(normalized);
		const definition = BlockRegistry.get(current.type);
		if (!definition.interaction && !definition.orientable) return false;
		const nextState = BlockRegistry.normalizeState(current.type, {
			...(current.state ?? {}),
			...patch
		});
		if (sameBlockState(current.state, nextState)) return false;
		const key = blockKey(normalized);
		this.removedBlocks.delete(key);
		this.placedBlocks.set(key, { type: current.type, state: nextState });
		this.indexPlacedBlock(normalized, current.type);
		this.playerModifiedColumns.add(columnKey(normalized.x, normalized.z));
		this.structureVersion += 1;
		if (track) {
			this.changes.push({
				type: 'placed',
				block: normalized,
				blockType: current.type,
				state: nextState ? { ...nextState } : undefined,
				updatedAt: Date.now()
			});
		}
		return true;
	}

	removeBlock(position: BlockCoordinate, track = true): BlockType | null {
		const normalized = normalizeBlock(position);
		const key = blockKey(normalized);
		const current = this.getBlock(normalized);

		if (current.type === 'air' || !current.collectable) {
			return null;
		}

		this.placedBlocks.delete(key);
		this.unindexPlacedBlock(normalized);
		this.removedBlocks.add(key);
		this.playerModifiedColumns.add(columnKey(normalized.x, normalized.z));
		this.structureVersion += 1;

		if (track) {
			this.changes.push({
				type: 'removed',
				block: normalized,
				blockType: current.type,
				updatedAt: Date.now()
			});
		}

		return current.type;
	}

	isSolidAt(position: BlockCoordinate): boolean {
		const block = this.getBlock(position);

		return block.solid && !block.passable;
	}

	isSolidLoadedAt(position: BlockCoordinate): boolean {
		const block = this.getLoadedBlock(position);

		return block !== null && block.solid && !block.passable;
	}

	getLoadedWaterColumnProfile(x: number, z: number): LoadedWaterColumnProfile {
		const blockX = Math.floor(x);
		const blockZ = Math.floor(z);
		if (!this.hasChunk(worldToChunk({ x: blockX, z: blockZ }))) {
			return {
				loaded: false,
				groundSurfaceY: Math.floor(this.generator.heightAt(blockX, blockZ)) + 1,
				generatedWaterBottomY: null,
				generatedWaterSurfaceY: null,
				generatedWaterDepth: 0
			};
		}

		const key = columnKey(blockX, blockZ);
		const generated = this.generatedColumnProfiles.get(key);
		const placed = this.placedColumnBlocks.get(key);
		const naturalOverrides = this.naturalTerrainColumnBlocks.get(key);
		let highestNaturalOverride = WORLD_MIN_Y - 1;
		if (naturalOverrides) {
			for (const [y, type] of naturalOverrides) {
				if (type !== 'air') highestNaturalOverride = Math.max(highestNaturalOverride, y);
			}
		}
		let highestCandidate = Math.max(
			Math.floor(this.generator.heightAt(blockX, blockZ)),
			generated?.highestSolidY ?? WORLD_MIN_Y,
			highestNaturalOverride
		);

		if (placed) {
			for (const [y, type] of placed) {
				const definition = BlockRegistry.get(type);
				if (definition.solid && !definition.passable)
					highestCandidate = Math.max(highestCandidate, y);
			}
		}

		let highestSolidY = WORLD_MIN_Y - 1;
		for (let y = Math.min(WORLD_MAX_Y, highestCandidate); y >= WORLD_MIN_Y; y -= 1) {
			const block = this.peekLoadedBlockWithoutTransient({ x: blockX, y, z: blockZ });
			if (block.solid && !block.passable) {
				highestSolidY = y;
				break;
			}
		}

		const groundSurfaceY = Math.max(WORLD_MIN_Y, highestSolidY + 1);
		const waterBottomY = generated?.waterBottomY ?? null;
		const waterSurfaceY =
			generated?.waterTopY === null || generated?.waterTopY === undefined
				? null
				: generated.waterTopY + 1;
		const generatedWaterDepth =
			waterSurfaceY === null ? 0 : Math.max(0, waterSurfaceY - groundSurfaceY);

		return {
			loaded: true,
			groundSurfaceY,
			generatedWaterBottomY: waterBottomY,
			generatedWaterSurfaceY: waterSurfaceY,
			generatedWaterDepth
		};
	}

	rainOcclusionAt(x: number, y: number, z: number, maxDistance = 64): number {
		const blockX = Math.floor(x);
		const blockZ = Math.floor(z);
		const startY = Math.max(WORLD_MIN_Y, Math.floor(y) + 1);
		const endY = Math.min(WORLD_MAX_Y, startY + Math.max(1, Math.floor(maxDistance)));

		for (let sampleY = startY; sampleY <= endY; sampleY += 1) {
			const block = this.getLoadedBlock({ x: blockX, y: sampleY, z: blockZ });
			if (!block || !block.solid || block.passable) continue;
			return block.type === 'leaves' ? 0.42 : 1;
		}

		return 0;
	}

	rainExposureAt(x: number, y: number, z: number, maxDistance = 64): number {
		return 1 - this.rainOcclusionAt(x, y, z, maxDistance);
	}

	getErosionSurfaceProfile(x: number, z: number): ErosionSurfaceProfile {
		const blockX = Math.floor(x);
		const blockZ = Math.floor(z);
		const chunk = worldToChunk({ x: blockX, z: blockZ });
		if (!this.hasChunk(chunk)) {
			return {
				loaded: false,
				protectedByPlayer: false,
				surfaceY: WORLD_MIN_Y - 1,
				type: 'air'
			};
		}

		const column = columnKey(blockX, blockZ);
		const profile = this.getLoadedWaterColumnProfile(blockX, blockZ);
		const surfaceY = Math.max(WORLD_MIN_Y - 1, profile.groundSurfaceY - 1);
		const type =
			surfaceY < WORLD_MIN_Y
				? 'air'
				: this.peekLoadedBlockWithoutTransient({ x: blockX, y: surfaceY, z: blockZ }).type;
		return {
			loaded: true,
			protectedByPlayer: this.playerModifiedColumns.has(column),
			surfaceY,
			type
		};
	}

	erodeNaturalSurface(x: number, z: number): { position: BlockCoordinate; type: BlockType } | null {
		const profile = this.getErosionSurfaceProfile(x, z);
		if (!profile.loaded || profile.protectedByPlayer || profile.surfaceY < WORLD_MIN_Y) return null;
		if (!isNaturallyErodible(profile.type)) return null;
		const position = { x: Math.floor(x), y: profile.surfaceY, z: Math.floor(z) };
		if (!this.setNaturalTerrainOverride(position, 'air')) return null;
		return { position, type: profile.type };
	}

	depositNaturalSurface(
		x: number,
		z: number,
		type: Extract<BlockType, 'dirt' | 'sand'>
	): { position: BlockCoordinate; type: BlockType } | null {
		const profile = this.getErosionSurfaceProfile(x, z);
		if (!profile.loaded || profile.protectedByPlayer) return null;
		const y = Math.max(WORLD_MIN_Y, profile.surfaceY + 1);
		if (y > WORLD_MAX_Y) return null;
		const position = { x: Math.floor(x), y, z: Math.floor(z) };
		const key = blockKey(position);
		if (this.placedBlocks.has(key) || this.removedBlocks.has(key)) return null;
		const current = this.peekLoadedBlockWithoutTransient(position);
		if (current.type !== 'air') return null;
		if (!this.setNaturalTerrainOverride(position, type)) return null;
		return { position, type };
	}

	exportNaturalTerrainEdits(): NaturalTerrainEditSaveState[] {
		return [...this.naturalTerrainOverrides.entries()]
			.map(([key, type]) => ({ position: parseKey(key), type }))
			.sort(
				(left, right) =>
					left.position.x - right.position.x ||
					left.position.z - right.position.z ||
					left.position.y - right.position.y
			);
	}

	loadNaturalTerrainEdits(edits: readonly NaturalTerrainEditSaveState[]): void {
		this.naturalTerrainOverrides.clear();
		this.naturalTerrainChunkBlocks.clear();
		this.naturalTerrainColumnBlocks.clear();
		for (const edit of edits) {
			const position = normalizeBlock(edit.position);
			if (position.y < WORLD_MIN_Y || position.y > WORLD_MAX_Y) continue;
			this.setNaturalTerrainOverrideInternal(position, edit.type);
		}
		this.structureVersion += 1;
	}

	private setNaturalTerrainOverride(
		position: BlockCoordinate,
		type: NaturalTerrainOverrideType
	): boolean {
		const normalized = normalizeBlock(position);
		if (normalized.y < WORLD_MIN_Y || normalized.y > WORLD_MAX_Y) return false;
		const key = blockKey(normalized);
		if (this.naturalTerrainOverrides.get(key) === type) return false;
		this.setNaturalTerrainOverrideInternal(normalized, type);
		this.structureVersion += 1;
		return true;
	}

	private setNaturalTerrainOverrideInternal(
		position: BlockCoordinate,
		type: NaturalTerrainOverrideType
	): void {
		const key = blockKey(position);
		this.naturalTerrainOverrides.set(key, type);
		const chunk = chunkKey(worldToChunk(position));
		const chunkBlocks = this.naturalTerrainChunkBlocks.get(chunk) ?? new Set<string>();
		chunkBlocks.add(key);
		this.naturalTerrainChunkBlocks.set(chunk, chunkBlocks);
		const column = columnKey(position.x, position.z);
		const columnBlocks =
			this.naturalTerrainColumnBlocks.get(column) ?? new Map<number, NaturalTerrainOverrideType>();
		columnBlocks.set(position.y, type);
		this.naturalTerrainColumnBlocks.set(column, columnBlocks);
	}

	setTransientWaterColumn(
		x: number,
		z: number,
		groundSurfaceY: number,
		waterDepth: number,
		naturalWaterBottomY: number | null,
		naturalWaterSurfaceY: number | null
	): boolean {
		const blockX = Math.floor(x);
		const blockZ = Math.floor(z);
		const ground = Math.max(WORLD_MIN_Y, Math.min(WORLD_MAX_Y, Math.floor(groundSurfaceY)));
		const depth = Math.max(0, Math.min(32, Number.isFinite(waterDepth) ? waterDepth : 0));
		const signature = `${ground}:${Math.round(depth * 200)}:${naturalWaterBottomY ?? ''}:${naturalWaterSurfaceY ?? ''}`;
		const column = columnKey(blockX, blockZ);
		if (this.transientWaterSignatures.get(column) === signature) return false;

		const cleared = this.clearTransientWaterColumn(blockX, blockZ);
		const desiredTop = Math.min(WORLD_MAX_Y + 1, ground + Math.ceil(depth));
		const naturalBottom = naturalWaterBottomY ?? desiredTop;
		const naturalTop = naturalWaterSurfaceY ?? naturalBottom;
		if (depth <= 0 && naturalTop <= naturalBottom) return cleared;

		const keys = new Set<string>();
		const startY = Math.max(WORLD_MIN_Y, Math.min(ground, naturalBottom));
		const endY = Math.min(WORLD_MAX_Y + 1, Math.max(desiredTop, naturalTop));

		for (let y = startY; y < endY; y += 1) {
			const position = { x: blockX, y, z: blockZ };
			const key = blockKey(position);
			const relative = y - ground;
			if (relative >= 0 && relative < depth) {
				const fillLevel = Math.min(1, Math.max(0.005, depth - relative));
				this.transientBlocks.set(key, { type: 'water', fillLevel });
				this.transientAir.delete(key);
			} else if (y >= naturalBottom && y < naturalTop) {
				this.transientBlocks.delete(key);
				this.transientAir.add(key);
			} else {
				continue;
			}

			keys.add(key);
			this.indexTransientKey(position, key);
		}

		this.transientWaterColumns.set(column, keys);
		this.transientWaterSignatures.set(column, signature);
		return true;
	}

	clearTransientWaterColumn(x: number, z: number): boolean {
		const column = columnKey(Math.floor(x), Math.floor(z));
		const keys = this.transientWaterColumns.get(column);
		if (!keys) return false;

		for (const key of keys) {
			this.transientBlocks.delete(key);
			this.transientAir.delete(key);
			const position = parseKey(key);
			const chunkBlocks = this.transientChunkBlocks.get(chunkKey(worldToChunk(position)));
			chunkBlocks?.delete(key);
		}

		this.transientWaterColumns.delete(column);
		this.transientWaterSignatures.delete(column);
		return true;
	}

	clearTransientOverridesInChunk(chunk: ChunkCoordinate): void {
		const normalized = normalizeChunk(chunk);
		const key = chunkKey(normalized);
		const transientKeys = this.transientChunkBlocks.get(key);
		if (transientKeys) {
			for (const blockPositionKey of [...transientKeys]) {
				const position = parseKey(blockPositionKey);
				this.clearTransientWaterColumn(position.x, position.z);
			}
		}
		this.transientChunkBlocks.delete(key);
	}

	safeRestorePosition(position: { x: number; y: number; z: number }): {
		x: number;
		y: number;
		z: number;
	} {
		if (
			!Number.isFinite(position.x) ||
			!Number.isFinite(position.y) ||
			!Number.isFinite(position.z)
		) {
			return this.spawnPosition();
		}

		const feet = { x: position.x, y: position.y, z: position.z };

		if (this.validatePlayerPosition(feet)) {
			return { ...feet };
		}

		const repaired = this.findSafeSpawnPosition(0.32, 1.78, feet, 8);

		return this.validatePlayerPosition(repaired) ? repaired : this.spawnPosition();
	}

	spawnPosition(): { x: number; y: number; z: number } {
		return this.findSafeSpawnPosition();
	}

	findSafeSpawnPosition(
		radius = 0.32,
		height = 1.78,
		origin: { x: number; z: number } = WORLD_SPAWN,
		searchRadius = 18
	): { x: number; y: number; z: number } {
		let best: { x: number; y: number; z: number } | null = null;
		let bestScore = Number.POSITIVE_INFINITY;

		for (let distance = 0; distance <= searchRadius; distance += 1) {
			for (let dx = -distance; dx <= distance; dx += 1) {
				for (let dz = -distance; dz <= distance; dz += 1) {
					if (Math.max(Math.abs(dx), Math.abs(dz)) !== distance) {
						continue;
					}

					const x = Math.floor(origin.x + dx) + 0.5;
					const z = Math.floor(origin.z + dz) + 0.5;
					const y = this.generator.heightAt(x, z) + 1.04;
					const candidate = { x, y, z };

					if (!this.validatePlayerPosition(candidate, radius, height)) {
						continue;
					}

					const score =
						Math.hypot(x - origin.x, z - origin.z) +
						Math.abs(this.generator.heightAt(x, z) - this.generator.heightAt(origin.x, origin.z)) *
							3;

					if (score < bestScore) {
						best = candidate;
						bestScore = score;
					}
				}
			}

			if (best) {
				return best;
			}
		}

		return {
			x: Math.floor(WORLD_SPAWN.x) + 0.5,
			y: this.generator.heightAt(WORLD_SPAWN.x, WORLD_SPAWN.z) + 1.04,
			z: Math.floor(WORLD_SPAWN.z) + 0.5
		};
	}

	validatePlayerPosition(
		position: { x: number; y: number; z: number },
		radius = 0.32,
		height = 1.78
	): boolean {
		if (
			position.y < WORLD_MIN_Y + 1 ||
			position.y + height > WORLD_MAX_Y ||
			this.intersectsSolidAabb(position, radius, height)
		) {
			return false;
		}

		if (!this.intersectsSolidAabb({ ...position, y: position.y - 0.08 }, radius, height)) {
			return false;
		}

		const centerHeight = this.generator.heightAt(position.x, position.z);

		for (let dx = -2; dx <= 2; dx += 1) {
			for (let dz = -2; dz <= 2; dz += 1) {
				const distance = Math.hypot(dx, dz);

				if (distance > 2.2) {
					continue;
				}

				const sampleHeight = this.generator.heightAt(position.x + dx, position.z + dz);

				if (sampleHeight < centerHeight - 1 || sampleHeight > centerHeight + 1) {
					return false;
				}
			}
		}

		const forwardClear = [
			{ x: position.x, z: position.z - 1 },
			{ x: position.x, z: position.z - 2 }
		];

		return forwardClear.every(
			(sample) =>
				!this.intersectsSolidAabb({ x: sample.x, y: position.y, z: sample.z }, radius, height)
		);
	}

	loadModifications(snapshot: WorldModificationSnapshot): void {
		this.placedBlocks.clear();
		this.placedColumnBlocks.clear();
		this.removedBlocks.clear();
		this.playerModifiedColumns.clear();
		this.changes.length = 0;

		for (const block of snapshot.placedBlocks) {
			const position = normalizeBlock(block.position);
			const state = BlockRegistry.normalizeState(block.type, block.state);
			this.placedBlocks.set(blockKey(position), { type: block.type, state });
			this.indexPlacedBlock(position, block.type);
			this.playerModifiedColumns.add(columnKey(position.x, position.z));
		}

		for (const block of snapshot.removedBlocks) {
			const position = normalizeBlock(block);
			this.removedBlocks.add(blockKey(position));
			this.playerModifiedColumns.add(columnKey(position.x, position.z));
		}

		this.changes.push(...snapshot.changes);
		this.structureVersion += 1;
	}

	exportModifications(): WorldModificationSnapshot {
		return {
			placedBlocks: Array.from(this.placedBlocks, ([key, placed]) => ({
				position: parseKey(key),
				type: placed.type,
				state: placed.state ? { ...placed.state } : undefined
			})),
			removedBlocks: Array.from(this.removedBlocks, parseKey),
			changes: [...this.changes]
		};
	}

	private indexPlacedBlock(position: BlockCoordinate, type: BlockType): void {
		const key = columnKey(position.x, position.z);
		const column = this.placedColumnBlocks.get(key) ?? new Map<number, BlockType>();
		column.set(position.y, type);
		this.placedColumnBlocks.set(key, column);
	}

	private unindexPlacedBlock(position: BlockCoordinate): void {
		const key = columnKey(position.x, position.z);
		const column = this.placedColumnBlocks.get(key);
		if (!column) return;
		column.delete(position.y);
		if (column.size === 0) this.placedColumnBlocks.delete(key);
	}

	private indexGeneratedBlock(position: BlockCoordinate, type: BlockType): void {
		const key = columnKey(position.x, position.z);
		const profile = this.generatedColumnProfiles.get(key) ?? {
			highestSolidY: WORLD_MIN_Y - 1,
			waterBottomY: null,
			waterTopY: null
		};
		const definition = BlockRegistry.get(type);
		if (definition.solid && !definition.passable && type !== 'wood' && type !== 'leaves') {
			profile.highestSolidY = Math.max(profile.highestSolidY, position.y);
		}
		if (type === 'water') {
			profile.waterBottomY =
				profile.waterBottomY === null ? position.y : Math.min(profile.waterBottomY, position.y);
			profile.waterTopY =
				profile.waterTopY === null ? position.y : Math.max(profile.waterTopY, position.y);
		}
		this.generatedColumnProfiles.set(key, profile);
	}

	private indexTransientKey(position: BlockCoordinate, key: string): void {
		const chunk = chunkKey(worldToChunk(position));
		const keys = this.transientChunkBlocks.get(chunk) ?? new Set<string>();
		keys.add(key);
		this.transientChunkBlocks.set(chunk, keys);
	}

	private generateChunk(chunk: ChunkCoordinate): void {
		const normalized = normalizeChunk(chunk);
		const key = chunkKey(normalized);

		if (this.loadedChunks.has(key)) {
			return;
		}

		const blockKeys = new Set<string>();

		for (const block of this.generator.generateChunk(normalized.x, normalized.z).blocks) {
			const blockPositionKey = blockKey(block.position);

			this.generatedBlocks.set(blockPositionKey, block.type);
			this.indexGeneratedBlock(block.position, block.type);
			blockKeys.add(blockPositionKey);
		}

		this.generatedChunkBlocks.set(key, blockKeys);
		this.loadedChunks.add(key);
	}

	private deleteGeneratedChunk(key: string): void {
		const blockKeys = this.generatedChunkBlocks.get(key);

		if (!blockKeys) {
			return;
		}

		for (const blockPositionKey of blockKeys) {
			this.generatedBlocks.delete(blockPositionKey);
		}

		const [chunkX = '0', chunkZ = '0'] = key.split(',');
		const startX = Number.parseInt(chunkX, 10) * 16;
		const startZ = Number.parseInt(chunkZ, 10) * 16;
		for (let x = startX; x < startX + 16; x += 1) {
			for (let z = startZ; z < startZ + 16; z += 1) {
				this.generatedColumnProfiles.delete(columnKey(x, z));
			}
		}

		this.generatedChunkBlocks.delete(key);
	}

	private generateBlock(position: BlockCoordinate): BlockType {
		const chunk = worldToChunk(position);
		this.loadChunk(chunk);

		return this.generatedBlocks.get(blockKey(position)) ?? 'air';
	}

	private intersectsSolidAabb(
		position: { x: number; y: number; z: number },
		radius: number,
		height: number
	): boolean {
		const playerBox = {
			minX: position.x - radius,
			maxX: position.x + radius,
			minY: position.y,
			maxY: position.y + height,
			minZ: position.z - radius,
			maxZ: position.z + radius
		};
		const minX = Math.floor(playerBox.minX);
		const maxX = Math.floor(playerBox.maxX);
		const minY = Math.floor(playerBox.minY);
		const maxY = Math.floor(playerBox.maxY);
		const minZ = Math.floor(playerBox.minZ);
		const maxZ = Math.floor(playerBox.maxZ);

		for (let x = minX; x <= maxX; x += 1) {
			for (let y = minY; y <= maxY; y += 1) {
				for (let z = minZ; z <= maxZ; z += 1) {
					const block = this.getBlock({ x, y, z });
					const local = BlockRegistry.collisionBox(block);
					if (!local) continue;
					if (
						playerBox.minX < x + local.maxX &&
						playerBox.maxX > x + local.minX &&
						playerBox.minY < y + local.maxY &&
						playerBox.maxY > y + local.minY &&
						playerBox.minZ < z + local.maxZ &&
						playerBox.maxZ > z + local.minZ
					)
						return true;
				}
			}
		}

		return false;
	}

	private isExposed(position: BlockCoordinate): boolean {
		const neighbors: BlockCoordinate[] = [
			{ x: position.x + 1, y: position.y, z: position.z },
			{ x: position.x - 1, y: position.y, z: position.z },
			{ x: position.x, y: position.y + 1, z: position.z },
			{ x: position.x, y: position.y - 1, z: position.z },
			{ x: position.x, y: position.y, z: position.z + 1 },
			{ x: position.x, y: position.y, z: position.z - 1 }
		];

		return neighbors.some((neighbor) => {
			const block = this.peekLoadedBlock(neighbor);

			return block.type === 'air' || block.transparent;
		});
	}

	private isLoadedBlock(position: BlockCoordinate): boolean {
		return this.loadedChunks.has(chunkKey(worldToChunk(position)));
	}

	private peekLoadedBlock(position: BlockCoordinate): VoxelBlock {
		const normalized = normalizeBlock(position);
		const key = blockKey(normalized);
		const placed = this.placedBlocks.get(key);

		if (placed) {
			return BlockRegistry.create(placed.type, normalized, undefined, placed.state);
		}

		const transient = this.transientBlocks.get(key);
		if (transient) {
			return BlockRegistry.create(transient.type, normalized, transient.fillLevel);
		}

		if (this.transientAir.has(key) || this.removedBlocks.has(key)) {
			return BlockRegistry.create('air', normalized);
		}

		const naturalOverride = this.naturalTerrainOverrides.get(key);
		if (naturalOverride) return BlockRegistry.create(naturalOverride, normalized);

		const generated = this.generatedBlocks.get(key);

		return BlockRegistry.create(generated ?? 'air', normalized);
	}

	private peekLoadedBlockWithoutTransient(position: BlockCoordinate): VoxelBlock {
		const normalized = normalizeBlock(position);
		const key = blockKey(normalized);
		const placed = this.placedBlocks.get(key);
		if (placed) return BlockRegistry.create(placed.type, normalized, undefined, placed.state);
		if (this.removedBlocks.has(key)) return BlockRegistry.create('air', normalized);
		const naturalOverride = this.naturalTerrainOverrides.get(key);
		if (naturalOverride) return BlockRegistry.create(naturalOverride, normalized);
		return BlockRegistry.create(this.generatedBlocks.get(key) ?? 'air', normalized);
	}
}

function sameBlockState(left?: BlockState, right?: BlockState): boolean {
	return (
		(left?.facing ?? null) === (right?.facing ?? null) &&
		(left?.open ?? null) === (right?.open ?? null) &&
		(left?.lit ?? null) === (right?.lit ?? null) &&
		(left?.powered ?? null) === (right?.powered ?? null)
	);
}

function isNaturallyErodible(type: BlockType): boolean {
	return type === 'grass' || type === 'dirt' || type === 'sand' || type === 'stone';
}

function columnKey(x: number, z: number): string {
	return `${Math.floor(x)},${Math.floor(z)}`;
}

function normalizeChunk(chunk: ChunkCoordinate): ChunkCoordinate {
	if (!Number.isFinite(chunk.x) || !Number.isFinite(chunk.z)) {
		throw new Error('Chunk coordinates must be finite.');
	}

	return {
		x: Math.trunc(chunk.x),
		z: Math.trunc(chunk.z)
	};
}

function normalizeBlock(position: BlockCoordinate): BlockCoordinate {
	return {
		x: Math.floor(position.x),
		y: Math.floor(position.y),
		z: Math.floor(position.z)
	};
}

function parseKey(key: string): BlockCoordinate {
	const [x = '0', y = '0', z = '0'] = key.split(',');

	return {
		x: Number.parseInt(x, 10),
		y: Number.parseInt(y, 10),
		z: Number.parseInt(z, 10)
	};
}
