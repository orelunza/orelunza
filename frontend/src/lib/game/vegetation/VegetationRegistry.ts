import { biomeVegetationProfile } from './BiomeVegetationProfile';
import type { GroundSpeciesId, TreeSpeciesId } from './VegetationFamily';
import {
	GROUND_SPECIES,
	TREE_SPECIES,
	type GroundSpecies,
	type TreeSpecies
} from './VegetationSpecies';

const TREES = new Map<TreeSpeciesId, TreeSpecies>(
	TREE_SPECIES.map((species) => [species.id, species])
);
const GROUND = new Map<GroundSpeciesId, GroundSpecies>(
	GROUND_SPECIES.map((species) => [species.id, species])
);

export const VegetationRegistry = {
	tree(id: TreeSpeciesId): TreeSpecies {
		const species = TREES.get(id);

		if (!species) {
			throw new Error(`Unknown tree species: ${id}`);
		}

		return species;
	},

	ground(id: GroundSpeciesId): GroundSpecies {
		const species = GROUND.get(id);

		if (!species) {
			throw new Error(`Unknown ground vegetation species: ${id}`);
		}

		return species;
	},

	treesForZone(zone: string): readonly TreeSpecies[] {
		return biomeVegetationProfile(zone).trees.map((entry) => this.tree(entry.id));
	},

	groundForZone(zone: string): readonly GroundSpecies[] {
		return biomeVegetationProfile(zone).ground.map((entry) => this.ground(entry.id));
	},

	allTrees(): readonly TreeSpecies[] {
		return TREE_SPECIES;
	},

	allGround(): readonly GroundSpecies[] {
		return GROUND_SPECIES;
	}
};
