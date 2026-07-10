/**
 * Convolution of signal with impulse response.
 * Direct convolution O(N*M). For long IRs, consider FFT-based methods.
 *
 * @module  digital-filter/convolution
 */

/**
 * @param {Float64Array} signal - Input signal
 * @param {Float64Array} ir - Impulse response
 * @returns {Float64Array} Convolved output (length = signal.length + ir.length - 1)
 */
export default function convolution (signal, ir) {
	let N = signal.length, M = ir.length
	let out = new Float64Array(N + M - 1)

	for (let i = 0; i < N; i++) {
		for (let j = 0; j < M; j++) {
			out[i + j] += signal[i] * ir[j]
		}
	}

	return out
}

/**
 * Centered same-length convolution with zero-padded boundaries (numpy 'same').
 * The shared kernel behind decimate/interpolate/oversample filtering.
 * @param {Float64Array} signal - Input signal
 * @param {Float64Array} ir - FIR coefficients (odd length centers exactly)
 * @returns {Float64Array} Filtered output, same length as signal
 */
export function convolveSame (signal, ir) {
	let N = signal.length, M = ir.length
	let half = (M - 1) >> 1
	let out = new Float64Array(N)

	for (let i = 0; i < N; i++) {
		let sum = 0
		let jLo = Math.max(0, half - i)
		let jHi = Math.min(M, N - i + half)
		for (let j = jLo; j < jHi; j++) sum += ir[j] * signal[i - half + j]
		out[i] = sum
	}

	return out
}
