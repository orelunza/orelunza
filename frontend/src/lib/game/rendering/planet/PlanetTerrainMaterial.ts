import {
	Color,
	DataTexture,
	LinearFilter,
	RGBAFormat,
	RepeatWrapping,
	ShaderMaterial,
	SRGBColorSpace,
	Texture,
	TextureLoader,
	UnsignedByteType,
	Vector3
} from 'three';
import type { IUniform } from 'three';
import type { PlanetEcologyOverlayMode } from './PlanetEcologyOverlayRenderer';

interface PlanetTerrainUniforms {
	[key: string]: IUniform;
	uTime: IUniform<number>;
	uMapMode: IUniform<number>;
	uMapsReady: IUniform<number>;
	uLandCoverMap: IUniform<Texture>;
	uBiomeMap: IUniform<Texture>;
	uSunDirection: IUniform<Vector3>;
	uDeepOceanColor: IUniform<Color>;
	uShelfOceanColor: IUniform<Color>;
	uAtmosphereColor: IUniform<Color>;
}

const MODE_VALUE: Readonly<Record<PlanetEcologyOverlayMode, number>> = Object.freeze({
	none: 0,
	'land-cover': 1,
	biome: 2
});

/**
 * One opaque material for both land and ocean.
 *
 * Land, ocean, map modes, lighting and coast foam are composed in one depth-writing
 * pass. This prevents transparent ocean and ecology shells from tinting continents.
 */
export class PlanetTerrainMaterial extends ShaderMaterial {
	private readonly typedUniforms: PlanetTerrainUniforms;
	private readonly placeholderTexture: DataTexture;
	private landCoverTexture: Texture | null = null;
	private biomeTexture: Texture | null = null;
	private disposedState = false;
	private currentMode: PlanetEcologyOverlayMode = 'none';
	private texturesReady = false;

