import {
	DEFAULT_CHARACTER_APPEARANCE,
	normalizeCharacterAppearance,
	type CharacterAppearanceV1
} from '../character/CharacterAppearance';

export type HumanoidHairStyle = CharacterAppearanceV1['hairStyle'];
export type HumanoidClothingStyle = 'field_tunic' | 'woven_trousers' | 'soft_boots';

export interface HumanoidAppearance {
	displayName: string;
	skinTone: string;
	hairStyle: HumanoidHairStyle;
	hairColor: string;
	top: {
		color: string;
		style: HumanoidClothingStyle;
	};
	pants: {
		color: string;
		style: HumanoidClothingStyle;
	};
	shoes: {
		color: string;
		style: HumanoidClothingStyle;
	};
}

export const DEFAULT_HUMANOID_APPEARANCE: HumanoidAppearance = toHumanoidAppearance(
	DEFAULT_CHARACTER_APPEARANCE
);

export function toHumanoidAppearance(
	appearance: Partial<CharacterAppearanceV1> | null | undefined
): HumanoidAppearance {
	const normalized = normalizeCharacterAppearance(appearance);

	return {
		displayName: normalized.displayName,
		skinTone: normalized.skinTone,
		hairStyle: normalized.hairStyle,
		hairColor: normalized.hairColor,
		top: {
			color: normalized.shirtColor,
			style: 'field_tunic'
		},
		pants: {
			color: normalized.pantsColor,
			style: 'woven_trousers'
		},
		shoes: {
			color: normalized.shoesColor,
			style: 'soft_boots'
		}
	};
}
