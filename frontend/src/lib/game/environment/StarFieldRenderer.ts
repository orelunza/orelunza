import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	Points,
	PointsMaterial,
	Scene,
	Vector3
} from 'three';
import { DeterministicRandom, TWO_PI } from './EnvironmentMath';
import type { EnvironmentQuality } from './EnvironmentQuality';
import type { EnvironmentState } from './EnvironmentState';

/** Radius of the star shell; sits just inside the atmosphere dome. */
const STAR_SHELL_RADIUS = 850;

/**
 * Renders the night sky's stars.
 *
 * All stars live in one {@link Points} object: a single geometry, a single
 * material, one draw call regardless of star count — never one draw call per
 * star. Positions are generated once from a seeded generator so the same seed
 * always yields the same constellation, and are never regenerated per frame.
 * Only the material opacity changes each frame so stars fade in at night and
 * out by day, and dim behind clouds.
 */
export class StarFieldRenderer {
	private readonly geometry = new BufferGeometry();
	private readonly material: PointsMaterial;
	private readonly points: Points;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality,
		seed: number
	) {
		const count = quality.starCount;
		const positions = new Float32Array(count * 3);
		const sizes = new Float32Array(count);
		const random = new DeterministicRandom(seed ^ 0x51ed270b);

		for (let index = 0; index < count; index += 1) {
			// Uniformly distribute points on the upper hemisphere shell. A few
			// dip slightly below the horizon; the dome and terrain occlude them.
			const u = random.next();
			const v = random.next() * 0.92 + 0.04;
			const theta = u * TWO_PI;
			const phi = Math.acos(1 - v);
			const sinPhi = Math.sin(phi);

			positions[index * 3] = STAR_SHELL_RADIUS * sinPhi * Math.cos(theta);
			positions[index * 3 + 1] = STAR_SHELL_RADIUS * Math.cos(phi);
			positions[index * 3 + 2] = STAR_SHELL_RADIUS * sinPhi * Math.sin(theta);

			// A spread of sizes gives several apparent star intensities.
			sizes[index] = random.range(0.6, 2.4);
		}

		this.geometry.setAttribute('position', new BufferAttribute(positions, 3));
		this.geometry.setAttribute('size', new BufferAttribute(sizes, 1));
		this.geometry.computeBoundingSphere();

		this.material = new PointsMaterial({
			color: 0xffffff,
			size: 2.4,
			sizeAttenuation: false,
			transparent: true,
			opacity: 0,
			depthWrite: false,
			depthTest: false,
			fog: false,
			toneMapped: false,
			blending: AdditiveBlending
		});

		this.points = new Points(this.geometry, this.material);
		this.points.name = 'orelunzaStarField';
		this.points.frustumCulled = false;
		this.points.renderOrder = -960;
		this.points.matrixAutoUpdate = false;

		this.scene.add(this.points);
	}

	update(state: EnvironmentState, cameraPosition: Vector3): void {
		if (this.disposed) {
			return;
		}

		// Follow the camera so stars are always at infinity, never approached.
		this.points.matrix.makeTranslation(cameraPosition.x, cameraPosition.y, cameraPosition.z);
		this.points.matrixWorld.copy(this.points.matrix);
		this.points.matrixWorldNeedsUpdate = false;

		this.material.opacity = state.starVisibility;
		this.points.visible = state.starVisibility > 0.01;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.scene.remove(this.points);
		this.geometry.dispose();
		this.material.dispose();
	}
}
