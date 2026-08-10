import type { GeographicBounds } from './WorldMapProjection';

export interface MapCellKey {
	level: number;
	x: number;
	y: number;
}

export function cellKey(cell: Readonly<MapCellKey>): string {
	return `${cell.level}/${cell.x}/${cell.y}`;
}

/** Deterministic equirectangular cells, including an explicit date-line split. */
export function visibleCells(
	bounds: Readonly<GeographicBounds>,
	level: number,
	cap = 96
): MapCellKey[] {
	const safeLevel = Math.max(0, Math.min(12, Math.trunc(level)));
	const side = 2 ** safeLevel;
	const south = Math.max(-90, Math.min(90, bounds.south));
	const north = Math.max(-90, Math.min(90, bounds.north));
	const y0 = latitudeCell(south, side);
	const y1 = latitudeCell(north, side);
	const spans =
		bounds.west <= bounds.east
			? [[bounds.west, bounds.east]]
			: [
					[bounds.west, 180],
					[-180, bounds.east]
				];
	const result: MapCellKey[] = [];
	for (const [west, east] of spans) {
		for (let x = longitudeCell(west, side); x <= longitudeCell(east, side); x += 1) {
			for (let y = y0; y <= y1; y += 1) {
				if (result.length >= cap) return result;
				result.push({ level: safeLevel, x: ((x % side) + side) % side, y });
			}
		}
	}
	return deduplicate(result);
}

export class BoundedCellCache<T> {
	private readonly entries = new Map<string, { cell: MapCellKey; value: T; used: number }>();
	private clock = 0;
	constructor(private readonly maximumEntries = 128) {}
	get(cell: Readonly<MapCellKey>): T | undefined {
		const entry = this.entries.get(cellKey(cell));
		if (entry) entry.used = ++this.clock;
		return entry?.value;
	}
	set(cell: Readonly<MapCellKey>, value: T): void {
		this.entries.set(cellKey(cell), { cell: { ...cell }, value, used: ++this.clock });
		this.evict();
	}
	retain(visible: readonly MapCellKey[]): void {
		const wanted = new Set(visible.map(cellKey));
		for (const [key, entry] of this.entries)
			if (!wanted.has(key) && this.entries.size > this.maximumEntries / 2) this.entries.delete(key);
		this.evict();
	}
	get size(): number {
		return this.entries.size;
	}
	private evict(): void {
		while (this.entries.size > this.maximumEntries) {
			let oldest: string | null = null;
			let oldestUse = Infinity;
			for (const [key, entry] of this.entries)
				if (entry.used < oldestUse) {
					oldest = key;
					oldestUse = entry.used;
				}
			if (oldest) this.entries.delete(oldest);
			else return;
		}
	}
}
function longitudeCell(longitude: number, side: number): number {
	if (longitude >= 180) return side - 1;
	if (longitude <= -180) return 0;
	return Math.min(
		side - 1,
		Math.max(0, Math.floor((((((longitude + 180) % 360) + 360) % 360) / 360) * side))
	);
}
function latitudeCell(latitude: number, side: number): number {
	return Math.min(side - 1, Math.max(0, Math.floor(((latitude + 90) / 180) * side)));
}
function deduplicate(cells: MapCellKey[]): MapCellKey[] {
	const known = new Set<string>();
	return cells.filter((cell) => {
		const key = cellKey(cell);
		if (known.has(key)) return false;
		known.add(key);
		return true;
	});
}
