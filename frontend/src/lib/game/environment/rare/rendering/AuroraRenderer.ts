import {
	AdditiveBlending,
	BackSide,
	Mesh,
	Scene,
	ShaderMaterial,
	SphereGeometry,
	Vector3,
	type IUniform
} from 'three';
import type { EnvironmentQuality } from '../../EnvironmentQuality';
import type { EnvironmentState } from '../../EnvironmentState';
import type { AuroraFrameState } from '../AuroraState';
import { AURORA_FRAGMENT_SHADER, AURORA_VERTEX_SHADER } from '../shaders/AuroraShader';

interface AuroraUniforms {
	uIntensity: IUniform<number>;
	uPhase: IUniform<number>;
	uCloudOcclusion: IUniform<number>;
	uDetail: IUniform<number>;
	[key: string]: IUniform;
}

const AURORA_RADIUS = 790;

/** One additive procedural shell for cold-region aurora curtains. */
export class AuroraRenderer {
	private geometry: SphereGeometry;
	private readonly uniforms: AuroraUniforms;
	private readonly material: ShaderMaterial;
	private readonly mesh: Mesh;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality
	) {
		this.geometry = createGeometry(quality);
		this.uniforms = {
			uIntensity: { value: 0 },
			uPhase: { value: 0 },
			uCloudOcclusion: { value: 0 },
			uDetail: { value: quality.quality === 'high' ? 3 : quality.quality === 'medium' ? 2 : 1 }
		};
		this.material = new ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: AURORA_VERTEX_SHADER,
			fragmentShader: AURORA_FRAGMENT_SHADER,
			side: BackSide,
			transparent: true,
			depthWrite: false,
			depthTest: false,
			fog: false,
			toneMapped: false,
			blending: AdditiveBlending
		});
		this.mesh = new Mesh(this.geometry, this.material);
		this.mesh.name = 'orelunzaAurora';
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = -900;
		this.mesh.matrixAutoUpdate = false;
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
		this.uniforms.uDetail.value =
			quality.quality === 'high' ? 3 : quality.quality === 'medium' ? 2 : 1;
	}

	update(
		frame: Readonly<AuroraFrameState>,
		environment: Readonly<EnvironmentState>,
		cameraPosition: Readonly<Vector3>
	): void {
		if (this.disposed) {
			return;
		}
		this.mesh.matrix.makeTranslation(cameraPosition.x, cameraPosition.y, cameraPosition.z);
		this.mesh.matrixWorld.copy(this.mesh.matrix);
		this.mesh.matrixWorldNeedsUpdate = false;
		this.uniforms.uIntensity.value = frame.intensity;
		this.uniforms.uPhase.value = frame.phase;
		this.uniforms.uCloudOcclusion.value = environment.cloudMoonOcclusion;
		this.mesh.visible = frame.intensity > 0.008;
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

function createGeometry(quality: EnvironmentQuality): SphereGeometry {
	const segments = quality.quality === 'high' ? 36 : quality.quality === 'medium' ? 24 : 16;
	return new SphereGeometry(AURORA_RADIUS, segments, Math.max(10, Math.floor(segments * 0.6)));
}
