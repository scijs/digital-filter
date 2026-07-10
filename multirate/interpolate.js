import firwin from '../fir/firwin.js'
import { convolveSame } from '../core/convolution.js'

/**
 * Interpolate signal: upsample by factor L then anti-image lowpass filter.
 * @param {Float64Array} data - Input signal
 * @param {number} factor - Interpolation factor L
 * @param {object} opts - {numtaps}
 * @returns {Float64Array} interpolated signal (length = data.length * factor)
 */
export default function interpolate (data, factor, opts) {
	if (!opts) opts = {}
	let numtaps = opts.numtaps || (30 * factor + 1)
	if (numtaps % 2 === 0) numtaps++

	// Upsample: insert factor-1 zeros between samples
	let upLen = data.length * factor
	let up = new Float64Array(upLen)
	for (let i = 0; i < data.length; i++) {
		up[i * factor] = data[i] * factor  // scale by factor to maintain energy
	}

	// Anti-imaging lowpass at the original Nyquist = 1/factor of the new rate
	// (normalized design — the cutoff/rate ratio is all that matters)
	let h = firwin(numtaps, 0.5 / factor, 1)

	return convolveSame(up, h)
}