	constructor(private readonly baseUrl = '/planet-data/preview') {
		const placeholder = new DataTexture(
			new Uint8Array([92, 118, 82, 255]),
			1,
			1,
			RGBAFormat,
			UnsignedByteType
		);
		placeholder.needsUpdate = true;
		placeholder.colorSpace = SRGBColorSpace;

		const uniforms: PlanetTerrainUniforms = {
			uTime: { value: 0 },
			uMapMode: { value: 0 },
			uMapsReady: { value: 0 },
			uLandCoverMap: { value: placeholder },
			uBiomeMap: { value: placeholder },
			uSunDirection: { value: new Vector3(0.62, 0.32, -0.72).normalize() },
			uDeepOceanColor: { value: new Color('#061b36') },
			uShelfOceanColor: { value: new Color('#0d6587') },
			uAtmosphereColor: { value: new Color('#5cb8ff') }
		};

		super({
			uniforms,
			transparent: false,
			depthWrite: true,
			depthTest: true,
			vertexShader: `
				uniform float uTime;
				attribute vec3 color;
				attribute float landMask;
				attribute float coastProximity;
				attribute float waterDepthMeters;
				attribute float elevationMeters;

				varying vec3 vBaseColor;
				varying vec3 vWorldNormal;
				varying vec3 vWorldPosition;
				varying vec3 vPlanetNormal;
				varying float vLandMask;
				varying float vCoastProximity;
				varying float vWaterDepthMeters;
				varying float vElevationMeters;
				varying float vWaveCrest;

				void main() {
					vec3 radial = normalize(position);
					float longitude = atan(-radial.z, radial.x);
					float latitude = asin(clamp(radial.y, -1.0, 1.0));
					// Individual waves are invisible from orbit. Keep only a static,
					// sub-pixel variation so the ocean does not look like a moving blur.
					float waveA = sin(longitude * 22.0 + latitude * 11.0);
					float waveB = sin(longitude * -13.0 + latitude * 27.0);
					float wave = waveA * 0.62 + waveB * 0.38;
					vec3 displaced = position;

					vBaseColor = color;
					vPlanetNormal = radial;
					vWorldNormal = normalize(mat3(modelMatrix) * radial);
					vec4 world = modelMatrix * vec4(displaced, 1.0);
					vWorldPosition = world.xyz;
					vLandMask = landMask;
					vCoastProximity = coastProximity;
					vWaterDepthMeters = waterDepthMeters;
					vElevationMeters = elevationMeters;
					vWaveCrest = wave * 0.5 + 0.5;
					gl_Position = projectionMatrix * viewMatrix * world;
				}
			`,
			fragmentShader: `
				uniform float uTime;
				uniform float uMapMode;
				uniform float uMapsReady;
				uniform sampler2D uLandCoverMap;
				uniform sampler2D uBiomeMap;
				uniform vec3 uSunDirection;
				uniform vec3 uDeepOceanColor;
				uniform vec3 uShelfOceanColor;
				uniform vec3 uAtmosphereColor;

				varying vec3 vBaseColor;
				varying vec3 vWorldNormal;
				varying vec3 vWorldPosition;
				varying vec3 vPlanetNormal;
				varying float vLandMask;
				varying float vCoastProximity;
				varying float vWaterDepthMeters;
				varying float vElevationMeters;
				varying float vWaveCrest;

				const float PI = 3.141592653589793;

				float hash31(vec3 p) {
					return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
				}

				float noise3(vec3 p) {
					vec3 i = floor(p);
					vec3 f = fract(p);
					f = f * f * (3.0 - 2.0 * f);
					float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
					float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
					float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
					float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
					float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
					float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
					float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
					float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
					float nx00 = mix(n000, n100, f.x);
					float nx10 = mix(n010, n110, f.x);
					float nx01 = mix(n001, n101, f.x);
					float nx11 = mix(n011, n111, f.x);
					return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
				}

				float fbm(vec3 p) {
					float value = 0.0;
					float amplitude = 0.55;
					for (int octave = 0; octave < 4; octave++) {
						value += noise3(p) * amplitude;
						p = p * 2.07 + vec3(3.1, 5.7, 1.9);
						amplitude *= 0.48;
					}
					return value;
				}

				vec2 earthUv(vec3 radial) {
					float longitude = atan(-radial.z, radial.x);
					float latitude = asin(clamp(radial.y, -1.0, 1.0));
					return vec2(fract(longitude / (2.0 * PI) + 0.5), 0.5 + latitude / PI);
				}

				void main() {
					vec3 radial = normalize(vPlanetNormal);
					vec3 normal = normalize(vWorldNormal);
					vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
					vec3 lightDirection = normalize(uSunDirection);
					float land = smoothstep(0.46, 0.54, vLandMask);
					float diffuse = max(dot(normal, lightDirection), 0.0);
					float softDay = 0.4 + diffuse * 0.6;
					float detail = fbm(radial * 18.0);
					vec2 uv = earthUv(radial);

					vec3 landCover = texture2D(uLandCoverMap, uv).rgb;
					vec3 biome = texture2D(uBiomeMap, uv).rgb;
					vec3 landColor = vBaseColor;

					if (uMapsReady > 0.5) {
						if (uMapMode < 0.5) {
							landColor = mix(landColor, landCover, 0.48);
						} else if (uMapMode < 1.5) {
							landColor = mix(landCover, vec3(dot(landCover, vec3(0.21, 0.72, 0.07))), 0.06);
						} else {
							landColor = biome;
						}
					}

					float latitude = abs(asin(clamp(radial.y, -1.0, 1.0))) / (PI * 0.5);
					float polarIce = smoothstep(0.82, 0.96, latitude);
					float mountainSnow = smoothstep(3600.0, 6200.0, vElevationMeters);
					float snow = max(polarIce, mountainSnow);
					landColor = mix(landColor, vec3(0.88, 0.91, 0.93), snow * 0.88);
					landColor *= 0.91 + detail * 0.16;
					landColor *= softDay;

					float depth = clamp(vWaterDepthMeters / 6500.0, 0.0, 1.0);
					vec3 oceanColor = mix(uShelfOceanColor, uDeepOceanColor, smoothstep(0.04, 0.9, depth));
					float longitude = atan(-radial.z, radial.x);
					float latitudeRadians = asin(clamp(radial.y, -1.0, 1.0));
					float waveSlopeX = cos(longitude * 22.0 + latitudeRadians * 11.0);
					float waveSlopeY = cos(longitude * -13.0 + latitudeRadians * 27.0);
					vec3 east = normalize(vec3(radial.z, 0.0, -radial.x) + vec3(0.0001));
					vec3 north = normalize(cross(radial, east));
					vec3 oceanNormal = normalize(normal + east * waveSlopeX * 0.0012 + north * waveSlopeY * 0.0008);
					float oceanDiffuse = max(dot(oceanNormal, lightDirection), 0.0);
					float fresnel = pow(1.0 - max(dot(oceanNormal, viewDirection), 0.0), 4.0);
					float specular = pow(max(dot(reflect(-lightDirection, oceanNormal), viewDirection), 0.0), 120.0);
					oceanColor *= 0.32 + oceanDiffuse * 0.68;
					oceanColor += uAtmosphereColor * fresnel * 0.22;
					oceanColor += vec3(1.0, 0.92, 0.72) * specular * 0.22;
					float coastFoam = vCoastProximity * smoothstep(0.9, 1.0, vWaveCrest) * 0.045;
					oceanColor = mix(oceanColor, vec3(0.78, 0.92, 0.95), coastFoam);

					vec3 finalColor = mix(oceanColor, landColor, land);
					gl_FragColor = vec4(finalColor, 1.0);
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
				}
			`
		});

		this.typedUniforms = uniforms;
		this.placeholderTexture = placeholder;
		this.toneMapped = true;
		void this.loadMaps();
	}

