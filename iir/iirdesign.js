import butterworth from './butterworth.js'
import chebyshev from './chebyshev.js'
import elliptic from './elliptic.js'
import { buttord, cheb1ord, ellipord } from './ordest.js'

/**
 * Automatically design an IIR filter from specifications.
 * Picks the filter type that gives the minimum order
 * (order estimates via buttord/cheb1ord/ellipord).
 *
 * @param {number} fpass - Passband edge frequency Hz
 * @param {number} fstop - Stopband edge frequency Hz
 * @param {number} rp - Passband ripple dB (default 1)
 * @param {number} rs - Stopband attenuation dB (default 40)
 * @param {number} fs - Sample rate (default 44100)
 * @returns {{sos: Array, order: number, type: string}}
 */
export default function iirdesign (fpass, fstop, rp, rs, fs) {
	if (!rp) rp = 1
	if (!rs) rs = 40
	if (!fs) fs = 44100

	let type = fpass < fstop ? 'lowpass' : 'highpass'
	let fc = fpass

	let bestOrder = Infinity, bestSos = null, bestName = ''

	let nBW = buttord(fpass, fstop, rp, rs, fs).order
	if (nBW < bestOrder) {
		bestOrder = nBW
		bestSos = butterworth(nBW, fc, fs, type)
		bestName = 'butterworth'
	}

	// Chebyshev I — typically lower order than Butterworth
	let nCh = cheb1ord(fpass, fstop, rp, rs, fs).order
	if (nCh < bestOrder) {
		bestOrder = nCh
		bestSos = chebyshev(nCh, fc, fs, rp, type)
		bestName = 'chebyshev'
	}

	// Elliptic — lowest order
	let nEl = ellipord(fpass, fstop, rp, rs, fs).order
	if (nEl < bestOrder) {
		bestOrder = nEl
		bestSos = elliptic(nEl, fc, fs, rp, rs, type)
		bestName = 'elliptic'
	}

	return { sos: bestSos, order: bestOrder, type: bestName }
}
