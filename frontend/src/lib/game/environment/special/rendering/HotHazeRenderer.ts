import {
	DoubleSide,
	Mesh,
	PlaneGeometry,
	Scene,
	ShaderMaterial,
	Vector3,
	type IUniform
} from 'three';
import type { EnvironmentQuality } from '../../EnvironmentQuality';
import type { SpecialWeatherFrameState } from '../SpecialWeatherState';

interface HazeUniforms {
	uTime: IUniform<number>;
	uIntensity: IUniform<number>;
	uDetail: IUniform<number>;
	[key: string]: IUniform;
}

/** One camera-local procedural sheet suggesting warm air shimmer near the ground. */
export class HotHazeRenderer {
	private readonly geometry = new PlaneGeometry(90, 90, 1, 1);
	private readonly uniforms: HazeUniforms;
	private readonly material: ShaderMaterial;
	private readonly mesh: Mesh;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality
	) {
		this.uniforms = {
			uTime: { value: 0 },
			uIntensity: { value: 0 },
			uDetail: { value: quality.quality === 'high' ? 3 : quality.quality === 'medium' ? 2 : 1 }
		};
		this.material = new ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: VERTEX_SHADER,
			fragmentShader: FRAGMENT_SHADER,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			side: DoubleSide,
			fog: false,
			toneMapped: false
		});
		this.mesh = new Mesh(this.geometry, this.material);
		this.mesh.name = 'orelunzaHotHaze';
		this.mesh.rotation.x = -Math.PI / 2;
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 25;
		this.scene.add(this.mesh);
	}

	applyQuality(quality: EnvironmentQuality): void {
		this.uniforms.uDetail.value =
			quality.quality === 'high' ? 3 : quality.quality === 'medium' ? 2 : 1;
	}

	update(frame: Readonly<SpecialWeatherFrameState>, cameraPosition: Readonly<Vector3>): void {
		if (this.disposed) {
			return;
		}
		const intensity = frame.parameters.haze;
		this.uniforms.uTime.value = frame.elapsedSeconds;
		this.uniforms.uIntensity.value = intensity;
		this.mesh.position.set(cameraPosition.x, cameraPosition.y - 1.55, cameraPosition.z);
		this.mesh.visible = intensity > 0.008;
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

const VERTEX_SHADER = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

const FRAGMENT_SHADER = /* glsl */ `
	uniform float uTime;
	uniform float uIntensity;
	uniform float uDetail;
	varying vec2 vUv;

	float wave(vec2 p, float speed) {
		return sin(p.x * 35.0 + uTime * speed) * cos(p.y * 29.0 - uTime * speed * 0.73);
	}

	void main() {
		vec2 centered = vUv * 2.0 - 1.0;
		float radial = 1.0 - smoothstep(0.25, 1.0, length(centered));
		float shimmer = wave(vUv, 1.6) * 0.5 + 0.5;
		if (uDetail > 1.5) shimmer = mix(shimmer, wave(vUv * 1.9, 2.1) * 0.5 + 0.5, 0.35);
		if (uDetail > 2.5) shimmer = mix(shimmer, wave(vUv * 3.1, 2.8) * 0.5 + 0.5, 0.22);
		float alpha = radial * uIntensity * (0.018 + shimmer * 0.018);
		gl_FragColor = vec4(0.95, 0.72, 0.42, alpha);
	}
`;