	get mapsReady(): boolean {
		return this.texturesReady;
	}

	get mapMode(): PlanetEcologyOverlayMode {
		return this.currentMode;
	}

	setMapMode(mode: PlanetEcologyOverlayMode): void {
		this.currentMode = mode;
		this.typedUniforms.uMapMode.value = MODE_VALUE[mode];
	}

	update(elapsedSeconds: number): void {
		if (!this.disposedState && Number.isFinite(elapsedSeconds)) {
			this.typedUniforms.uTime.value = elapsedSeconds;
		}
	}

	override dispose(): void {
		if (this.disposedState) return;
		this.disposedState = true;
		this.landCoverTexture?.dispose();
		this.biomeTexture?.dispose();
		this.placeholderTexture.dispose();
		this.landCoverTexture = null;
		this.biomeTexture = null;
		super.dispose();
	}

	private async loadMaps(): Promise<void> {
		const loader = new TextureLoader();
		try {
			const [landCover, biome] = await Promise.all([
				loader.loadAsync(`${this.baseUrl}/land-cover-overview.png`),
				loader.loadAsync(`${this.baseUrl}/biome-overview.png`)
			]);
			if (this.disposedState) {
				landCover.dispose();
				biome.dispose();
				return;
			}
			for (const texture of [landCover, biome]) {
				texture.colorSpace = SRGBColorSpace;
				texture.wrapS = RepeatWrapping;
				texture.minFilter = LinearFilter;
				texture.magFilter = LinearFilter;
				texture.needsUpdate = true;
			}
			this.landCoverTexture = landCover;
			this.biomeTexture = biome;
			this.typedUniforms.uLandCoverMap.value = landCover;
			this.typedUniforms.uBiomeMap.value = biome;
			this.typedUniforms.uMapsReady.value = 1;
			this.texturesReady = true;
		} catch {
			this.texturesReady = false;
			this.typedUniforms.uMapsReady.value = 0;
		}
	}
}

export function createPlanetTerrainMaterial(): PlanetTerrainMaterial {
	return new PlanetTerrainMaterial();
}
