import type { TargetedBlock } from '../game-types';
import type { VegetationInteractionInstance } from '../vegetation/VegetationInteractionIndex';

export interface BlockBuildTarget {
	kind: 'block';
	distance: number;
	block: TargetedBlock;
}

export interface VegetationBuildTarget extends VegetationInteractionInstance {
	kind: 'vegetation';
	distance: number;
}

export type BuildTarget = BlockBuildTarget | VegetationBuildTarget;

export interface CreationRaycastResult {
	target: BuildTarget | null;
	blockTarget: TargetedBlock | null;
}
