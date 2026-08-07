import type { LocalWaterForcing } from './LocalWaterState';

export type NaturalWaterBodyKind = 'land' | 'river' | 'lake' | 'ocean';

export interface SnowpackStepResult {
	snowWaterEquivalent: number;
	snowfallAdded: number;
	meltReleased: number;
}

const SNOW_WATER_EQUIVALENT_RATE = 0.000055;
const MINIMUM_SNOW_STORAGE = 1e-9;

/**
 * Converts atmospheric snowfall into stored water equivalent and releases it
 * as liquid water once temperature, daylight or warm rain can melt it.
 *
 * Snow melt is an internal phase change: it must never change the total water
 * budget by itself.
 */
export function stepSnowpack(
	currentSnowWaterEquivalent: number,
	deltaSeconds: number,
	forcing: Readonly<LocalWaterForcing>
): SnowpackStepResult {
	const dt = Math.max(0, Math.min(60, finiteOr(deltaSeconds, 0)));
	let snow = Math.max(0, finiteOr(currentSnowWaterEquivalent, 0));
	if (dt <= 0) {
		return { snowWaterEquivalent: snow, snowfallAdded: 0, meltReleased: 0 };
	}

	const snowfallRate = snowfallDepthPerSecond(forcing);
	const snowfallAdded = snowfallRate * dt;
	snow += snowfallAdded;

	const meltRate = snowMeltDepthPerSecond(forcing);
	const meltReleased = Math.min(snow, meltRate * dt);
	snow -= meltReleased;

	if (snow < MINIMUM_SNOW_STORAGE || !Number.isFinite(snow)) snow = 0;

	return {
		snowWaterEquivalent: snow,
		snowfallAdded,
		meltReleased
	};
}

export function snowfallDepthPerSecond(forcing: Readonly<LocalWaterForcing>): number {
	if (forcing.precipitationType !== 'snow' && forcing.precipitationType !== 'mixed') {
		return 0;
	}

	return clamp01(forcing.snowIntensity) * SNOW_WATER_EQUIVALENT_RATE;
}

export function snowMeltDepthPerSecond(forcing: Readonly<LocalWaterForcing>): number {
	const temperature = finiteOr(forcing.temperatureCelsius, 0);
	if (temperature <= -1.5) return 0;

	const thermal = Math.max(0, temperature + 1.5) * 0.00000115;
	const solar = clamp01(forcing.daylight) * Math.max(0, temperature + 0.5) * 0.00000028;
	const warmRain = clamp01(forcing.rainIntensity) * Math.max(0, temperature) * 0.00000022;
	return Math.min(0.00004, thermal + solar + warmRain);
}

/**
 * Dimensionless hydraulic-energy signal shared with the erosion system.
 * Lot 8 introduced the signal; Lot 9 consumes it through a deliberately slow,
 * voxel-budgeted sediment model rather than mutating terrain directly here.
 */
export function erosionPotential(waterDepth: number, speed: number, groundSlope: number): number {
	const depthFactor = clamp01(Math.max(0, finiteOr(waterDepth, 0)) / 0.75);
	const speedFactor = clamp01(Math.max(0, finiteOr(speed, 0)) / 1.4);
	const slopeFactor = clamp01(Math.max(0, finiteOr(groundSlope, 0)) / 0.65);
	return clamp01(depthFactor * (0.25 + speedFactor * 0.75) * (0.2 + slopeFactor * 0.8));
}

export function classifyNaturalWaterBody(
	zone: string | null | undefined,
	naturalWaterDepth: number
): NaturalWaterBodyKind {
	const label = (zone ?? '').toLowerCase();
	if (label.includes('ocean') || label.includes('coast')) return 'ocean';
	if (label.includes('lake')) return 'lake';
	if (label.includes('river') || label.includes('waterfall')) return 'river';
	if (naturalWaterDepth > 0) return 'river';
	return 'land';
}

function finiteOr(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? (value as number) : fallback;
}

function clamp01(value: number | undefined): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? (value as number) : 0));
}
