export class ProceduralRainSource {
	private readonly source: AudioBufferSourceNode;
	private readonly filter: BiquadFilterNode;
	private readonly gain: GainNode;

	constructor(context: AudioContext, destination: AudioNode, seed: number) {
		this.source = context.createBufferSource();
		this.source.buffer = createRainBuffer(context, 3, seed);
		this.source.loop = true;
		this.filter = context.createBiquadFilter();
		this.filter.type = 'highpass';
		this.filter.frequency.value = 1200;
		this.filter.Q.value = 0.35;
		this.gain = context.createGain();
		this.gain.gain.value = 0;
		this.source.connect(this.filter).connect(this.gain).connect(destination);
		this.source.start();
	}

	setLevel(level: number, time: number): void {
		const bounded = Math.max(0, Math.min(1, level));
		this.gain.gain.cancelScheduledValues(time);
		this.gain.gain.setTargetAtTime(bounded * 0.3, time, 0.12);
		this.filter.frequency.setTargetAtTime(1900 - bounded * 850, time, 0.22);
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

function createRainBuffer(context: AudioContext, seconds: number, seed: number): AudioBuffer {
	const length = Math.max(1, Math.floor(context.sampleRate * seconds));
	const buffer = context.createBuffer(1, length, context.sampleRate);
	const data = buffer.getChannelData(0);
	let state = seed >>> 0;
	let envelope = 0;
	for (let index = 0; index < length; index += 1) {
		state = Math.imul(state ^ (state >>> 16), 0x45d9f3b) >>> 0;
		const random = state / 4294967296;
		if (random > 0.997) {
			envelope = 1;
		}
		envelope *= 0.965;
		const white = random * 2 - 1;
		data[index] = white * 0.2 + envelope * white * 0.8;
	}
	return buffer;
}
