import type { Vector3 } from 'three';
import { clamp, clamp01, hashUint32, lerp } from '../EnvironmentMath';
import type { ClimateRegionProfile } from '../regions/ClimateRegionProfile';
import type { WorldSeason } from '../time/WorldDate';
import { getWeatherPreset } from '../weather/WeatherPreset';
import {
	copyWeatherParameters,
	createWeatherParameters,
	type WeatherParameters
} from '../weather/WeatherState';
import type { WindFrameState } from '../wind/WindState';
import { WeatherCell } from './WeatherCell';
import { sampleWeatherCellInfluence } from './WeatherCellInfluence';
import {
	WEATHER_CELL_KINDS,
	createWeatherCellInfluenceFrame,
	isWeatherCellKind,
	type WeatherCellInfluenceFrame,
	type WeatherCellKind,
	type WeatherCellManagerSaveState,
	type WeatherCellSaveState
} from './WeatherCellState';

const SPAWN_INTERVAL_SALT = 0x63656c31;
const KIND_SALT = 0x63656c32;
const DISTANCE_SALT = 0x63656c33;
const LATERAL_SALT = 0x63656c34;
const RADIUS_SALT = 0x63656c35;
const INTENSITY_SALT = 0x63656c36;
const SPEED_SALT = 0x63656c37;
const LIFETIME_SALT = 0x63656c38;
const MAX_DISTANCE_FROM_PLAYER = 1100;
const MAX_BOUNDARIES_PER_UPDATE = 256;

export interface WeatherCellManagerOptions {
	seed: number;
	durationScale?: number;
	maxCells?: number;
}

/** Deterministic active weather cells around the current player region. */
export class WeatherCellManager {
	private readonly seed: number;
	private readonly durationScale: number;
	private readonly maxCells: number;
	private readonly frame = createWeatherCellInfluenceFrame();
	private readonly cells: WeatherCell[] = [];
	private elapsedSeconds = 0;
	private nextSpawnAtSeconds = 0;
	private spawnIndex = 0;
	private paused = false;

	constructor(options: WeatherCellManagerOptions) {
		this.seed = options.seed >>> 0;
		this.durationScale = sanitizeDurationScale(options.durationScale);
		this.maxCells = clamp(Math.floor(options.maxCells ?? 7), 1, 24);
		this.nextSpawnAtSeconds = 300 * this.durationScale;
	}

	get currentState(): Readonly<WeatherCellInfluenceFrame> {
		return this.frame;
	}

	get activeCells(): readonly WeatherCell[] {
		return this.cells;
	}

	update(
		deltaSeconds: number,
		cameraPosition: Readonly<Vector3>,
		wind: Readonly<WindFrameState>,
		region: ClimateRegionProfile,
		seasonalPrecipitationScale = 1,
		season: WorldSeason = 'spring'
	): void {
		let remaining =
			!this.paused && Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
		let boundaries = 0;

		while (remaining > 0 && boundaries < MAX_BOUNDARIES_PER_UPDATE) {
			const untilSpawn = Math.max(0, this.nextSpawnAtSeconds - this.elapsedSeconds);
			const consumed = Math.min(remaining, untilSpawn);
			this.advanceCells(consumed, cameraPosition, wind);
			this.elapsedSeconds += consumed;
			remaining -= consumed;

			if (this.elapsedSeconds + Number.EPSILON < this.nextSpawnAtSeconds) {
				break;
			}

			this.spawnScheduledCell(cameraPosition, wind, region, seasonalPrecipitationScale, season);
			this.scheduleNextSpawn(region, seasonalPrecipitationScale);
			boundaries += 1;
		}

		if (remaining > 0) {
			this.advanceCells(remaining, cameraPosition, wind);
			this.elapsedSeconds += remaining;
		}

		this.sampleAt(cameraPosition.x, cameraPosition.z);
	}

	pause(): void {
		this.paused = true;
	}

	resume(): void {
		this.paused = false;
	}

	clear(): void {
		this.cells.length = 0;
		this.resetInfluence();
	}

	/** Development helper used by the browser debug API and deterministic tests. */
	spawnAt(
		kind: WeatherCellKind,
		x: number,
		z: number,
		radius: number,
		intensity: number,
		wind: Readonly<WindFrameState>,
		lifetimeSeconds = 300
	): number {
		const id = this.nextCellId();
		const speed = clamp(2.2 + wind.strength * 5.8, 1.4, 10);
		this.pushCell({
			id,
			kind,
			x: finiteOr(x, 0),
			z: finiteOr(z, 0),
			radius: clamp(finiteOr(radius, 120), 24, 500),
			intensity: clamp01(intensity),
			velocityX: finiteOr(wind.directionX, 1) * speed,
			velocityZ: finiteOr(wind.directionZ, 0) * speed,
			ageSeconds: 0,
			lifetimeSeconds: clamp(finiteOr(lifetimeSeconds, 300), 10, 3600),
			growthSeconds: 0,
			decaySeconds: 36
		});
		return id;
	}

