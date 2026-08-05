import {
	AdditiveBlending,
	CanvasTexture,
	Color,
	Mesh,
	MeshBasicMaterial,
	Scene,
	SphereGeometry,
	Sprite,
	SpriteMaterial,
	Vector3,
	type Texture
} from 'three';
import { clamp01, smoothstep } from './EnvironmentMath';
import type { EnvironmentQuality } from './EnvironmentQuality';
import type { EnvironmentState } from './EnvironmentState';

/** Distance from the camera at which the discs are placed (inside the dome). */
const BODY_DISTANCE = 780;
const SUN_RADIUS = 26;
const MOON_RADIUS = 20;
const WHITE = new Color('#ffffff');

/**
 * Renders the visible sun and moon.
 *
 * Both bodies are real meshes so they are genuine discs, not invisible lights.
 * Each object is added directly to the scene with `matrixAutoUpdate` disabled;
 * its world matrix is written by hand each frame. Writing `matrixWorld`
 * directly and clearing `matrixWorldNeedsUpdate` means the renderer's
 * `scene.updateMatrixWorld()` leaves our placement untouched. Everything is
 * created once — per frame only positions, colours and opacities change — so
 * the bodies add a small fixed number of draw calls and zero allocation.
 */
export class CelestialBodyRenderer {
	private readonly sunGeometry = new SphereGeometry(SUN_RADIUS, 20, 16);
	private readonly sunMaterial = new MeshBasicMaterial({
		color: new Color('#fff4d6'),
		fog: false,
		toneMapped: false,
		transparent: true
	});
	private readonly sun = new Mesh(this.sunGeometry, this.sunMaterial);

	private readonly moonGeometry = new SphereGeometry(MOON_RADIUS, 20, 16);
	private readonly moonMaterial = new MeshBasicMaterial({
		color: new Color('#d7dcec'),
		fog: false,
		toneMapped: false,
		transparent: true
	});
	private readonly moon = new Mesh(this.moonGeometry, this.moonMaterial);

	private readonly glowTexture: Texture | null;
	private readonly sunGlow: Sprite | null;
	private readonly moonGlow: Sprite | null;

	private readonly scratch = new Vector3();
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality
	) {
		this.configureBody(this.sun, 'orelunzaSun');
		this.configureBody(this.moon, 'orelunzaMoon');
		this.scene.add(this.sun, this.moon);

		if (quality.celestialGlow) {
			this.glowTexture = createRadialGlowTexture();

			this.sunGlow = this.createGlow('#ffd9a0', SUN_RADIUS * 7);
			this.moonGlow = this.createGlow('#9fb4e6', MOON_RADIUS * 5);
			this.scene.add(this.sunGlow, this.moonGlow);
		} else {
			this.glowTexture = null;
			this.sunGlow = null;
			this.moonGlow = null;
		}
	}

	update(state: EnvironmentState, cameraPosition: Vector3): void {
		if (this.disposed) {
			return;
		}

		this.placeAlong(this.sun, state.sunDirection, cameraPosition);
		this.placeAlong(this.moon, state.moonDirection, cameraPosition);

		// The sun fades out below the horizon.
		const sunOpacity = clamp01(smoothstep(-0.06, 0.08, state.sunAltitude));
		this.sunMaterial.opacity = sunOpacity;
		this.sun.visible = sunOpacity > 0.01;
		this.sunMaterial.color.copy(state.sunTint).lerp(WHITE, 0.4);

		// The moon fades in at night and dims with its illuminated fraction, so
		// a new moon is nearly invisible while a full moon is bright.
		const moonOpacity =
			clamp01(smoothstep(-0.06, 0.08, state.moonDirection.y)) *
			(0.3 + state.lunarIllumination * 0.7) *
			(0.35 + state.night * 0.65);
		this.moonMaterial.opacity = moonOpacity;
		this.moon.visible = moonOpacity > 0.01;

		if (this.sunGlow) {
			this.placeAlong(this.sunGlow, state.sunDirection, cameraPosition);
			const material = this.sunGlow.material as SpriteMaterial;
			material.opacity = sunOpacity * 0.75;
			material.color.copy(state.sunTint);
			this.sunGlow.visible = this.sun.visible;
		}

		if (this.moonGlow) {
			this.placeAlong(this.moonGlow, state.moonDirection, cameraPosition);
			(this.moonGlow.material as SpriteMaterial).opacity = moonOpacity * 0.6;
			this.moonGlow.visible = this.moon.visible;
		}
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.scene.remove(this.sun, this.moon);
		this.sunGeometry.dispose();
		this.sunMaterial.dispose();
		this.moonGeometry.dispose();
		this.moonMaterial.dispose();

		if (this.sunGlow) {
			this.scene.remove(this.sunGlow);
			(this.sunGlow.material as SpriteMaterial).dispose();
		}

		if (this.moonGlow) {
			this.scene.remove(this.moonGlow);
			(this.moonGlow.material as SpriteMaterial).dispose();
		}

		this.glowTexture?.dispose();
	}

	private configureBody(body: Mesh | Sprite, name: string): void {
		body.name = name;
		body.frustumCulled = false;
		body.renderOrder = -900;
		body.matrixAutoUpdate = false;
	}

	private createGlow(color: string, scale: number): Sprite {
		const sprite = new Sprite(
			new SpriteMaterial({
				map: this.glowTexture,
				color: new Color(color),
				blending: AdditiveBlending,
				depthWrite: false,
				depthTest: false,
				fog: false,
				toneMapped: false,
				transparent: true
			})
		);
		sprite.scale.setScalar(scale);
		sprite.frustumCulled = false;
		sprite.renderOrder = -950;
		sprite.matrixAutoUpdate = false;

		return sprite;
	}

	/**
	 * Positions an object along a unit direction at BODY_DISTANCE from the
	 * camera, writing its world matrix directly so the renderer's world-matrix
	 * pass will not overwrite the placement.
	 */
	private placeAlong(object: Mesh | Sprite, direction: Vector3, cameraPosition: Vector3): void {
		this.scratch.copy(direction).multiplyScalar(BODY_DISTANCE).add(cameraPosition);

		object.position.copy(this.scratch);
		object.matrix.makeTranslation(this.scratch.x, this.scratch.y, this.scratch.z);
		object.matrixWorld.copy(object.matrix);
		object.matrixWorldNeedsUpdate = false;
	}
}

/**
 * Builds a small radial-gradient glow texture once. In headless environments
 * without a 2D canvas context this returns a 1x1 texture so construction never
 * throws during tests.
 */
function createRadialGlowTexture(): Texture {
	if (typeof document === 'undefined') {
		return new CanvasTexture(createFallbackCanvas());
	}

	const size = 128;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d');

	if (!context) {
		return new CanvasTexture(createFallbackCanvas());
	}

	const gradient = context.createRadialGradient(
		size / 2,
		size / 2,
		0,
		size / 2,
		size / 2,
		size / 2
	);
	gradient.addColorStop(0, 'rgba(255,255,255,1)');
	gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
	gradient.addColorStop(1, 'rgba(255,255,255,0)');

	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);

	const texture = new CanvasTexture(canvas);
	texture.needsUpdate = true;

	return texture;
}

function createFallbackCanvas(): HTMLCanvasElement {
	return {
		width: 1,
		height: 1
	} as unknown as HTMLCanvasElement;
}
