import type { MiniMapCell, MiniMapSnapshot } from '../../game-types';

export interface LocalMapPathPoint {
	x: number;
	z: number;
}

export interface LocalMapTarget {
	x: number;
	z: number;
	inside: boolean;
}

export function localMapTarget(
	map: Pick<MiniMapSnapshot, 'size' | 'cellSizeMeters'>,
	eastMeters: number,
	northMeters: number
): LocalMapTarget {
	const centre = (map.size - 1) / 2;
	const rawX = centre + eastMeters / map.cellSizeMeters;
	const rawZ = centre + northMeters / map.cellSizeMeters;
	const edge = Math.max(1, centre - 1);
	const dx = rawX - centre;
	const dz = rawZ - centre;
	const inside = Math.abs(dx) <= edge && Math.abs(dz) <= edge;
	if (inside) return { x: Math.round(rawX), z: Math.round(rawZ), inside: true };
	const scale = edge / Math.max(Math.abs(dx), Math.abs(dz), 1e-9);
	return {
		x: Math.round(centre + dx * scale),
		z: Math.round(centre + dz * scale),
		inside: false
	};
}

export function findLocalMapPath(
	map: Pick<MiniMapSnapshot, 'size' | 'cells'>,
	target: Readonly<LocalMapTarget>
): LocalMapPathPoint[] {
	const size = map.size;
	if (!Number.isInteger(size) || size <= 0) return [];
	const cells = new Map<number, MiniMapCell>();
	for (const cell of map.cells) cells.set(cell.z * size + cell.x, cell);
	const start = { x: Math.floor(size / 2), z: Math.floor(size / 2) };
	const goal = nearestLand(cells, size, target.x, target.z);
	if (!goal) return [];
	const startKey = start.z * size + start.x;
	const goalKey = goal.z * size + goal.x;
	if (!cells.has(startKey) || !cells.has(goalKey)) return [];

	const open = new Set<number>([startKey]);
	const cameFrom = new Map<number, number>();
	const g = new Map<number, number>([[startKey, 0]]);
	const f = new Map<number, number>([[startKey, heuristic(start.x, start.z, goal.x, goal.z)]]);

	while (open.size > 0) {
		let current = -1;
		let best = Number.POSITIVE_INFINITY;
		for (const key of open) {
			const score = f.get(key) ?? Number.POSITIVE_INFINITY;
			if (score < best) {
				best = score;
				current = key;
			}
		}
		if (current < 0) break;
		if (current === goalKey) return reconstruct(cameFrom, current, size);
		open.delete(current);
		const cx = current % size;
		const cz = Math.floor(current / size);
		const currentCell = cells.get(current)!;
		for (const [dx, dz] of NEIGHBOURS) {
			const nx = cx + dx;
			const nz = cz + dz;
			if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
			const key = nz * size + nx;
			const next = cells.get(key);
			if (!next || next.terrain === 'water') continue;
			const diagonal = dx !== 0 && dz !== 0;
			const elevationPenalty = Math.min(
				4,
				Math.abs((next.elevationMeters ?? 0) - (currentCell.elevationMeters ?? 0)) / 20
			);
			const tentative =
				(g.get(current) ?? Number.POSITIVE_INFINITY) +
				(diagonal ? Math.SQRT2 : 1) +
				elevationPenalty;
			if (tentative >= (g.get(key) ?? Number.POSITIVE_INFINITY)) continue;
			cameFrom.set(key, current);
			g.set(key, tentative);
			f.set(key, tentative + heuristic(nx, nz, goal.x, goal.z));
			open.add(key);
		}
	}
	return [];
}

function nearestLand(
	cells: ReadonlyMap<number, MiniMapCell>,
	size: number,
	x: number,
	z: number
): LocalMapPathPoint | null {
	const clampedX = Math.max(0, Math.min(size - 1, Math.round(x)));
	const clampedZ = Math.max(0, Math.min(size - 1, Math.round(z)));
	for (let radius = 0; radius <= 5; radius += 1) {
		for (let dz = -radius; dz <= radius; dz += 1) {
			for (let dx = -radius; dx <= radius; dx += 1) {
				if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
				const nx = clampedX + dx;
				const nz = clampedZ + dz;
				if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
				const cell = cells.get(nz * size + nx);
				if (cell?.terrain === 'land') return { x: nx, z: nz };
			}
		}
	}
	return null;
}

function reconstruct(cameFrom: ReadonlyMap<number, number>, goal: number, size: number) {
	const keys = [goal];
	let current = goal;
	while (cameFrom.has(current)) {
		current = cameFrom.get(current)!;
		keys.push(current);
	}
	keys.reverse();
	return keys.map((key) => ({ x: key % size, z: Math.floor(key / size) }));
}

function heuristic(ax: number, az: number, bx: number, bz: number): number {
	return Math.hypot(bx - ax, bz - az);
}

const NEIGHBOURS = [
	[-1, -1],
	[0, -1],
	[1, -1],
	[-1, 0],
	[1, 0],
	[-1, 1],
	[0, 1],
	[1, 1]
] as const;
