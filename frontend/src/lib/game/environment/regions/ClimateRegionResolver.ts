import type { Vector3 } from 'three';
import { clamp, clamp01, lerp } from '../EnvironmentMath';
import type { WeatherWorldQuery } from '../weather/WeatherWorldQuery';
import {
	CLIMATE_REGION_IDS,
	getClimateRegionProfile,
	resolveClimateRegionProfile,
	type ClimateRegionId,
	type ClimateRegionProfile
} from './ClimateRegionProfile';
import {
	createClimateRegionFrameState,
	type ClimateRegionFrameState,
	type ClimateRegionSaveState
} from './ClimateRegion';

const SAMPLE_RADIUS = 22;
const RESPONSE_SECONDS = 5.5;
const SAMPLE_OFFSETS: readonly [x: number, z: number, weight: number][] = [
	[0, 0, 4],
	[SAMPLE_RADIUS, 0, 2],
	[-SAMPLE_RADIUS, 0, 2],
	[0, SAMPLE_RADIUS, 2],
	[0, -SAMPLE_RADIUS, 2],
	[SAMPLE_RADIUS, SAMPLE_RADIUS, 1],
	[-SAMPLE_RADIUS, SAMPLE_RADIUS, 1],
	[SAMPLE_RADIUS, -SAMPLE_RADIUS, 1],
	[-SAMPLE_RADIUS, -SAMPLE_RADIUS, 1]
];
const TOTAL_SAMPLE_WEIGHT = SAMPLE_OFFSETS.reduce((total, sample) => total + sample[2], 0);

/** Resolves discrete terrain zones into a smooth local climate at boundaries. */
export class ClimateRegionResolver {
	private readonly frame = createClimateRegionFrameState();
	private readonly weights = new Float64Array(CLIMATE_REGION_IDS.length);

	get currentState(): Readonly<ClimateRegionFrameState> {
		return this.frame;
	}

	get currentProfile(): ClimateRegionProfile {
		return getClimateRegionProfile(this.frame.regionId);
	}

