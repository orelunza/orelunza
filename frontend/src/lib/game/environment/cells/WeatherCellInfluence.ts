import { clamp01, smoothstep } from '../EnvironmentMath';
import type { WeatherCell } from './WeatherCell';

export interface SampledWeatherCellInfluence {
	cloud: number;
	core: number;
}

/**
 * Samples a cell using a broad cloud envelope and a tighter precipitation core.
 * This lets the sky darken before rain reaches the player.
 */
export function sampleWeatherCellInfluence(
	cell: WeatherCell,
	x: number,
	z: number
): SampledWeatherCellInfluence {
	const state = cell.state;
	const lifecycle = cell.lifecycleIntensity;
	if (lifecycle <= 0) {
		return { cloud: 0, core: 0 };
	}

	const distance = Math.hypot(x - state.x, z - state.z);
	const radius = Math.max(1, state.radius);
	const cloud = lifecycle * (1 - smoothstep(radius * 0.92, radius * 1.42, distance));
	const core = lifecycle * (1 - smoothstep(radius * 0.58, radius, distance));

	return {
		cloud: clamp01(cloud),
		core: clamp01(core)
	};
}
