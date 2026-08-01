import type { InventorySnapshot } from '../inventory/Inventory';
import type { PlayerTransform } from '../game-types';
import type { BlockChange, BlockCoordinate, BlockType } from './voxel-types';

export interface WorldSaveV1 {
	version: 1;
	worldId: string;
	seed: string;
	player: PlayerTransform;
	inventory: InventorySnapshot;
	placedBlocks: Array<{ position: BlockCoordinate; type: BlockType }>;
	removedBlocks: BlockCoordinate[];
	changes: BlockChange[];
	updatedAt: number;
}

export function serializeWorldSave(save: WorldSaveV1): string {
	return JSON.stringify(save);
}

export function parseWorldSave(value: string): WorldSaveV1 | null {
	const parsed: unknown = JSON.parse(value);

	if (!isWorldSaveV1(parsed)) {
		return null;
	}

	return parsed;
}

export function isWorldSaveV1(value: unknown): value is WorldSaveV1 {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Partial<WorldSaveV1>;

	return (
		candidate.version === 1 &&
		typeof candidate.worldId === 'string' &&
		typeof candidate.seed === 'string' &&
		Array.isArray(candidate.placedBlocks) &&
		Array.isArray(candidate.removedBlocks)
	);
}
