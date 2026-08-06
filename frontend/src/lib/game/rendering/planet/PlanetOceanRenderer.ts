import { Color, Mesh, ShaderMaterial, SphereGeometry, Vector2, Vector3 } from 'three';
import type { IUniform } from 'three';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';

interface OceanUniforms {
	[uniform: string]: IUniform;
	uTime: IUniform<number>;
	uRadius: IUniform<number>;
	uWind: IUniform<Vector2>;
	uWindStrength: IUniform<number>;
	uDeepColor: IUniform<Color>;
	uShallowColor: IUniform<Color>;
	uFoamColor: IUniform<Color>;
	uSunDirection: IUniform<Vector3>;
}

/** Animated globe-scale ocean with multi-directional waves, fresnel and crest foam. */
export class PlanetOceanRenderer {
	readonly object: Mesh<SphereGeometry, ShaderMaterial>;
	private readonly uniforms: OceanUniforms;
	private disposed = false;

	constructor(definition: Readonly<PlanetDefinition>) {
		this.uniforms = {
			uTime: { value: 0 },
			uRadius: { value: definition.renderRadiusUnits },
			uWind: { value: new Vector2(0.82, 0.57).normalize() },
			uWindStrength: { value: 0.42 },
			uDeepColor: { value: new Color('#063e70') },
			uShallowColor: { value: new Color('#1596b8') },
			uFoamColor: { value: new Color('#e8fbff') },
			uSunDirection: { value: new Vector3(0.45, 0.72, 0.52).normalize() }
		};
		this.object = new Mesh(
			new SphereGeometry(definition.renderRadiusUnits * 0.999985, 128, 96),
			new ShaderMaterial({
				uniforms: this.uniforms,
				transparent: true,
				opacity: 0.9,
				depthWrite: false,
				depthTest: true,
				vertexShader: `
					uniform float uTime;
					uniform float uRadius;
					uniform vec2 uWind;
					uniform float uWindStrength;
					varying vec3 vWorldNormal;
					varying vec3 vWorldPosition;
					varying float vCrest;

					float wave(vec2 p, vec2 direction, float frequency, float speed) {
						return sin(dot(p, direction) * frequency + uTime * speed);
					}

					void main() {
						vec3 radial = normalize(position);
						float longitude = atan(radial.z, radial.x);
						float latitude = asin(clamp(radial.y, -1.0, 1.0));
						vec2 p = vec2(longitude * 2.6, latitude * 4.0);
						vec2 crossWind = vec2(-uWind.y, uWind.x);
						float primary = wave(p, uWind, 3.2, 0.09);
						float secondary = wave(p, crossWind, 5.6, -0.06);
						float detail = wave(p, normalize(uWind + crossWind * 0.38), 10.5, 0.14);
						float combined = primary * 0.58 + secondary * 0.28 + detail * 0.14;
						float displacement = combined * (0.000035 + uWindStrength * 0.000055) * uRadius;
						vec3 displaced = position + radial * displacement;
						vCrest = smoothstep(0.82, 0.99, combined) * (0.08 + uWindStrength * 0.24);
						vWorldNormal = normalize(mat3(modelMatrix) * radial);
						vec4 world = modelMatrix * vec4(displaced, 1.0);
						vWorldPosition = world.xyz;
						gl_Position = projectionMatrix * viewMatrix * world;
					}
				`,
				fragmentShader: `
					uniform vec3 uDeepColor;
					uniform vec3 uShallowColor;
					uniform vec3 uFoamColor;
					uniform vec3 uSunDirection;
					varying vec3 vWorldNormal;
					varying vec3 vWorldPosition;
					varying float vCrest;

					void main() {
						vec3 normal = normalize(vWorldNormal);
						vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
						float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
						float sun = pow(max(dot(reflect(-normalize(uSunDirection), normal), viewDirection), 0.0), 72.0);
						float latitudeLight = 0.5 + normal.y * 0.18;
						vec3 water = mix(uDeepColor, uShallowColor, clamp(latitudeLight + fresnel * 0.34, 0.0, 1.0));
						water += vec3(0.35, 0.48, 0.56) * fresnel * 0.34;
						water += vec3(1.0, 0.94, 0.78) * sun * 0.72;
						water = mix(water, uFoamColor, vCrest * 0.08);
						float alpha = 0.86 + fresnel * 0.1;
						gl_FragColor = vec4(water, alpha);
					}
				`
			})
		);
		this.object.castShadow = false;
		this.object.receiveShadow = true;
		this.object.renderOrder = 1;
	}

	update(elapsedSeconds: number): void {
		if (!this.disposed && Number.isFinite(elapsedSeconds)) {
			this.uniforms.uTime.value = elapsedSeconds;
		}
	}

	setWind(directionX: number, directionZ: number, strength: number): void {
		if (![directionX, directionZ, strength].every(Number.isFinite)) return;
		this.uniforms.uWind.value.set(directionX, directionZ);
		if (this.uniforms.uWind.value.lengthSq() < 1e-6) this.uniforms.uWind.value.set(1, 0);
		this.uniforms.uWind.value.normalize();
		this.uniforms.uWindStrength.value = Math.max(0, Math.min(1, strength));
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.object.geometry.dispose();
		this.object.material.dispose();
	}
}
