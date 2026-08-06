import type { LocalWaterForcing } from './LocalWaterState';

export interface ShallowWaterCellInitialization {
	groundHeight: number;
	waterDepth: number;
	sourceDepth?: number;
	velocityX?: number;
	velocityZ?: number;
	active?: boolean;
}

export interface ShallowWaterStepOptions {
	flowRate?: number;
	maximumTransferPerStep?: number;
	sourceRechargeRate?: number;
	allowBoundaryOutflow?: boolean;
	boundaryGroundAt?: (x: number, z: number) => number;
	boundaryWaterDepthAt?: (x: number, z: number) => number;
	worldOriginX?: number;
	worldOriginZ?: number;
	rainScale?: number;
	evaporationScale?: number;
}

export interface ShallowWaterStepResult {
	changedIndices: number[];
	rainAdded: number;
	evaporated: number;
	sourceInflow: number;
	boundaryOutflow: number;
	totalVolume: number;
	maximumDepth: number;
	maximumSpeed: number;
}

const WATER_EPSILON = 1e-5;
const MINIMUM_STORED_DEPTH = 1e-9;
const CHANGE_EPSILON = 1e-7;
const DEFAULT_FLOW_RATE = 2.8;
const DEFAULT_MAXIMUM_TRANSFER = 0.28;
const DEFAULT_SOURCE_RECHARGE = 0.04;

/**
 * Conservative, two-dimensional shallow-water approximation.
 *
 * The solver stores one water column per horizontal voxel cell. Fluxes are
 * computed from the hydraulic head (ground + water depth), accumulated into a
 * separate delta buffer, then applied together. That keeps the result
 * deterministic and prevents iteration order from creating or deleting water.
 */
export class ShallowWaterSolver {
	readonly groundHeight: Float64Array;
	readonly waterDepth: Float64Array;
	readonly sourceDepth: Float64Array;
	readonly velocityX: Float64Array;
	readonly velocityZ: Float64Array;
	readonly active: Uint8Array;

	private readonly depthDelta: Float64Array;
	private readonly momentumX: Float64Array;
	private readonly momentumZ: Float64Array;
	private readonly changedMask: Uint8Array;

	constructor(
		readonly width: number,
		readonly height: number,
		initialization?: readonly ShallowWaterCellInitialization[]
	) {
		if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
			throw new Error('Shallow-water dimensions must be positive integers.');
		}

		const length = width * height;
		this.groundHeight = new Float64Array(length);
		this.waterDepth = new Float64Array(length);
		this.sourceDepth = new Float64Array(length);
		this.velocityX = new Float64Array(length);
		this.velocityZ = new Float64Array(length);
		this.active = new Uint8Array(length);
		this.depthDelta = new Float64Array(length);
		this.momentumX = new Float64Array(length);
		this.momentumZ = new Float64Array(length);
		this.changedMask = new Uint8Array(length);

