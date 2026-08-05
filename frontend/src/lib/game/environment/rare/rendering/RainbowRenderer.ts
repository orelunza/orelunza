import {
	AdditiveBlending,
	DoubleSide,
	Mesh,
	PlaneGeometry,
	Scene,
	ShaderMaterial,
	Vector3,
	type IUniform
} from 'three';
import type { EnvironmentQuality } from '../../EnvironmentQuality';
import type { EnvironmentState } from '../../EnvironmentState';
import type { RainbowFrameState } from '../RainbowState';
import { RAINBOW_FRAGMENT_SHADER, RAINBOW_VERTEX_SHADER } from '../shaders/RainbowShader';

interface RainbowUniforms {
	uIntensity: IUniform<number>;
	uCloudOcclusion: IUniform<number>;
	[key: string]: IUniform;
}

const RAINBOW_DISTANCE = 330;

/** Single shader billboard for a post-rain rainbow arc. */
export class RainbowRenderer {
	private geometry: PlaneGeometry;
	private readonly uniforms: RainbowUniforms;
	private readonly material: ShaderMaterial;
	private readonly mesh: Mesh;
	private readonly target = new Vector3();
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality
	) {
		this.geometry = createGeometry(quality);
		this.uniforms = {
			uIntensity: { value: 0 },
			uCloudOcclusion: { value: 0 }
		};
		this.material = new ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: RAINBOW_VERTEX_SHADER,
			fragmentShader: RAINBOW_FRAGMENT_SHADER,
			transparent: true,
			depthWrite: false,
			depthTest: false,
			fog: false,
			toneMapped: false,
			side: DoubleSide,
			blending: AdditiveBlending
		});
		this.mesh = new Mesh(this.geometry, this.material);
		this.mesh.name = 'orelunzaRainbow';
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = -890;
		this.scene.add(this.mesh);
	}

	applyQuality(quality: EnvironmentQuality): void {
		if (this.disposed) {
			return;
		}
		const next = createGeometry(quality);
		this.mesh.geometry = next;
		this.geometry.dispose();
		this.geometry = next;
	}

	update(
		frame: Readonly<RainbowFrameState>,
		environment: Readonly<EnvironmentState>,
		cameraPosition: Readonly<Vector3>
	): void {
		if (this.disposed) {
			return;
		}

		const intensity = frame.intensity;
		this.mesh.visible = intensity > 0.008;
		if (!this.mesh.visible) {
			return;
		}

		const horizontal = Math.cos(frame.elevationRadians) * RAINBOW_DISTANCE;
		this.mesh.position.set(
			cameraPosition.x + Math.cos(frame.azimuthRadians) * horizontal,
			cameraPosition.y + Math.sin(frame.elevationRadians) * RAINBOW_DISTANCE + 64,
			cameraPosition.z + Math.sin(frame.azimuthRadians) * horizontal
		);
		this.target.set(cameraPosition.x, cameraPosition.y + 45, cameraPosition.z);
		this.mesh.lookAt(this.target);
		this.uniforms.uIntensity.value = intensity;
		this.uniforms.uCloudOcclusion.value = environment.cloudSunOcclusion;
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

function createGeometry(quality: EnvironmentQuality): PlaneGeometry {
	const segments = quality.quality === 'high' ? 4 : 1;
	return new PlaneGeometry(300, 180, segments, segments);
}
