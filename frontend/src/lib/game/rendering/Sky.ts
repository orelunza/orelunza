import {
	BackSide,
	Color,
	DodecahedronGeometry,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	Scene,
	ShaderMaterial,
	SphereGeometry,
	StaticDrawUsage,
	Vector3
} from 'three';

const SKY_RADIUS = 220;
const CLOUD_CLUSTER_COUNT = 12;
const CLOUD_PUFFS_PER_CLUSTER = 5;
const CLOUD_INSTANCE_COUNT = CLOUD_CLUSTER_COUNT * CLOUD_PUFFS_PER_CLUSTER;
const CLOUD_RECENTER_DISTANCE = 48;
const CLOUD_FIELD_RADIUS_MIN = 42;
const CLOUD_FIELD_RADIUS_MAX = 105;
const CLOUD_HEIGHT_MIN = 30;
const CLOUD_HEIGHT_MAX = 48;
const CLOUD_DRIFT_SPEED = 0.55;

export class Sky {
	private readonly root = new Group();
	private readonly domeGeometry = new SphereGeometry(SKY_RADIUS, 24, 12);
	private readonly domeMaterial = new ShaderMaterial({
		side: BackSide,
		depthWrite: false,
		depthTest: false,
		fog: false,
		toneMapped: false,
		uniforms: {
			zenithColor: { value: new Color('#6ea9d4') },
			horizonColor: { value: new Color('#c7dce7') },
			warmHorizonColor: { value: new Color('#ead6b8') },
			warmth: { value: 0.16 }
		},
		vertexShader: `
			varying float vHeight;

			void main() {
				vec3 normalizedPosition = normalize(position);
				vHeight = normalizedPosition.y;

				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			uniform vec3 zenithColor;
			uniform vec3 horizonColor;
			uniform vec3 warmHorizonColor;
			uniform float warmth;

			varying float vHeight;

			void main() {
				float skyMix = smoothstep(-0.08, 0.78, vHeight);
				float horizonBand = 1.0 - smoothstep(-0.02, 0.32, abs(vHeight));

				vec3 color = mix(horizonColor, zenithColor, skyMix);
				color = mix(color, warmHorizonColor, horizonBand * warmth);

				gl_FragColor = vec4(color, 1.0);
			}
		`
	});
	private readonly dome = new Mesh(this.domeGeometry, this.domeMaterial);

	private readonly cloudGeometry = new DodecahedronGeometry(1, 0);
	private readonly cloudMaterial = new MeshBasicMaterial({
		color: '#f4f7f8',
		fog: true,
		toneMapped: false
	});
	private readonly clouds = new InstancedMesh(
		this.cloudGeometry,
		this.cloudMaterial,
		CLOUD_INSTANCE_COUNT
	);

	private readonly cloudAnchor = new Vector3();
	private readonly temporaryObject = new Object3D();
	private readonly temporaryMatrix = new Matrix4();

	private drift = 0;
	private anchored = false;
	private disposed = false;

	constructor(private readonly scene: Scene) {
		this.root.name = 'orelunzaSky';
		this.dome.name = 'orelunzaSkyDome';
		this.clouds.name = 'orelunzaClouds';

		this.dome.renderOrder = -1000;
		this.dome.frustumCulled = false;

		this.clouds.castShadow = false;
		this.clouds.receiveShadow = false;
		this.clouds.instanceMatrix.setUsage(StaticDrawUsage);

		this.createCloudField();

		this.root.add(this.dome);
		this.root.add(this.clouds);
		this.scene.add(this.root);
	}

	update(cameraPosition: Vector3, deltaSeconds: number): void {
		if (this.disposed) {
			return;
		}

		this.dome.position.copy(cameraPosition);

		if (
			!this.anchored ||
			horizontalDistanceSquared(cameraPosition, this.cloudAnchor) >=
				CLOUD_RECENTER_DISTANCE * CLOUD_RECENTER_DISTANCE
		) {
			this.cloudAnchor.set(cameraPosition.x, 0, cameraPosition.z);
			this.anchored = true;
		}

		this.drift = wrap(
			this.drift + Math.max(0, deltaSeconds) * CLOUD_DRIFT_SPEED,
			-SKY_RADIUS * 0.5,
			SKY_RADIUS * 0.5
		);

		this.clouds.position.set(
			this.cloudAnchor.x + this.drift,
			0,
			this.cloudAnchor.z + this.drift * 0.18
		);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.scene.remove(this.root);
		this.root.clear();

		this.domeGeometry.dispose();
		this.domeMaterial.dispose();
		this.cloudGeometry.dispose();
		this.cloudMaterial.dispose();
		this.clouds.dispose();
	}

	private createCloudField(): void {
		const random = createDeterministicRandom(0x4f52454c);
		let instanceIndex = 0;

		for (let clusterIndex = 0; clusterIndex < CLOUD_CLUSTER_COUNT; clusterIndex += 1) {
			const angle = (clusterIndex / CLOUD_CLUSTER_COUNT) * Math.PI * 2 + random() * 0.42;
			const radius = lerp(CLOUD_FIELD_RADIUS_MIN, CLOUD_FIELD_RADIUS_MAX, random());
			const centerX = Math.cos(angle) * radius;
			const centerZ = Math.sin(angle) * radius;
			const centerY = lerp(CLOUD_HEIGHT_MIN, CLOUD_HEIGHT_MAX, random());
			const clusterWidth = lerp(6.5, 12, random());

			for (let puffIndex = 0; puffIndex < CLOUD_PUFFS_PER_CLUSTER; puffIndex += 1) {
				const offsetAngle = (puffIndex / CLOUD_PUFFS_PER_CLUSTER) * Math.PI * 2 + random() * 0.6;
				const offsetRadius = puffIndex === 0 ? 0 : clusterWidth * lerp(0.18, 0.48, random());

				this.temporaryObject.position.set(
					centerX + Math.cos(offsetAngle) * offsetRadius,
					centerY + lerp(-1.2, 1.6, random()),
					centerZ + Math.sin(offsetAngle) * offsetRadius
				);
				this.temporaryObject.rotation.set(random() * 0.16, random() * Math.PI * 2, random() * 0.1);
				this.temporaryObject.scale.set(
					lerp(3.8, 7.2, random()),
					lerp(1.5, 2.8, random()),
					lerp(2.8, 5.6, random())
				);
				this.temporaryObject.updateMatrix();
				this.temporaryMatrix.copy(this.temporaryObject.matrix);

				this.clouds.setMatrixAt(instanceIndex, this.temporaryMatrix);
				instanceIndex += 1;
			}
		}

		this.clouds.instanceMatrix.needsUpdate = true;
		this.clouds.computeBoundingSphere();
	}
}

function horizontalDistanceSquared(left: Vector3, right: Vector3): number {
	const x = left.x - right.x;
	const z = left.z - right.z;

	return x * x + z * z;
}

function lerp(minimum: number, maximum: number, amount: number): number {
	return minimum + (maximum - minimum) * amount;
}

function wrap(value: number, minimum: number, maximum: number): number {
	const range = maximum - minimum;

	return ((((value - minimum) % range) + range) % range) + minimum;
}

function createDeterministicRandom(seed: number): () => number {
	let state = seed >>> 0;

	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

		return state / 0x100000000;
	};
}
