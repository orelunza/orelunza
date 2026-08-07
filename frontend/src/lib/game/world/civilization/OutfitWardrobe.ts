import type { CharacterAppearanceV1 } from '../../character/CharacterAppearance';

export interface OutfitPreset {
	id: string;
	label: string;
	shirtColor: CharacterAppearanceV1['shirtColor'];
	pantsColor: CharacterAppearanceV1['pantsColor'];
	shoesColor: CharacterAppearanceV1['shoesColor'];
}

export const OUTFIT_PRESETS: readonly OutfitPreset[] = [
	{
		id: 'everyday',
		label: 'Everyday',
		shirtColor: '#5c8f7a',
		pantsColor: '#42506a',
		shoesColor: '#2a2622'
	},
	{
		id: 'city',
		label: 'City',
		shirtColor: '#d7d3c8',
		pantsColor: '#313842',
		shoesColor: '#191b1d'
	},
	{
		id: 'warm',
		label: 'Warm earth',
		shirtColor: '#a8644f',
		pantsColor: '#574a3f',
		shoesColor: '#33251e'
	},
	{
		id: 'formal',
		label: 'Formal',
		shirtColor: '#ecebe5',
		pantsColor: '#202733',
		shoesColor: '#171717'
	},
	{
		id: 'work',
		label: 'Builder',
		shirtColor: '#cc8b36',
		pantsColor: '#384351',
		shoesColor: '#3a2c22'
	}
];

export function nextWardrobeOutfit(current: CharacterAppearanceV1): {
	appearance: CharacterAppearanceV1;
	preset: OutfitPreset;
} {
	const currentIndex = OUTFIT_PRESETS.findIndex(
		(preset) =>
			normalizeColor(current.shirtColor) === normalizeColor(preset.shirtColor) &&
			normalizeColor(current.pantsColor) === normalizeColor(preset.pantsColor) &&
			normalizeColor(current.shoesColor) === normalizeColor(preset.shoesColor)
	);
	const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % OUTFIT_PRESETS.length : 0;
	const preset = OUTFIT_PRESETS[nextIndex];
	return {
		appearance: {
			...current,
			shirtColor: preset.shirtColor,
			pantsColor: preset.pantsColor,
			shoesColor: preset.shoesColor
		},
		preset
	};
}

function normalizeColor(value: string): string {
	return value.trim().toLowerCase();
}
