import type { InventorySnapshot } from '../inventory/Inventory';
import type { PlayerTransform } from '../game-types';
import type { BlockChange, BlockCoordinate, BlockType } from './voxel-types';
import type { CharacterAppearanceV1 } from '../character/CharacterAppearance';

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

export interface WorldSaveV2 {
	version: 2;
	worldId: string;
	seed: string;
	player: PlayerTransform;
	character: CharacterAppearanceV1;
	inventory: InventorySnapshot;
	placedBlocks: Array<{ position: BlockCoordinate; type: BlockType }>;
	removedBlocks: BlockCoordinate[];
	changes: BlockChange[];
	updatedAt: number;
}

export type WorldSave = WorldSaveV1 | WorldSaveV2;

export function serializeWorldSave(save: WorldSave): string {
	return JSON.stringify(save);
}

export function parseWorldSave(value: string): WorldSave | null {
	const parsed: unknown = JSON.parse(value);

	if (isWorldSaveV2(parsed) || isWorldSaveV1(parsed)) {
		return parsed;
	}

	return null;
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

export function isWorldSaveV2(value: unknown): value is WorldSaveV2 {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Partial<WorldSaveV2>;

	return (
		candidate.version === 2 &&
		typeof candidate.worldId === 'string' &&
		typeof candidate.seed === 'string' &&
		!!candidate.character &&
		Array.isArray(candidate.placedBlocks) &&
		Array.isArray(candidate.removedBlocks)
	);
}
