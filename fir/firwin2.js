/**
 * FIR filter with arbitrary frequency response via frequency sampling
 * (scipy fir2 / MATLAB fir2)
 *
 * @module  digital-filter/firwin2
 */

import { getWindow } from './util.js'

let { cos, PI } = Math

/**
 * @param {number} numtaps - Filter length (must be odd)
 * @param {Array} freq - Frequency points [0-1] where 1 = Nyquist, must start at 0 and end at 1
 * @param {Array} gain - Desired gain at each frequency point
 * @param {object} opts - { window: 'hamming', nfft: 1024 }
 * @returns {Float64Array} FIR coefficients
 */
export default function firwin2 (numtaps, freq, gain, opts) {
	if (!opts) opts = {}
	let nfft = opts.nfft || 1024
	if (nfft < numtaps) nfft = numtaps * 2

	// Interpolate onto dense half-spectrum grid: DFT bin i ↔ f = i/(nfft/2),
	// so Nyquist (f = 1) sits at bin nfft/2 — not at bin nfft
	let half = nfft / 2
	let H = new Float64Array(half + 1)
	for (let i = 0; i <= half; i++) {
		let f = i / half
		let j = 0
		while (j < freq.length - 1 && freq[j + 1] < f) j++
		if (j >= freq.length - 1) { H[i] = gain[gain.length - 1]; continue }
		let t = (f - freq[j]) / (freq[j + 1] - freq[j])
		H[i] = gain[j] + t * (gain[j + 1] - gain[j])
	}

	// Conjugate-symmetric spectrum for real output
	let re = new Float64Array(nfft)
	re[0] = H[0]
	for (let i = 1; i < half; i++) {
		re[i] = H[i]
		re[nfft - i] = H[i]
	}
	re[half] = H[half]

	// IDFT → impulse response
	let h = new Float64Array(nfft)
	for (let n = 0; n < nfft; n++) {
		let sum = 0
		for (let k = 0; k < nfft; k++) sum += re[k] * cos(2 * PI * k * n / nfft)
		h[n] = sum / nfft
	}

	// Circular shift to center and truncate
	let M = (numtaps - 1) / 2
	let out = new Float64Array(numtaps)
	for (let i = 0; i < numtaps; i++) {
		let idx = (i - M + nfft) % nfft
		out[i] = h[idx]
	}

	// Apply window
	let win = getWindow(opts.window, numtaps)
	for (let i = 0; i < numtaps; i++) out[i] *= win[i]

	return out
}
