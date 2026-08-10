import type { WebGLRenderer, Scene } from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';

export interface PerformanceSnapshot {
	fps: number;
	frameMs: number;
	frameP95Ms: number;
	frameMaxMs: number;
	longFrames: number;
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
	private readonly frameSamples: number[] = [];
	private frameMaxMs = 0;
	private longFrames = 0;
	private initialGenerationMsValue = 0;
	private rebuildTotalMs = 0;
	private rebuildCount = 0;
	private rebuildsThisSecond = 0;
	private rebuildsPerSecondValue = 0;
	private physicsMsValue = 0;
	private cameraMsValue = 0;

	recordFrameStart(): void {
		const now = performance.now();
		const frameMs = now - this.lastFrame;
		this.frameMsValue = this.frameMsValue * 0.9 + frameMs * 0.1;
		this.frameSamples.push(frameMs);
		if (this.frameSamples.length > 240) this.frameSamples.shift();
		this.frameMaxMs = Math.max(this.frameMaxMs, frameMs);
		if (frameMs > 33) this.longFrames += 1;
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
			frameP95Ms: round(percentile(this.frameSamples, 0.95)),
			frameMaxMs: round(this.frameMaxMs),
			longFrames: this.longFrames,
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

function percentile(values: readonly number[], fraction: number): number {
	if (!values.length) return 0;
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] ?? 0;
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
