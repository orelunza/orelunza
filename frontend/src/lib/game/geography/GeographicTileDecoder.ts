import { PLANET_FACES } from '../planet/PlanetFace';
import type { GeographicTile } from './GeographicTile';

const HEADER_BYTES = 16;
const MAGIC = 0x5447524f; // ORGT in little endian

export function decodeGeographicTile(buffer: ArrayBuffer): GeographicTile {
	if (buffer.byteLength < HEADER_BYTES) {
		throw new RangeError('Geographic tile payload is truncated.');
	}
	const view = new DataView(buffer);
	if (view.getUint32(0, true) !== MAGIC) {
		throw new TypeError('Invalid geographic tile magic.');
	}
	const version = view.getUint8(4);
	const resolution = view.getUint8(5);
	const level = view.getUint8(6);
	const faceIndex = view.getUint8(7);
	const face = PLANET_FACES[faceIndex];
	const x = view.getUint16(8, true);
	const y = view.getUint16(10, true);
	const minimumElevationMeters = view.getInt16(12, true);
	const maximumElevationMeters = view.getInt16(14, true);
	if (version !== 1 || !face || resolution < 2) {
		throw new TypeError('Unsupported geographic tile header.');
	}
	const sampleCount = resolution * resolution;
	const expectedBytes = HEADER_BYTES + sampleCount * 3;
	if (buffer.byteLength !== expectedBytes) {
		throw new RangeError('Geographic tile payload size does not match its resolution.');
	}
	const elevationMeters = new Int16Array(sampleCount);
	let offset = HEADER_BYTES;
	for (let index = 0; index < sampleCount; index += 1) {
		elevationMeters[index] = view.getInt16(offset, true);
		offset += 2;
	}
	const landMask = new Uint8Array(buffer.slice(offset));
	return {
		id: { face, level, x, y },
		resolution,
		minimumElevationMeters,
		maximumElevationMeters,
		elevationMeters,
		landMask,
		byteLength: buffer.byteLength
	};
}
