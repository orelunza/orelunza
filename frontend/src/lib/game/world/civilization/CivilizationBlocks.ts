import type { TargetedBlock } from '../../game-types';
import { BlockRegistry } from '../BlockRegistry';
import type { BlockFacing, BlockState, BlockType } from '../voxel-types';

export function placementRuleAllows(type: BlockType, target: TargetedBlock): boolean {
	const rule = BlockRegistry.get(type).placement ?? 'any';
	if (rule === 'any') return isCardinal(target.normal);
	if (rule === 'floor')
		return target.normal.x === 0 && target.normal.y === 1 && target.normal.z === 0;
	return target.normal.y === 0 && Math.abs(target.normal.x) + Math.abs(target.normal.z) === 1;
}

export function blockStateForPlacement(
	type: BlockType,
	target: TargetedBlock,
	playerYaw: number
): BlockState | undefined {
	const definition = BlockRegistry.get(type);
	const base = BlockRegistry.defaultState(type);
	if (!definition.orientable) return base;
	return BlockRegistry.normalizeState(type, {
		...(base ?? {}),
		facing: facingForPlacement(target, playerYaw)
	});
}

export function facingForPlacement(target: TargetedBlock, playerYaw: number): BlockFacing {
	if (target.normal.y === 0) {
		if (target.normal.x > 0) return 'east';
		if (target.normal.x < 0) return 'west';
		if (target.normal.z > 0) return 'south';
		if (target.normal.z < 0) return 'north';
	}
	return facingFromYaw(playerYaw);
}

export function facingFromYaw(yaw: number): BlockFacing {
	const safeYaw = Number.isFinite(yaw) ? yaw : 0;
	const x = Math.sin(safeYaw);
	const z = Math.cos(safeYaw);
	if (Math.abs(x) > Math.abs(z)) return x >= 0 ? 'east' : 'west';
	return z >= 0 ? 'south' : 'north';
}

export function yawForFacing(facing: BlockFacing | undefined): number {
	switch (facing) {
		case 'east':
			return Math.PI / 2;
		case 'south':
			return Math.PI;
		case 'west':
			return -Math.PI / 2;
		case 'north':
		default:
			return 0;
	}
}

function isCardinal(normal: Readonly<{ x: number; y: number; z: number }>): boolean {
	return Math.abs(normal.x) + Math.abs(normal.y) + Math.abs(normal.z) === 1;
}
