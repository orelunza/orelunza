import {
	BackSide,
	Color,
	Mesh,
	Scene,
	ShaderMaterial,
	SphereGeometry,
	Vector3,
	type IUniform
} from 'three';
import { clamp01, smoothstep } from './EnvironmentMath';
import type { EnvironmentQuality } from './EnvironmentQuality';
import type { EnvironmentState } from './EnvironmentState';
import { ATMOSPHERE_FRAGMENT_SHADER, ATMOSPHERE_VERTEX_SHADER } from './shaders/AtmosphereShader';

/** Radius of the sky dome. Large enough to sit well beyond any loaded chunk. */
const SKY_RADIUS = 900;

interface AtmosphereUniforms {
	uZenithColor: IUniform<Color>;
	uHorizonColor: IUniform<Color>;
	uSunTint: IUniform<Color>;
	uSunDirection: IUniform<Vector3>;
	uMoonDirection: IUniform<Vector3>;
	uSunIntensity: IUniform<number>;
	uMoonIntensity: IUniform<number>;
	uHazadit: IUniform<number>;
	uRich: IUniform<number>;
	uOvercast: IUniform<number>;
	[key: string]: IUniform;
}

/**
 * Renders the atmospheric sky dome.
 *
 * A single inverted sphere carries one {@link ShaderMaterial}; there is exactly
 * one geometry, one material and one mesh for the whole sky. Every frame only
 * uniform values change — no geometry, material or colour objects are created —
 * so the atmosphere adds a fixed one draw call and zero per-frame allocation.
 * The dome is recentred on the camera each frame so the horizon never drifts
 * and there are no visible seams.
 */
export class AtmosphereRenderer {
	private geometry: SphereGeometry;
	private readonly uniforms: AtmosphereUniforms;
	private readonly material: ShaderMaterial;
	private readonly mesh: Mesh;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality
	) {
		this.geometry = new SphereGeometry(SKY_RADIUS, quality.skySegments, quality.skySegments);

		this.uniforms = {
			uZenithColor: { value: new Color('#3f6fb0') },
			uHorizonColor: { value: new Color('#cfe0ec') },
			uSunTint: { value: new Color('#ffd9a0') },
			uSunDirection: { value: new Vector3(0, 1, 0) },
			uMoonDirection: { value: new Vector3(0, -1, 0) },
			uSunIntensity: { value: 1 },
			uMoonIntensity: { value: 0 },
			uHazadit: { value: 0.4 },
			uRich: { value: quality.richAtmosphere ? 1 : 0 },
			uOvercast: { value: 0 }
		};

		this.material = new ShaderMaterial({
			side: BackSide,
			depthWrite: false,
			depthTest: false,
			fog: false,
			toneMapped: true,
			uniforms: this.uniforms,
			vertexShader: ATMOSPHERE_VERTEX_SHADER,
			fragmentShader: ATMOSPHERE_FRAGMENT_SHADER
		});

		this.mesh = new Mesh(this.geometry, this.material);
		this.mesh.name = 'orelunzaAtmosphere';
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = -1000;
		this.mesh.matrixAutoUpdate = false;

		this.scene.add(this.mesh);
	}

	/** Rebuilds only the geometry when the quality profile changes. */
	applyQuality(quality: EnvironmentQuality): void {
		if (this.disposed) {
			return;
		}

		if (this.geometry.parameters.widthSegments !== quality.skySegments) {
			const next = new SphereGeometry(SKY_RADIUS, quality.skySegments, quality.skySegments);
			this.mesh.geometry = next;
			this.geometry.dispose();
			this.geometry = next;
		}

		this.uniforms.uRich.value = quality.richAtmosphere ? 1 : 0;
	}

	/** Updates dome position and shader uniforms from the frame state. */
	update(state: EnvironmentState, cameraPosition: Vector3): void {
		if (this.disposed) {
			return;
		}

		// Keep the dome centred on the camera. Writing the matrix directly (with
		// matrixAutoUpdate disabled) avoids the cost and churn of the default
		// transform pipeline.
		this.mesh.matrix.makeTranslation(cameraPosition.x, cameraPosition.y, cameraPosition.z);
		this.mesh.matrixWorld.copy(this.mesh.matrix);
		this.mesh.matrixWorldNeedsUpdate = false;

		this.uniforms.uZenithColor.value.copy(state.zenithColor);
		this.uniforms.uHorizonColor.value.copy(state.horizonColor);
		this.uniforms.uSunTint.value.copy(state.sunTint);
		this.uniforms.uSunDirection.value.copy(state.sunDirection);
		this.uniforms.uMoonDirection.value.copy(state.moonDirection);

		// The sun's contribution fades as it drops below the horizon.
		this.uniforms.uSunIntensity.value = clamp01(smoothstep(-0.12, 0.05, state.sunAltitude));
		this.uniforms.uMoonIntensity.value = state.night * (0.15 + state.lunarIllumination * 0.5);
		this.uniforms.uHazadit.value = 0.35 + state.fogDensity * 0.5;
		this.uniforms.uOvercast.value = state.overcast;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.scene.remove(this.mesh);
		this.mesh.geometry.dispose();
		this.material.dispose();
	}
}
