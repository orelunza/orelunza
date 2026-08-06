import { BufferGeometry, LineBasicMaterial, LineSegments } from 'three';

export class PlanetDebugOverlay {
	readonly object: LineSegments;
	private disposed = false;

	constructor() {
		this.object = new LineSegments(
			new BufferGeometry(),
			new LineBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.42 })
		);
		this.object.frustumCulled = false;
		this.object.renderOrder = 3;
	}

	setGeometry(geometry: BufferGeometry): void {
		if (this.disposed) {
			geometry.dispose();
			return;
		}
		this.object.geometry.dispose();
		this.object.geometry = geometry;
	}

	setVisible(visible: boolean): void {
		this.object.visible = visible;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.object.geometry.dispose();
		(this.object.material as LineBasicMaterial).dispose();
	}
}
