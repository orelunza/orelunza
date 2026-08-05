import type { GroundSpeciesId, TreeSpeciesId } from './VegetationFamily';

export interface WeightedSpecies<T extends string> {
	id: T;
	weight: number;
}

export interface BiomeVegetationProfile {
	zone: string;
	treeDensity: number;
	groundDensity: number;
	trees: readonly WeightedSpecies<TreeSpeciesId>[];
	ground: readonly WeightedSpecies<GroundSpeciesId>[];
}

const PROFILES: Record<string, BiomeVegetationProfile> = {
	'Central City': {
		zone: 'Central City',
		treeDensity: 0,
		groundDensity: 0.02,
		trees: [],
		ground: [{ id: 'meadow_short_grass', weight: 1 }]
	},
	Riverbank: {
		zone: 'Riverbank',
		treeDensity: 0.16,
		groundDensity: 0.46,
		trees: [
			{ id: 'willow_drooping', weight: 5 },
			{ id: 'palm_crown', weight: 2 },
			{ id: 'oak_round', weight: 1 }
		],
		ground: [
			{ id: 'forest_fern', weight: 3 },
			{ id: 'meadow_short_grass', weight: 3 },
			{ id: 'white_flower', weight: 1 },
			{ id: 'moss_patch', weight: 2 }
		]
	},
	'Forest Edge': {
		zone: 'Forest Edge',
		treeDensity: 0.42,
		groundDensity: 0.72,
		trees: [
			{ id: 'oak_round', weight: 4 },
			{ id: 'pine_layered', weight: 3 },
			{ id: 'willow_drooping', weight: 1 },
			{ id: 'kapok_emergent', weight: 1 }
		],
		ground: [
			{ id: 'forest_fern', weight: 5 },
			{ id: 'low_shrub', weight: 3 },
			{ id: 'dense_shrub', weight: 1 },
			{ id: 'violet_flower', weight: 1 },
			{ id: 'moss_patch', weight: 3 }
		]
	},
	'Free Build Meadow': {
		zone: 'Free Build Meadow',
		treeDensity: 0,
		groundDensity: 0.34,
		trees: [],
		ground: [
			{ id: 'meadow_short_grass', weight: 7 },
			{ id: 'yellow_flower', weight: 2 },
			{ id: 'white_flower', weight: 1 },
			{ id: 'low_shrub', weight: 1 }
		]
	},
	'Spawn Meadow': {
		zone: 'Spawn Meadow',
		treeDensity: 0.1,
		groundDensity: 0.52,
		trees: [
			{ id: 'oak_round', weight: 5 },
			{ id: 'acacia_spreading', weight: 3 },
			{ id: 'willow_drooping', weight: 1 }
		],
		ground: [
			{ id: 'meadow_short_grass', weight: 7 },
			{ id: 'yellow_flower', weight: 2 },
			{ id: 'white_flower', weight: 2 },
			{ id: 'violet_flower', weight: 1 },
			{ id: 'low_shrub', weight: 1 }
		]
	},
	'Amazon Rainforest': {
		zone: 'Amazon Rainforest',
		treeDensity: 0.62,
		groundDensity: 0.88,
		trees: [
			{ id: 'kapok_emergent', weight: 4 },
			{ id: 'palm_crown', weight: 4 },
			{ id: 'acacia_spreading', weight: 2 },
			{ id: 'willow_drooping', weight: 1 }
		],
		ground: [
			{ id: 'tropical_fern', weight: 6 },
			{ id: 'dense_shrub', weight: 4 },
			{ id: 'forest_fern', weight: 2 },
			{ id: 'tropical_flower', weight: 1 },
			{ id: 'moss_patch', weight: 3 }
		]
	},
	'Pine Highlands': {
		zone: 'Pine Highlands',
		treeDensity: 0.4,
		groundDensity: 0.48,
		trees: [
			{ id: 'pine_layered', weight: 7 },
			{ id: 'oak_round', weight: 1 }
		],
		ground: [
			{ id: 'forest_fern', weight: 3 },
			{ id: 'low_shrub', weight: 3 },
			{ id: 'moss_patch', weight: 4 },
			{ id: 'violet_flower', weight: 1 }
		]
	}
};

const DEFAULT_PROFILE = PROFILES['Spawn Meadow'];

export function biomeVegetationProfile(zone: string): BiomeVegetationProfile {
	return PROFILES[zone] ?? DEFAULT_PROFILE;
}

export function allBiomeVegetationProfiles(): readonly BiomeVegetationProfile[] {
	return Object.values(PROFILES);
}
