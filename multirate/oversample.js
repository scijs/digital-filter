import firwin from '../fir/firwin.js'
import kaiserord from '../fir/kaiserord.js'
import { convolveSame } from '../core/convolution.js'

/**
 * Oversample a signal by a given factor with anti-alias filtering.
 * @param {Float64Array} data - Input signal
 * @param {number} factor - Oversampling factor (2, 4, 8, etc.)
 * @param {object} opts - { numtaps: FIR length override, attenuation: image rejection dB (default 70) }
 * @returns {Float64Array} Oversampled signal
 */
export default function oversample (data, factor, opts) {
	if (!opts) opts = {}
	// The anti-imaging transition band narrows ∝ 1/factor, so the tap count must
	// grow ∝ factor — a fixed length gives no rejection at high factors.
	let A = opts.attenuation || 70
	let { numtaps, beta } = kaiserord(0.2 / factor, A)
	if (opts.numtaps) {
		numtaps = opts.numtaps
		if (numtaps % 2 === 0) numtaps++
	}

	let N = data.length
	let outLen = N * factor

	// Upsample: insert zeros
	let up = new Float64Array(outLen)
	for (let i = 0; i < N; i++) up[i * factor] = data[i] * factor

	// Anti-image lowpass at 1/factor of new Nyquist
	let h = firwin(numtaps, 0.5 / factor, 1, {window: ['kaiser', beta]})

	return convolveSame(up, h)
}
