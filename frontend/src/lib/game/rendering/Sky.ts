import { Scene, Vector3, type WebGLRenderer } from 'three';
import {
	EnvironmentSystem,
	type EnvironmentDebugApi,
	type EnvironmentSaveState
} from '../environment/EnvironmentSystem';
import type { RenderQuality } from './QualitySettings';
import type { WeatherWorldQuery } from '../environment/weather/WeatherWorldQuery';

export interface SkyOptions {
	renderer: WebGLRenderer;
	seed: string;
	quality: RenderQuality;
	dayLengthSeconds?: number;
	worldQuery?: WeatherWorldQuery;
}

/**
 * Thin façade over {@link EnvironmentSystem}.
 *
 * The rest of the game still talks to a `Sky` with the same lifecycle it always
 * had — construct, {@link update} each frame with the camera position and a
 * delta, {@link dispose} on teardown. Everything real now lives in the
 * environment package; this class only forwards, so GameEngine's integration
 * stays small and the production sky can grow across phases without touching
 * the loop.
 */
export class Sky {
	private readonly environment: EnvironmentSystem;

	constructor(scene: Scene, options: SkyOptions) {
		this.environment = new EnvironmentSystem({
			scene,
			renderer: options.renderer,
			seed: options.seed,
			quality: options.quality,
			dayLengthSeconds: options.dayLengthSeconds,
			worldQuery: options.worldQuery
		});
	}

	update(cameraPosition: Vector3, deltaSeconds: number): void {
		this.environment.update(cameraPosition, deltaSeconds);
	}

	get windDirection(): number {
		return this.environment.currentState.windDirection;
	}

	get windStrength(): number {
		return this.environment.currentState.windStrength;
	}

	setQuality(quality: RenderQuality): void {
		this.environment.setQuality(quality);
	}

	serialize(): EnvironmentSaveState {
		return this.environment.serialize();
	}

	restore(save: EnvironmentSaveState | null | undefined): void {
		this.environment.restore(save);
	}

	createDebugApi(): EnvironmentDebugApi {
		return this.environment.createDebugApi();
	}

	dispose(): void {
		this.environment.dispose();
	}
}
