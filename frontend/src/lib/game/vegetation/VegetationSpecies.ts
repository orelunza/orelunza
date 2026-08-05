import type {
	CanopyShape,
	GroundShape,
	GroundSpeciesId,
	TreeSpeciesId,
	TrunkShape,
	VegetationFamily
} from './VegetationFamily';

export interface ColorRamp {
	shadow: number;
	base: number;
	sunlit: number;
}

export interface TreeSpecies {
	id: TreeSpeciesId;
	label: string;
	family: 'tree';
	canopy: CanopyShape;
	trunk: TrunkShape;
	minHeight: number;
	maxHeight: number;
	canopyRadius: number;
	trunkColor: number;
	leafRamp: ColorRamp;
}

export interface GroundSpecies {
	id: GroundSpeciesId;
	label: string;
	family: Exclude<VegetationFamily, 'tree'>;
	shape: GroundShape;
	minScale: number;
	maxScale: number;
	windFlex: number;
	colorRamp: ColorRamp;
}

export type VegetationSpecies = TreeSpecies | GroundSpecies;

export const TREE_SPECIES: readonly TreeSpecies[] = [
	{
		id: 'oak_round',
		label: 'Round oak',
		family: 'tree',
		canopy: 'round',
		trunk: 'straight',
		minHeight: 4,
		maxHeight: 6,
		canopyRadius: 2,
		trunkColor: 0x7f5b38,
		leafRamp: { shadow: 0x21351e, base: 0x3c5a2c, sunlit: 0x6e8245 }
	},
	{
		id: 'acacia_spreading',
		label: 'Spreading acacia',
		family: 'tree',
		canopy: 'umbrella',
		trunk: 'branching',
		minHeight: 4,
		maxHeight: 6,
		canopyRadius: 3,
		trunkColor: 0x8e6945,
		leafRamp: { shadow: 0x26371d, base: 0x51612f, sunlit: 0x89904a }
	},
	{
		id: 'pine_layered',
		label: 'Layered pine',
		family: 'tree',
		canopy: 'layered',
		trunk: 'tapered',
		minHeight: 7,
		maxHeight: 10,
		canopyRadius: 3,
		trunkColor: 0x674a34,
		leafRamp: { shadow: 0x172d22, base: 0x294a34, sunlit: 0x4c6645 }
	},
	{
		id: 'kapok_emergent',
		label: 'Emergent kapok',
		family: 'tree',
		canopy: 'emergent',
		trunk: 'buttressed',
		minHeight: 10,
		maxHeight: 14,
		canopyRadius: 4,
		trunkColor: 0x8b6b4a,
		leafRamp: { shadow: 0x17311f, base: 0x315b35, sunlit: 0x5f814b }
	},
	{
		id: 'palm_crown',
		label: 'Crown palm',
		family: 'tree',
		canopy: 'frond',
		trunk: 'curved',
		minHeight: 7,
		maxHeight: 11,
		canopyRadius: 4,
		trunkColor: 0x9a7448,
		leafRamp: { shadow: 0x1d3a24, base: 0x3c6a36, sunlit: 0x78a34e }
	},
	{
		id: 'willow_drooping',
		label: 'Drooping willow',
		family: 'tree',
		canopy: 'drooping',
		trunk: 'branching',
		minHeight: 5,
		maxHeight: 7,
		canopyRadius: 3,
		trunkColor: 0x756044,
		leafRamp: { shadow: 0x213a25, base: 0x41673b, sunlit: 0x77975a }
	}
] as const;

export const GROUND_SPECIES: readonly GroundSpecies[] = [
	{
		id: 'meadow_short_grass',
		label: 'Short meadow grass',
		family: 'grass',
		shape: 'short-grass',
		minScale: 0.55,
		maxScale: 1.05,
		windFlex: 1,
		colorRamp: { shadow: 0x42512a, base: 0x6d7c3b, sunlit: 0x9b9953 }
	},
	{
		id: 'forest_fern',
		label: 'Forest fern',
		family: 'fern',
		shape: 'fern',
		minScale: 0.65,
		maxScale: 1.15,
		windFlex: 0.55,
		colorRamp: { shadow: 0x203421, base: 0x3c5b32, sunlit: 0x65804a }
	},
	{
		id: 'tropical_fern',
		label: 'Tropical fern',
		family: 'fern',
		shape: 'tropical-fern',
		minScale: 0.85,
		maxScale: 1.45,
		windFlex: 0.7,
		colorRamp: { shadow: 0x173923, base: 0x2f6b3b, sunlit: 0x63a052 }
	},
	{
		id: 'low_shrub',
		label: 'Low shrub',
		family: 'shrub',
		shape: 'shrub',
		minScale: 0.55,
		maxScale: 0.95,
		windFlex: 0.2,
		colorRamp: { shadow: 0x283921, base: 0x455b32, sunlit: 0x6d7b48 }
	},
	{
		id: 'dense_shrub',
		label: 'Dense tropical shrub',
		family: 'shrub',
		shape: 'shrub',
		minScale: 0.8,
		maxScale: 1.35,
		windFlex: 0.18,
		colorRamp: { shadow: 0x15301d, base: 0x31542e, sunlit: 0x56743f }
	},
	{
		id: 'white_flower',
		label: 'White meadow flower',
		family: 'flower',
		shape: 'flower',
		minScale: 0.7,
		maxScale: 1.05,
		windFlex: 0.9,
		colorRamp: { shadow: 0xaeb7a2, base: 0xe7eadb, sunlit: 0xffffff }
	},
	{
		id: 'yellow_flower',
		label: 'Yellow meadow flower',
		family: 'flower',
		shape: 'flower',
		minScale: 0.7,
		maxScale: 1.08,
		windFlex: 0.9,
		colorRamp: { shadow: 0xa67b25, base: 0xe0b83c, sunlit: 0xffdf62 }
	},
	{
		id: 'violet_flower',
		label: 'Violet woodland flower',
		family: 'flower',
		shape: 'flower',
		minScale: 0.68,
		maxScale: 1.02,
		windFlex: 0.85,
		colorRamp: { shadow: 0x573b69, base: 0x8b64a0, sunlit: 0xb891ca }
	},
	{
		id: 'tropical_flower',
		label: 'Tropical red flower',
		family: 'flower',
		shape: 'flower',
		minScale: 0.95,
		maxScale: 1.35,
		windFlex: 0.75,
		colorRamp: { shadow: 0x7f2a2f, base: 0xc34b46, sunlit: 0xef7a5d }
	},
	{
		id: 'moss_patch',
		label: 'Forest moss',
		family: 'moss',
		shape: 'moss',
		minScale: 0.75,
		maxScale: 1.35,
		windFlex: 0,
		colorRamp: { shadow: 0x334124, base: 0x536536, sunlit: 0x78844a }
	}
] as const;
