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

function create(
	zone: string,
	treeDensity: number,
	groundDensity: number,
	trees: readonly WeightedSpecies<TreeSpeciesId>[],
	ground: readonly WeightedSpecies<GroundSpeciesId>[]
): BiomeVegetationProfile {
	return { zone, treeDensity, groundDensity, trees, ground };
}

const PROFILES: Record<string, BiomeVegetationProfile> = {
	'Central City': create('Central City', 0, 0.02, [], [{ id: 'meadow_short_grass', weight: 1 }]),
	Riverbank: create(
		'Riverbank',
		0.16,
		0.46,
		[
			{ id: 'willow_drooping', weight: 5 },
			{ id: 'palm_crown', weight: 2 },
			{ id: 'oak_round', weight: 1 }
		],
		[
			{ id: 'forest_fern', weight: 3 },
			{ id: 'meadow_short_grass', weight: 3 },
			{ id: 'white_flower', weight: 1 },
			{ id: 'moss_patch', weight: 2 }
		]
	),
	'Forest Edge': create(
		'Forest Edge',
		0.42,
		0.72,
		[
			{ id: 'oak_round', weight: 4 },
			{ id: 'pine_layered', weight: 3 },
			{ id: 'willow_drooping', weight: 1 },
			{ id: 'kapok_emergent', weight: 1 }
		],
		[
			{ id: 'forest_fern', weight: 5 },
			{ id: 'low_shrub', weight: 3 },
			{ id: 'dense_shrub', weight: 1 },
			{ id: 'violet_flower', weight: 1 },
			{ id: 'moss_patch', weight: 3 }
		]
	),
	'Free Build Meadow': create(
		'Free Build Meadow',
		0,
		0.34,
		[],
		[
			{ id: 'meadow_short_grass', weight: 7 },
			{ id: 'yellow_flower', weight: 2 },
			{ id: 'white_flower', weight: 1 },
			{ id: 'low_shrub', weight: 1 }
		]
	),
	'Spawn Meadow': create(
		'Spawn Meadow',
		0.1,
		0.52,
		[
			{ id: 'oak_round', weight: 5 },
			{ id: 'acacia_spreading', weight: 3 },
			{ id: 'willow_drooping', weight: 1 }
		],
		[
			{ id: 'meadow_short_grass', weight: 7 },
			{ id: 'yellow_flower', weight: 2 },
			{ id: 'white_flower', weight: 2 },
			{ id: 'violet_flower', weight: 1 },
			{ id: 'low_shrub', weight: 1 }
		]
	),
	'Amazon Rainforest': create(
		'Amazon Rainforest',
		0.62,
		0.88,
		[
			{ id: 'kapok_emergent', weight: 4 },
			{ id: 'palm_crown', weight: 4 },
			{ id: 'acacia_spreading', weight: 2 },
			{ id: 'willow_drooping', weight: 1 }
		],
		[
			{ id: 'tropical_fern', weight: 6 },
			{ id: 'dense_shrub', weight: 4 },
			{ id: 'forest_fern', weight: 2 },
			{ id: 'tropical_flower', weight: 1 },
			{ id: 'moss_patch', weight: 3 }
		]
	),
	'Pine Highlands': create(
		'Pine Highlands',
		0.4,
		0.48,
		[
			{ id: 'pine_layered', weight: 7 },
			{ id: 'oak_round', weight: 1 }
		],
		[
			{ id: 'forest_fern', weight: 3 },
			{ id: 'low_shrub', weight: 3 },
			{ id: 'moss_patch', weight: 4 },
			{ id: 'violet_flower', weight: 1 }
		]
	),
	'Planet Tropical Rainforest': create(
		'Planet Tropical Rainforest',
		0.78,
		0.9,
		[
			{ id: 'kapok_emergent', weight: 5 },
			{ id: 'palm_crown', weight: 4 },
			{ id: 'willow_drooping', weight: 1 }
		],
		[
			{ id: 'tropical_fern', weight: 7 },
			{ id: 'dense_shrub', weight: 4 },
			{ id: 'tropical_flower', weight: 1 },
			{ id: 'moss_patch', weight: 3 }
		]
	),
	'Planet Tropical Seasonal Forest': create(
		'Planet Tropical Seasonal Forest',
		0.6,
		0.72,
		[
			{ id: 'acacia_spreading', weight: 4 },
			{ id: 'palm_crown', weight: 3 },
			{ id: 'kapok_emergent', weight: 2 }
		],
		[
			{ id: 'tropical_fern', weight: 3 },
			{ id: 'low_shrub', weight: 4 },
			{ id: 'meadow_short_grass', weight: 3 }
		]
	),
	'Planet Savanna': create(
		'Planet Savanna',
		0.18,
		0.78,
		[
			{ id: 'acacia_spreading', weight: 8 },
			{ id: 'palm_crown', weight: 1 }
		],
		[
			{ id: 'meadow_short_grass', weight: 8 },
			{ id: 'low_shrub', weight: 2 },
			{ id: 'yellow_flower', weight: 1 }
		]
	),
	'Planet Temperate Forest': create(
		'Planet Temperate Forest',
		0.6,
		0.7,
		[
			{ id: 'oak_round', weight: 7 },
			{ id: 'pine_layered', weight: 2 },
			{ id: 'willow_drooping', weight: 1 }
		],
		[
			{ id: 'forest_fern', weight: 5 },
			{ id: 'low_shrub', weight: 3 },
			{ id: 'moss_patch', weight: 2 },
			{ id: 'white_flower', weight: 1 }
		]
	),
	'Planet Boreal Forest': create(
		'Planet Boreal Forest',
		0.56,
		0.5,
		[
			{ id: 'pine_layered', weight: 9 },
			{ id: 'oak_round', weight: 1 }
		],
		[
			{ id: 'moss_patch', weight: 5 },
			{ id: 'low_shrub', weight: 3 },
			{ id: 'forest_fern', weight: 2 }
		]
	),
	'Planet Grassland': create(
		'Planet Grassland',
		0.06,
		0.72,
		[
			{ id: 'oak_round', weight: 4 },
			{ id: 'acacia_spreading', weight: 2 }
		],
		[
			{ id: 'meadow_short_grass', weight: 8 },
			{ id: 'yellow_flower', weight: 2 },
			{ id: 'white_flower', weight: 1 },
			{ id: 'low_shrub', weight: 1 }
		]
	),
	'Planet Shrubland': create(
		'Planet Shrubland',
		0.035,
		0.42,
		[{ id: 'acacia_spreading', weight: 3 }],
		[
			{ id: 'low_shrub', weight: 6 },
			{ id: 'meadow_short_grass', weight: 3 },
			{ id: 'dense_shrub', weight: 1 }
		]
	),
	'Planet Desert': create(
		'Planet Desert',
		0.003,
		0.035,
		[
			{ id: 'acacia_spreading', weight: 1 },
			{ id: 'palm_crown', weight: 1 }
		],
		[{ id: 'low_shrub', weight: 1 }]
	),
	'Planet Alpine': create(
		'Planet Alpine',
		0.012,
		0.16,
		[{ id: 'pine_layered', weight: 1 }],
		[
			{ id: 'moss_patch', weight: 4 },
			{ id: 'low_shrub', weight: 2 },
			{ id: 'violet_flower', weight: 1 }
		]
	),
	'Planet Polar': create('Planet Polar', 0, 0.025, [], [{ id: 'moss_patch', weight: 1 }]),
	'Planet Wetland': create(
		'Planet Wetland',
		0.22,
		0.88,
		[
			{ id: 'willow_drooping', weight: 6 },
			{ id: 'palm_crown', weight: 2 }
		],
		[
			{ id: 'forest_fern', weight: 5 },
			{ id: 'tropical_fern', weight: 3 },
			{ id: 'moss_patch', weight: 4 }
		]
	),
	'Planet Mangrove': create(
		'Planet Mangrove',
		0.68,
		0.78,
		[
			{ id: 'willow_drooping', weight: 5 },
			{ id: 'palm_crown', weight: 3 }
		],
		[
			{ id: 'tropical_fern', weight: 4 },
			{ id: 'moss_patch', weight: 4 },
			{ id: 'dense_shrub', weight: 2 }
		]
	),
	'Planet Cropland': create(
		'Planet Cropland',
		0.015,
		0.38,
		[{ id: 'oak_round', weight: 1 }],
		[
			{ id: 'meadow_short_grass', weight: 8 },
			{ id: 'white_flower', weight: 1 }
		]
	),
	'Planet Urban': create(
		'Planet Urban',
		0.005,
		0.04,
		[{ id: 'oak_round', weight: 1 }],
		[{ id: 'meadow_short_grass', weight: 1 }]
	),
	'Planet Coast': create(
		'Planet Coast',
		0.06,
		0.28,
		[
			{ id: 'palm_crown', weight: 3 },
			{ id: 'willow_drooping', weight: 1 }
		],
		[
			{ id: 'meadow_short_grass', weight: 3 },
			{ id: 'low_shrub', weight: 2 }
		]
	),
	'Planet Freshwater': create('Planet Freshwater', 0, 0, [], []),
	'Planet Ocean': create('Planet Ocean', 0, 0, [], [])
};

const DEFAULT_PROFILE = PROFILES['Spawn Meadow'];

export function biomeVegetationProfile(zone: string): BiomeVegetationProfile {
	return PROFILES[zone] ?? DEFAULT_PROFILE;
}

export function allBiomeVegetationProfiles(): readonly BiomeVegetationProfile[] {
	return Object.values(PROFILES);
}
