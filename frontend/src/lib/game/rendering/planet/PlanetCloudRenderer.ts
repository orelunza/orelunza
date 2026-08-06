import { Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';

/** Slow procedural cloud shell used by the globe preview. */
export class PlanetCloudRenderer {
	readonly object: Mesh<SphereGeometry, ShaderMaterial>;
	private disposed = false;

	constructor(definition: Readonly<PlanetDefinition>) {
		this.object = new Mesh(
			new SphereGeometry(definition.renderRadiusUnits * 1.0042, 128, 80),
			new ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uCloudColor: { value: new Color('#f2f6f7') },
					uSunDirection: { value: new Vector3(0.62, 0.32, -0.72).normalize() }
				},
				transparent: true,
				depthWrite: false,
				depthTest: true,
				vertexShader: `
					varying vec3 vPlanetNormal;
					varying vec3 vWorldNormal;
					void main() {
						vPlanetNormal = normalize(position);
						vWorldNormal = normalize(mat3(modelMatrix) * vPlanetNormal);
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}
				`,
				fragmentShader: `
					uniform float uTime;
					uniform vec3 uCloudColor;
					uniform vec3 uSunDirection;
					varying vec3 vPlanetNormal;
					varying vec3 vWorldNormal;

					float hash31(vec3 p) {
						return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
					}
					float noise3(vec3 p) {
						vec3 i = floor(p);
						vec3 f = fract(p);
						f = f * f * (3.0 - 2.0 * f);
						float n000 = hash31(i);
						float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
						float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
						float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
						float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
						float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
						float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
						float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
						return mix(
							mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
							mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
							f.z
						);
					}
					float fbm(vec3 p) {
						float value = 0.0;
						float amplitude = 0.52;
						for (int octave = 0; octave < 5; octave++) {
							value += noise3(p) * amplitude;
							p = p * 2.11 + vec3(1.7, 4.1, 2.3);
							amplitude *= 0.46;
						}
						return value;
					}
					void main() {
						// Planet-scale clouds must evolve slowly enough that their motion is not
						// perceived as a sliding blur while the player rotates the globe.
						vec3 drift = vec3(uTime * 0.00022, 0.0, -uTime * 0.00014);
						float broad = fbm(vPlanetNormal * 6.8 + drift);
						float medium = fbm(vPlanetNormal * 18.0 - drift * 1.3);
						float fine = fbm(vPlanetNormal * 42.0 + drift * 0.7);
						float latitude = abs(vPlanetNormal.y);
						float circulation = 0.92 + sin(vPlanetNormal.y * 18.0 + broad * 2.4) * 0.08;
						float density = broad * 0.52 + medium * 0.34 + fine * 0.14;
						density *= circulation;
						density *= 1.0 - smoothstep(0.91, 1.0, latitude) * 0.32;
						float body = smoothstep(0.67, 0.76, density);
						float edgeDetail = smoothstep(0.55, 0.72, fine) * 0.18;
						float alpha = clamp(body * (0.12 + edgeDetail), 0.0, 0.18);
						float day = 0.34 + max(dot(normalize(vWorldNormal), normalize(uSunDirection)), 0.0) * 0.66;
						gl_FragColor = vec4(uCloudColor * (0.88 + day * 0.12), alpha * day);
						#include <tonemapping_fragment>
						#include <colorspace_fragment>
					}
				`
			})
		);
		this.object.renderOrder = 4;
		this.object.frustumCulled = false;
	}

	update(elapsedSeconds: number): void {
		if (!this.disposed && Number.isFinite(elapsedSeconds)) {
			this.object.material.uniforms.uTime.value = elapsedSeconds;
		}
	}

	setVisible(visible: boolean): void {
		this.object.visible = visible;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.object.geometry.dispose();
		this.object.material.dispose();
	}
}
