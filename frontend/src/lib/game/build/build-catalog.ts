import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockDefinition, BlockType } from '../world/voxel-types';
import { BUILD_CATEGORY_DESCRIPTORS, type BuildCategory } from './build-types';

/**
 * Entrée du catalogue de construction. Vue projetée d'une `BlockDefinition`,
 * limitée aux champs dont le catalogue a besoin. `BlockRegistry` reste l'unique
 * source de vérité : cette structure ne duplique aucune donnée, elle référence.
 */
export interface CatalogEntry {
	type: BlockType;
	label: string;
	description: string;
	category: BuildCategory;
}

/** Filtre `All` du catalogue, ou une catégorie précise. */
export type CatalogFilter = 'all' | BuildCategory;

export interface CatalogCategoryOption {
	id: CatalogFilter;
	label: string;
}

/**
 * Un bloc apparaît dans le catalogue si et seulement s'il est constructible :
 * `placeable === true` et `type !== 'air'`. Toute autre définition est exclue.
 */
export function isCatalogBlock(definition: BlockDefinition): boolean {
	return definition.placeable && definition.type !== 'air';
}

/**
 * Construit la liste des entrées à partir de `BlockRegistry`.
 *
 * Généré automatiquement : tout nouveau bloc constructible ajouté au registre
 * apparaît ici sans modification d'un composant Svelte. La liste est triée de
 * manière déterministe (catégorie selon l'ordre défini, puis label, puis type)
 * afin que le rendu et les tests soient reproductibles.
 */
export function buildCatalogEntries(): CatalogEntry[] {
	const order = new Map<BuildCategory, number>(
		BUILD_CATEGORY_DESCRIPTORS.map((descriptor, index) => [descriptor.id, index])
	);

	return BlockRegistry.all()
		.filter(isCatalogBlock)
		.map((definition) => ({
			type: definition.type,
			label: definition.label,
			description: definition.description,
			category: definition.category
		}))
		.sort((a, b) => {
			const categoryDelta =
				(order.get(a.category) ?? Number.MAX_SAFE_INTEGER) -
				(order.get(b.category) ?? Number.MAX_SAFE_INTEGER);

			if (categoryDelta !== 0) {
				return categoryDelta;
			}

			const labelDelta = a.label.localeCompare(b.label);

			if (labelDelta !== 0) {
				return labelDelta;
			}

			return a.type.localeCompare(b.type);
		});
}

/**
 * Options de la barre de catégories : `All` suivi des catégories qui possèdent
 * au moins un bloc constructible. Une catégorie vide n'est pas affichée.
 */
export function buildCategoryOptions(entries: CatalogEntry[]): CatalogCategoryOption[] {
	const present = new Set<BuildCategory>(entries.map((entry) => entry.category));

	const options: CatalogCategoryOption[] = [{ id: 'all', label: 'All' }];

	for (const descriptor of BUILD_CATEGORY_DESCRIPTORS) {
		if (present.has(descriptor.id)) {
			options.push({ id: descriptor.id, label: descriptor.label });
		}
	}

	return options;
}

/** Normalise une recherche : minuscules, espaces superflus supprimés. */
export function normalizeQuery(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchesQuery(entry: CatalogEntry, normalizedQuery: string): boolean {
	if (normalizedQuery.length === 0) {
		return true;
	}

	const haystack = `${entry.label} ${entry.type} ${entry.category}`.toLowerCase();

	return haystack.includes(normalizedQuery);
}

/**
 * Applique le filtre de catégorie puis le filtre texte à une liste d'entrées.
 *
 * La recherche porte sur le label, le type technique et la catégorie ; elle est
 * insensible à la casse et aux espaces superflus. L'ordre relatif des entrées
 * est préservé, donc le résultat reste déterministe.
 */
export function filterCatalogEntries(
	entries: CatalogEntry[],
	category: CatalogFilter,
	query: string
): CatalogEntry[] {
	const normalizedQuery = normalizeQuery(query);

	return entries.filter((entry) => {
		if (category !== 'all' && entry.category !== category) {
			return false;
		}

		return matchesQuery(entry, normalizedQuery);
	});
}
