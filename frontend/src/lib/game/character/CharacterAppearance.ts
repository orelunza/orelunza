/**
 * Persistent appearance data for the lightweight Orelunza citizen.
 *
 * Keep this structure small: it is stored in saves, sent over the network and
 * read every time an avatar is created. Geometry and animation data do not
 * belong here.
 */

export const CHARACTER_APPEARANCE_VERSION = 1 as const;

export const CHARACTER_BODY_TYPES = ['neutral_m', 'neutral_f'] as const;
export type CharacterBodyType = (typeof CHARACTER_BODY_TYPES)[number];

export const CHARACTER_HAIR_STYLES = [
	'none',
	'shaved',
	'short',
	'curly',
	'afro',
	'long',
	'braids_simple'
] as const;
export type CharacterHairStyle = (typeof CHARACTER_HAIR_STYLES)[number];

/** Canonical persisted colour format. */
export type CharacterColor = `#${string}`;

export interface CharacterAppearanceV1 {
	version: typeof CHARACTER_APPEARANCE_VERSION;
	displayName: string;
	bodyType: CharacterBodyType;
	skinTone: CharacterColor;
	hairStyle: CharacterHairStyle;
	hairColor: CharacterColor;
	shirtColor: CharacterColor;
	pantsColor: CharacterColor;
	shoesColor: CharacterColor;
}

/**
 * Accepted by normalizers and public update APIs.
 *
 * `unknown` values are intentionally supported because appearances are loaded
 * from JSON, localStorage and remote player snapshots.
 */
export type CharacterAppearanceInput =
	Partial<CharacterAppearanceV1> | Record<string, unknown> | null | undefined;

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearanceV1 = {
	version: CHARACTER_APPEARANCE_VERSION,
	displayName: 'Forest Citizen',
	bodyType: 'neutral_m',
	skinTone: '#b98565',
	hairStyle: 'short',
	hairColor: '#3b2b22',
	shirtColor: '#4f8f74',
	pantsColor: '#37485f',
	shoesColor: '#2b2725'
};

/** Small curated palettes for the avatar editor. */
export const CHARACTER_SKIN_TONES = [
	'#f2d3b1',
	'#ddb08a',
	'#c58d68',
	'#a96f4d',
	'#7f4f35',
	'#523222'
] as const satisfies readonly CharacterColor[];

export const CHARACTER_HAIR_COLORS = [
	'#1d1714',
	'#3b2b22',
	'#65452d',
	'#9a683d',
	'#d0a66a',
	'#b95e37'
] as const satisfies readonly CharacterColor[];

export const CHARACTER_CLOTHING_COLORS = [
	'#4f8f74',
	'#5b7698',
	'#9b6b49',
	'#8b5f72',
	'#b48a4a',
	'#65704e',
	'#d8d0bd',
	'#34383c'
] as const satisfies readonly CharacterColor[];

const BODY_TYPE_SET = new Set<string>(CHARACTER_BODY_TYPES);
const HAIR_STYLE_SET = new Set<string>(CHARACTER_HAIR_STYLES);
const DISPLAY_NAME_MAX_LENGTH = 32;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SHORT_HEX_COLOR = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;

/**
 * Convert untrusted or legacy appearance data into a complete V1 snapshot.
 *
 * Old saves may omit `version` and `bodyType`; both are restored here. Invalid
 * individual fields never invalidate the whole avatar.
 */
export function normalizeCharacterAppearance(
	input: CharacterAppearanceInput = DEFAULT_CHARACTER_APPEARANCE
): CharacterAppearanceV1 {
	const source = asRecord(input);

	return {
		version: CHARACTER_APPEARANCE_VERSION,
		displayName: normalizeDisplayName(source.displayName, DEFAULT_CHARACTER_APPEARANCE.displayName),
		bodyType: normalizeBodyType(source.bodyType),
		skinTone: normalizeCharacterColor(source.skinTone, DEFAULT_CHARACTER_APPEARANCE.skinTone),
		hairStyle: normalizeHairStyle(source.hairStyle),
		hairColor: normalizeCharacterColor(source.hairColor, DEFAULT_CHARACTER_APPEARANCE.hairColor),
		shirtColor: normalizeCharacterColor(source.shirtColor, DEFAULT_CHARACTER_APPEARANCE.shirtColor),
		pantsColor: normalizeCharacterColor(source.pantsColor, DEFAULT_CHARACTER_APPEARANCE.pantsColor),
		shoesColor: normalizeCharacterColor(source.shoesColor, DEFAULT_CHARACTER_APPEARANCE.shoesColor)
	};
}

