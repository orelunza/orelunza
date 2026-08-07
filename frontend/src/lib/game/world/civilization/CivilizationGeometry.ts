import {
	BoxGeometry,
	BufferGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	Float32BufferAttribute
} from 'three';
import type { BlockRenderShape } from '../voxel-types';

const cache = new Map<string, BufferGeometry>();

export function civilizationGeometry(
	shape: BlockRenderShape,
	active = false
): BufferGeometry | null {
	const key = `${shape}:${active ? 'active' : 'idle'}`;
	const existing = cache.get(key);
	if (existing) return existing;
	const geometry = createGeometry(shape, active);
	if (!geometry) return null;
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	cache.set(key, geometry);
	return geometry;
}

export function disposeCivilizationGeometries(): void {
	for (const geometry of cache.values()) geometry.dispose();
	cache.clear();
}

function createGeometry(shape: BlockRenderShape, active: boolean): BufferGeometry | null {
	switch (shape) {
		case 'glass-panel':
			return box(0.92, 0.92, 0.08, 0, 0, 0);
		case 'door':
			return merge([box(0.9, 1.86, 0.11, 0, 0.43, 0), box(0.07, 0.07, 0.08, 0.32, 0.45, 0.09)]);
		case 'slab':
			return box(1, 0.5, 1, 0, -0.25, 0);
		case 'stairs':
			return merge([box(1, 0.5, 1, 0, -0.25, 0), box(1, 0.5, 0.5, 0, 0.25, 0.25)]);
		case 'wood-fence':
			return merge([
				box(0.18, 1.15, 0.18, 0, 0.075, 0),
				box(0.92, 0.13, 0.12, 0, 0.18, 0),
				box(0.92, 0.13, 0.12, 0, -0.18, 0),
				box(0.12, 0.13, 0.92, 0, 0.18, 0),
				box(0.12, 0.13, 0.92, 0, -0.18, 0)
			]);
		case 'metal-fence': {
			const parts: BufferGeometry[] = [
				box(0.96, 0.08, 0.08, 0, 0.38, 0),
				box(0.96, 0.08, 0.08, 0, -0.32, 0)
			];
			for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) parts.push(box(0.055, 1.18, 0.055, x, 0.08, 0));
			return merge(parts);
		}
		case 'brick-fence':
			return merge([
				box(1, 0.64, 0.26, 0, -0.18, 0),
				box(0.22, 0.86, 0.36, -0.39, -0.07, 0),
				box(0.22, 0.86, 0.36, 0.39, -0.07, 0)
			]);
		case 'table':
			return merge([
				box(0.92, 0.1, 0.92, 0, 0.23, 0),
				...[-0.36, 0.36].flatMap((x) => [-0.36, 0.36].map((z) => box(0.09, 0.7, 0.09, x, -0.17, z)))
			]);
		case 'bed':
			return merge([
				box(0.92, 0.15, 0.94, 0, -0.4, 0),
				box(0.84, 0.18, 0.86, 0, -0.23, 0.02),
				box(0.68, 0.11, 0.25, 0, -0.08, -0.25),
				box(0.92, 0.42, 0.08, 0, -0.08, 0.43)
			]);
		case 'mattress':
			return merge([box(0.92, 0.2, 0.94, 0, -0.4, 0), box(0.65, 0.08, 0.24, 0, -0.25, -0.27)]);
		case 'curtain':
			return merge([box(0.9, 0.82, 0.045, 0, 0.02, 0), box(0.98, 0.05, 0.07, 0, 0.45, 0)]);
		case 'wardrobe':
			return merge([
				box(0.9, 1.72, 0.56, 0, 0.36, 0),
				box(0.025, 1.58, 0.04, 0, 0.36, -0.3),
				box(0.04, 0.04, 0.05, -0.08, 0.38, -0.33),
				box(0.04, 0.04, 0.05, 0.08, 0.38, -0.33)
			]);
		case 'clothes-rack':
			return merge([
				box(0.07, 1.4, 0.07, -0.38, 0.2, 0),
				box(0.07, 1.4, 0.07, 0.38, 0.2, 0),
				box(0.82, 0.07, 0.07, 0, 0.86, 0),
				box(0.82, 0.07, 0.42, 0, -0.47, 0)
			]);
		case 'shoe-rack':
			return merge([
				box(0.88, 0.08, 0.5, 0, -0.42, 0),
				box(0.88, 0.08, 0.5, 0, -0.14, 0),
				box(0.07, 0.56, 0.5, -0.4, -0.22, 0),
				box(0.07, 0.56, 0.5, 0.4, -0.22, 0)
			]);
		case 'floor-lamp':
			return merge([
				cylinder(0.2, 0.2, 0.08, 12, 0, -0.46, 0),
				cylinder(0.035, 0.035, 1.15, 8, 0, 0.08, 0),
				cone(0.28, 0.4, 16, 0, 0.66, 0)
			]);
		case 'fire-pit':
			return active
				? merge([cylinder(0.4, 0.44, 0.16, 10, 0, -0.42, 0), cone(0.22, 0.58, 8, 0, -0.04, 0)])
				: cylinder(0.4, 0.44, 0.16, 10, 0, -0.42, 0);

		case 'chair':
			return merge([
				box(0.62, 0.1, 0.62, 0, -0.08, 0),
				box(0.62, 0.58, 0.1, 0, 0.28, 0.27),
				...[-0.24, 0.24].flatMap((x) => [-0.24, 0.24].map((z) => box(0.07, 0.5, 0.07, x, -0.32, z)))
			]);
		case 'sofa':
			return merge([
				box(0.94, 0.3, 0.7, 0, -0.25, 0.05),
				box(0.94, 0.48, 0.16, 0, 0.1, 0.32),
				box(0.12, 0.48, 0.72, -0.41, -0.05, 0.04),
				box(0.12, 0.48, 0.72, 0.41, -0.05, 0.04)
			]);
		case 'kitchen-counter':
			return merge([
				box(0.98, 0.78, 0.76, 0, -0.08, 0.08),
				box(1, 0.1, 0.82, 0, 0.38, 0.05),
				box(0.04, 0.58, 0.04, 0, -0.05, -0.325)
			]);
		case 'kitchen-cabinet':
			return active
				? merge([
						box(0.9, 0.88, 0.56, 0, -0.02, 0.08),
						box(0.42, 0.78, 0.06, -0.44, -0.02, -0.21),
						box(0.42, 0.78, 0.06, 0.44, -0.02, -0.21)
					])
				: merge([box(0.9, 0.88, 0.56, 0, -0.02, 0.08), box(0.04, 0.72, 0.04, 0, -0.02, -0.22)]);
		case 'refrigerator':
			return active
				? merge([
						box(0.82, 1.72, 0.68, 0, 0.36, 0.05),
						box(0.7, 1.58, 0.07, -0.38, 0.36, -0.28),
						box(0.05, 0.55, 0.06, -0.31, 0.35, -0.33)
					])
				: merge([
						box(0.82, 1.72, 0.68, 0, 0.36, 0.05),
						box(0.05, 0.55, 0.06, 0.29, 0.35, -0.31),
						box(0.72, 0.035, 0.04, 0, 0.25, -0.31)
					]);
		case 'sink':
			return merge([
				box(0.92, 0.72, 0.7, 0, -0.12, 0.08),
				box(0.92, 0.1, 0.76, 0, 0.3, 0.04),
				box(0.54, 0.04, 0.42, 0, 0.35, 0.02),
				cylinder(0.025, 0.025, 0.35, 8, 0.22, 0.52, 0.21),
				box(0.32, 0.035, 0.035, 0.06, 0.68, 0.21)
			]);
		case 'toilet':
			return merge([
				box(0.58, 0.58, 0.32, 0, 0.08, 0.28),
				cylinder(0.32, 0.28, 0.38, 18, 0, -0.25, 0),
				box(0.56, 0.08, 0.62, 0, -0.03, -0.03)
			]);
		case 'shower':
			return merge([
				box(0.88, 0.06, 0.88, 0, -0.46, 0),
				box(0.05, 1.82, 0.05, 0.36, 0.4, 0.34),
				box(0.05, 1.82, 0.05, -0.36, 0.4, 0.34),
				box(0.78, 0.05, 0.05, 0, 1.28, 0.34),
				cylinder(0.16, 0.16, 0.05, 12, 0, 1.12, 0.06)
			]);
		case 'mirror':
			return merge([box(0.74, 0.82, 0.035, 0, 0.06, 0), box(0.82, 0.9, 0.04, 0, 0.06, 0.025)]);
		case 'radio':
			return merge([
				box(0.72, 0.38, 0.3, 0, -0.28, 0),
				cylinder(0.12, 0.12, 0.035, 14, -0.18, -0.28, -0.17),
				box(0.035, 0.58, 0.035, 0.26, 0.06, 0)
			]);
		case 'bookshelf': {
			const parts: BufferGeometry[] = [box(0.9, 1.7, 0.34, 0, 0.35, 0.24)];
			for (const y of [-0.24, 0.14, 0.52]) parts.push(box(0.76, 0.055, 0.38, 0, y, 0.03));
			return merge(parts);
		}
		case 'rug':
			return box(0.94, 0.025, 0.94, 0, -0.487, 0);
		case 'cooking-pot':
			return merge([
				cylinder(0.27, 0.22, 0.32, 14, 0, -0.32, 0),
				box(0.68, 0.055, 0.055, 0, -0.2, 0)
			]);
		case 'frying-pan':
			return merge([
				cylinder(0.28, 0.28, 0.06, 16, -0.08, -0.4, 0),
				box(0.56, 0.07, 0.09, 0.28, -0.39, 0)
			]);
		case 'plate-stack':
			return merge([-0.43, -0.38, -0.33].map((y) => cylinder(0.28, 0.28, 0.035, 18, 0, y, 0)));
		case 'glass-cup':
			return merge([
				cylinder(0.13, 0.1, 0.3, 14, 0, -0.32, 0),
				cylinder(0.08, 0.08, 0.04, 12, 0, -0.15, 0)
			]);
		case 'fruit-bowl':
			return merge([
				cylinder(0.3, 0.2, 0.16, 14, 0, -0.4, 0),
				...[-0.14, 0, 0.14].map((x, index) => cone(0.11, 0.2, 8, x, -0.21 + (index % 2) * 0.04, 0))
			]);
		case 'road-marking':
			return box(0.78, 0.018, 0.18, 0, -0.49, 0);
		case 'glass-door':
			return merge([
				box(0.9, 1.86, 0.06, 0, 0.43, 0),
				box(0.045, 1.86, 0.09, -0.43, 0.43, 0),
				box(0.045, 1.86, 0.09, 0.43, 0.43, 0),
				box(0.8, 0.045, 0.09, 0, 1.34, 0),
				box(0.05, 0.35, 0.08, 0.29, 0.4, 0.07)
			]);
		case 'street-lamp':
			return merge([
				cylinder(0.16, 0.19, 0.12, 12, 0, -0.44, 0),
				cylinder(0.045, 0.055, 1.72, 10, 0, 0.38, 0),
				box(0.58, 0.055, 0.055, 0.24, 1.16, 0),
				box(0.28, 0.16, 0.22, 0.48, 1.08, 0)
			]);
		case 'bench':
			return merge([
				box(0.96, 0.1, 0.42, 0, -0.12, 0),
				box(0.96, 0.48, 0.08, 0, 0.2, 0.2),
				box(0.08, 0.5, 0.34, -0.36, -0.3, 0),
				box(0.08, 0.5, 0.34, 0.36, -0.3, 0)
			]);
		case 'trash-bin':
			return merge([
				cylinder(0.28, 0.32, 0.7, 12, 0, -0.14, 0),
				cylinder(0.31, 0.31, 0.07, 12, 0, 0.24, 0)
			]);
		case 'bollard':
			return merge([
				cylinder(0.13, 0.16, 0.76, 10, 0, -0.1, 0),
				cylinder(0.18, 0.18, 0.08, 10, 0, -0.46, 0)
			]);
		case 'bus-shelter':
			return merge([
				box(0.05, 1.72, 0.05, -0.43, 0.35, -0.34),
				box(0.05, 1.72, 0.05, 0.43, 0.35, -0.34),
				box(0.05, 1.72, 0.05, -0.43, 0.35, 0.34),
				box(0.05, 1.72, 0.05, 0.43, 0.35, 0.34),
				box(0.96, 0.07, 0.78, 0, 1.22, 0),
				box(0.88, 1.52, 0.035, 0, 0.34, 0.34),
				box(0.72, 0.08, 0.32, 0, -0.18, 0.02)
			]);
		case 'store-shelf': {
			const parts: BufferGeometry[] = [paint(box(0.92, 1.7, 0.42, 0, 0.35, 0.2), 0x665f57)];
			const productColors = [0xd59a55, 0xc95545, 0x7ba35f, 0x5e95bd, 0xe0d39f, 0x8d6eb2];
			let productIndex = 0;
			for (const y of [-0.28, 0.08, 0.44, 0.78]) {
				parts.push(paint(box(0.82, 0.055, 0.48, 0, y, 0), 0xa59a8d));
				for (const x of [-0.28, 0, 0.28]) {
					parts.push(
						paint(
							box(0.2, 0.16, 0.28, x, y + 0.11, -0.04),
							productColors[productIndex++ % productColors.length]!
						)
					);
				}
			}
			return merge(parts);
		}
		case 'produce-crate':
			return merge([
				paint(box(0.9, 0.48, 0.8, 0, -0.26, 0), 0x8d6745),
				...[-0.27, 0, 0.27].map((x, i) =>
					paint(
						cone(0.105, 0.19, 8, x, 0.03 + (i % 2) * 0.03, 0),
						[0xc94f42, 0xe49b3b, 0x77a54e][i]!
					)
				),
				...[-0.16, 0.16].map((z, i) =>
					paint(cone(0.09, 0.17, 8, i === 0 ? -0.12 : 0.14, 0.09, z), i === 0 ? 0x7ca74d : 0xd75d52)
				)
			]);
		case 'drink-cooler': {
			const parts: BufferGeometry[] = [
				paint(box(0.88, 1.72, 0.58, 0, 0.36, 0.08), 0x59666b),
				paint(box(0.72, 1.42, 0.045, 0, 0.4, -0.23), 0xa9d1d6),
				paint(box(0.045, 0.45, 0.05, 0.29, 0.42, -0.27), 0xd9e3e5)
			];
			for (const y of [-0.1, 0.28, 0.66]) {
				parts.push(paint(box(0.68, 0.035, 0.36, 0, y - 0.08, 0.05), 0xc7d1d3));
				for (const x of [-0.24, -0.08, 0.08, 0.24]) {
					parts.push(paint(cylinder(0.045, 0.05, 0.24, 10, x, y + 0.05, 0.02), 0x6aaec8));
				}
			}
			return merge(parts);
		}
		case 'checkout-counter':
			return merge([
				box(0.96, 0.72, 0.74, 0, -0.12, 0.06),
				box(0.96, 0.08, 0.82, 0, 0.28, 0.02),
				box(0.3, 0.22, 0.2, 0.25, 0.43, 0.04),
				box(0.14, 0.24, 0.08, 0.25, 0.61, 0.02)
			]);
		case 'shopping-cart':
			return merge([
				box(0.68, 0.45, 0.46, 0, -0.06, 0.04),
				box(0.06, 0.72, 0.06, -0.34, -0.02, 0.2),
				box(0.06, 0.72, 0.06, 0.34, -0.02, 0.2),
				box(0.8, 0.055, 0.055, 0, 0.34, 0.2),
				cylinder(0.075, 0.075, 0.06, 10, -0.28, -0.43, -0.18),
				cylinder(0.075, 0.075, 0.06, 10, 0.28, -0.43, -0.18)
			]);
		case 'store-sign':
			return merge([box(0.82, 0.38, 0.08, 0, 0.15, 0), box(0.08, 0.5, 0.08, -0.38, 0.15, 0)]);
		case 'pool-ladder':
			return merge([
				cylinder(0.035, 0.035, 1.45, 8, -0.28, 0.22, 0),
				cylinder(0.035, 0.035, 1.45, 8, 0.28, 0.22, 0),
				...[-0.32, -0.04, 0.24, 0.52].map((y) => box(0.56, 0.04, 0.05, 0, y, 0))
			]);
		default:
			return null;
	}
}

