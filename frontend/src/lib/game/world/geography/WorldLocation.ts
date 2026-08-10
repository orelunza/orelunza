import type { SettlementAnchor } from './SettlementCatalog';
export interface WorldLocation {
	countryId: string;
	countryName: string;
	settlementId: string;
	settlementName: string;
	latitude: number;
	longitude: number;
	elevationMeters: number;
	worldAnchorId: string;
	biomeName?: string | null;
}
export function locationFromSettlement(
	settlement: SettlementAnchor,
	elevationMeters = 0
): WorldLocation {
	return {
		countryId: settlement.countryId,
		countryName: settlement.countryName,
		settlementId: settlement.id,
		settlementName: settlement.name,
		latitude: settlement.latitude,
		longitude: settlement.longitude,
		elevationMeters,
		worldAnchorId: settlement.id
	};
}
