import { BlockRegistry } from './BlockRegistry';
import { TerrainGenerator } from './TerrainGenerator';
import {
	type BlockChange,
	type BlockCoordinate,
	type BlockType,
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
	placedBlocks: Array<{ position: BlockCoordinate; type: BlockType }>;
	removedBlocks: BlockCoordinate[];
	changes: BlockChange[];
}

export class VoxelWorld {
	private readonly generator: TerrainGenerator;
	private readonly generatedBlocks = new Map<string, BlockType>();
	private readonly loadedChunks = new Set<string>();
	private readonly placedBlocks = new Map<string, BlockType>();
	private readonly removedBlocks = new Set<string>();
	private readonly changes: BlockChange[] = [];

	constructor(readonly seed: string) {
		this.generator = new TerrainGenerator(seed);
	}

	get terrainGenerator(): TerrainGenerator {
		return this.generator;
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

	ensureChunksAround(position: { x: number; z: number }, radius: number): boolean {
		const center = worldToChunk(position);
		const wanted = new Set<string>();
		let changed = false;

		for (let x = center.x - radius; x <= center.x + radius; x += 1) {
			for (let z = center.z - radius; z <= center.z + radius; z += 1) {
				const coordinate = { x, z };
				const key = chunkKey(coordinate);

				wanted.add(key);

				if (!this.loadedChunks.has(key)) {
					this.generateChunk(coordinate);
					changed = true;
				}
			}
		}

		for (const key of this.loadedChunks) {
			if (!wanted.has(key)) {
				this.loadedChunks.delete(key);
				this.deleteGeneratedChunk(key);
				changed = true;
			}
		}

		return changed;
	}

	getVisibleBlocks(): VoxelBlock[] {
		const blocks: VoxelBlock[] = [];

		for (const [key, type] of this.generatedBlocks) {
			if (this.removedBlocks.has(key) || this.placedBlocks.has(key)) {
				continue;
			}

			const position = parseKey(key);

			if (this.isLoadedBlock(position) && this.isExposed(position)) {
				blocks.push(BlockRegistry.create(type, position));
			}
		}

		for (const [key, type] of this.placedBlocks) {
			if (this.removedBlocks.has(key) || type === 'air') {
				continue;
			}

			const position = parseKey(key);

			if (this.isLoadedBlock(position) && this.isExposed(position)) {
				blocks.push(BlockRegistry.create(type, position));
			}
		}

		return blocks;
	}

	getBlock(position: BlockCoordinate): VoxelBlock {
		const normalized = normalizeBlock(position);

		if (normalized.y < WORLD_MIN_Y || normalized.y > WORLD_MAX_Y) {
			return BlockRegistry.create('air', normalized);
		}

		const key = blockKey(normalized);

		if (this.removedBlocks.has(key)) {
			return BlockRegistry.create('air', normalized);
		}

		const placed = this.placedBlocks.get(key);

		if (placed) {
			return BlockRegistry.create(placed, normalized);
		}

		const generated = this.generatedBlocks.get(key) ?? this.generateBlock(normalized);

		return BlockRegistry.create(generated, normalized);
	}

	setBlock(position: BlockCoordinate, type: BlockType, track = true): boolean {
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
		this.placedBlocks.set(key, type);

		if (track) {
			this.changes.push({
				type: 'placed',
				block: normalized,
				blockType: type,
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
		this.removedBlocks.add(key);

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
		const block = this.peekLoadedBlock(position);

		return block.solid && !block.passable;
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
		this.removedBlocks.clear();
		this.changes.length = 0;

		for (const block of snapshot.placedBlocks) {
			this.placedBlocks.set(blockKey(normalizeBlock(block.position)), block.type);
		}

		for (const block of snapshot.removedBlocks) {
			this.removedBlocks.add(blockKey(normalizeBlock(block)));
		}

		this.changes.push(...snapshot.changes);
	}

	exportModifications(): WorldModificationSnapshot {
		return {
			placedBlocks: Array.from(this.placedBlocks, ([key, type]) => ({
				position: parseKey(key),
				type
			})),
			removedBlocks: Array.from(this.removedBlocks, parseKey),
			changes: [...this.changes]
		};
	}

	private generateChunk(chunk: ChunkCoordinate): void {
		this.loadedChunks.add(chunkKey(chunk));

		for (const block of this.generator.generateChunk(chunk.x, chunk.z).blocks) {
			this.generatedBlocks.set(blockKey(block.position), block.type);
		}
	}

	private deleteGeneratedChunk(key: string): void {
		const [x = '0', z = '0'] = key.split(',');
		const chunk = {
			x: Number.parseInt(x, 10),
			z: Number.parseInt(z, 10)
		};

		for (const block of this.generatedBlocks.keys()) {
			const position = parseKey(block);

			if (worldToChunk(position).x === chunk.x && worldToChunk(position).z === chunk.z) {
				this.generatedBlocks.delete(block);
			}
		}
	}

	private generateBlock(position: BlockCoordinate): BlockType {
		const chunk = worldToChunk(position);
		this.generateChunk(chunk);

		return this.generatedBlocks.get(blockKey(position)) ?? 'air';
	}

	private intersectsSolidAabb(
		position: { x: number; y: number; z: number },
		radius: number,
		height: number
	): boolean {
		const minX = Math.floor(position.x - radius);
		const maxX = Math.floor(position.x + radius);
		const minY = Math.floor(position.y);
		const maxY = Math.floor(position.y + height);
		const minZ = Math.floor(position.z - radius);
		const maxZ = Math.floor(position.z + radius);

		for (let x = minX; x <= maxX; x += 1) {
			for (let y = minY; y <= maxY; y += 1) {
				for (let z = minZ; z <= maxZ; z += 1) {
					if (this.isSolidAt({ x, y, z })) {
						return true;
					}
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

		if (this.removedBlocks.has(key)) {
			return BlockRegistry.create('air', normalized);
		}

		const placed = this.placedBlocks.get(key);

		if (placed) {
			return BlockRegistry.create(placed, normalized);
		}

		const generated = this.generatedBlocks.get(key);

		return BlockRegistry.create(generated ?? 'air', normalized);
	}
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
