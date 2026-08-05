import type { Vector3 } from 'three';
import type { VegetationBuildTarget } from './BuildTarget';
import type {
	VegetationInteractionIndex,
	VegetationInteractionInstance
} from '../vegetation/VegetationInteractionIndex';

/** Raycasts lightweight plant bounds from the chunked interaction index. */
export class VegetationRaycaster {
	raycastFrom(
		origin: Readonly<Vector3>,
		direction: Readonly<Vector3>,
		index: VegetationInteractionIndex,
		maximumDistance: number,
		minimumDistance = 0
	): VegetationBuildTarget | null {
		if (!isFiniteVector(origin) || !isFiniteVector(direction)) {
			return null;
		}

		const length = Math.hypot(direction.x, direction.y, direction.z);

		if (length <= Number.EPSILON || !Number.isFinite(maximumDistance) || maximumDistance <= 0) {
			return null;
		}

		const normalized = {
			x: direction.x / length,
			y: direction.y / length,
			z: direction.z / length
		};
		const minimum = Math.max(0, finiteOr(minimumDistance, 0));
		const maximum = Math.max(minimum, finiteOr(maximumDistance, minimum));
		let nearest: VegetationBuildTarget | null = null;

		for (const instance of index.candidatesAlongRay(origin, normalized, minimum, maximum)) {
			const distance = rayBoxDistance(origin, normalized, instance, minimum, maximum);

			if (distance === null || (nearest && distance >= nearest.distance)) {
				continue;
			}

			nearest = {
				kind: 'vegetation',
				distance,
				...cloneInstance(instance)
			};
		}

		return nearest;
	}
}

export function rayBoxDistance(
	origin: Readonly<{ x: number; y: number; z: number }>,
	direction: Readonly<{ x: number; y: number; z: number }>,
	instance: Pick<VegetationInteractionInstance, 'position' | 'halfExtents'>,
	minimumDistance = 0,
	maximumDistance = Number.POSITIVE_INFINITY
): number | null {
	let entry = Math.max(0, minimumDistance);
	let exit = maximumDistance;

	for (const axis of ['x', 'y', 'z'] as const) {
		const center = instance.position[axis];
		const extent = Math.max(0.02, instance.halfExtents[axis]);
		const minimum = center - extent;
		const maximum = center + extent;
		const rayOrigin = origin[axis];
		const rayDirection = direction[axis];

		if (Math.abs(rayDirection) <= 1e-8) {
			if (rayOrigin < minimum || rayOrigin > maximum) {
				return null;
			}

			continue;
		}

		const inverse = 1 / rayDirection;
		let near = (minimum - rayOrigin) * inverse;
		let far = (maximum - rayOrigin) * inverse;

		if (near > far) {
			[near, far] = [far, near];
		}

		entry = Math.max(entry, near);
		exit = Math.min(exit, far);

		if (exit < entry) {
			return null;
		}
	}

	return entry <= maximumDistance ? entry : null;
}

function cloneInstance(instance: VegetationInteractionInstance): VegetationInteractionInstance {
	return {
		...instance,
		chunk: { ...instance.chunk },
		position: { ...instance.position },
		halfExtents: { ...instance.halfExtents }
	};
}

function isFiniteVector(vector: Readonly<{ x: number; y: number; z: number }>): boolean {
	return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
