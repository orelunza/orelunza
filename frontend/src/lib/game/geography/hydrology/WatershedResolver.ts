export interface WatershedInput {
	resolution: number;
	halfExtentMeters: number;
	elevationMeters: ArrayLike<number>;
	landMask: ArrayLike<number>;
	runoff?: ArrayLike<number>;
	riverThreshold?: number;
	minimumLakeDepthMeters?: number;
	minimumWaterfallDropMeters?: number;
}

export interface WatershedGrid {
	resolution: number;
	halfExtentMeters: number;
	cellSizeMeters: number;
	filledElevationMeters: Float32Array;
	flowTo: Int32Array;
	flowAccumulation: Float32Array;
	basinId: Int32Array;
	riverStrength: Float32Array;
	lakeDepthMeters: Float32Array;
	waterfallDropMeters: Float32Array;
	oceanConnected: Uint8Array;
	riverMouth: Uint8Array;
	maximumAccumulation: number;
}

interface HeapEntry {
	index: number;
	elevation: number;
}

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = Object.freeze([
	[-1, -1],
	[0, -1],
	[1, -1],
	[-1, 0],
	[1, 0],
	[-1, 1],
	[0, 1],
	[1, 1]
]);

/**
 * Deterministic priority-flood and D8 watershed resolver.
 * Depressions are filled only for drainage routing; the difference from the
 * source relief becomes the lake depth used by the local terrain generator.
 */
