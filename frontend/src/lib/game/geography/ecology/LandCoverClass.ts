export const LAND_COVER_CODES = Object.freeze({
	unknown: 0,
	'tree-cover': 1,
	shrubland: 2,
	grassland: 3,
	cropland: 4,
	'built-up': 5,
	'bare-sparse': 6,
	'snow-ice': 7,
	'permanent-water': 8,
	'herbaceous-wetland': 9,
	mangrove: 10,
	'moss-lichen': 11
} as const);

export type LandCoverClass = keyof typeof LAND_COVER_CODES;
export type LandCoverCode = (typeof LAND_COVER_CODES)[LandCoverClass];

const BY_CODE = new Map<number, LandCoverClass>(
	Object.entries(LAND_COVER_CODES).map(([name, code]) => [code, name as LandCoverClass])
);

export function landCoverFromCode(code: number): LandCoverClass {
	return BY_CODE.get(code) ?? 'unknown';
}

export function landCoverCode(value: LandCoverClass): LandCoverCode {
	return LAND_COVER_CODES[value];
}

export function landCoverLabel(value: LandCoverClass): string {
	return value
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
