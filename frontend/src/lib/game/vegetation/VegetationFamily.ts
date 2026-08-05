export type TreeSpeciesId =
	| 'oak_round'
	| 'acacia_spreading'
	| 'pine_layered'
	| 'kapok_emergent'
	| 'palm_crown'
	| 'willow_drooping';

export type GroundSpeciesId =
	| 'meadow_short_grass'
	| 'forest_fern'
	| 'tropical_fern'
	| 'low_shrub'
	| 'dense_shrub'
	| 'white_flower'
	| 'yellow_flower'
	| 'violet_flower'
	| 'tropical_flower'
	| 'moss_patch';

export type CanopyShape = 'round' | 'umbrella' | 'layered' | 'emergent' | 'frond' | 'drooping';
export type TrunkShape = 'straight' | 'branching' | 'tapered' | 'buttressed' | 'curved';
export type GroundShape = 'short-grass' | 'fern' | 'tropical-fern' | 'shrub' | 'flower' | 'moss';

export type VegetationFamily = 'tree' | 'grass' | 'fern' | 'shrub' | 'flower' | 'moss';
