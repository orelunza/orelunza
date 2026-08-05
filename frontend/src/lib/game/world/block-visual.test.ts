import { describe, expect, test } from 'vitest';

import { BlockRegistry } from './BlockRegistry';
import { blockVisual } from './block-visual';

describe('block visual helper for catalog icons', () => {
	test('derives face colours from the registry colour', () => {
		const visual = blockVisual('grass');
		const registryColor = BlockRegistry.get('grass').color;
		const expectedTop = `#${registryColor.toString(16).padStart(6, '0')}`;

		expect(visual.top).toBe(expectedTop);
		expect(visual.left).not.toBe(visual.top);
		expect(visual.right).not.toBe(visual.top);
	});

	test('returns a stable object per type', () => {
		expect(blockVisual('stone')).toBe(blockVisual('stone'));
	});

	test('marks transparent blocks with reduced opacity', () => {
		expect(blockVisual('glass').opacity).toBeLessThan(1);
		expect(blockVisual('brick').opacity).toBe(1);
	});

	test('returns CSS-ready colours without browser APIs', () => {
		const visual = blockVisual('wood');

		expect(visual).toMatchObject({
			top: expect.stringMatching(/^#[0-9a-f]{6}$/i),
			left: expect.stringMatching(/^#[0-9a-f]{6}$/i),
			right: expect.stringMatching(/^#[0-9a-f]{6}$/i),
			opacity: 1
		});
	});

	test('derives different icon colours for different blocks', () => {
		expect(blockVisual('wood').top).not.toBe(blockVisual('stone').top);
	});
});