		for (let index = 0; index < length; index += 1) {
			const cell = initialization?.[index];
			this.groundHeight[index] = finiteOr(cell?.groundHeight, 0);
			this.waterDepth[index] = nonNegative(cell?.waterDepth);
			this.sourceDepth[index] = nonNegative(cell?.sourceDepth);
			this.velocityX[index] = finiteOr(cell?.velocityX, 0);
			this.velocityZ[index] = finiteOr(cell?.velocityZ, 0);
			this.active[index] = cell?.active === false ? 0 : 1;
		}
	}

	get length(): number {
		return this.width * this.height;
	}

	indexAt(x: number, z: number): number {
		if (x < 0 || x >= this.width || z < 0 || z >= this.height) {
			return -1;
		}

		return z * this.width + x;
	}

	setCell(index: number, cell: ShallowWaterCellInitialization): void {
		this.assertIndex(index);
		this.groundHeight[index] = finiteOr(cell.groundHeight, 0);
		this.waterDepth[index] = nonNegative(cell.waterDepth);
		this.sourceDepth[index] = nonNegative(cell.sourceDepth);
		this.velocityX[index] = finiteOr(cell.velocityX, 0);
		this.velocityZ[index] = finiteOr(cell.velocityZ, 0);
		this.active[index] = cell.active === false ? 0 : 1;
	}

	step(
		deltaSeconds: number,
		forcing: Readonly<LocalWaterForcing>,
		options: Readonly<ShallowWaterStepOptions> = {}
	): ShallowWaterStepResult {
		const dt = Math.max(0, Math.min(0.25, finiteOr(deltaSeconds, 0)));
		if (dt <= 0) {
			return this.inspect([]);
		}

		this.depthDelta.fill(0);
		this.momentumX.fill(0);
		this.momentumZ.fill(0);
		this.changedMask.fill(0);

		const flowRate = positiveOr(options.flowRate, DEFAULT_FLOW_RATE);
		const maximumTransfer = positiveOr(
			options.maximumTransferPerStep,
			DEFAULT_MAXIMUM_TRANSFER
		);
		const sourceRechargeRate = nonNegative(
			options.sourceRechargeRate ?? DEFAULT_SOURCE_RECHARGE
		);
		let boundaryOutflow = 0;

		for (let z = 0; z < this.height; z += 1) {
			for (let x = 0; x < this.width; x += 1) {
				const index = this.indexAt(x, z);
				if (!this.active[index]) {
					continue;
				}

				if (x + 1 < this.width) {
					this.transferPair(index, this.indexAt(x + 1, z), 1, 0, dt, flowRate, maximumTransfer);
				}

				if (z + 1 < this.height) {
					this.transferPair(index, this.indexAt(x, z + 1), 0, 1, dt, flowRate, maximumTransfer);
				}

				if (options.allowBoundaryOutflow) {
					boundaryOutflow += this.transferBoundary(
						index,
						x,
						z,
						dt,
						flowRate,
						maximumTransfer,
						options
					);
				}
			}
		}

		const rainRate = rainDepthPerSecond(forcing) * nonNegative(options.rainScale ?? 1);
		const evaporationRate =
			evaporationDepthPerSecond(forcing) * nonNegative(options.evaporationScale ?? 1);
		let rainAdded = 0;
		let evaporated = 0;
		let sourceInflow = 0;
		const changedIndices: number[] = [];

		for (let index = 0; index < this.length; index += 1) {
			if (!this.active[index]) {
				continue;
			}

			const oldDepth = this.waterDepth[index];
			let nextDepth = Math.max(0, oldDepth + this.depthDelta[index]);

			if (rainRate > 0) {
				const added = rainRate * dt;
				nextDepth += added;
				rainAdded += added;
			}

			if (evaporationRate > 0 && nextDepth > 0) {
				const removed = Math.min(nextDepth, evaporationRate * dt);
				nextDepth -= removed;
				evaporated += removed;
			}

			const baseline = this.sourceDepth[index];
			if (baseline > nextDepth && sourceRechargeRate > 0) {
				const recharge = Math.min(baseline - nextDepth, sourceRechargeRate * dt);
				nextDepth += recharge;
				sourceInflow += recharge;
			}

			if (!Number.isFinite(nextDepth) || nextDepth < MINIMUM_STORED_DEPTH) {
				nextDepth = 0;
			}

			this.waterDepth[index] = nextDepth;
			const denominator = Math.max(nextDepth, 0.05) * Math.max(dt, 1e-6);
			const targetVelocityX = this.momentumX[index] / denominator;
			const targetVelocityZ = this.momentumZ[index] / denominator;
			const damping = Math.exp(-dt * 4.2);
			this.velocityX[index] = finiteOr(
				this.velocityX[index] * damping + targetVelocityX * (1 - damping),
				0
			);
			this.velocityZ[index] = finiteOr(
				this.velocityZ[index] * damping + targetVelocityZ * (1 - damping),
				0
			);

			if (this.changedMask[index] || Math.abs(nextDepth - oldDepth) >= CHANGE_EPSILON) {
				changedIndices.push(index);
			}
		}

		return {
			...this.inspect(changedIndices),
			rainAdded,
			evaporated,
			sourceInflow,
			boundaryOutflow
		};
	}

	private transferPair(
		leftIndex: number,
		rightIndex: number,
		directionX: number,
		directionZ: number,
		dt: number,
		flowRate: number,
		maximumTransfer: number
	): void {
		if (!this.active[leftIndex] || !this.active[rightIndex]) {
			return;
		}

		const leftDepth = Math.max(0, this.waterDepth[leftIndex] + this.depthDelta[leftIndex]);
		const rightDepth = Math.max(0, this.waterDepth[rightIndex] + this.depthDelta[rightIndex]);
		const leftSurface = this.groundHeight[leftIndex] + leftDepth;
		const rightSurface = this.groundHeight[rightIndex] + rightDepth;
		const difference = leftSurface - rightSurface;

		if (Math.abs(difference) <= WATER_EPSILON) {
			return;
		}

		const sourceIndex = difference > 0 ? leftIndex : rightIndex;
		const destinationIndex = difference > 0 ? rightIndex : leftIndex;
		const sign = difference > 0 ? 1 : -1;
		const sourceSurface = difference > 0 ? leftSurface : rightSurface;
		const destinationSurface = difference > 0 ? rightSurface : leftSurface;
		const barrierHeight = Math.max(
			this.groundHeight[sourceIndex],
			this.groundHeight[destinationIndex]
		);
		const overflowHead = sourceSurface - Math.max(destinationSurface, barrierHeight);

		if (overflowHead <= WATER_EPSILON) {
			return;
		}

		const available = Math.max(0, sourceSurface - barrierHeight);
		const remainingDepth = Math.max(
			0,
			this.waterDepth[sourceIndex] + this.depthDelta[sourceIndex]
		);
		const transfer = Math.min(
			remainingDepth,
			available,
			overflowHead * flowRate * dt,
			maximumTransfer
		);

		if (transfer <= WATER_EPSILON) {
			return;
		}

		this.depthDelta[sourceIndex] -= transfer;
		this.depthDelta[destinationIndex] += transfer;
		this.changedMask[sourceIndex] = 1;
		this.changedMask[destinationIndex] = 1;

		const signedX = directionX * sign;
		const signedZ = directionZ * sign;
		this.momentumX[sourceIndex] += signedX * transfer;
		this.momentumZ[sourceIndex] += signedZ * transfer;
		this.momentumX[destinationIndex] += signedX * transfer;
		this.momentumZ[destinationIndex] += signedZ * transfer;
	}

	private transferBoundary(
		index: number,
		x: number,
		z: number,
		dt: number,
		flowRate: number,
		maximumTransfer: number,
		options: Readonly<ShallowWaterStepOptions>
	): number {
		let outflow = 0;
		const worldX = (options.worldOriginX ?? 0) + x;
		const worldZ = (options.worldOriginZ ?? 0) + z;
		const directions: Array<readonly [number, number]> = [];

		if (x === 0) directions.push([-1, 0]);
		if (x === this.width - 1) directions.push([1, 0]);
		if (z === 0) directions.push([0, -1]);
		if (z === this.height - 1) directions.push([0, 1]);

		for (const [dx, dz] of directions) {
			const outsideX = worldX + dx;
			const outsideZ = worldZ + dz;
			const outsideGround = finiteOr(
				options.boundaryGroundAt?.(outsideX, outsideZ),
				this.groundHeight[index]
			);
			const outsideDepth = nonNegative(
				options.boundaryWaterDepthAt?.(outsideX, outsideZ)
			);
			const remainingDepth = Math.max(
				0,
				this.waterDepth[index] + this.depthDelta[index]
			);
			const insideSurface = this.groundHeight[index] + remainingDepth;
			const outsideSurface = outsideGround + outsideDepth;
			const barrierHeight = Math.max(this.groundHeight[index], outsideGround);
			const overflowHead = insideSurface - Math.max(outsideSurface, barrierHeight);

			if (overflowHead <= WATER_EPSILON) {
				continue;
			}

			const available = Math.max(0, insideSurface - barrierHeight);
			const transfer = Math.min(
				remainingDepth,
				available,
				overflowHead * flowRate * dt,
				maximumTransfer
			);

			if (transfer <= WATER_EPSILON) {
				continue;
			}

			this.depthDelta[index] -= transfer;
			this.changedMask[index] = 1;
			this.momentumX[index] += dx * transfer;
			this.momentumZ[index] += dz * transfer;
			outflow += transfer;
		}

		return outflow;
	}

	private inspect(changedIndices: number[]): ShallowWaterStepResult {
		let totalVolume = 0;
		let maximumDepth = 0;
		let maximumSpeed = 0;

		for (let index = 0; index < this.length; index += 1) {
			if (!this.active[index]) {
				continue;
			}

			const depth = nonNegative(this.waterDepth[index]);
			const speed = Math.hypot(this.velocityX[index], this.velocityZ[index]);
			totalVolume += depth;
			maximumDepth = Math.max(maximumDepth, depth);
			maximumSpeed = Math.max(maximumSpeed, Number.isFinite(speed) ? speed : 0);
		}

		return {
			changedIndices,
			rainAdded: 0,
			evaporated: 0,
			sourceInflow: 0,
			boundaryOutflow: 0,
			totalVolume,
			maximumDepth,
			maximumSpeed
		};
	}

	private assertIndex(index: number): void {
		if (!Number.isInteger(index) || index < 0 || index >= this.length) {
			throw new Error(`Invalid shallow-water cell index: ${index}`);
		}
	}
}

export function rainDepthPerSecond(forcing: Readonly<LocalWaterForcing>): number {
	const precipitation = forcing.precipitationType;
	if (precipitation !== 'rain' && precipitation !== 'mixed') {
		return 0;
	}

	const exposed = 1 - clamp01(forcing.rainShelter);
	return clamp01(forcing.rainIntensity) * exposed * 0.00008;
}

export function evaporationDepthPerSecond(forcing: Readonly<LocalWaterForcing>): number {
	const temperature = Math.max(-20, Math.min(55, finiteOr(forcing.temperatureCelsius, 18)));
	const warmth = clamp01((temperature + 5) / 40);
	const dryness = 1 - clamp01(forcing.humidity);
	const sunlight = clamp01(forcing.daylight);
	const wind = clamp01(forcing.windStrength);

	return 0.0000001 +
		warmth * (0.00000045 + sunlight * 0.0000011 + dryness * 0.00000055 + wind * 0.00000035);
}

function finiteOr(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? (value as number) : fallback;
}

function nonNegative(value: number | undefined): number {
	return Math.max(0, finiteOr(value, 0));
}

function positiveOr(value: number | undefined, fallback: number): number {
	const finite = finiteOr(value, fallback);
	return finite > 0 ? finite : fallback;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
