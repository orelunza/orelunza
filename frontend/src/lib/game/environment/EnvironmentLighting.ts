import { AmbientLight, DirectionalLight, Fog, Scene, Vector3, type WebGLRenderer } from 'three';
import { lerp } from './EnvironmentMath';
import type { EnvironmentQuality } from './EnvironmentQuality';
import type { EnvironmentState } from './EnvironmentState';

/** How far the directional light sits from the player along the sun vector. */
const LIGHT_DISTANCE = 90;
/** Half-extent of the orthographic shadow frustum around the player. */
const SHADOW_EXTENT = 60;

/**
 * Owns the world's dynamic lighting and fog.
 *
 * There is exactly one {@link DirectionalLight} and one {@link AmbientLight};
 * they are created in the constructor and only ever mutated afterwards — no new
 * lights are allocated per frame. The directional light tracks the sun by day
 * and the moon by night, its target following the player so shadows stay
 * crisp near the camera. Colour, intensity, position and fog are eased toward
 * their targets so a slow sun does not make shadows shimmer.
 */
export class EnvironmentLighting {
	private readonly sun = new DirectionalLight(0xffffff, 1);
	private readonly ambient = new AmbientLight(0xffffff, 0.6);
	private readonly fog = new Fog(0xcfe0ec, 40, 260);

	private readonly lightPosition = new Vector3();
	private readonly followPosition = new Vector3();
	private shadowsEnabled: boolean;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality
	) {
		this.shadowsEnabled = quality.sunShadows;

		this.sun.name = 'orelunzaSunLight';
		this.sun.castShadow = quality.sunShadows;
		this.sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
		this.sun.shadow.camera.left = -SHADOW_EXTENT;
		this.sun.shadow.camera.right = SHADOW_EXTENT;
		this.sun.shadow.camera.top = SHADOW_EXTENT;
		this.sun.shadow.camera.bottom = -SHADOW_EXTENT;
		this.sun.shadow.camera.near = 1;
		this.sun.shadow.camera.far = LIGHT_DISTANCE * 2.4;
		this.sun.shadow.bias = -0.0006;
		this.sun.shadow.normalBias = 0.02;

		this.ambient.name = 'orelunzaAmbientLight';

		this.scene.add(this.sun, this.sun.target, this.ambient);
		this.scene.fog = this.fog;
	}

	/**
	 * Applies a quality change by toggling shadow casting and map size on the
	 * existing light. The light instances themselves are never replaced.
	 */
	applyQuality(quality: EnvironmentQuality, renderer: WebGLRenderer): void {
		if (this.disposed) {
			return;
		}

		this.shadowsEnabled = quality.sunShadows;
		this.sun.castShadow = quality.sunShadows;
		this.sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
		this.sun.shadow.map?.dispose();
		this.sun.shadow.map = null;
		renderer.shadowMap.enabled = quality.sunShadows;
	}

	update(state: EnvironmentState, cameraPosition: Vector3, deltaSeconds: number): void {
		if (this.disposed) {
			return;
		}

		// The directional light comes from the sun when it is up, otherwise from
		// the moon, so a scene is never lit from below the horizon.
		const useSun = state.sunAltitude > -0.05;
		const direction = useSun ? state.sunDirection : state.moonDirection;

		this.followPosition.set(cameraPosition.x, 0, cameraPosition.z);
		this.lightPosition.copy(direction).multiplyScalar(LIGHT_DISTANCE).add(this.followPosition);

		// Ease the light position toward its target. Because the sun moves
		// slowly the eased position barely lags, but the smoothing removes the
		// per-frame micro-jitter that would otherwise crawl across shadows.
		const positionEase = 1 - Math.pow(0.0001, deltaSeconds);
		this.sun.position.lerp(this.lightPosition, positionEase);
		this.sun.target.position.copy(this.followPosition);
		this.sun.target.updateMatrixWorld();

		// Ease colour and intensity so weather/time transitions never pop.
		const colorEase = 1 - Math.pow(0.002, deltaSeconds);
		this.sun.color.lerp(state.lightColor, colorEase);
		this.sun.intensity = lerp(this.sun.intensity, state.lightIntensity, colorEase);
		this.sun.shadow.radius = lerp(1, 5, state.shadowSoftness);

		this.ambient.color.lerp(state.ambientColor, colorEase);
		this.ambient.intensity = lerp(this.ambient.intensity, state.ambientIntensity, colorEase);

		// Fog colour follows the horizon; range tightens with fog density.
		this.fog.color.lerp(state.fogColor, colorEase);
		const near = lerp(40, 12, state.fogDensity);
		const far = lerp(260, 90, state.fogDensity);
		this.fog.near = lerp(this.fog.near, near, colorEase);
		this.fog.far = lerp(this.fog.far, far, colorEase);
	}

	/** Snaps eased values to their targets immediately (used on restore). */
	snapTo(state: EnvironmentState, cameraPosition: Vector3): void {
		if (this.disposed) {
			return;
		}

		const useSun = state.sunAltitude > -0.05;
		const direction = useSun ? state.sunDirection : state.moonDirection;

		this.followPosition.set(cameraPosition.x, 0, cameraPosition.z);
		this.sun.position.copy(direction).multiplyScalar(LIGHT_DISTANCE).add(this.followPosition);
		this.sun.target.position.copy(this.followPosition);
		this.sun.target.updateMatrixWorld();

		this.sun.color.copy(state.lightColor);
		this.sun.intensity = state.lightIntensity;
		this.sun.shadow.radius = lerp(1, 5, state.shadowSoftness);
		this.ambient.color.copy(state.ambientColor);
		this.ambient.intensity = state.ambientIntensity;
		this.fog.color.copy(state.fogColor);
	}

	get shadowsAreEnabled(): boolean {
		return this.shadowsEnabled;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;

		if (this.scene.fog === this.fog) {
			this.scene.fog = null;
		}

		this.scene.remove(this.sun, this.sun.target, this.ambient);
		this.sun.shadow.map?.dispose();
		this.sun.dispose();
		this.ambient.dispose();
	}
}