	serialize(): WeatherCellManagerSaveState {
		return {
			elapsedSeconds: this.elapsedSeconds,
			nextSpawnAtSeconds: this.nextSpawnAtSeconds,
			spawnIndex: this.spawnIndex,
			paused: this.paused,
			cells: this.cells.map((cell) => cell.serialize())
		};
	}

	restore(save: WeatherCellManagerSaveState | null | undefined): void {
		if (!save) {
			return;
		}
		this.elapsedSeconds = nonNegative(save.elapsedSeconds);
		this.nextSpawnAtSeconds = Math.max(
			this.elapsedSeconds,
			finiteOr(save.nextSpawnAtSeconds, this.elapsedSeconds + 30 * this.durationScale)
		);
		this.spawnIndex = finiteUint32(save.spawnIndex);
		this.paused = save.paused === true;
		this.cells.length = 0;
		for (const raw of Array.isArray(save.cells) ? save.cells : []) {
			if (!isWeatherCellKind(raw.kind) || this.cells.length >= this.maxCells) {
				continue;
			}
			this.cells.push(new WeatherCell(raw));
		}
		this.resetInfluence();
	}

	private advanceCells(
		deltaSeconds: number,
		cameraPosition: Readonly<Vector3>,
		wind: Readonly<WindFrameState>
	): void {
		if (deltaSeconds <= 0) {
			return;
		}
		for (let index = this.cells.length - 1; index >= 0; index -= 1) {
			const cell = this.cells[index];
			if (!cell) {
				continue;
			}
			cell.update(deltaSeconds, wind);
			const distance = Math.hypot(cell.state.x - cameraPosition.x, cell.state.z - cameraPosition.z);
			if (cell.expired || distance > MAX_DISTANCE_FROM_PLAYER) {
				this.cells.splice(index, 1);
			}
		}
	}

	private spawnScheduledCell(
		cameraPosition: Readonly<Vector3>,
		wind: Readonly<WindFrameState>,
		region: ClimateRegionProfile,
		seasonalPrecipitationScale: number,
		season: WorldSeason
	): void {
		if (this.cells.length >= this.maxCells) {
			return;
		}
		const index = this.spawnIndex;
		const kind = chooseCellKind(
			region,
			unitHash(this.seed, index, KIND_SALT),
			seasonalPrecipitationScale,
			season
		);
		const radius = randomRange(
			region.cellRadius[0],
			region.cellRadius[1],
			this.seed,
			index,
			RADIUS_SALT
		);
		const distance = randomRange(radius * 1.45, radius * 2.35, this.seed, index, DISTANCE_SALT);
		const lateral = randomRange(-radius * 0.55, radius * 0.55, this.seed, index, LATERAL_SALT);
		const directionX = finiteOr(wind.directionX, 1);
		const directionZ = finiteOr(wind.directionZ, 0);
		const perpendicularX = -directionZ;
		const perpendicularZ = directionX;
		const speed =
			randomRange(2.8, 5.8, this.seed, index, SPEED_SALT) * lerp(0.75, 1.3, wind.strength);
		const intensity = randomRange(0.68, 1, this.seed, index, INTENSITY_SALT);
		const travelSeconds = distance / Math.max(1, speed);
		const lifetime =
			travelSeconds + randomRange(120, 260, this.seed, index, LIFETIME_SALT) * this.durationScale;

		this.pushCell({
			id: this.nextCellId(),
			kind,
			x: cameraPosition.x - directionX * distance + perpendicularX * lateral,
			z: cameraPosition.z - directionZ * distance + perpendicularZ * lateral,
			radius,
			intensity,
			velocityX: directionX * speed,
			velocityZ: directionZ * speed,
			ageSeconds: 0,
			lifetimeSeconds: Math.max(40, lifetime),
			growthSeconds: Math.min(28, Math.max(6, lifetime * 0.12)),
			decaySeconds: Math.min(52, Math.max(12, lifetime * 0.18))
		});
	}

	private scheduleNextSpawn(region: ClimateRegionProfile, seasonalScale = 1): void {
		const climateCadence = 1 / Math.max(0.35, Math.min(1.5, finiteOr(seasonalScale, 1)));
		const interval =
			randomRange(
				region.cellSpawnSeconds[0],
				region.cellSpawnSeconds[1],
				this.seed,
				this.spawnIndex,
				SPAWN_INTERVAL_SALT
			) *
			this.durationScale *
			climateCadence;
		this.nextSpawnAtSeconds = this.elapsedSeconds + Math.max(0.01, interval);
	}

	private nextCellId(): number {
		const id = hashUint32(this.seed ^ Math.imul(this.spawnIndex >>> 0, 0x9e3779b1));
		this.spawnIndex = (this.spawnIndex + 1) >>> 0;
		return id;
	}

	private pushCell(state: WeatherCellSaveState): void {
		if (this.cells.length >= this.maxCells) {
			this.cells.shift();
		}
		this.cells.push(new WeatherCell(state));
	}