	update(deltaSeconds: number, position: Readonly<Vector3>, worldQuery?: WeatherWorldQuery): void {
		const safeDelta = safePositiveDelta(deltaSeconds);
		if (!this.frame.paused) {
			this.frame.elapsedSeconds += safeDelta;
		}

		this.weights.fill(0);
		const x = finiteOr(position.x, 0);
		const z = finiteOr(position.z, 0);

		for (const [offsetX, offsetZ, weight] of SAMPLE_OFFSETS) {
			const zone = worldQuery?.climateZoneAt?.(x + offsetX, z + offsetZ) ?? 'Spawn Meadow';
			const profile = resolveClimateRegionProfile(zone);
			const index = CLIMATE_REGION_IDS.indexOf(profile.id);
			this.weights[Math.max(0, index)] += weight;
		}

		let dominantIndex = 0;
		let dominantWeight = this.weights[0] ?? 0;
		for (let index = 1; index < this.weights.length; index += 1) {
			if ((this.weights[index] ?? 0) > dominantWeight) {
				dominantIndex = index;
				dominantWeight = this.weights[index] ?? 0;
			}
		}

		const dominantId = CLIMATE_REGION_IDS[dominantIndex] ?? 'spawn_meadow';
		const dominantProfile = getClimateRegionProfile(dominantId);
		const target = this.sampleBlendedTarget();
		const alpha = !this.frame.initialized
			? 1
			: safeDelta > 0
				? 1 - Math.exp(-safeDelta / RESPONSE_SECONDS)
				: 0;

		this.frame.regionId = dominantId;
		this.frame.zone = dominantProfile.zone;
		this.frame.dominantWeight = clamp01(dominantWeight / TOTAL_SAMPLE_WEIGHT);
		this.frame.boundaryBlend = clamp01(1 - this.frame.dominantWeight);
		this.frame.baseTemperatureCelsius = lerp(
			this.frame.baseTemperatureCelsius,
			target.baseTemperatureCelsius,
			alpha
		);
		this.frame.dailyRangeCelsius = lerp(
			this.frame.dailyRangeCelsius,
			target.dailyRangeCelsius,
			alpha
		);
		this.frame.humidity = clamp01(lerp(this.frame.humidity, target.humidity, alpha));
		this.frame.lapseRateCelsiusPerMeter = lerp(
			this.frame.lapseRateCelsiusPerMeter,
			target.lapseRateCelsiusPerMeter,
			alpha
		);
		this.frame.windMultiplier = clamp(
			lerp(this.frame.windMultiplier, target.windMultiplier, alpha),
			0.35,
			1.8
		);
		this.frame.cloudBias = clamp(lerp(this.frame.cloudBias, target.cloudBias, alpha), -0.4, 0.4);
		this.frame.fogBias = clamp(lerp(this.frame.fogBias, target.fogBias, alpha), -0.4, 0.5);
		this.frame.windBias = clamp(lerp(this.frame.windBias, target.windBias, alpha), -0.4, 0.5);
		this.frame.temperatureBias = clamp(
			lerp(this.frame.temperatureBias, target.temperatureBias, alpha),
			-12,
			12
		);
		this.frame.backgroundPrecipitationScale = clamp(
			lerp(this.frame.backgroundPrecipitationScale, target.backgroundPrecipitationScale, alpha),
			0,
			1.6
		);
		this.frame.lightningScale = clamp(
			lerp(this.frame.lightningScale, target.lightningScale, alpha),
			0,
			1.8
		);
		this.frame.initialized = true;
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	serialize(): ClimateRegionSaveState {
		return { ...this.frame };
	}

	restore(save: ClimateRegionSaveState | null | undefined): void {
		if (!save) {
			return;
		}

		const regionId = isClimateRegionId(save.regionId) ? save.regionId : 'spawn_meadow';
		const profile = getClimateRegionProfile(regionId);
		this.frame.elapsedSeconds = nonNegative(save.elapsedSeconds);
		this.frame.paused = save.paused === true;
		this.frame.initialized = save.initialized !== false;
		this.frame.regionId = regionId;
		this.frame.zone =
			typeof save.zone === 'string' && save.zone.length > 0 ? save.zone : profile.zone;
		this.frame.dominantWeight = safeUnit(save.dominantWeight);
		this.frame.boundaryBlend = safeUnit(save.boundaryBlend);
		this.frame.baseTemperatureCelsius = finiteOr(
			save.baseTemperatureCelsius,
			profile.baseTemperatureCelsius
		);
		this.frame.dailyRangeCelsius = Math.max(
			0.1,
			finiteOr(save.dailyRangeCelsius, profile.dailyRangeCelsius)
		);
		this.frame.humidity = safeUnit(save.humidity);
		this.frame.lapseRateCelsiusPerMeter = clamp(
			finiteOr(save.lapseRateCelsiusPerMeter, profile.lapseRateCelsiusPerMeter),
			0.01,
			1
		);
		this.frame.windMultiplier = clamp(
			finiteOr(save.windMultiplier, profile.windMultiplier),
			0.35,
			1.8
		);
		this.frame.cloudBias = clamp(
			finiteOr(save.cloudBias, profile.weatherBias.cloudCoverage),
			-0.4,
			0.4
		);
		this.frame.fogBias = clamp(finiteOr(save.fogBias, profile.weatherBias.fogDensity), -0.4, 0.5);
		this.frame.windBias = clamp(
			finiteOr(save.windBias, profile.weatherBias.windStrength),
			-0.4,
			0.5
		);
		this.frame.temperatureBias = clamp(
			finiteOr(save.temperatureBias, profile.weatherBias.temperatureOffset),
			-12,
			12
		);
		this.frame.backgroundPrecipitationScale = clamp(
			finiteOr(save.backgroundPrecipitationScale, profile.backgroundPrecipitationScale),
			0,
			1.6
		);
		this.frame.lightningScale = clamp(
			finiteOr(save.lightningScale, profile.lightningScale),
			0,
			1.8
		);
	}

	private sampleBlendedTarget(): BlendedTarget {
		const target: BlendedTarget = {
			baseTemperatureCelsius: 0,
			dailyRangeCelsius: 0,
			humidity: 0,
			lapseRateCelsiusPerMeter: 0,
			windMultiplier: 0,
			cloudBias: 0,
			fogBias: 0,
			windBias: 0,
			temperatureBias: 0,
			backgroundPrecipitationScale: 0,
			lightningScale: 0
		};

		for (let index = 0; index < CLIMATE_REGION_IDS.length; index += 1) {
			const weight = (this.weights[index] ?? 0) / TOTAL_SAMPLE_WEIGHT;
			if (weight <= 0) {
				continue;
			}
			const profile = getClimateRegionProfile(CLIMATE_REGION_IDS[index] ?? 'spawn_meadow');
			target.baseTemperatureCelsius += profile.baseTemperatureCelsius * weight;
			target.dailyRangeCelsius += profile.dailyRangeCelsius * weight;
			target.humidity += profile.humidity * weight;
			target.lapseRateCelsiusPerMeter += profile.lapseRateCelsiusPerMeter * weight;
			target.windMultiplier += profile.windMultiplier * weight;
			target.cloudBias += profile.weatherBias.cloudCoverage * weight;
			target.fogBias += profile.weatherBias.fogDensity * weight;
			target.windBias += profile.weatherBias.windStrength * weight;
			target.temperatureBias += profile.weatherBias.temperatureOffset * weight;
			target.backgroundPrecipitationScale += profile.backgroundPrecipitationScale * weight;
			target.lightningScale += profile.lightningScale * weight;
		}

		return target;
	}
}

interface BlendedTarget {
	baseTemperatureCelsius: number;
	dailyRangeCelsius: number;
	humidity: number;
	lapseRateCelsiusPerMeter: number;
	windMultiplier: number;
	cloudBias: number;
	fogBias: number;
	windBias: number;
	temperatureBias: number;
	backgroundPrecipitationScale: number;
	lightningScale: number;
}

function isClimateRegionId(value: unknown): value is ClimateRegionId {
	return typeof value === 'string' && (CLIMATE_REGION_IDS as readonly string[]).includes(value);
}

function safePositiveDelta(value: number): number {
	return Number.isFinite(value) && value > 0 ? value : 0;
}

function safeUnit(value: number): number {
	return Number.isFinite(value) ? clamp01(value) : 0;
}

function nonNegative(value: number): number {
	return Number.isFinite(value) && value >= 0 ? value : 0;
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