function box(
	width: number,
	height: number,
	depth: number,
	x: number,
	y: number,
	z: number
): BufferGeometry {
	const geometry = new BoxGeometry(width, height, depth);
	geometry.translate(x, y, z);
	return geometry;
}

function cylinder(
	radiusTop: number,
	radiusBottom: number,
	height: number,
	segments: number,
	x: number,
	y: number,
	z: number
): BufferGeometry {
	const geometry = new CylinderGeometry(radiusTop, radiusBottom, height, segments);
	geometry.translate(x, y, z);
	return geometry;
}

function cone(
	radius: number,
	height: number,
	segments: number,
	x: number,
	y: number,
	z: number
): BufferGeometry {
	const geometry = new ConeGeometry(radius, height, segments);
	geometry.translate(x, y, z);
	return geometry;
}

function paint(geometry: BufferGeometry, color: number): BufferGeometry {
	const position = geometry.getAttribute('position');
	const value = new Color(color);
	const colors = new Float32Array(position.count * 3);
	for (let index = 0; index < position.count; index += 1) {
		colors[index * 3] = value.r;
		colors[index * 3 + 1] = value.g;
		colors[index * 3 + 2] = value.b;
	}
	geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
	return geometry;
}

function merge(sources: BufferGeometry[]): BufferGeometry {
	const positions: number[] = [];
	const normals: number[] = [];
	const colors: number[] = [];
	let hasColors = false;
	for (const source of sources) {
		const geometry = source.index ? source.toNonIndexed() : source.clone();
		const position = geometry.getAttribute('position');
		const normal = geometry.getAttribute('normal');
		const color = geometry.getAttribute('color');
		hasColors ||= color !== undefined;
		for (let i = 0; i < position.count; i += 1) {
			positions.push(position.getX(i), position.getY(i), position.getZ(i));
			normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
			colors.push(color?.getX(i) ?? 1, color?.getY(i) ?? 1, color?.getZ(i) ?? 1);
		}
		geometry.dispose();
		source.dispose();
	}
	const merged = new BufferGeometry();
	merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
	merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
	if (hasColors) merged.setAttribute('color', new Float32BufferAttribute(colors, 3));
	return merged;
}
