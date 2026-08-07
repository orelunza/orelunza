import type { VoxelWorld } from '../VoxelWorld';
import { BlockRegistry } from '../BlockRegistry';
import {
	buildingAtWorld,
	buildingPowerPanelPosition,
	type UrbanBuildingDefinition
} from './UrbanBuildingRegistry';
import type { BlockCoordinate, BlockType } from '../voxel-types';

const POWER_CONSUMERS = new Set<BlockType>([
	'ceiling_light',
	'floor_lamp',
	'radio',
	'refrigerator',
	'drink_cooler',
	'glass_door',
	'elevator_door',
	'elevator_call_button',
	'elevator_panel'
]);

export interface UrbanPowerToggleResult {
	handled: boolean;
	powered: boolean;
	buildingLabel?: string;
	changed: BlockCoordinate[];
}

export class UrbanPowerSystem {
	constructor(private readonly world: VoxelWorld) {}

	isPoweredAt(position: Pick<BlockCoordinate, 'x' | 'z'>): boolean {
		const building = buildingAtWorld(position.x, position.z);
		if (!building) return true;
		return this.isBuildingPowered(building);
	}

	toggleAt(position: BlockCoordinate): UrbanPowerToggleResult {
		const building = buildingAtWorld(position.x, position.z);
		if (!building) return { handled: false, powered: true, changed: [] };
		const panel = this.world.getLoadedBlock(position);
		if (panel?.type !== 'power_panel') return { handled: false, powered: true, changed: [] };
		const powered = panel.state?.powered === false;
		const changed: BlockCoordinate[] = [];
		if (this.world.updateBlockState(position, { powered })) changed.push({ ...position });

		for (const chunk of this.world.getLoadedChunks()) {
			for (const block of this.world.getVisibleBlocksInChunk(chunk)) {
				if (!POWER_CONSUMERS.has(block.type)) continue;
				const owner = buildingAtWorld(block.position.x, block.position.z);
				if (owner?.id !== building.id) continue;
				if (this.world.updateBlockState(block.position, { powered }))
					changed.push({ ...block.position });
			}
		}
		return { handled: true, powered, buildingLabel: building.label, changed };
	}

	private isBuildingPowered(building: UrbanBuildingDefinition): boolean {
		const groundY = Math.floor(
			this.world.terrainGenerator.heightAt(
				buildingPowerPanelPosition(building).x,
				buildingPowerPanelPosition(building).z
			)
		);
		const panelPosition = buildingPowerPanelPosition(building, groundY);
		const panel = this.world.getLoadedBlock(panelPosition);
		return panel?.type !== 'power_panel' || panel.state?.powered !== false;
	}
}
