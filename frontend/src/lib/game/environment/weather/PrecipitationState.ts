import type { WeatherKind } from './WeatherState';

export interface PrecipitationSaveState {
	elapsedSeconds: number;
	paused: boolean;
	visibleIntensity: number;
}

export interface PrecipitationFrameState {
	elapsedSeconds: number;
	paused: boolean;
	kind: 'none' | 'rain';
	intensity: number;
	visibleIntensity: number;
	shelter: number;
	windX: number;
	windZ: number;
	fallSpeed: number;
	splashIntensity: number;
}

export function createPrecipitationFrameState(): PrecipitationFrameState {
	return {
		elapsedSeconds: 0,
		paused: false,
		kind: 'none',
		intensity: 0,
		visibleIntensity: 0,
		shelter: 0,
		windX: 0,
		windZ: 0,
		fallSpeed: 18,
		splashIntensity: 0
	};
}

export function snowBlendForWeather(
	current: WeatherKind,
	next: WeatherKind,
	transition: number
): number {
	const from = current === 'snow' ? 1 : 0;
	const to = next === 'snow' ? 1 : 0;
	const amount = Number.isFinite(transition) ? Math.min(1, Math.max(0, transition)) : 0;

	return from + (to - from) * amount;
}
