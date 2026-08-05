export class ProceduralWindSource {
	private readonly source: AudioBufferSourceNode;
	private readonly filter: BiquadFilterNode;
	private readonly gain: GainNode;

	constructor(context: AudioContext, destination: AudioNode, seed: number) {
		this.source = context.createBufferSource();
		this.source.buffer = createNoiseBuffer(context, 4, seed);
		this.source.loop = true;
		this.filter = context.createBiquadFilter();
		this.filter.type = 'bandpass';
		this.filter.frequency.value = 520;
		this.filter.Q.value = 0.45;
		this.gain = context.createGain();
		this.gain.gain.value = 0;
		this.source.connect(this.filter).connect(this.gain).connect(destination);
		this.source.start();
	}

	setLevel(level: number, time: number): void {
		this.gain.gain.cancelScheduledValues(time);
		this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.22, time, 0.18);
		this.filter.frequency.setTargetAtTime(340 + level * 1250, time, 0.3);
	}

	dispose(): void {
		try {
			this.source.stop();
		} catch {
			// Already stopped by the browser.
		}
		this.source.disconnect();
		this.filter.disconnect();
		this.gain.disconnect();
	}
}

function createNoiseBuffer(context: AudioContext, seconds: number, seed: number): AudioBuffer {
	const length = Math.max(1, Math.floor(context.sampleRate * seconds));
	const buffer = context.createBuffer(1, length, context.sampleRate);
	const data = buffer.getChannelData(0);
	let state = seed >>> 0;
	let previous = 0;
	for (let index = 0; index < length; index += 1) {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		const white = (((value ^ (value >>> 14)) >>> 0) / 2147483648 - 1) * 0.65;
		previous = previous * 0.985 + white * 0.015;
		data[index] = previous;
	}
	return buffer;
}
