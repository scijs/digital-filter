import firwin from '../fir/firwin.js'
import upfirdn from './upfirdn.js'

/**
 * Resample signal by rational factor p/q.
 * Designs anti-alias lowpass FIR and applies via upfirdn.
 *
 * @param {Float64Array|Array<number>} data - Input signal
 * @param {number} p - Upsample factor (output rate = input rate * p/q)
 * @param {number} q - Downsample factor
 * @param {object} [opts] - {numtaps}
 *   numtaps: FIR filter length (default 10*max(p,q)+1, odd)
 * @returns {Float64Array} Resampled signal
 */
export default function resample (data, p, q, opts) {
	if (!opts) opts = {}

	// Simplify ratio
	let g = gcd(p, q)
	p = p / g
	q = q / g
	if (p === 1 && q === 1) return new Float64Array(data)

	let numtaps = opts.numtaps || (10 * Math.max(p, q) + 1)
	if (numtaps % 2 === 0) numtaps++

	// Anti-alias filter at min(1/p, 1/q) * Nyquist
	// Normalize: cutoff at 1/(2*max(p,q)) of the upsampled rate
	let fc = 1 / (2 * Math.max(p, q))
	// firwin expects Hz + fs; use normalized: fc * fs where fs = 1
	let h = firwin(numtaps, fc, 1)

	// Scale by upsampling factor to preserve amplitude
	for (let i = 0; i < h.length; i++) h[i] *= p

	// Delay compensation must remove an INTEGER number of output samples:
	// zero-prepad h until the group delay divides q (scipy resample_poly),
	// otherwise the output is misaligned by a fraction of a sample.
	let delay = (numtaps - 1) / 2
	let prePad = (q - delay % q) % q
	if (prePad) {
		let hp = new Float64Array(prePad + h.length)
		hp.set(h, prePad)
		h = hp
		delay += prePad
	}

	let out = upfirdn(data, h, p, q)

	// Trim to expected length: ceil(data.length * p / q)
	let expected = Math.ceil(data.length * p / q)
	let startIdx = delay / q
	let result = new Float64Array(expected)
	for (let i = 0; i < expected; i++) {
		let idx = startIdx + i
		result[i] = idx < out.length ? out[idx] : 0
	}

	return result
}

function gcd (a, b) {
	a = Math.abs(a); b = Math.abs(b)
	while (b) { let t = b; b = a % b; a = t }
	return a
}
