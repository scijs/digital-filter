import firwin from '../fir/firwin.js'
import { convolveSame } from '../core/convolution.js'

/**
 * Decimate signal: anti-alias lowpass filter then downsample by factor M.
 * @param {Float64Array} data - Input signal
 * @param {number} factor - Decimation factor M
 * @param {object} opts - {numtaps}
 *   numtaps: FIR filter length (default 30*factor+1)
 * @returns {Float64Array} decimated signal (length = ceil(data.length / factor))
 */
export default function decimate (data, factor, opts) {
	if (!opts) opts = {}
	let numtaps = opts.numtaps || (30 * factor + 1)
	if (numtaps % 2 === 0) numtaps++

	// Anti-aliasing lowpass at 90% of the new Nyquist (normalized design —
	// the cutoff/rate ratio is all that matters, absolute fs cancels out)
	let h = firwin(numtaps, 0.9 * 0.5 / factor, 1)

	let filtered = convolveSame(data, h)

	// Downsample
	let outLen = Math.ceil(data.length / factor)
	let output = new Float64Array(outLen)
	for (let i = 0; i < outLen; i++) {
		output[i] = filtered[i * factor]
	}

	return output
}
