export type CharacterBodyType = 'neutral_m' | 'neutral_f';

export interface CharacterAppearanceV1 {
	version: 1;
	displayName: string;
	bodyType: CharacterBodyType;
	skinTone: string;
	hairStyle: 'shaved' | 'short' | 'curly' | 'afro' | 'long' | 'braids_simple' | 'none';
	hairColor: string;
	shirtColor: string;
	pantsColor: string;
	shoesColor: string;
}

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearanceV1 = {
	version: 1,
	displayName: 'Orelunza Citizen',
	bodyType: 'neutral_m',
	skinTone: '#b98565',
	hairStyle: 'short',
	hairColor: '#3b2b22',
	shirtColor: '#4f8f74',
	pantsColor: '#37485f',
	shoesColor: '#2b2725'
};

const HAIR_STYLES = new Set<CharacterAppearanceV1['hairStyle']>([
	'shaved',
	'short',
	'curly',
	'afro',
	'long',
	'braids_simple',
	'none'
]);
const BODY_TYPES = new Set<CharacterBodyType>(['neutral_m', 'neutral_f']);
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function normalizeCharacterAppearance(
	value: Partial<CharacterAppearanceV1> | null | undefined
): CharacterAppearanceV1 {
	const hairStyle = HAIR_STYLES.has(value?.hairStyle ?? 'short') ? value?.hairStyle : 'short';
	const bodyType = BODY_TYPES.has(value?.bodyType ?? 'neutral_m') ? value?.bodyType : 'neutral_m';

	return {
		...DEFAULT_CHARACTER_APPEARANCE,
		...value,
		version: 1,
		displayName: value?.displayName?.trim() || DEFAULT_CHARACTER_APPEARANCE.displayName,
		bodyType: bodyType ?? DEFAULT_CHARACTER_APPEARANCE.bodyType,
		hairStyle: hairStyle ?? DEFAULT_CHARACTER_APPEARANCE.hairStyle,
		skinTone: normalizeColor(value?.skinTone, DEFAULT_CHARACTER_APPEARANCE.skinTone),
		hairColor: normalizeColor(value?.hairColor, DEFAULT_CHARACTER_APPEARANCE.hairColor),
		shirtColor: normalizeColor(value?.shirtColor, DEFAULT_CHARACTER_APPEARANCE.shirtColor),
		pantsColor: normalizeColor(value?.pantsColor, DEFAULT_CHARACTER_APPEARANCE.pantsColor),
		shoesColor: normalizeColor(value?.shoesColor, DEFAULT_CHARACTER_APPEARANCE.shoesColor)
	};
}

export function serializeCharacterAppearance(appearance: CharacterAppearanceV1): string {
	return JSON.stringify(appearance);
}

export function parseCharacterAppearance(value: string): CharacterAppearanceV1 | null {
	const parsed: unknown = JSON.parse(value);

	if (!parsed || typeof parsed !== 'object') {
		return null;
	}

	const candidate = parsed as Partial<CharacterAppearanceV1>;

	if (candidate.version !== 1 || typeof candidate.displayName !== 'string') {
		return null;
	}

	return normalizeCharacterAppearance(candidate);
}

function normalizeColor(value: string | undefined, fallback: string): string {
	return value && COLOR_PATTERN.test(value) ? value : fallback;
}
