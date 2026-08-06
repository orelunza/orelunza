import type { BlockCoordinate, BlockType } from '../voxel-types';
import { planetSurfaceBlockKey } from '../../planet/surface/PlanetSurfaceChunkId';
import type { VoxelWorld } from '../VoxelWorld';

export interface PlanetTerrainEdit {
	key: string;
	position: BlockCoordinate;
	originalBlock: BlockType;
	replacementBlock: BlockType | null;
	updatedAt: number;
}

export interface PlanetTerrainEditStoreSaveState {
	version: 1;
	anchorId: string;
	edits: PlanetTerrainEdit[];
}

export class PlanetTerrainEditStore {
	private readonly edits = new Map<string, PlanetTerrainEdit>();

	constructor(readonly anchorId: string) {
		if (!anchorId) {
			throw new RangeError('Planet terrain edit store requires an anchor id.');
		}
	}

	get size(): number {
		return this.edits.size;
	}

	record(
		position: Readonly<BlockCoordinate>,
		originalBlock: BlockType,
		replacementBlock: BlockType | null,
		updatedAt = Date.now()
	): PlanetTerrainEdit {
		const normalized = {
			x: Math.floor(position.x),
			y: Math.floor(position.y),
			z: Math.floor(position.z)
		};
		const key = planetSurfaceBlockKey(this.anchorId, normalized);
		const edit: PlanetTerrainEdit = {
			key,
			position: normalized,
			originalBlock,
			replacementBlock,
			updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now()
		};
		this.edits.set(key, edit);
		return { ...edit, position: { ...edit.position } };
	}

	get(position: Readonly<BlockCoordinate>): PlanetTerrainEdit | null {
		const edit = this.edits.get(planetSurfaceBlockKey(this.anchorId, position));
		return edit ? { ...edit, position: { ...edit.position } } : null;
	}

	apply(world: VoxelWorld): void {
		for (const edit of this.edits.values()) {
			if (edit.replacementBlock === null || edit.replacementBlock === 'air') {
				world.removeBlock(edit.position, false);
			} else {
				world.setBlock(edit.position, edit.replacementBlock, false);
			}
		}
	}

	serialize(): PlanetTerrainEditStoreSaveState {
		return {
			version: 1,
			anchorId: this.anchorId,
			edits: Array.from(this.edits.values(), (edit) => ({
				...edit,
				position: { ...edit.position }
			}))
		};
	}

	restore(state: Readonly<PlanetTerrainEditStoreSaveState>): void {
		if (state.version !== 1 || state.anchorId !== this.anchorId || !Array.isArray(state.edits)) {
			throw new TypeError('Invalid planet terrain edit state.');
		}
		this.edits.clear();
		for (const edit of state.edits) {
			this.record(edit.position, edit.originalBlock, edit.replacementBlock, edit.updatedAt);
		}
	}
}
