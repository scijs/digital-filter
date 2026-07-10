let {sin, cos, sqrt, pow, PI} = Math

// Factories, not shared constants — callers may mutate the returned object
let SILENCE = () => ({ b0: 0, b1: 0, b2: 0, a1: 0, a2: 0 })
let PASS = () => ({ b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 })
let INVERT = () => ({ b0: -1, b1: 0, b2: 0, a1: 0, a2: 0 })
let gain = A2 => ({ b0: A2, b1: 0, b2: 0, a1: 0, a2: 0 })

function norm (b0, b1, b2, a0, a1, a2) {
	return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 }
}

function intermediates (fc, Q, fs) {
	let w0 = 2 * PI * fc / fs
	let sinw = sin(w0), cosw = cos(w0)
	let alpha = sinw / (2 * Q)
	return { sinw, cosw, alpha }
}

/**
 * @param {number} fc - Cutoff frequency in Hz
 * @param {number} Q - Quality factor
 * @param {number} fs - Sample rate in Hz
 * @returns {{b0: number, b1: number, b2: number, a1: number, a2: number}}
 */
export function lowpass (fc, Q, fs) {
	if (!fs) fs = 44100
	if (fc <= 0) return SILENCE()
	if (fc >= fs / 2) return PASS()
	let { cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		(1 - cosw) / 2, 1 - cosw, (1 - cosw) / 2,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

/**
 * @param {number} fc - Cutoff frequency in Hz
 * @param {number} Q - Quality factor
 * @param {number} fs - Sample rate in Hz
 * @returns {{b0: number, b1: number, b2: number, a1: number, a2: number}}
 */
export function highpass (fc, Q, fs) {
	if (!fs) fs = 44100
	if (fc <= 0) return PASS()
	if (fc >= fs / 2) return SILENCE()
	let { cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		(1 + cosw) / 2, -(1 + cosw), (1 + cosw) / 2,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

/**
 * Constant-skirt-gain bandpass — peak gain = Q (RBJ cookbook BPF variant 1).
 * @param {number} fc - Center frequency in Hz
 * @param {number} Q - Quality factor
 * @param {number} fs - Sample rate in Hz
 * @returns {{b0: number, b1: number, b2: number, a1: number, a2: number}}
 */
export function bandpass (fc, Q, fs) {
	if (!fs) fs = 44100
	if (fc <= 0 || fc >= fs / 2) return SILENCE()
	if (Q <= 0) return SILENCE()
	let { sinw, cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		sinw / 2, 0, -sinw / 2,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

/**
 * Constant-0dB-peak-gain bandpass (RBJ cookbook BPF variant 2).
 * @param {number} fc - Center frequency in Hz
 * @param {number} Q - Quality factor
 * @param {number} fs - Sample rate in Hz
 * @returns {{b0: number, b1: number, b2: number, a1: number, a2: number}}
 */
export function bandpass2 (fc, Q, fs) {
	if (!fs) fs = 44100
	if (fc <= 0 || fc >= fs / 2) return SILENCE()
	if (Q <= 0) return PASS()
	let { cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		alpha, 0, -alpha,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

/**
 * @param {number} fc - Center frequency in Hz
 * @param {number} Q - Quality factor
 * @param {number} fs - Sample rate in Hz
 * @returns {{b0: number, b1: number, b2: number, a1: number, a2: number}}
 */
export function notch (fc, Q, fs) {
	if (!fs) fs = 44100
	if (fc <= 0 || fc >= fs / 2) return PASS()
	if (Q <= 0) return SILENCE()
	let { cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		1, -2 * cosw, 1,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

/**
 * @param {number} fc - Center frequency in Hz
 * @param {number} Q - Quality factor
 * @param {number} fs - Sample rate in Hz
 * @returns {{b0: number, b1: number, b2: number, a1: number, a2: number}}
 */
export function allpass (fc, Q, fs) {
	if (!fs) fs = 44100
	if (fc <= 0 || fc >= fs / 2) return PASS()
	if (Q <= 0) return INVERT()
	let { cosw, alpha } = intermediates(fc, Q, fs)
	return norm(
		1 - alpha, -2 * cosw, 1 + alpha,
		1 + alpha, -2 * cosw, 1 - alpha
	)
}

/**
 * @param {number} fc - Center frequency in Hz
 * @param {number} Q - Quality factor
 * @param {number} fs - Sample rate in Hz
 * @param {number} dBgain - Gain in dB
 * @returns {{b0: number, b1: number, b2: number, a1: number, a2: number}}
 */
export function peaking (fc, Q, fs, dBgain) {
	if (!fs) fs = 44100
	if (fc <= 0 || fc >= fs / 2) return PASS()
	if (Q <= 0) return gain(pow(10, dBgain / 20))
	let { cosw, alpha } = intermediates(fc, Q, fs)
	let A = pow(10, dBgain / 40)
	return norm(
		1 + alpha * A, -2 * cosw, 1 - alpha * A,
		1 + alpha / A, -2 * cosw, 1 - alpha / A
	)
}

/**
 * @param {number} fc - Shelf frequency in Hz
 * @param {number} Q - Quality factor (slope)
 * @param {number} fs - Sample rate in Hz
 * @param {number} dBgain - Gain in dB
 * @returns {{b0: number, b1: number, b2: number, a1: number, a2: number}}
 */
export function lowshelf (fc, Q, fs, dBgain) {
	if (!fs) fs = 44100
	let A = pow(10, dBgain / 40)
	if (fc <= 0) return PASS()
	if (fc >= fs / 2) return gain(A * A)
	let { cosw, alpha } = intermediates(fc, Q, fs)
	let s = 2 * sqrt(A) * alpha
	return norm(
		A * ((A+1) - (A-1)*cosw + s),
		2*A * ((A-1) - (A+1)*cosw),
		A * ((A+1) - (A-1)*cosw - s),
		(A+1) + (A-1)*cosw + s,
		-2 * ((A-1) + (A+1)*cosw),
		(A+1) + (A-1)*cosw - s
	)
}

/**
 * @param {number} fc - Shelf frequency in Hz
 * @param {number} Q - Quality factor (slope)
 * @param {number} fs - Sample rate in Hz
 * @param {number} dBgain - Gain in dB
 * @returns {{b0: number, b1: number, b2: number, a1: number, a2: number}}
 */
export function highshelf (fc, Q, fs, dBgain) {
	if (!fs) fs = 44100
	let A = pow(10, dBgain / 40)
	if (fc <= 0) return gain(A * A)
	if (fc >= fs / 2) return PASS()
	let { cosw, alpha } = intermediates(fc, Q, fs)
	let s = 2 * sqrt(A) * alpha
	return norm(
		A * ((A+1) + (A-1)*cosw + s),
		-2*A * ((A-1) + (A+1)*cosw),
		A * ((A+1) + (A-1)*cosw - s),
		(A+1) - (A-1)*cosw + s,
		2 * ((A-1) - (A+1)*cosw),
		(A+1) - (A-1)*cosw - s
	)
}
