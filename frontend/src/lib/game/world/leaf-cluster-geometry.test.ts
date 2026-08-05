import { describe, expect, test } from 'vitest';

import { createLeafClusterGeometry } from './LeafClusterGeometry';

describe('production leaf cluster geometry', () => {
	test('builds one irregular multi-volume cluster with matching attributes', () => {
		const geometry = createLeafClusterGeometry();
		const positions = geometry.getAttribute('position');
		const normals = geometry.getAttribute('normal');
		const colors = geometry.getAttribute('color');

		expect(positions.count).toBeGreaterThan(36);
		expect(normals.count).toBe(positions.count);
		expect(colors.count).toBe(positions.count);
		expect(geometry.index).toBeNull();

		geometry.dispose();
	});

	test('keeps the cluster inside a bounded voxel-scale silhouette', () => {
		const geometry = createLeafClusterGeometry();
		geometry.computeBoundingBox();
		const bounds = geometry.boundingBox;

		expect(bounds).not.toBeNull();
		expect(bounds!.max.x - bounds!.min.x).toBeGreaterThan(0.9);
		expect(bounds!.max.y - bounds!.min.y).toBeGreaterThan(0.8);
		expect(bounds!.max.z - bounds!.min.z).toBeGreaterThan(0.9);
		expect(bounds!.max.x - bounds!.min.x).toBeLessThan(1.5);
		expect(bounds!.max.y - bounds!.min.y).toBeLessThan(1.4);
		expect(bounds!.max.z - bounds!.min.z).toBeLessThan(1.5);

		geometry.dispose();
	});

	test('contains bright exterior and dark interior colour ranges', () => {
		const geometry = createLeafClusterGeometry();
		const colors = geometry.getAttribute('color');
		let minimum = Number.POSITIVE_INFINITY;
		let maximum = Number.NEGATIVE_INFINITY;

		for (let index = 0; index < colors.count; index += 1) {
			const brightness =
				colors.getX(index) * 0.2126 + colors.getY(index) * 0.7152 + colors.getZ(index) * 0.0722;
			minimum = Math.min(minimum, brightness);
			maximum = Math.max(maximum, brightness);
		}

		expect(minimum).toBeLessThan(0.32);
		expect(maximum).toBeGreaterThan(0.72);
		expect(maximum - minimum).toBeGreaterThan(0.45);

		geometry.dispose();
	});

	test('keeps every generated value finite', () => {
		const geometry = createLeafClusterGeometry();

		for (const attributeName of ['position', 'normal', 'color'] as const) {
			const attribute = geometry.getAttribute(attributeName);

			for (let index = 0; index < attribute.count; index += 1) {
				expect(Number.isFinite(attribute.getX(index))).toBe(true);
				expect(Number.isFinite(attribute.getY(index))).toBe(true);
				expect(Number.isFinite(attribute.getZ(index))).toBe(true);
			}
		}

		geometry.dispose();
	});
});
