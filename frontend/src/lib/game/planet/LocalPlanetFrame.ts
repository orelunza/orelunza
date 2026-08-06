import { Vector3 } from 'three';
import type { GeodeticCoordinate } from './GeodeticCoordinate';

export interface LocalPlanetFrame {
	east: Vector3;
	north: Vector3;
	up: Vector3;
}

export function createLocalPlanetFrame(
	coordinate: Readonly<Pick<GeodeticCoordinate, 'latitudeRadians' | 'longitudeRadians'>>
): LocalPlanetFrame {
	const latitude = coordinate.latitudeRadians;
	const longitude = coordinate.longitudeRadians;
	const sinLatitude = Math.sin(latitude);
	const cosLatitude = Math.cos(latitude);
	const sinLongitude = Math.sin(longitude);
	const cosLongitude = Math.cos(longitude);

	const up = new Vector3(
		cosLatitude * cosLongitude,
		sinLatitude,
		-cosLatitude * sinLongitude
	).normalize();
	const east = new Vector3(-sinLongitude, 0, -cosLongitude).normalize();
	const north = new Vector3().crossVectors(up, east).normalize();

	return { east, north, up };
}

export function isOrthonormalPlanetFrame(
	frame: Readonly<LocalPlanetFrame>,
	epsilon = 1e-9
): boolean {
	const lengths = [frame.east.length(), frame.north.length(), frame.up.length()];
	const dots = [frame.east.dot(frame.north), frame.east.dot(frame.up), frame.north.dot(frame.up)];

	return (
		lengths.every((length) => Math.abs(length - 1) <= epsilon) &&
		dots.every((dot) => Math.abs(dot) <= epsilon)
	);
}
