import { clamp, clamp01, lerp } from '../EnvironmentMath';
import type { WeatherCellInfluenceFrame } from '../cells/WeatherCellState';
import {
	copyWeatherParameters,
	createWeatherParameters,
	type WeatherFrameState,
	type WeatherKind
} from '../weather/WeatherState';
import type { ClimateRegionFrameState } from './ClimateRegion';

export interface RegionalWeatherInspect {
	regionId: string;
	zone: string;
	boundaryBlend: number;
	localWeather: WeatherKind;
	activeCellCount: number;
	dominantCellId: number | null;
	dominantCellKind: WeatherKind | null;
	cellCloudInfluence: number;
	cellCoreInfluence: number;
}

/**
 * Blends the global deterministic timeline with local regional biases and
 * moving weather cells. Renderers consume only this effective frame.
 */
export class RegionalWeatherSystem {
	private readonly frame: WeatherFrameState = {
		current: 'clear',
		next: 'clear',
		transition: 0,
		seed: 0,
		phase: 'holding',
		phaseElapsedSeconds: 0,
		phaseDurationSeconds: 1,
		scheduleIndex: 0,
		paused: false,
		parameters: createWeatherParameters()
	};
	private readonly inspect: RegionalWeatherInspect = {
		regionId: 'spawn_meadow',
		zone: 'Spawn Meadow',
		boundaryBlend: 0,
		localWeather: 'clear',
		activeCellCount: 0,
		dominantCellId: null,
		dominantCellKind: null,
		cellCloudInfluence: 0,
		cellCoreInfluence: 0
	};

	get currentState(): Readonly<WeatherFrameState> {
		return this.frame;
	}

	get currentInspect(): Readonly<RegionalWeatherInspect> {
		return this.inspect;
	}

	update(
		base: Readonly<WeatherFrameState>,
		region: Readonly<ClimateRegionFrameState>,
		cells: Readonly<WeatherCellInfluenceFrame>
	): void {
		this.frame.current = base.current;
		this.frame.next = base.next;
		this.frame.transition = clamp01(base.transition);
		this.frame.seed = base.seed >>> 0;
		this.frame.phase = base.phase;
		this.frame.phaseElapsedSeconds = Math.max(0, finiteOr(base.phaseElapsedSeconds, 0));
		this.frame.phaseDurationSeconds = Math.max(0.01, finiteOr(base.phaseDurationSeconds, 1));
		this.frame.scheduleIndex = base.scheduleIndex >>> 0;
		this.frame.paused = base.paused;
		copyWeatherParameters(this.frame.parameters, base.parameters);

		const parameters = this.frame.parameters;
		parameters.cloudCoverage = clamp01(parameters.cloudCoverage + region.cloudBias);
		parameters.humidity = clamp01(lerp(parameters.humidity, region.humidity, 0.2));
		parameters.fogDensity = clamp01(parameters.fogDensity + region.fogBias);
		parameters.windStrength = clamp01(
			(parameters.windStrength + region.windBias) * region.windMultiplier
		);
		parameters.temperatureOffset = clamp(
			parameters.temperatureOffset + region.temperatureBias,
			-18,
			18
		);
		parameters.precipitation = clamp01(
			parameters.precipitation * region.backgroundPrecipitationScale
		);
		parameters.lightningProbability = clamp01(
			parameters.lightningProbability * region.lightningScale
		);

		const cloudInfluence = clamp01(cells.cloudInfluence);
		const coreInfluence = clamp01(cells.coreInfluence);
		const humidInfluence = Math.max(cloudInfluence * 0.7, coreInfluence);

		parameters.cloudCoverage = lerp(
			parameters.cloudCoverage,
			cells.cloudParameters.cloudCoverage,
			cloudInfluence
		);
		parameters.cloudDensity = lerp(
			parameters.cloudDensity,
			cells.cloudParameters.cloudDensity,
			cloudInfluence
		);
		parameters.cloudDarkness = lerp(
			parameters.cloudDarkness,
			cells.cloudParameters.cloudDarkness,
			cloudInfluence
		);
		parameters.overcast = lerp(parameters.overcast, cells.cloudParameters.overcast, cloudInfluence);
		parameters.humidity = lerp(
			parameters.humidity,
			cells.coreParameters.humidity || cells.cloudParameters.humidity,
			humidInfluence
		);
		parameters.fogDensity = lerp(
			parameters.fogDensity,
			Math.max(cells.cloudParameters.fogDensity, cells.coreParameters.fogDensity),
			humidInfluence
		);
		parameters.windStrength = lerp(
			parameters.windStrength,
			Math.max(cells.cloudParameters.windStrength, cells.coreParameters.windStrength),
			Math.max(cloudInfluence * 0.45, coreInfluence)
		);
		parameters.temperatureOffset = lerp(
			parameters.temperatureOffset,
			cells.coreParameters.temperatureOffset,
			coreInfluence
		);
		parameters.precipitation = lerp(
			parameters.precipitation,
			cells.coreParameters.precipitation,
			coreInfluence
		);
		parameters.lightningProbability = lerp(
			parameters.lightningProbability,
			cells.coreParameters.lightningProbability,
			coreInfluence
		);

		if (cells.dominantKind && coreInfluence >= 0.42) {
			this.frame.current = cells.dominantKind;
			this.frame.next = cells.dominantKind;
			this.frame.transition = coreInfluence;
		} else if (cells.dominantKind && cloudInfluence >= 0.35) {
			this.frame.next = isPrecipitating(cells.dominantKind) ? 'overcast' : cells.dominantKind;
			this.frame.transition = cloudInfluence;
		}

		this.inspect.regionId = region.regionId;
		this.inspect.zone = region.zone;
		this.inspect.boundaryBlend = region.boundaryBlend;
		this.inspect.localWeather = this.frame.current;
		this.inspect.activeCellCount = cells.activeCellCount;
		this.inspect.dominantCellId = cells.dominantCellId;
		this.inspect.dominantCellKind = cells.dominantKind;
		this.inspect.cellCloudInfluence = cloudInfluence;
		this.inspect.cellCoreInfluence = coreInfluence;
	}
}

function isPrecipitating(kind: WeatherKind): boolean {
	return kind === 'light_rain' || kind === 'heavy_rain' || kind === 'storm' || kind === 'snow';
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
