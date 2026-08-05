export const CLOUD_VERTEX_SHADER = /* glsl */ `
	varying vec3 vCloudDirection;

	void main() {
		vCloudDirection = normalize(position);
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

export const CLOUD_FRAGMENT_SHADER = /* glsl */ `
	precision highp float;

	uniform float uCoverage;
	uniform float uDensity;
	uniform float uDarkness;
	uniform float uOpacity;
	uniform float uDaylight;
	uniform float uNight;
	uniform float uDetail;
	uniform vec2 uWindOffset;
	uniform vec3 uSunDirection;
	uniform float uLightningFlash;

	varying vec3 vCloudDirection;

	float hash31(vec3 p) {
		p = fract(p * 0.1031);
		p += dot(p, p.yzx + 33.33);
		return fract((p.x + p.y) * p.z);
	}

	float valueNoise(vec3 p) {
		vec3 cell = floor(p);
		vec3 local = fract(p);
		local = local * local * (3.0 - 2.0 * local);

		float n000 = hash31(cell + vec3(0.0, 0.0, 0.0));
		float n100 = hash31(cell + vec3(1.0, 0.0, 0.0));
		float n010 = hash31(cell + vec3(0.0, 1.0, 0.0));
		float n110 = hash31(cell + vec3(1.0, 1.0, 0.0));
		float n001 = hash31(cell + vec3(0.0, 0.0, 1.0));
		float n101 = hash31(cell + vec3(1.0, 0.0, 1.0));
		float n011 = hash31(cell + vec3(0.0, 1.0, 1.0));
		float n111 = hash31(cell + vec3(1.0, 1.0, 1.0));

		float nx00 = mix(n000, n100, local.x);
		float nx10 = mix(n010, n110, local.x);
		float nx01 = mix(n001, n101, local.x);
		float nx11 = mix(n011, n111, local.x);
		float nxy0 = mix(nx00, nx10, local.y);
		float nxy1 = mix(nx01, nx11, local.y);

		return mix(nxy0, nxy1, local.z);
	}

	float fbm(vec3 p) {
		float value = 0.0;
		float amplitude = 0.55;

		for (int octave = 0; octave < 5; octave++) {
			if (float(octave) >= uDetail) {
				break;
			}

			value += valueNoise(p) * amplitude;
			p = p * 2.03 + vec3(17.1, 9.2, 13.7);
			amplitude *= 0.5;
		}

		return value;
	}

	float cloudLayer(vec3 direction, float scale, vec3 offset, float thresholdBias) {
		float noise = fbm(direction * scale + offset);
		float threshold = mix(0.82, 0.29, uCoverage) + thresholdBias;
		return smoothstep(threshold, threshold + mix(0.18, 0.08, uDensity), noise);
	}

	void main() {
		vec3 direction = normalize(vCloudDirection);
		float horizon = smoothstep(-0.02, 0.18, direction.y);

		if (horizon <= 0.001 || uOpacity <= 0.001) {
			discard;
		}

		vec3 drift = vec3(uWindOffset.x, 0.0, uWindOffset.y);
		float highLayer = cloudLayer(direction, 3.1, drift * 0.55 + vec3(4.2, 8.0, 1.7), 0.07);
		float middleLayer = cloudLayer(direction, 4.7, drift + vec3(12.4, 2.1, 7.8), 0.0);
		float lowLayer = cloudLayer(direction, 6.8, drift * 1.45 + vec3(2.7, 11.3, 15.1), -0.04);
		float cloud = clamp(highLayer * 0.34 + middleLayer * 0.72 + lowLayer * 0.56, 0.0, 1.0);
		cloud = smoothstep(0.08, 0.86, cloud) * uDensity;

		float sunFacing = max(dot(direction, normalize(uSunDirection)), 0.0);
		vec3 dayBright = vec3(0.94, 0.95, 0.96);
		vec3 dayDark = vec3(0.32, 0.36, 0.43);
		vec3 nightBright = vec3(0.18, 0.21, 0.29);
		vec3 nightDark = vec3(0.055, 0.065, 0.095);
		vec3 dayColor = mix(dayBright, dayDark, uDarkness);
		vec3 nightColor = mix(nightBright, nightDark, uDarkness);
		vec3 cloudColor = mix(nightColor, dayColor, uDaylight);
		cloudColor += vec3(1.0, 0.78, 0.52) * pow(sunFacing, 12.0) * (1.0 - uDarkness) * 0.18;
		cloudColor *= mix(0.82, 1.05, clamp(direction.y, 0.0, 1.0));
		cloudColor = mix(cloudColor, vec3(0.78, 0.87, 1.0), clamp(uLightningFlash * 0.92, 0.0, 1.0));

		float alpha = cloud * uOpacity * horizon;
		alpha *= mix(0.8, 1.0, uNight);

		if (alpha <= 0.002) {
			discard;
		}

		gl_FragColor = vec4(max(cloudColor, vec3(0.0)), clamp(alpha, 0.0, 0.96));
	}
`;
