import { describe, expect, test } from 'vitest';

import { vegetationRandom01, vegetationTintAt } from './VegetationPalette';

function brightness(color: number): number {
	const r = (color >> 16) & 0xff;
	const g = (color >> 8) & 0xff;
	const b = color & 0xff;

	return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

describe('production vegetation palette', () => {
	test('returns deterministic grass and leaf colours', () => {
		const position = { x: 17, y: 10, z: -23 };

		expect(vegetationTintAt('grass', position, 'Spawn Meadow')).toBe(
			vegetationTintAt('grass', position, 'Spawn Meadow')
		);
		expect(vegetationTintAt('leaves', position, 'Forest Edge')).toBe(
			vegetationTintAt('leaves', position, 'Forest Edge')
		);
	});

	test('varies neighbouring vegetation without random state', () => {
		const colors = new Set(
			Array.from({ length: 16 }, (_, index) =>
				vegetationTintAt('grass', { x: index, y: 9, z: 4 }, 'Spawn Meadow')
			)
		);

		expect(colors.size).toBeGreaterThan(4);
	});

	test('keeps forest grass darker than the open meadow', () => {
		let forestBrightness = 0;
		let meadowBrightness = 0;

		for (let index = 0; index < 32; index += 1) {
			const position = { x: index - 16, y: 9, z: index * 2 - 21 };
			forestBrightness += brightness(vegetationTintAt('grass', position, 'Forest Edge'));
			meadowBrightness += brightness(vegetationTintAt('grass', position, 'Spawn Meadow'));
		}

		expect(forestBrightness).toBeLessThan(meadowBrightness);
	});

	test('keeps the deterministic random helper finite and bounded', () => {
		for (let index = -100; index <= 100; index += 1) {
			const value = vegetationRandom01(index, index * 3, -index * 2, 71);

			expect(Number.isFinite(value)).toBe(true);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});
});
