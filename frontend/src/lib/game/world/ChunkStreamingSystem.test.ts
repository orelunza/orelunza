import { describe, expect, test } from 'vitest';
import { ChunkStreamingSystem } from './ChunkStreamingSystem';
import type { ChunkCoordinate } from './voxel-types';

describe('ChunkStreamingSystem frame-budgeted requests', () => {
	test('deduplicates requests and performs no more than the configured jobs per update', () => {
		const loaded: ChunkCoordinate[] = [];
		const streaming = new ChunkStreamingSystem({
			visibleRadius: 1,
			retainRadius: 2,
			maxLoadsPerUpdate: 1,
			loadChunk: (chunk) => {
				loaded.push({ ...chunk });
			},
			unloadChunk: () => undefined
		});

		streaming.update({ x: 0, z: 0 });
		expect(loaded).toEqual([{ x: 0, z: 0 }]);
		expect(streaming.snapshot.pendingLoads).toBe(8);

		streaming.update({ x: 0, z: 0 });
		expect(loaded).toHaveLength(2);
		expect(new Set(loaded.map((chunk) => `${chunk.x},${chunk.z}`)).size).toBe(2);
	});

	test('rebuilds a bounded queue and retains a forward prefetch strip after crossing a chunk', () => {
		const streaming = new ChunkStreamingSystem({
			visibleRadius: 1,
			retainRadius: 2,
			maxLoadsPerUpdate: 1,
			loadChunk: () => undefined,
			unloadChunk: () => undefined
		});

		streaming.update({ x: 0, z: 0 });
		streaming.update({ x: 16, z: 0 });

		// 3×3 immediately-required chunks plus a 3-chunk strip one chunk ahead.
		expect(streaming.snapshot.pendingLoads).toBeLessThanOrEqual(11);
		expect(streaming.snapshot.prefetching).toBeGreaterThan(0);
	});
});
