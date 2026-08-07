/** Lightweight world queries used by weather effects without owning the voxel world. */
export interface WeatherWorldQuery {
	/** Returns the highest solid surface at or below maxY, or null when unavailable. */
	surfaceHeightAt(x: number, z: number, maxY: number): number | null;
	/** Returns rain occlusion in [0, 1] above the sample point. */
	rainOcclusionAt(x: number, y: number, z: number): number;
	/** Horizontal/vertical openness around the listener in [0, 1]. */
	opennessAt?(x: number, y: number, z: number): number;
	/** Optional local biome/zone name used by the climate system. */
	climateZoneAt?(x: number, z: number): string;
}
