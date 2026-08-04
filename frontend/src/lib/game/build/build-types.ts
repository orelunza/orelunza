export type BuildCategory = 'terrain' | 'nature' | 'construction' | 'decoration';

export type BuildCategoryFilter = 'all' | BuildCategory;

export const BUILD_CATEGORIES: BuildCategory[] = [
	'terrain',
	'nature',
	'construction',
	'decoration'
];