export class WatershedResolver {
	resolve(input: Readonly<WatershedInput>): WatershedGrid {
		validateInput(input);
		const count = input.resolution * input.resolution;
		const elevation = copyFinite(input.elevationMeters, count);
		const land = normalizeLandMask(input.landMask, count);
		const runoff = normalizeRunoff(input.runoff, land, count);
		const filled = elevation.slice();
		const floodRank = new Int32Array(count);
		floodRank.fill(-1);
		const visited = new Uint8Array(count);
		const heap = new MinimumHeap();
		let nextRank = 0;

		for (let index = 0; index < count; index += 1) {
			const { x, y } = coordinateOf(index, input.resolution);
			if (land[index] === 0 || isBoundary(x, y, input.resolution)) {
				visited[index] = 1;
				heap.push({ index, elevation: filled[index] ?? 0 });
			}
		}

		while (heap.size > 0) {
			const current = heap.pop();
			if (!current) break;
			if (floodRank[current.index] >= 0) continue;
			floodRank[current.index] = nextRank++;
			const { x, y } = coordinateOf(current.index, input.resolution);
			for (const [offsetX, offsetY] of NEIGHBOURS) {
				const neighbourX = x + offsetX;
				const neighbourY = y + offsetY;
				if (!inside(neighbourX, neighbourY, input.resolution)) continue;
				const neighbour = neighbourY * input.resolution + neighbourX;
				if (visited[neighbour] === 1) continue;
				visited[neighbour] = 1;
				filled[neighbour] = Math.max(elevation[neighbour] ?? 0, current.elevation);
				heap.push({ index: neighbour, elevation: filled[neighbour] ?? 0 });
			}
		}

		const flowTo = new Int32Array(count);
		flowTo.fill(-1);
		for (let index = 0; index < count; index += 1) {
			if (land[index] === 0) continue;
			const { x, y } = coordinateOf(index, input.resolution);
			const currentElevation = filled[index] ?? 0;
			let best = -1;
			let bestSlope = 0;
			let bestRank = floodRank[index] ?? Number.MAX_SAFE_INTEGER;
			for (const [offsetX, offsetY] of NEIGHBOURS) {
				const neighbourX = x + offsetX;
				const neighbourY = y + offsetY;
				if (!inside(neighbourX, neighbourY, input.resolution)) continue;
				const neighbour = neighbourY * input.resolution + neighbourX;
				const neighbourElevation = filled[neighbour] ?? 0;
				const neighbourRank = floodRank[neighbour] ?? Number.MAX_SAFE_INTEGER;
				const drop = currentElevation - neighbourElevation;
				const distance = offsetX !== 0 && offsetY !== 0 ? Math.SQRT2 : 1;
				const slope = drop > 1e-6 ? drop / distance : 0;
				const steeper = slope > bestSlope + 1e-9;
				const equalSlopeLowerRank =
					Math.abs(slope - bestSlope) <= 1e-9 && slope > 0 && neighbourRank < bestRank;
				const drainsPlateau =
					bestSlope <= 1e-9 && Math.abs(drop) <= 1e-6 && neighbourRank < bestRank;
				if (steeper || equalSlopeLowerRank || drainsPlateau) {
					best = neighbour;
					bestSlope = slope;
					bestRank = neighbourRank;
				}
			}
			flowTo[index] = best;
		}

		const accumulation = runoff.slice();
		const incoming = new Int32Array(count);
		for (let index = 0; index < count; index += 1) {
			const downstream = flowTo[index] ?? -1;
			if (downstream >= 0) incoming[downstream] += 1;
		}
		const queue = new Int32Array(count);
		let queueRead = 0;
		let queueWrite = 0;
		for (let index = 0; index < count; index += 1) {
			if (land[index] === 1 && incoming[index] === 0) queue[queueWrite++] = index;
		}
		while (queueRead < queueWrite) {
			const index = queue[queueRead++] ?? -1;
			if (index < 0) continue;
			const downstream = flowTo[index] ?? -1;
			if (downstream < 0) continue;
			accumulation[downstream] += accumulation[index] ?? 0;
			incoming[downstream] -= 1;
			if (land[downstream] === 1 && incoming[downstream] === 0) {
				queue[queueWrite++] = downstream;
			}
		}

		let maximumAccumulation = 0;
		for (let index = 0; index < count; index += 1) {
			if (land[index] === 1)
				maximumAccumulation = Math.max(maximumAccumulation, accumulation[index] ?? 0);
		}
		const threshold = Math.max(1, input.riverThreshold ?? Math.max(8, input.resolution * 0.22));
		const riverStrength = new Float32Array(count);
		const denominator = Math.max(1e-6, Math.sqrt(maximumAccumulation) - Math.sqrt(threshold));
		for (let index = 0; index < count; index += 1) {
			if (land[index] === 0 || (accumulation[index] ?? 0) < threshold) continue;
			riverStrength[index] = clamp01(
				(Math.sqrt(accumulation[index] ?? 0) - Math.sqrt(threshold)) / denominator
			);
		}

		const minimumLakeDepth = Math.max(0, input.minimumLakeDepthMeters ?? 0.75);
		const lakeDepth = new Float32Array(count);
		for (let index = 0; index < count; index += 1) {
			if (land[index] === 0) continue;
			const depth = Math.max(0, (filled[index] ?? 0) - (elevation[index] ?? 0));
			lakeDepth[index] = depth >= minimumLakeDepth ? depth : 0;
		}

		const minimumWaterfallDrop = Math.max(0, input.minimumWaterfallDropMeters ?? 3.5);
		const waterfallDrop = new Float32Array(count);
		const riverMouth = new Uint8Array(count);
		for (let index = 0; index < count; index += 1) {
			const downstream = flowTo[index] ?? -1;
			if (downstream < 0 || riverStrength[index] <= 0) continue;
			if (land[downstream] === 0) riverMouth[index] = 1;
			const drop = Math.max(0, (elevation[index] ?? 0) - (elevation[downstream] ?? 0));
			if (drop >= minimumWaterfallDrop) waterfallDrop[index] = drop;
		}

		const basinId = new Int32Array(count);
		basinId.fill(-1);
		const oceanConnected = new Uint8Array(count);
		for (let index = 0; index < count; index += 1) {
			if (land[index] === 0) continue;
			resolveBasin(index, flowTo, land, basinId, oceanConnected);
		}

		return {
			resolution: input.resolution,
			halfExtentMeters: input.halfExtentMeters,
			cellSizeMeters: (input.halfExtentMeters * 2) / Math.max(1, input.resolution - 1),
			filledElevationMeters: filled,
			flowTo,
			flowAccumulation: accumulation,
			basinId,
			riverStrength,
			lakeDepthMeters: lakeDepth,
			waterfallDropMeters: waterfallDrop,
			oceanConnected,
			riverMouth,
			maximumAccumulation
		};
	}
}

