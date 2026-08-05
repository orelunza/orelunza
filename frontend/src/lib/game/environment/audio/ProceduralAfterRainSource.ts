export class ProceduralAfterRainSource {
	private readonly oscillator: OscillatorNode;
	private readonly gain: GainNode;
	private readonly filter: BiquadFilterNode;

	constructor(context: AudioContext, destination: AudioNode) {
		this.oscillator = context.createOscillator();
		this.oscillator.type = 'sine';
		this.oscillator.frequency.value = 174;
		this.filter = context.createBiquadFilter();
		this.filter.type = 'lowpass';
		this.filter.frequency.value = 420;
		this.gain = context.createGain();
		this.gain.gain.value = 0;
		this.oscillator.connect(this.filter).connect(this.gain).connect(destination);
		this.oscillator.start();
	}

	setLevel(level: number, time: number): void {
		this.gain.gain.cancelScheduledValues(time);
		this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.012, time, 0.8);
	}

	dispose(): void {
		try {
			this.oscillator.stop();
		} catch {
			// Already stopped by the browser.
		}
		this.oscillator.disconnect();
		this.filter.disconnect();
		this.gain.disconnect();
	}
}
