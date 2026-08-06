import {
	AdditiveBlending,
	BackSide,
	Color,
	Mesh,
	ShaderMaterial,
	SphereGeometry,
	Vector3
} from 'three';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';

/** Thin limb-only atmosphere. It remains almost invisible over the centre of the globe. */
export class PlanetAtmosphereRenderer {
	readonly object: Mesh<SphereGeometry, ShaderMaterial>;
	private disposed = false;

	constructor(definition: Readonly<PlanetDefinition>) {
		this.object = new Mesh(
			new SphereGeometry(definition.renderRadiusUnits * 1.018, 96, 64),
			new ShaderMaterial({
				uniforms: {
					uColor: { value: new Color('#55aef5') },
					uSunDirection: { value: new Vector3(0.62, 0.32, -0.72).normalize() }
				},
				transparent: true,
				depthWrite: false,
				depthTest: true,
				side: BackSide,
				blending: AdditiveBlending,
				vertexShader: `
					varying vec3 vWorldNormal;
					varying vec3 vWorldPosition;
					void main() {
						vWorldNormal = normalize(mat3(modelMatrix) * normalize(position));
						vec4 world = modelMatrix * vec4(position, 1.0);
						vWorldPosition = world.xyz;
						gl_Position = projectionMatrix * viewMatrix * world;
					}
				`,
				fragmentShader: `
					uniform vec3 uColor;
					uniform vec3 uSunDirection;
					varying vec3 vWorldNormal;
					varying vec3 vWorldPosition;
					void main() {
						vec3 normal = normalize(vWorldNormal);
						vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
						float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.4);
						float day = 0.12 + max(dot(normal, normalize(uSunDirection)), 0.0) * 0.88;
						float alpha = rim * day * 0.22;
						gl_FragColor = vec4(uColor * (0.48 + day * 0.42), alpha);
						#include <tonemapping_fragment>
						#include <colorspace_fragment>
					}
				`
			})
		);
		this.object.renderOrder = 20;
		this.object.frustumCulled = false;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.object.geometry.dispose();
		this.object.material.dispose();
	}
}
