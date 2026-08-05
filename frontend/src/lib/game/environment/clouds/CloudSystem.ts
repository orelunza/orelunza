import { clamp01, lerp } from '../EnvironmentMath';
import type { WeatherParameters } from '../weather/WeatherState';
import type { WindFrameState } from '../wind/WindState';
import { createCloudFrameState, type CloudFrameState, type CloudSaveState } from './CloudState';

const CLOUD_TRAVEL_SPEED = 0.0075;

/**
 * Allocation-free bridge between weather data, unified wind and cloud rendering.
 * It owns only visual drift; cloud coverage and density remain authoritative in
 * WeatherScheduler so save compatibility stays simple.
 */
export class CloudSystem {
	private readonly frame = createCloudFrameState();

	get currentState(): Readonly<CloudFrameState> {
		return this.frame;
	}

	serialize(): CloudSaveState {
		return {
			windOffsetX: this.frame.windOffsetX,
			windOffsetZ: this.frame.windOffsetZ
		};
	}

	restore(save: CloudSaveState | null | undefined): void {
		if (!save) {
			return;
		}

		this.frame.windOffsetX = wrapCloudOffset(save.windOffsetX);
		this.frame.windOffsetZ = wrapCloudOffset(save.windOffsetZ);
	}

	update(
		weather: Readonly<WeatherParameters>,
		wind: Readonly<WindFrameState>,
		deltaSeconds: number
	): void {
		const coverage = clamp01(weather.cloudCoverage);
		const density = clamp01(weather.cloudDensity);
		const darkness = clamp01(weather.cloudDarkness);
		const opacity = clamp01(coverage * lerp(0.45, 1, density));
		const safeDelta =
			!wind.paused && Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
		const travel = safeDelta * CLOUD_TRAVEL_SPEED * lerp(0.35, 1.8, wind.strength);

		this.frame.coverage = coverage;
		this.frame.density = density;
		this.frame.darkness = darkness;
		this.frame.opacity = opacity;
		this.frame.sunOcclusion = clamp01(opacity * lerp(0.3, 1, darkness));
		this.frame.moonOcclusion = clamp01(opacity * lerp(0.45, 0.92, density));
		this.frame.shadowStrength = clamp01(coverage * density * (1 - darkness * 0.2));
		this.frame.windOffsetX = wrapCloudOffset(this.frame.windOffsetX + wind.directionX * travel);
		this.frame.windOffsetZ = wrapCloudOffset(this.frame.windOffsetZ + wind.directionZ * travel);
	}
}

function wrapCloudOffset(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	const wrapped = value % 4096;

	return wrapped < 0 ? wrapped + 4096 : wrapped;
}
