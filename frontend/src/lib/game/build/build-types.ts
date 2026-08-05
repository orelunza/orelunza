/**
 * Catégories de construction Orelunza.
 *
 * `voxel-types.ts` importe déjà `BuildCategory` depuis ce fichier ; c'est
 * l'unique définition du type. Les catégories demandées par le catalogue sont
 * `nature`, `construction`, `decoration`, `light` et `utility`. `terrain` est
 * conservée parce que le registre l'utilise déjà pour les blocs de sol
 * (grass, dirt, stone, sand) et que la retirer casserait les définitions
 * existantes.
 */
export type BuildCategory =
	'terrain' | 'nature' | 'construction' | 'decoration' | 'light' | 'utility';

export interface BuildCategoryDescriptor {
	id: BuildCategory;
	label: string;
}

/**
 * Ordre d'affichage des catégories dans la barre du catalogue. `terrain` est
 * placée après les cinq catégories principales demandées.
 */
export const BUILD_CATEGORY_ORDER: BuildCategory[] = [
	'nature',
	'construction',
	'decoration',
	'light',
	'utility',
	'terrain'
];

export const BUILD_CATEGORY_LABELS: Record<BuildCategory, string> = {
	nature: 'Nature',
	construction: 'Construction',
	decoration: 'Decoration',
	light: 'Light',
	utility: 'Utility',
	terrain: 'Terrain'
};

export const BUILD_CATEGORY_DESCRIPTORS: BuildCategoryDescriptor[] = BUILD_CATEGORY_ORDER.map(
	(id) => ({ id, label: BUILD_CATEGORY_LABELS[id] })
);

export type BuildCategoryFilter = 'all' | BuildCategory;