/** Parse JSON or an already-decoded value without throwing. */
export function parseCharacterAppearance(value: unknown): CharacterAppearanceV1 {
	if (typeof value !== 'string') {
		return normalizeCharacterAppearance(asCharacterAppearanceInput(value));
	}

	try {
		return normalizeCharacterAppearance(asCharacterAppearanceInput(JSON.parse(value)));
	} catch {
		return cloneCharacterAppearance(DEFAULT_CHARACTER_APPEARANCE);
	}
}

/** Serialize only canonical fields in a stable order. */
export function serializeCharacterAppearance(input: CharacterAppearanceInput): string {
	return JSON.stringify(normalizeCharacterAppearance(input));
}

export function cloneCharacterAppearance(input: CharacterAppearanceInput): CharacterAppearanceV1 {
	return { ...normalizeCharacterAppearance(input) };
}

export function isCharacterAppearanceV1(value: unknown): value is CharacterAppearanceV1 {
	if (!isRecord(value)) {
		return false;
	}

	return (
		value.version === CHARACTER_APPEARANCE_VERSION &&
		typeIsBodyType(value.bodyType) &&
		typeIsHairStyle(value.hairStyle) &&
		typeIsDisplayName(value.displayName) &&
		isCanonicalCharacterColor(value.skinTone) &&
		isCanonicalCharacterColor(value.hairColor) &&
		isCanonicalCharacterColor(value.shirtColor) &&
		isCanonicalCharacterColor(value.pantsColor) &&
		isCanonicalCharacterColor(value.shoesColor)
	);
}

export function characterAppearanceEquals(
	left: CharacterAppearanceInput,
	right: CharacterAppearanceInput
): boolean {
	const a = normalizeCharacterAppearance(left);
	const b = normalizeCharacterAppearance(right);

	return (
		a.version === b.version &&
		a.displayName === b.displayName &&
		a.bodyType === b.bodyType &&
		a.skinTone === b.skinTone &&
		a.hairStyle === b.hairStyle &&
		a.hairColor === b.hairColor &&
		a.shirtColor === b.shirtColor &&
		a.pantsColor === b.pantsColor &&
		a.shoesColor === b.shoesColor
	);
}

export function normalizeCharacterColor(value: unknown, fallback: CharacterColor): CharacterColor {
	if (typeof value !== 'string') {
		return fallback;
	}

	const candidate = value.trim().toLowerCase();

	if (HEX_COLOR.test(candidate)) {
		return candidate as CharacterColor;
	}

	const short = SHORT_HEX_COLOR.exec(candidate);

	if (short) {
		return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` as CharacterColor;
	}

	return fallback;
}

function normalizeBodyType(value: unknown): CharacterBodyType {
	return typeIsBodyType(value) ? value : DEFAULT_CHARACTER_APPEARANCE.bodyType;
}

function normalizeHairStyle(value: unknown): CharacterHairStyle {
	return typeIsHairStyle(value) ? value : DEFAULT_CHARACTER_APPEARANCE.hairStyle;
}

function normalizeDisplayName(value: unknown, fallback: string): string {
	if (typeof value !== 'string') {
		return fallback;
	}

	const normalized = value.replace(/\s+/g, ' ').trim().slice(0, DISPLAY_NAME_MAX_LENGTH);

	return normalized || fallback;
}

function typeIsBodyType(value: unknown): value is CharacterBodyType {
	return typeof value === 'string' && BODY_TYPE_SET.has(value);
}

function typeIsHairStyle(value: unknown): value is CharacterHairStyle {
	return typeof value === 'string' && HAIR_STYLE_SET.has(value);
}

function typeIsDisplayName(value: unknown): value is string {
	if (typeof value !== 'string') {
		return false;
	}

	const normalized = value.replace(/\s+/g, ' ').trim();

	return normalized.length > 0 && normalized.length <= DISPLAY_NAME_MAX_LENGTH;
}

function isCanonicalCharacterColor(value: unknown): value is CharacterColor {
	return typeof value === 'string' && HEX_COLOR.test(value) && value === value.toLowerCase();
}

function asCharacterAppearanceInput(value: unknown): CharacterAppearanceInput {
	return isRecord(value) ? value : undefined;
}

function asRecord(value: CharacterAppearanceInput): Record<string, unknown> {
	return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
