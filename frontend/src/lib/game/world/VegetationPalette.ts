import type { BlockCoordinate, BlockType } from './voxel-types';

export type VegetationZone =
	| 'Central City'
	| 'Riverbank'
	| 'Forest Edge'
	| 'Free Build Meadow'
	| 'Spawn Meadow'
	| 'Amazon Rainforest'
	| 'Pine Highlands'
	| string;

interface PaletteRamp {
	shadow: number;
	base: number;
	sunlit: number;
}

const GRASS_RAMPS: Record<string, PaletteRamp> = {
	'Central City': { shadow: 0x535637, base: 0x6d7043, sunlit: 0x898553 },
	Riverbank: { shadow: 0x565a32, base: 0x74753d, sunlit: 0x94904c },
	'Forest Edge': { shadow: 0x334128, base: 0x4e5c31, sunlit: 0x69713c },
	'Free Build Meadow': { shadow: 0x566332, base: 0x748043, sunlit: 0x969450 },
	'Spawn Meadow': { shadow: 0x555d31, base: 0x73783c, sunlit: 0x93904b },
	'Amazon Rainforest': { shadow: 0x2d4827, base: 0x486f35, sunlit: 0x6f8d45 },
	'Pine Highlands': { shadow: 0x3c4b2c, base: 0x59643a, sunlit: 0x79804a }
};

const LEAF_RAMPS: Record<string, PaletteRamp> = {
	'Central City': { shadow: 0x25341f, base: 0x3b512b, sunlit: 0x63703e },
	Riverbank: { shadow: 0x233821, base: 0x39582f, sunlit: 0x607643 },
	'Forest Edge': { shadow: 0x1d2d1c, base: 0x304827, sunlit: 0x506039 },
	'Free Build Meadow': { shadow: 0x263a20, base: 0x3f5b2c, sunlit: 0x687b42 },
	'Spawn Meadow': { shadow: 0x25381f, base: 0x3e592c, sunlit: 0x66783f },
	'Amazon Rainforest': { shadow: 0x122b1a, base: 0x275a30, sunlit: 0x4f7d43 },
	'Pine Highlands': { shadow: 0x17291f, base: 0x294632, sunlit: 0x4d6344 }
};

const WOOD_RAMPS: Record<string, PaletteRamp> = {
	'Central City': { shadow: 0x554536, base: 0x735a43, sunlit: 0x92745a },
	Riverbank: { shadow: 0x4d4334, base: 0x6f5c43, sunlit: 0x927a58 },
	'Forest Edge': { shadow: 0x47382d, base: 0x664c38, sunlit: 0x866548 },
	'Free Build Meadow': { shadow: 0x58432f, base: 0x79583b, sunlit: 0x9a744f },
	'Spawn Meadow': { shadow: 0x513e2e, base: 0x735239, sunlit: 0x946d4b },
	'Amazon Rainforest': { shadow: 0x4c3e30, base: 0x745a40, sunlit: 0x9b7754 },
	'Pine Highlands': { shadow: 0x3d322a, base: 0x5a4637, sunlit: 0x785d45 }
};

const TALL_GRASS_RAMPS: Record<string, PaletteRamp> = {
	'Central City': { shadow: 0x51562f, base: 0x70733c, sunlit: 0x918b4b },
	Riverbank: { shadow: 0x4f5d30, base: 0x6f7c3d, sunlit: 0x92994f },
	'Forest Edge': { shadow: 0x304227, base: 0x4a5d31, sunlit: 0x6a7440 },
	'Free Build Meadow': { shadow: 0x526431, base: 0x718342, sunlit: 0x989850 },
	'Spawn Meadow': { shadow: 0x526031, base: 0x727d3e, sunlit: 0x96934b },
	'Amazon Rainforest': { shadow: 0x284a2a, base: 0x4b7438, sunlit: 0x73a04f },
	'Pine Highlands': { shadow: 0x3b4c2c, base: 0x56643a, sunlit: 0x778148 }
};

