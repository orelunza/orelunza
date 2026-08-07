import { CENTRAL_CITY_CENTER, type BlockCoordinate, type BlockType } from '../voxel-types';

export type UrbanBuildingKind = 'civic' | 'office' | 'hotel' | 'apartments' | 'residential';

export interface UrbanBuildingDefinition {
	id: string;
	label: string;
	kind: UrbanBuildingKind;
	localX: number;
	localZ: number;
	halfWidth: number;
	halfDepth: number;
	floors: number;
	floorHeight: number;
	wall: BlockType;
	accent: BlockType;
	hasElevator?: boolean;
}

/**
 * Shared civic lift layout. Keeping the shaft, landing doors and controls in
 * one registry prevents the generated tower, runtime lift and renderer from
 * drifting apart as the lobby evolves.
 */
export const CIVIC_ELEVATOR_LAYOUT = {
	shaftLocalX: 3,
	shaftLocalZ: 3,
	doorLocalX: 3,
	doorLocalZ: 4,
	callLocalX: 2,
	callLocalZ: 4,
	panelLocalX: 4,
	panelLocalZ: 4
} as const;

export const CIVIC_TOWER: UrbanBuildingDefinition = {
	id: 'civic-tower',
	label: 'Orelunza Civic Tower',
	kind: 'civic',
	localX: 0,
	localZ: 0,
	// Lot Ville 4.1: a tower floor should feel like a real lobby/office plate,
	// not a tiny room wrapped by a tall facade.
	halfWidth: 7,
	halfDepth: 7,
	floors: 15,
	floorHeight: 4,
	wall: 'concrete',
	accent: 'marble',
	hasElevator: true
};

export const URBAN_BUILDINGS: readonly UrbanBuildingDefinition[] = [
	CIVIC_TOWER,
	{
		id: 'west-office',
		label: 'West Offices',
		kind: 'office',
		localX: -14,
		localZ: -7,
		halfWidth: 6,
		halfDepth: 5,
		floors: 10,
		floorHeight: 4,
		wall: 'concrete',
		accent: 'brick'
	},
	{
		id: 'city-hotel',
		label: 'Orelunza Hotel',
		kind: 'hotel',
		localX: 14,
		localZ: -6,
		halfWidth: 6,
		halfDepth: 5,
		floors: 12,
		floorHeight: 4,
		wall: 'concrete',
		accent: 'marble'
	},
	{
		id: 'east-apartments',
		label: 'East Apartments',
		kind: 'apartments',
		localX: 14,
		localZ: 5,
		halfWidth: 6,
		halfDepth: 5,
		floors: 9,
		floorHeight: 4,
		wall: 'brick',
		accent: 'concrete'
	},
	{
		id: 'garden-residences',
		label: 'Garden Residences',
		kind: 'residential',
		localX: -14,
		localZ: 4,
		halfWidth: 6,
		halfDepth: 5,
		floors: 7,
		floorHeight: 4,
		wall: 'brick',
		accent: 'wooden_plank'
	}
];

export function buildingAtWorld(x: number, z: number): UrbanBuildingDefinition | null {
	const localX = Math.floor(x) - CENTRAL_CITY_CENTER.x;
	const localZ = Math.floor(z) - CENTRAL_CITY_CENTER.z;
	return (
		URBAN_BUILDINGS.find(
			(building) =>
				Math.abs(localX - building.localX) <= building.halfWidth &&
				Math.abs(localZ - building.localZ) <= building.halfDepth
		) ?? null
	);
}

export function buildingCenter(building: UrbanBuildingDefinition): { x: number; z: number } {
	return {
		x: CENTRAL_CITY_CENTER.x + building.localX,
		z: CENTRAL_CITY_CENTER.z + building.localZ
	};
}

export function buildingPowerPanelPosition(
	building: UrbanBuildingDefinition,
	groundY = 9
): BlockCoordinate {
	const center = buildingCenter(building);
	return { x: center.x - 2, y: groundY + 1, z: center.z + 1 };
}

export function buildingFloorBlockY(
	building: UrbanBuildingDefinition,
	groundY: number,
	floor: number
): number {
	return groundY + Math.max(0, floor - 1) * building.floorHeight;
}
