import type { BlockCoordinate, WorldCoordinate } from '../voxel-types';
import { blockKey } from '../voxel-types';

interface RadioVoice {
	output: GainNode;
	filter: BiquadFilterNode;
	carrier: OscillatorNode;
	carrierGain: GainNode;
	texture: AudioBufferSourceNode;
	textureGain: GainNode;
	position: BlockCoordinate;
}

const RADIO_RADIUS = 12;
const MAX_RADIO_VOLUME = 0.045;
const MAX_ACTIVE_RADIOS = 4;

/**
 * Tiny procedural radio ambience used until Orelunza has authored stations.
 * It deliberately owns no external media assets and is started only after a
 * player interaction. Spatial gain makes a radio sound local to the room.
 */
export class CivilizationRadioAudio {
	private context: AudioContext | null = null;
	private voices = new Map<string, RadioVoice>();

	setRadio(position: BlockCoordinate, active: boolean): void {
		const key = blockKey(position);
		if (!active) {
			this.stopVoice(key);
			return;
		}
		if (this.voices.has(key)) return;
		if (this.voices.size >= MAX_ACTIVE_RADIOS) {
			const oldest = this.voices.keys().next().value as string | undefined;
			if (oldest) this.stopVoice(oldest);
		}
		const context = this.ensureContext();
		if (!context) return;
		void context.resume().catch(() => undefined);

		const output = context.createGain();
		output.gain.value = 0;
		const filter = context.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = 2800;
		filter.Q.value = 0.7;
		output.connect(filter);
		filter.connect(context.destination);

		const carrier = context.createOscillator();
		carrier.type = 'triangle';
		carrier.frequency.value = 196;
		const carrierGain = context.createGain();
		carrierGain.gain.value = 0.055;
		carrier.connect(carrierGain);
		carrierGain.connect(output);

		const texture = context.createBufferSource();
		texture.buffer = createRadioTexture(context);
		texture.loop = true;
		const textureGain = context.createGain();
		textureGain.gain.value = 0.28;
		texture.connect(textureGain);
		textureGain.connect(output);

		carrier.start();
		texture.start();
		this.voices.set(key, {
			output,
			filter,
			carrier,
			carrierGain,
			texture,
			textureGain,
			position: { ...position }
		});
	}

	update(listener: Readonly<WorldCoordinate>): void {
		if (!this.context) return;
		const now = this.context.currentTime;
		for (const voice of this.voices.values()) {
			const dx = listener.x - (voice.position.x + 0.5);
			const dy = listener.y - (voice.position.y + 0.5);
			const dz = listener.z - (voice.position.z + 0.5);
			const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
			const normalized = Math.max(0, 1 - distance / RADIO_RADIUS);
			const gain = MAX_RADIO_VOLUME * normalized * normalized;
			voice.output.gain.setTargetAtTime(gain, now, 0.08);
		}
	}

	dispose(): void {
		for (const key of [...this.voices.keys()]) this.stopVoice(key);
		if (this.context) {
			void this.context.close().catch(() => undefined);
			this.context = null;
		}
	}

	private ensureContext(): AudioContext | null {
		if (this.context) return this.context;
		if (typeof window === 'undefined') return null;
		const AudioContextCtor = window.AudioContext;
		if (!AudioContextCtor) return null;
		this.context = new AudioContextCtor();
		return this.context;
	}

	private stopVoice(key: string): void {
		const voice = this.voices.get(key);
		if (!voice) return;
		try {
			voice.carrier.stop();
		} catch {
			// Already stopped by the browser.
		}
		try {
			voice.texture.stop();
		} catch {
			// Already stopped by the browser.
		}
		voice.carrier.disconnect();
		voice.carrierGain.disconnect();
		voice.texture.disconnect();
		voice.textureGain.disconnect();
		voice.output.disconnect();
		voice.filter.disconnect();
		this.voices.delete(key);
	}
}

function createRadioTexture(context: AudioContext): AudioBuffer {
	const seconds = 1.5;
	const length = Math.max(1, Math.floor(context.sampleRate * seconds));
	const buffer = context.createBuffer(1, length, context.sampleRate);
	const channel = buffer.getChannelData(0);
	let state = 0x6d2b79f5;
	for (let i = 0; i < channel.length; i += 1) {
		state = Math.imul(state ^ (state >>> 15), 1 | state);
		state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
		const random = ((state ^ (state >>> 14)) >>> 0) / 4294967295;
		channel[i] = (random * 2 - 1) * 0.18;
	}
	return buffer;
}
