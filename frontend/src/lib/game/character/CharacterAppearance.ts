export interface CharacterAppearanceV1 {
	version: 1;
	displayName: string;
	skinTone: string;
	hairStyle: 'short' | 'curly' | 'long' | 'none';
	hairColor: string;
	shirtColor: string;
	pantsColor: string;
	shoesColor: string;
}

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearanceV1 = {
	version: 1,
	displayName: 'Orelunza Citizen',
	skinTone: '#b98565',
	hairStyle: 'short',
	hairColor: '#3b2b22',
	shirtColor: '#4f8f74',
	pantsColor: '#37485f',
	shoesColor: '#2b2725'
};

export function normalizeCharacterAppearance(
	value: Partial<CharacterAppearanceV1> | null | undefined
): CharacterAppearanceV1 {
	return {
		...DEFAULT_CHARACTER_APPEARANCE,
		...value,
		version: 1,
		displayName: value?.displayName?.trim() || DEFAULT_CHARACTER_APPEARANCE.displayName
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