function resolveBasin(
	start: number,
	flowTo: Int32Array,
	land: Uint8Array,
	basinId: Int32Array,
	oceanConnected: Uint8Array
): void {
	const path: number[] = [];
	const seen = new Set<number>();
	let current = start;
	let outlet = start;
	let connected = false;

	while (current >= 0 && land[current] === 1) {
		if (basinId[current] >= 0) {
			outlet = basinId[current] ?? current;
			connected = oceanConnected[current] === 1;
			break;
		}
		if (seen.has(current)) {
			outlet = current;
			break;
		}
		seen.add(current);
		path.push(current);
		const downstream = flowTo[current] ?? -1;
		if (downstream < 0) {
			outlet = current;
			break;
		}
		if (land[downstream] === 0) {
			outlet = downstream;
			connected = true;
			break;
		}
		current = downstream;
	}

	for (const index of path) {
		basinId[index] = outlet;
		oceanConnected[index] = connected ? 1 : 0;
	}
}

function validateInput(input: Readonly<WatershedInput>): void {
	const count = input.resolution * input.resolution;
	if (
		!Number.isInteger(input.resolution) ||
		input.resolution < 3 ||
		input.resolution > 257 ||
		!Number.isFinite(input.halfExtentMeters) ||
		input.halfExtentMeters <= 0 ||
		input.elevationMeters.length !== count ||
		input.landMask.length !== count ||
		(input.runoff !== undefined && input.runoff.length !== count)
	) {
		throw new TypeError('Invalid watershed input grid.');
	}
}

function copyFinite(values: ArrayLike<number>, count: number): Float32Array {
	const result = new Float32Array(count);
	for (let index = 0; index < count; index += 1) {
		const value = values[index] ?? 0;
		result[index] = Number.isFinite(value) ? value : 0;
	}
	return result;
}

function normalizeLandMask(values: ArrayLike<number>, count: number): Uint8Array {
	const result = new Uint8Array(count);
	for (let index = 0; index < count; index += 1) {
		result[index] = (values[index] ?? 0) >= 0.5 ? 1 : 0;
	}
	return result;
}

function normalizeRunoff(
	values: ArrayLike<number> | undefined,
	land: Uint8Array,
	count: number
): Float32Array {
	const result = new Float32Array(count);
	for (let index = 0; index < count; index += 1) {
		if (land[index] === 0) continue;
		const value = values?.[index] ?? 1;
		result[index] = Math.max(0.01, Number.isFinite(value) ? value : 1);
	}
	return result;
}

function coordinateOf(index: number, resolution: number): { x: number; y: number } {
	return { x: index % resolution, y: Math.floor(index / resolution) };
}

function isBoundary(x: number, y: number, resolution: number): boolean {
	return x === 0 || y === 0 || x === resolution - 1 || y === resolution - 1;
}

function inside(x: number, y: number, resolution: number): boolean {
	return x >= 0 && y >= 0 && x < resolution && y < resolution;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

class MinimumHeap {
	private readonly entries: HeapEntry[] = [];

	get size(): number {
		return this.entries.length;
	}

	push(entry: HeapEntry): void {
		this.entries.push(entry);
		let index = this.entries.length - 1;
		while (index > 0) {
			const parent = Math.floor((index - 1) / 2);
			if (this.compare(this.entries[parent], entry) <= 0) break;
			this.entries[index] = this.entries[parent] as HeapEntry;
			index = parent;
		}
		this.entries[index] = entry;
	}

	pop(): HeapEntry | null {
		const root = this.entries[0];
		const tail = this.entries.pop();
		if (!root || !tail || this.entries.length === 0) return root ?? null;
		let index = 0;
		while (true) {
			const left = index * 2 + 1;
			const right = left + 1;
			if (left >= this.entries.length) break;
			let child = left;
			if (
				right < this.entries.length &&
				this.compare(this.entries[right], this.entries[left]) < 0
			) {
				child = right;
			}
			if (this.compare(this.entries[child], tail) >= 0) break;
			this.entries[index] = this.entries[child] as HeapEntry;
			index = child;
		}
		this.entries[index] = tail;
		return root;
	}

	private compare(left: HeapEntry | undefined, right: HeapEntry | undefined): number {
		if (!left) return 1;
		if (!right) return -1;
		return left.elevation - right.elevation || left.index - right.index;
	}
}
