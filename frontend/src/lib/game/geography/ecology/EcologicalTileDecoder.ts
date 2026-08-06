import { PLANET_FACES } from '../../planet/PlanetFace';
import type { EcologicalTile } from './EcologicalTile';

const HEADER_BYTES = 24;
const MAGIC = 0x4345524f; // OREC in little endian

export function decodeEcologicalTile(buffer: ArrayBuffer): EcologicalTile {
	if (buffer.byteLength < HEADER_BYTES) {
		throw new RangeError('Ecological tile payload is truncated.');
	}
	const view = new DataView(buffer);
	if (view.getUint32(0, true) !== MAGIC) {
		throw new TypeError('Invalid ecological tile magic.');
	}
	const version = view.getUint8(4);
	const face = PLANET_FACES[view.getUint8(5)];
	const level = view.getUint8(6);
	const x = view.getUint16(8, true);
	const y = view.getUint16(10, true);
	const resolution = view.getUint16(12, true);
	const sampleCount = view.getUint32(20, true);
	if (version !== 1 || !face || resolution < 2 || sampleCount !== resolution * resolution) {
		throw new TypeError('Unsupported ecological tile header.');
	}
	const expectedBytes = HEADER_BYTES + sampleCount * 3;
	if (buffer.byteLength !== expectedBytes) {
		throw new RangeError('Ecological tile payload size does not match its resolution.');
	}
	let offset = HEADER_BYTES;
	const landCoverCodes = new Uint8Array(buffer.slice(offset, offset + sampleCount));
	offset += sampleCount;
	const treeCoverDensity = new Uint8Array(buffer.slice(offset, offset + sampleCount));
	offset += sampleCount;
	const confidence = new Uint8Array(buffer.slice(offset, offset + sampleCount));
	return {
		id: { face, level, x, y },
		resolution,
		landCoverCodes,
		treeCoverDensity,
		confidence,
		byteLength: buffer.byteLength
	};
}
