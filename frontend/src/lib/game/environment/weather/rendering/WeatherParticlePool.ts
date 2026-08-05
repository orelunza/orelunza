import { hashUint32 } from '../../EnvironmentMath';

/** Fixed deterministic particle seeds shared by weather renderers. */
export class WeatherParticlePool {
	readonly x: Float32Array;
	readonly y: Float32Array;
	readonly z: Float32Array;
	readonly phase: Float32Array;
	readonly scale: Float32Array;

	constructor(count: number, seed: number) {
		const safeCount = Math.max(1, Math.floor(count));
		this.x = new Float32Array(safeCount);
		this.y = new Float32Array(safeCount);
		this.z = new Float32Array(safeCount);
		this.phase = new Float32Array(safeCount);
		this.scale = new Float32Array(safeCount);

		for (let index = 0; index < safeCount; index += 1) {
			this.x[index] = unit(seed, index, 0x78) * 2 - 1;
			this.y[index] = unit(seed, index, 0x79);
			this.z[index] = unit(seed, index, 0x7a) * 2 - 1;
			this.phase[index] = unit(seed, index, 0x70);
			this.scale[index] = 0.72 + unit(seed, index, 0x73) * 0.56;
		}
	}

	get count(): number {
		return this.x.length;
	}
}

function unit(seed: number, index: number, salt: number): number {
	return hashUint32((seed >>> 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ salt) / 4294967296;
}
