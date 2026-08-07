import type { Inventory } from '../inventory/Inventory';
import { BlockRegistry } from '../world/BlockRegistry';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { BlockCoordinate, BlockState, BlockType } from '../world/voxel-types';
import type { TargetedBlock } from '../game-types';
import type { PlayerCollider } from '../player/PlayerCollider';
import type { PlayerState } from '../player/PlayerState';
import {
	blockStateForPlacement,
	placementRuleAllows
} from '../world/civilization/CivilizationBlocks';

export interface BlockPlacementPreview {
	position: BlockCoordinate;
	allowed: boolean;
	liftsPlayer: boolean;
	state?: BlockState;
}

export class BlockPlacementSystem {
	constructor(
		private readonly world: VoxelWorld,
		private readonly inventory: Inventory,
		private readonly player: PlayerState,
		private readonly collider: PlayerCollider,
		private readonly onChanged: (position: BlockCoordinate) => void
	) {}

	preview(target: TargetedBlock | null, selected: BlockType | null): BlockPlacementPreview | null {
		if (!target || !selected || selected === 'air') {
			return null;
		}

		const definition = BlockRegistry.get(selected);

		if (
			!definition.placeable ||
			!isCardinalNormal(target.normal) ||
			!placementRuleAllows(selected, target)
		) {
			return null;
		}

		const targetedBlock = this.world.getLoadedBlock(target.block);

		if (!targetedBlock || targetedBlock.type === 'air') {
			return null;
		}

		const position = placementPosition(target);
		const state = blockStateForPlacement(selected, target, this.player.bodyYaw);
		const destination = this.world.getLoadedBlock(position);

		if (!destination) {
			return null;
		}

		let allowed = destination.type === 'air' || destination.type === 'water';
		let pillarLiftPosition: { x: number; y: number; z: number } | null = null;

		if (
			allowed &&
			definition.solid &&
			this.collider.intersectsPlayerBlock(this.player, position, selected, state)
		) {
			pillarLiftPosition = this.resolvePillarLiftPosition(target, position, selected, state);
			allowed =
				pillarLiftPosition !== null && !this.collider.wouldCollide(this.player, pillarLiftPosition);
		}

		return {
			position,
			allowed,
			liftsPlayer: pillarLiftPosition !== null && allowed,
			state
		};
	}

	place(target: TargetedBlock | null, selected: BlockType | null, creative = false): boolean {
		const preview = this.preview(target, selected);

		if (!preview?.allowed || !target || !selected) {
			return false;
		}

		let consumed = false;

		if (!creative) {
			consumed = this.inventory.removeItem(selected, 1);

			if (!consumed) {
				return false;
			}
		}

		const pillarLiftPosition = preview.liftsPlayer
			? this.resolvePillarLiftPosition(target, preview.position, selected, preview.state)
			: null;

		if (!this.world.setBlock(preview.position, selected, true, preview.state)) {
			this.refund(selected, consumed);
			return false;
		}

		if (pillarLiftPosition) {
			this.player.position.x = pillarLiftPosition.x;
			this.player.position.y = pillarLiftPosition.y;
			this.player.position.z = pillarLiftPosition.z;
			this.player.velocity.y = 0;
			this.player.verticalSpeed = 0;
			this.player.onGround = true;
			this.player.stepEvent = null;
		}

		this.onChanged(preview.position);

		return true;
	}

	private resolvePillarLiftPosition(
		target: TargetedBlock,
		position: BlockCoordinate,
		type: BlockType,
		state?: BlockState
	): { x: number; y: number; z: number } | null {
		if (target.normal.x !== 0 || target.normal.y !== 1 || target.normal.z !== 0) {
			return null;
		}

		const previewBlock = BlockRegistry.create(type, position, undefined, state);
		const collision = BlockRegistry.collisionBox(previewBlock);
		const blockTop = position.y + (collision?.maxY ?? 1);
		const liftHeight = blockTop - this.player.position.y;
		const horizontalOverlap =
			this.player.position.x + this.player.radius > position.x &&
			this.player.position.x - this.player.radius < position.x + 1 &&
			this.player.position.z + this.player.radius > position.z &&
			this.player.position.z - this.player.radius < position.z + 1;

		// Assisted pillar building: placing on the top face directly beneath the
		// player's footprint lifts the feet onto the new block. Side placements
		// and blocks intersecting the torso remain forbidden.
		if (!horizontalOverlap || liftHeight <= 0 || liftHeight > 1.001) {
			return null;
		}

		return {
			x: this.player.position.x,
			y: blockTop,
			z: this.player.position.z
		};
	}

	private refund(type: BlockType, consumed: boolean): void {
		if (consumed) {
			this.inventory.addItem(type, 1);
		}
	}
}

export function placementPosition(target: TargetedBlock): BlockCoordinate {
	if (target.type === 'water') {
		return { ...target.block };
	}

	return {
		x: target.block.x + target.normal.x,
		y: target.block.y + target.normal.y,
		z: target.block.z + target.normal.z
	};
}

function isCardinalNormal(normal: BlockCoordinate): boolean {
	if (!Number.isInteger(normal.x) || !Number.isInteger(normal.y) || !Number.isInteger(normal.z)) {
		return false;
	}

	return Math.abs(normal.x) + Math.abs(normal.y) + Math.abs(normal.z) === 1;
}
