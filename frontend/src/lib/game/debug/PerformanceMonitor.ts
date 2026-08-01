import type { WebGLRenderer, Scene } from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';

export interface PerformanceSnapshot {
	fps: number;
	frameMs: number;
	drawCalls: number;
	triangles: number;
	textures: number;
	geometries: number;
	chunksLoaded: number;
	chunksVisible: number;
	objects: number;
	initialGenerationMs: number;
	averageChunkRebuildMs: number;
	chunkRebuildsPerSecond: number;
	physicsMs: number;
	cameraMs: number;
}

export class PerformanceMonitor {
	private frameCount = 0;
	private lastSecond = performance.now();
	private lastFrame = performance.now();
	private fpsValue = 0;
	private frameMsValue = 0;
	private initialGenerationMsValue = 0;
	private rebuildTotalMs = 0;
	private rebuildCount = 0;
	private rebuildsThisSecond = 0;
	private rebuildsPerSecondValue = 0;
	private physicsMsValue = 0;
	private cameraMsValue = 0;

	recordFrameStart(): void {
		const now = performance.now();
		this.frameMsValue = this.frameMsValue * 0.9 + (now - this.lastFrame) * 0.1;
		this.lastFrame = now;
		this.frameCount += 1;

		if (now - this.lastSecond >= 1000) {
			this.fpsValue = (this.frameCount * 1000) / (now - this.lastSecond);
			this.rebuildsPerSecondValue = this.rebuildsThisSecond;
			this.frameCount = 0;
			this.rebuildsThisSecond = 0;
			this.lastSecond = now;
		}
	}

	recordInitialGeneration(milliseconds: number): void {
		this.initialGenerationMsValue = milliseconds;
	}

	recordChunkRebuild(milliseconds: number): void {
		this.rebuildTotalMs += milliseconds;
		this.rebuildCount += 1;
		this.rebuildsThisSecond += 1;
	}

	recordPhysics(milliseconds: number): void {
		this.physicsMsValue = this.physicsMsValue * 0.85 + milliseconds * 0.15;
	}

	recordCamera(milliseconds: number): void {
		this.cameraMsValue = this.cameraMsValue * 0.85 + milliseconds * 0.15;
	}

	snapshot(renderer: WebGLRenderer, scene: Scene, world: VoxelWorld): PerformanceSnapshot {
		return {
			fps: round(this.fpsValue),
			frameMs: round(this.frameMsValue),
			drawCalls: renderer.info.render.calls,
			triangles: renderer.info.render.triangles,
			textures: renderer.info.memory.textures,
			geometries: renderer.info.memory.geometries,
			chunksLoaded: world.getLoadedChunks().length,
			chunksVisible: world.getLoadedChunks().length,
			objects: countObjects(scene),
			initialGenerationMs: round(this.initialGenerationMsValue),
			averageChunkRebuildMs: round(
				this.rebuildCount > 0 ? this.rebuildTotalMs / this.rebuildCount : 0
			),
			chunkRebuildsPerSecond: this.rebuildsPerSecondValue,
			physicsMs: round(this.physicsMsValue),
			cameraMs: round(this.cameraMsValue)
		};
	}
}

function countObjects(scene: Scene): number {
	let count = 0;
	scene.traverse(() => {
		count += 1;
	});

	return count;
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}