const DEFAULT_GRASS_RAMP = GRASS_RAMPS['Spawn Meadow'];
const DEFAULT_LEAF_RAMP = LEAF_RAMPS['Spawn Meadow'];
const DEFAULT_TALL_GRASS_RAMP = TALL_GRASS_RAMPS['Spawn Meadow'];
const DEFAULT_WOOD_RAMP = WOOD_RAMPS['Spawn Meadow'];

/**
 * Stable, low-frequency colour variation for terrain and foliage.
 *
 * Nearby blocks share part of the same broad noise value, preventing television
 * static, while a weaker per-block term keeps large surfaces from looking flat.
 */
export function vegetationTintAt(
	type: Extract<BlockType, 'grass' | 'leaves'>,
	position: BlockCoordinate,
	zone: VegetationZone
): number {
	const ramp =
		type === 'grass'
			? (GRASS_RAMPS[zone] ?? DEFAULT_GRASS_RAMP)
			: (LEAF_RAMPS[zone] ?? DEFAULT_LEAF_RAMP);
	const salt = type === 'grass' ? 0x47a5 : 0x8bc3;
	const broad = hash01(Math.floor(position.x / 4), Math.floor(position.z / 4), salt);
	const detail = hash01(position.x, position.z, salt ^ Math.imul(position.y + 17, 131));
	const amount = clamp01(broad * 0.68 + detail * 0.32);

	return sampleRamp(ramp, amount);
}

/** Stable trunk variation shared by voxel tree families. */
export function woodTintAt(position: BlockCoordinate, zone: VegetationZone): number {
	const ramp = WOOD_RAMPS[zone] ?? DEFAULT_WOOD_RAMP;
	const broad = hash01(Math.floor(position.x / 6), Math.floor(position.z / 6), 0x9b31);
	const vertical = hash01(position.x, position.z, 0xac43 ^ Math.imul(position.y + 11, 97));
	const amount = clamp01(broad * 0.78 + vertical * 0.22);

	return sampleRamp(ramp, amount);
}

/** Colour ramp dedicated to tall grass, slightly warmer than the terrain below. */
export function tallGrassTintAt(position: BlockCoordinate, zone: VegetationZone): number {
	const ramp = TALL_GRASS_RAMPS[zone] ?? DEFAULT_TALL_GRASS_RAMP;
	const broad = hash01(Math.floor(position.x / 5), Math.floor(position.z / 5), 0xa173);
	const detail = hash01(position.x, position.z, 0xc54d ^ Math.imul(position.y + 23, 173));
	const amount = clamp01(broad * 0.72 + detail * 0.28);

	return sampleRamp(ramp, amount);
}

/** A deterministic number in [0, 1], useful for instance scale and rotation. */
export function vegetationRandom01(x: number, y: number, z: number, salt = 0): number {
	return hash01(x + Math.imul(y, 31), z - Math.imul(y, 17), salt);
}

function sampleRamp(ramp: PaletteRamp, amount: number): number {
	if (amount <= 0.5) {
		return mixRgb(ramp.shadow, ramp.base, amount * 2);
	}

	return mixRgb(ramp.base, ramp.sunlit, (amount - 0.5) * 2);
}

function mixRgb(from: number, to: number, amount: number): number {
	const t = clamp01(amount);
	const fromR = (from >> 16) & 0xff;
	const fromG = (from >> 8) & 0xff;
	const fromB = from & 0xff;
	const toR = (to >> 16) & 0xff;
	const toG = (to >> 8) & 0xff;
	const toB = to & 0xff;
	const r = Math.round(fromR + (toR - fromR) * t);
	const g = Math.round(fromG + (toG - fromG) * t);
	const b = Math.round(fromB + (toB - fromB) * t);

	return (r << 16) | (g << 8) | b;
}

function hash01(x: number, z: number, salt: number): number {
	let hash = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(z | 0, 0x5f356495) ^ (salt | 0);
	hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
	hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39);

	return ((hash ^ (hash >>> 15)) >>> 0) / 0xffffffff;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}