	private sampleAt(x: number, z: number): void {
		this.resetInfluence();
		this.frame.activeCellCount = this.cells.length;
		let cloudWeight = 0;
		let coreWeight = 0;
		let strongest = 0;

		for (const cell of this.cells) {
			const sampled = sampleWeatherCellInfluence(cell, x, z);
			if (sampled.cloud <= 0 && sampled.core <= 0) {
				continue;
			}
			const preset = getWeatherPreset(cell.state.kind).parameters;
			accumulate(this.frame.cloudParameters, preset, sampled.cloud);
			accumulate(this.frame.coreParameters, preset, sampled.core);
			cloudWeight += sampled.cloud;
			coreWeight += sampled.core;
			this.frame.cloudInfluence = combineInfluence(this.frame.cloudInfluence, sampled.cloud);
			this.frame.coreInfluence = combineInfluence(this.frame.coreInfluence, sampled.core);
			const dominance = Math.max(sampled.core, sampled.cloud * 0.55);
			if (dominance > strongest) {
				strongest = dominance;
				this.frame.dominantCellId = cell.state.id;
				this.frame.dominantKind = cell.state.kind;
			}
		}

		if (cloudWeight > 0) {
			scaleParameters(this.frame.cloudParameters, 1 / cloudWeight);
		}
		if (coreWeight > 0) {
			scaleParameters(this.frame.coreParameters, 1 / coreWeight);
		}
	}

	private resetInfluence(): void {
		this.frame.activeCellCount = this.cells.length;
		this.frame.dominantCellId = null;
		this.frame.dominantKind = null;
		this.frame.cloudInfluence = 0;
		this.frame.coreInfluence = 0;
		copyWeatherParameters(this.frame.cloudParameters, ZERO_PARAMETERS);
		copyWeatherParameters(this.frame.coreParameters, ZERO_PARAMETERS);
	}
}

const ZERO_PARAMETERS = Object.freeze(createWeatherParameters());

function chooseCellKind(
	region: ClimateRegionProfile,
	random: number,
	seasonalPrecipitationScale = 1,
	season: WorldSeason = 'spring'
): WeatherCellKind {
	const weights = WEATHER_CELL_KINDS.map((kind) => {
		const base = Math.max(0, region.cellWeatherWeights[kind] ?? 0);
		let scale = 1;
		if (isPrecipitatingCell(kind)) {
			scale *= Math.max(0.2, Math.min(1.8, finiteOr(seasonalPrecipitationScale, 1)));
		}
		if (kind === 'snow') {
			scale *= season === 'winter' ? 1.9 : season === 'summer' ? 0.03 : 0.42;
		}
		return base * scale;
	});
	const total = weights.reduce((sum, weight) => sum + weight, 0);
	if (total <= 0) {
		return 'overcast';
	}
	let cursor = clamp01(random) * total;
	for (let index = 0; index < WEATHER_CELL_KINDS.length; index += 1) {
		cursor -= weights[index] ?? 0;
		if (cursor <= 0) {
			return WEATHER_CELL_KINDS[index] ?? 'overcast';
		}
	}
	return WEATHER_CELL_KINDS[WEATHER_CELL_KINDS.length - 1] ?? 'overcast';
}

function isPrecipitatingCell(kind: WeatherCellKind): boolean {
	return kind === 'light_rain' || kind === 'heavy_rain' || kind === 'storm' || kind === 'snow';
}

function accumulate(
	target: WeatherParameters,
	source: Readonly<WeatherParameters>,
	weight: number
): void {
	target.cloudCoverage += source.cloudCoverage * weight;
	target.cloudDensity += source.cloudDensity * weight;
	target.cloudDarkness += source.cloudDarkness * weight;
	target.humidity += source.humidity * weight;
	target.precipitation += source.precipitation * weight;
	target.fogDensity += source.fogDensity * weight;
	target.windStrength += source.windStrength * weight;
	target.temperatureOffset += source.temperatureOffset * weight;
	target.lightningProbability += source.lightningProbability * weight;
	target.overcast += source.overcast * weight;
}

function scaleParameters(target: WeatherParameters, scale: number): void {
	target.cloudCoverage *= scale;
	target.cloudDensity *= scale;
	target.cloudDarkness *= scale;
	target.humidity *= scale;
	target.precipitation *= scale;
	target.fogDensity *= scale;
	target.windStrength *= scale;
	target.temperatureOffset *= scale;
	target.lightningProbability *= scale;
	target.overcast *= scale;
}

function combineInfluence(current: number, next: number): number {
	return clamp01(1 - (1 - clamp01(current)) * (1 - clamp01(next)));
}

function unitHash(seed: number, index: number, salt: number): number {
	return hashUint32(seed ^ Math.imul(index >>> 0, 0x9e3779b1) ^ salt) / 4294967296;
}

function randomRange(
	minimum: number,
	maximum: number,
	seed: number,
	index: number,
	salt: number
): number {
	return lerp(minimum, maximum, unitHash(seed, index, salt));
}

function sanitizeDurationScale(value: number | undefined): number {
	return Number.isFinite(value) && value !== undefined && value > 0 ? value : 1;
}

function nonNegative(value: number): number {
	return Number.isFinite(value) && value >= 0 ? value : 0;
}

function finiteUint32(value: number): number {
	return Number.isFinite(value) && value >= 0 ? value >>> 0 : 0;
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
