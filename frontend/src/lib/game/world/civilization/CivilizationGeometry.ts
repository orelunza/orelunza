import {
	BoxGeometry,
	BufferGeometry,
	ConeGeometry,
	CylinderGeometry,
	Float32BufferAttribute
} from 'three';
import type { BlockRenderShape } from '../voxel-types';

const cache = new Map<string, BufferGeometry>();

export function civilizationGeometry(shape: BlockRenderShape, lit = false): BufferGeometry | null {
	const key = `${shape}:${lit ? 'lit' : 'idle'}`;
	const existing = cache.get(key);
	if (existing) return existing;
	const geometry = createGeometry(shape, lit);
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

function createGeometry(shape: BlockRenderShape, lit: boolean): BufferGeometry | null {
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
			return lit
				? merge([cylinder(0.4, 0.44, 0.16, 10, 0, -0.42, 0), cone(0.22, 0.58, 8, 0, -0.04, 0)])
				: cylinder(0.4, 0.44, 0.16, 10, 0, -0.42, 0);
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

function merge(sources: BufferGeometry[]): BufferGeometry {
	const positions: number[] = [];
	const normals: number[] = [];
	for (const source of sources) {
		const geometry = source.index ? source.toNonIndexed() : source.clone();
		const position = geometry.getAttribute('position');
		const normal = geometry.getAttribute('normal');
		for (let i = 0; i < position.count; i += 1) {
			positions.push(position.getX(i), position.getY(i), position.getZ(i));
			normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
		}
		geometry.dispose();
		source.dispose();
	}
	const merged = new BufferGeometry();
	merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
	merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
	return merged;
}
