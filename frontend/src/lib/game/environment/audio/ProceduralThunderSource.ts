import type { ThunderEvent } from '../weather/ThunderEvent';

export class ProceduralThunderSource {
	private readonly active = new Set<AudioBufferSourceNode>();

	constructor(
		private readonly context: AudioContext,
		private readonly destination: AudioNode,
		private readonly seed: number
	) {}

	play(event: Readonly<ThunderEvent>): void {
		const distanceFalloff = 1 / (1 + Math.max(0, event.distanceMeters - 12) / 70);
		const level = Math.max(0, Math.min(1, event.intensity * distanceFalloff));
		if (level <= 0.01) {
			return;
		}

		const source = this.context.createBufferSource();
		const filter = this.context.createBiquadFilter();
		const gain = this.context.createGain();
		source.buffer = createThunderBuffer(
			this.context,
			2.8 + event.distanceMeters / 90,
			this.seed ^ event.strikeId
		);
		filter.type = 'lowpass';
		filter.frequency.value = 520 + level * 760;
		filter.Q.value = 0.5;
		gain.gain.value = 0;
		const now = this.context.currentTime;
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(level * 0.62, now + 0.025);
		gain.gain.exponentialRampToValueAtTime(0.001, now + Math.max(1.5, source.buffer.duration));
		source.connect(filter).connect(gain).connect(this.destination);
		this.active.add(source);
		source.addEventListener(
			'ended',
			() => {
				this.active.delete(source);
				source.disconnect();
				filter.disconnect();
				gain.disconnect();
			},
			{ once: true }
		);
		source.start(now);
	}

	dispose(): void {
		for (const source of this.active) {
			try {
				source.stop();
			} catch {
				// Already stopped.
			}
			source.disconnect();
		}
		this.active.clear();
	}
}

function createThunderBuffer(context: AudioContext, seconds: number, seed: number): AudioBuffer {
	const length = Math.max(1, Math.floor(context.sampleRate * seconds));
	const buffer = context.createBuffer(1, length, context.sampleRate);
	const data = buffer.getChannelData(0);
	let state = seed >>> 0;
	let low = 0;
	for (let index = 0; index < length; index += 1) {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		const white = ((value ^ (value >>> 14)) >>> 0) / 2147483648 - 1;
		low = low * 0.992 + white * 0.008;
		const t = index / length;
		const attack = Math.min(1, t * 70);
		const decay = Math.pow(1 - t, 2.1);
		const rumble = Math.sin(index * 0.0017) * 0.18;
		data[index] = (low * 2.8 + rumble) * attack * decay;
	}
	return buffer;
}
