import { describe, expect, test } from 'vitest';
import { BlockRegistry } from '../world/BlockRegistry';
import { blockIconShape } from './block-icon-shape';

describe('block catalog icon silhouettes', () => {
	test('assigns a meaningful silhouette to every placeable block', () => {
		for (const definition of BlockRegistry.all()) {
			if (!definition.placeable) {
				continue;
			}

			expect(blockIconShape(definition.type)).not.toBe('empty');
		}
	});

	test('does not reuse one generic cube silhouette for different placeable blocks', () => {
		const shapes = BlockRegistry.all()
			.filter((definition) => definition.placeable)
			.map((definition) => blockIconShape(definition.type));

		expect(new Set(shapes).size).toBe(shapes.length);
	});

	test('keeps air intentionally invisible', () => {
		expect(blockIconShape('air')).toBe('empty');
	});
});
