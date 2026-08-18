import type { CountryBoundary } from '../../geography/countries/CountryBoundary';
import { cityRoadCenterlines } from '../CityGenerator';
import { URBAN_BUILDINGS } from '../civilization/UrbanBuildingRegistry';
import { knownSettlements, type SettlementAnchor } from '../geography/SettlementCatalog';
import type { WorldLocation } from '../geography/WorldLocation';
import type { TravelPlan } from '../travel/TravelPlan';
import { lodFeatures } from './MapLod';
import { BoundedCellCache, type MapCellKey, visibleCells } from './MapSpatialCells';
import type { GeographicBounds } from './WorldMapProjection';

export type MapFeatureType = 'settlement' | 'road' | 'building' | 'country';
export interface MapCoordinate {
	latitude: number;
	longitude: number;
}
export interface MapFeature {
	id: string;
	type: MapFeatureType;
	latitude: number;
	longitude: number;
	label?: string;
	source: 'generated' | 'geographic' | 'player';
	importance?: number;
	line?: readonly MapCoordinate[];
	footprint?: readonly MapCoordinate[];
	country?: CountryBoundary;
}
export interface MapQueryContext {
	plan: TravelPlan | null;
	player: WorldLocation | null;
}

/**
 * Cell-indexed adapter over data Orelunza actually owns.  Global terrain is
 * rendered from its geography-pack overview; country polygons come from the
 * country provider. Roads/buildings are intentionally limited to the active
 * CityGenerator template because no global road/building dataset exists.
 */
export class WorldMapDataProvider {
	private countries: readonly CountryBoundary[] = [];
	private readonly cache = new BoundedCellCache<MapFeature[]>(128);
	setCountries(countries: readonly CountryBoundary[]): void {
		this.countries = countries;
	}
	get cacheSize(): number {
		return this.cache.size;
	}
	query(bounds: GeographicBounds, zoom: number, context: MapQueryContext): MapFeature[] {
		const rules = lodFeatures(zoom);
		const cells = visibleCells(bounds, spatialLevel(zoom), 64);
		this.cache.retain(cells);
		const result: MapFeature[] = [];
		for (const cell of cells) {
			let features = this.cache.get(cell);
			if (!features) {
				features = this.featuresForCell(cell, context.player, rules.roads, rules.buildings);
				this.cache.set(cell, features);
			}
			result.push(
				...features.filter((feature) => contains(bounds, feature.latitude, feature.longitude))
			);
		}
		const localFeatures = prioritize(result, rules.maximumFeatures);
		if (!rules.countries) return localFeatures;

		// Country boundaries and labels are reference geography, not optional detail.
		// Keep every visible country outside the local-feature cap so a world view
		// never drops countries merely because settlements or generated geometry exist.
		return [...localFeatures, ...this.countryFeatures(bounds)];
	}
	private featuresForCell(
		cell: MapCellKey,
		player: WorldLocation | null,
		roads: boolean,
		buildings: boolean
	): MapFeature[] {
		const features = knownSettlements()
			.filter((settlement) => inCell(settlement.latitude, settlement.longitude, cell))
			.map(settlementFeature);
		if (!player || (!roads && !buildings) || !inCell(player.latitude, player.longitude, cell))
			return features;
		if (roads) features.push(...cityRoadFeatures(player));
		if (buildings) features.push(...cityBuildingFeatures(player));
		return features;
	}
	private countryFeatures(bounds: GeographicBounds): MapFeature[] {
		return this.countries
			.filter((country) => boundsIntersect(bounds, country.bounds))
			.map((country) => ({
				id: `country/${country.id}`,
				type: 'country',
				latitude: country.label[1],
				longitude: country.label[0],
				label: country.name,
				source: 'geographic',
				importance: 5,
				country
			}));
	}
}

function cityRoadFeatures(anchor: WorldLocation): MapFeature[] {
	return cityRoadCenterlines().map((line, index) => ({
		id: `city-road/${anchor.worldAnchorId}/${index}`,
		type: 'road',
		...toGeo(anchor, line[0].x, line[0].z),
		source: 'generated',
		importance: 40,
		line: line.map((point) => toGeo(anchor, point.x, point.z))
	}));
}
function cityBuildingFeatures(anchor: WorldLocation): MapFeature[] {
	return URBAN_BUILDINGS.map((building) => {
		const footprint = [
			[-building.halfWidth, -building.halfDepth],
			[building.halfWidth, -building.halfDepth],
			[building.halfWidth, building.halfDepth],
			[-building.halfWidth, building.halfDepth]
		].map(([x, z]) => toGeo(anchor, building.localX + x, building.localZ + z));
		return {
			id: `building/${anchor.worldAnchorId}/${building.id}`,
			type: 'building' as const,
			...toGeo(anchor, building.localX, building.localZ),
			label: building.label,
			source: 'generated' as const,
			importance: 30,
			footprint
		};
	});
}
function toGeo(anchor: WorldLocation, eastMeters: number, northMeters: number): MapCoordinate {
	return {
		latitude: anchor.latitude + northMeters / 111_320,
		longitude:
			anchor.longitude +
			eastMeters / Math.max(1, 111_320 * Math.cos((anchor.latitude * Math.PI) / 180))
	};
}
function settlementFeature(settlement: SettlementAnchor): MapFeature {
	return {
		id: settlement.id,
		type: 'settlement',
		latitude: settlement.latitude,
		longitude: settlement.longitude,
		label: settlement.name,
		source: 'generated',
		importance: settlement.type === 'city' ? 70 : 20
	};
}
function spatialLevel(zoom: number): number {
	return zoom < 5 ? 2 : zoom < 12 ? 5 : 9;
}
function contains(bounds: GeographicBounds, latitude: number, longitude: number): boolean {
	return (
		latitude >= bounds.south &&
		latitude <= bounds.north &&
		(bounds.west <= bounds.east
			? longitude >= bounds.west && longitude <= bounds.east
			: longitude >= bounds.west || longitude <= bounds.east)
	);
}
function inCell(latitude: number, longitude: number, cell: MapCellKey): boolean {
	const side = 2 ** cell.level;
	const x = Math.min(
		side - 1,
		Math.max(0, Math.floor((((((longitude + 180) % 360) + 360) % 360) / 360) * side))
	);
	const y = Math.min(side - 1, Math.max(0, Math.floor(((latitude + 90) / 180) * side)));
	return x === cell.x && y === cell.y;
}
function boundsIntersect(
	bounds: GeographicBounds,
	country: readonly [number, number, number, number]
): boolean {
	const [west, south, east, north] = country;
	if (north < bounds.south || south > bounds.north) return false;
	return bounds.west <= bounds.east
		? !(east < bounds.west || west > bounds.east)
		: east >= bounds.west || west <= bounds.east;
}
function prioritize(features: MapFeature[], cap: number): MapFeature[] {
	const unique = new Map<string, MapFeature>();
	for (const feature of features) if (!unique.has(feature.id)) unique.set(feature.id, feature);
	return [...unique.values()]
		.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || a.id.localeCompare(b.id))
		.slice(0, cap);
}
