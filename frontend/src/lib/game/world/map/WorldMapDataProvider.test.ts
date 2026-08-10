import { describe, expect, it } from 'vitest';
import { cityRoadCenterlines } from '../CityGenerator';
import { URBAN_BUILDINGS } from '../civilization/UrbanBuildingRegistry';
import { WorldMapDataProvider } from './WorldMapDataProvider';

const player = {
	countryId: 'UGA',
	countryName: 'Uganda',
	settlementId: 'ug-kampala',
	settlementName: 'Kampala',
	latitude: 0.3476,
	longitude: 32.5825,
	elevationMeters: 0,
	worldAnchorId: 'ug-kampala'
};
const bounds = { west: 32.57, east: 32.6, south: 0.33, north: 0.37 };
describe('WorldMapDataProvider', () => {
	it('uses the CityGenerator and UrbanBuildingRegistry geometry, not another random city', () => {
		const provider = new WorldMapDataProvider();
		const features = provider.query(bounds, 13, { player, plan: null });
		expect(features.filter((feature) => feature.type === 'road')).toHaveLength(
			cityRoadCenterlines().length
		);
		expect(features.filter((feature) => feature.type === 'building')).toHaveLength(
			URBAN_BUILDINGS.length
		);
	});
	it('does not issue building features at far zoom and remains bounded', () => {
		const provider = new WorldMapDataProvider();
		const far = provider.query({ west: -180, east: 180, south: -85, north: 85 }, 3, {
			player,
			plan: null
		});
		expect(far.some((feature) => feature.type === 'building')).toBe(false);
		expect(far.length).toBeLessThanOrEqual(80);
		expect(provider.cacheSize).toBeLessThanOrEqual(128);
	});
});
