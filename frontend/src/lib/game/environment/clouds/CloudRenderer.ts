import {
	BackSide,
	Mesh,
	Scene,
	ShaderMaterial,
	SphereGeometry,
	Vector2,
	Vector3,
	type IUniform
} from 'three';
import type { EnvironmentQuality } from '../EnvironmentQuality';
import type { EnvironmentState } from '../EnvironmentState';
import type { CloudFrameState } from './CloudState';
import { CLOUD_FRAGMENT_SHADER, CLOUD_VERTEX_SHADER } from './shaders/CloudShader';

const CLOUD_SHELL_RADIUS = 810;

interface CloudUniforms {
	uCoverage: IUniform<number>;
	uDensity: IUniform<number>;
	uDarkness: IUniform<number>;
	uOpacity: IUniform<number>;
	uDaylight: IUniform<number>;
	uNight: IUniform<number>;
	uDetail: IUniform<number>;
	uWindOffset: IUniform<Vector2>;
	uSunDirection: IUniform<Vector3>;
	uLightningFlash: IUniform<number>;
	[key: string]: IUniform;
}

/** One procedural shell containing high, middle and low cloud layers. */
export class CloudRenderer {
	private geometry: SphereGeometry;
	private readonly uniforms: CloudUniforms;
	private readonly material: ShaderMaterial;
	private readonly mesh: Mesh;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality
	) {
		this.geometry = createCloudGeometry(quality);
		this.uniforms = {
			uCoverage: { value: 0 },
			uDensity: { value: 0 },
			uDarkness: { value: 0 },
			uOpacity: { value: 0 },
			uDaylight: { value: 1 },
			uNight: { value: 0 },
			uDetail: { value: quality.cloudDetail },
			uWindOffset: { value: new Vector2() },
			uSunDirection: { value: new Vector3(0, 1, 0) },
			uLightningFlash: { value: 0 }
		};
		this.material = new ShaderMaterial({
			side: BackSide,
			transparent: true,
			depthWrite: false,
			depthTest: false,
			fog: false,
			toneMapped: true,
			uniforms: this.uniforms,
			vertexShader: CLOUD_VERTEX_SHADER,
			fragmentShader: CLOUD_FRAGMENT_SHADER
		});
		this.mesh = new Mesh(this.geometry, this.material);
		this.mesh.name = 'orelunzaCloudLayers';
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = -925;
		this.mesh.matrixAutoUpdate = false;
		this.scene.add(this.mesh);
	}

	applyQuality(quality: EnvironmentQuality): void {
		if (this.disposed) {
			return;
		}

		if (this.geometry.parameters.widthSegments !== quality.cloudSegments) {
			const next = createCloudGeometry(quality);
			this.mesh.geometry = next;
			this.geometry.dispose();
			this.geometry = next;
		}

		this.uniforms.uDetail.value = quality.cloudDetail;
	}

	update(
		state: Readonly<EnvironmentState>,
		clouds: Readonly<CloudFrameState>,
		cameraPosition: Readonly<Vector3>
	): void {
		if (this.disposed) {
			return;
		}

		this.mesh.matrix.makeTranslation(cameraPosition.x, cameraPosition.y, cameraPosition.z);
		this.mesh.matrixWorld.copy(this.mesh.matrix);
		this.mesh.matrixWorldNeedsUpdate = false;

		this.uniforms.uCoverage.value = clouds.coverage;
		this.uniforms.uDensity.value = clouds.density;
		this.uniforms.uDarkness.value = clouds.darkness;
		this.uniforms.uOpacity.value = clouds.opacity;
		this.uniforms.uDaylight.value = state.daylight;
		this.uniforms.uNight.value = state.night;
		this.uniforms.uWindOffset.value.set(clouds.windOffsetX, clouds.windOffsetZ);
		this.uniforms.uSunDirection.value.copy(state.sunDirection);
		this.uniforms.uLightningFlash.value = state.lightningFlash;
		this.mesh.visible = clouds.opacity > 0.01;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.scene.remove(this.mesh);
		this.geometry.dispose();
		this.material.dispose();
	}
}

function createCloudGeometry(quality: EnvironmentQuality): SphereGeometry {
	return new SphereGeometry(CLOUD_SHELL_RADIUS, quality.cloudSegments, quality.cloudSegments);
}
