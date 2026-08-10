import { describe, expect, it } from 'vitest';
import { createTravelPlan } from './TravelPlan';

const a = {
	countryId: 'a',
	countryName: 'A',
	settlementId: 'a',
	settlementName: 'A',
	latitude: 0,
	longitude: 0,
	elevationMeters: 0,
	worldAnchorId: 'a'
};
const b = {
	...a,
	countryId: 'b',
	countryName: 'B',
	settlementId: 'b',
	settlementName: 'B',
	longitude: 2,
	worldAnchorId: 'b'
};
describe('RoutePlan', () => {
	it('starts planned without moving either location', () => {
		const plan = createTravelPlan(a, b, 222);
		expect(plan.origin).toEqual(a);
		expect(plan.destination).toEqual(b);
		expect(plan.status).toBe('planned');
		expect(plan.remainingDistanceKm).toBe(plan.totalDistanceKm);
		expect(plan.progress).toBe(0);
		expect(plan.segments[0]?.distanceKm).toBe(222);
	});
});
