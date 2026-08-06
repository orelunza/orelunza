import type { BlockType } from '../../world/voxel-types';
import type { PlanetBiomeId } from './PlanetBiome';

export interface PlanetBiomeProfile {
	id: PlanetBiomeId;
	label: string;
	zoneName: string;
	vegetationDensity: number;
	treeDensity: number;
	surfaceMoisture: number;
	surfaceBlock: Extract<BlockType, 'grass' | 'sand' | 'stone' | 'dirt'>;
	subsurfaceBlock: Extract<BlockType, 'dirt' | 'sand' | 'stone'>;
}

const PROFILES: Readonly<Record<PlanetBiomeId, PlanetBiomeProfile>> = Object.freeze({
	'tropical-rainforest': profile(
		'tropical-rainforest',
		'Tropical Rainforest',
		0.96,
		0.88,
		0.9,
		'grass',
		'dirt'
	),
	'tropical-seasonal-forest': profile(
		'tropical-seasonal-forest',
		'Tropical Seasonal Forest',
		0.82,
		0.68,
		0.66,
		'grass',
		'dirt'
	),
	savanna: profile('savanna', 'Savanna', 0.66, 0.22, 0.34, 'grass', 'dirt'),
	'temperate-forest': profile(
		'temperate-forest',
		'Temperate Forest',
		0.84,
		0.66,
		0.58,
		'grass',
		'dirt'
	),
	'boreal-forest': profile('boreal-forest', 'Boreal Forest', 0.7, 0.6, 0.48, 'grass', 'dirt'),
	grassland: profile('grassland', 'Grassland', 0.64, 0.08, 0.32, 'grass', 'dirt'),
	shrubland: profile('shrubland', 'Shrubland', 0.38, 0.06, 0.2, 'grass', 'dirt'),
	desert: profile('desert', 'Desert', 0.05, 0.005, 0.03, 'sand', 'sand'),
	alpine: profile('alpine', 'Alpine', 0.18, 0.015, 0.26, 'stone', 'stone'),
	polar: profile('polar', 'Polar', 0.03, 0, 0.18, 'stone', 'stone'),
	wetland: profile('wetland', 'Wetland', 0.88, 0.28, 0.98, 'grass', 'dirt'),
	mangrove: profile('mangrove', 'Mangrove', 0.9, 0.72, 1, 'dirt', 'dirt'),
	cropland: profile('cropland', 'Cropland', 0.42, 0.025, 0.46, 'grass', 'dirt'),
	urban: profile('urban', 'Urban', 0.08, 0.01, 0.18, 'stone', 'stone'),
	coast: profile('coast', 'Coast', 0.28, 0.08, 0.7, 'sand', 'sand'),
	freshwater: profile('freshwater', 'Freshwater', 0, 0, 1, 'sand', 'sand'),
	ocean: profile('ocean', 'Ocean', 0, 0, 1, 'sand', 'sand')
});

export function planetBiomeProfile(id: PlanetBiomeId): PlanetBiomeProfile {
	return PROFILES[id];
}

export function allPlanetBiomeProfiles(): readonly PlanetBiomeProfile[] {
	return Object.values(PROFILES);
}

function profile(
	id: PlanetBiomeId,
	label: string,
	vegetationDensity: number,
	treeDensity: number,
	surfaceMoisture: number,
	surfaceBlock: PlanetBiomeProfile['surfaceBlock'],
	subsurfaceBlock: PlanetBiomeProfile['subsurfaceBlock']
): PlanetBiomeProfile {
	return {
		id,
		label,
		zoneName: `Planet ${label}`,
		vegetationDensity,
		treeDensity,
		surfaceMoisture,
		surfaceBlock,
		subsurfaceBlock
	};
}
