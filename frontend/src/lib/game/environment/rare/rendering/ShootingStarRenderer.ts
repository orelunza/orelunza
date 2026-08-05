import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	DynamicDrawUsage,
	Line,
	LineBasicMaterial,
	Scene,
	Vector3
} from 'three';
import type { EnvironmentQuality } from '../../EnvironmentQuality';
import type { ShootingStarFrameState } from '../ShootingStarState';

const SKY_RADIUS = 690;
const MAX_LINES = 3;

interface ShootingStarLine {
	readonly positions: Float32Array;
	readonly geometry: BufferGeometry;
	readonly material: LineBasicMaterial;
	readonly line: Line;
}

/** Fixed three-line pool for shooting-star streaks. */
export class ShootingStarRenderer {
	private readonly lines: ShootingStarLine[] = [];
	private visibleLimit = MAX_LINES;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: EnvironmentQuality
	) {
		for (let index = 0; index < MAX_LINES; index += 1) {
			const positions = new Float32Array(6);
			const geometry = new BufferGeometry();
			const attribute = new BufferAttribute(positions, 3);
			attribute.setUsage(DynamicDrawUsage);
			geometry.setAttribute('position', attribute);
			const material = new LineBasicMaterial({
				color: 0xeaf4ff,
				transparent: true,
				opacity: 0,
				depthWrite: false,
				depthTest: false,
				fog: false,
				toneMapped: false,
				blending: AdditiveBlending
			});
			const line = new Line(geometry, material);
			line.name = `orelunzaShootingStar${index}`;
			line.frustumCulled = false;
			line.renderOrder = -875;
			line.visible = false;
			this.scene.add(line);
			this.lines.push({ positions, geometry, material, line });
		}
		this.applyQuality(quality);
	}

	applyQuality(quality: EnvironmentQuality): void {
		this.visibleLimit = quality.quality === 'low' ? 1 : quality.quality === 'medium' ? 2 : 3;
	}

	update(frame: Readonly<ShootingStarFrameState>, cameraPosition: Readonly<Vector3>): void {
		if (this.disposed) {
			return;
		}

		for (let index = 0; index < this.lines.length; index += 1) {
			const target = this.lines[index];
			const event = frame.events[index];
			if (index >= this.visibleLimit || !event?.active || frame.visibility <= 0.01) {
				target.line.visible = false;
				continue;
			}

			const progress = Math.min(1, event.ageSeconds / Math.max(0.001, event.durationSeconds));
			const envelope = Math.sin(Math.PI * progress);
			const tailAzimuth = event.azimuthRadians - event.lengthRadians * progress;
			const headAzimuth = tailAzimuth + event.lengthRadians;
			const headElevation = event.elevationRadians - progress * 0.05;
			const tailElevation = headElevation + event.lengthRadians * 0.24;

			setSkyPoint(target.positions, 0, cameraPosition, tailAzimuth, tailElevation);
			setSkyPoint(target.positions, 3, cameraPosition, headAzimuth, headElevation);
			const attribute = target.geometry.getAttribute('position') as BufferAttribute;
			attribute.needsUpdate = true;
			target.material.opacity = event.brightness * envelope * frame.visibility;
			target.line.visible = target.material.opacity > 0.01;
		}
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		for (const target of this.lines) {
			this.scene.remove(target.line);
			target.geometry.dispose();
			target.material.dispose();
		}
	}
}

function setSkyPoint(
	positions: Float32Array,
	offset: number,
	cameraPosition: Readonly<Vector3>,
	azimuth: number,
	elevation: number
): void {
	const horizontal = Math.cos(elevation) * SKY_RADIUS;
	positions[offset] = cameraPosition.x + Math.cos(azimuth) * horizontal;
	positions[offset + 1] = cameraPosition.y + Math.sin(elevation) * SKY_RADIUS;
	positions[offset + 2] = cameraPosition.z + Math.sin(azimuth) * horizontal;
}
