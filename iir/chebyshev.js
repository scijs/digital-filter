/**
 * Chebyshev Type I filter → cascaded SOS
 * Equiripple passband, monotonic stopband
 *
 * @module  digital-filter/chebyshev
 */

let {sin, cos, sqrt, pow, floor, sinh, cosh, asinh, PI} = Math
import { polesSos } from '../core/transform.js'

/**
 * Design Chebyshev Type I filter as cascaded second-order sections.
 *
 * @param {number} order - Filter order
 * @param {number} fc - Cutoff frequency in Hz
 * @param {number} [fs=44100] - Sample rate in Hz
 * @param {number} [ripple=1] - Passband ripple in dB
 * @param {string} [type='lowpass'] - Filter type: 'lowpass', 'highpass', 'bandpass', 'bandstop'
 * @returns {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} SOS sections
 */
export default function chebyshev (order, fc, fs, ripple, type) {
	if (!fs) fs = 44100
	if (!ripple) ripple = 1
	if (!type) type = 'lowpass'

	let poles = chebyshevPoles(order, ripple)
	let sections = polesSos(poles, fc, fs, type)

	// Even-order gain correction: scale peak to 0dB
	if (order % 2 === 0) {
		let eps = sqrt(pow(10, ripple / 10) - 1)
		let g = 1 / sqrt(1 + eps * eps)
		sections[0].b0 *= g
		sections[0].b1 *= g
		sections[0].b2 *= g
	}

	return sections
}

// Chebyshev Type I prototype poles (normalized LP at 1 rad/s)
export { chebyshevPoles as poles }  // pre-2.4 subpath export kept
export function type2 () { throw new Error('chebyshev type2: use iir/chebyshev2.js') }  // pre-2.4 stub kept (always threw)
function chebyshevPoles (N, ripple) {
	let eps = sqrt(pow(10, ripple / 10) - 1)
	let mu = asinh(1 / eps) / N
	let poles = []

	for (let m = 0; m < floor(N / 2); m++) {
		let theta = PI * (2 * m + 1) / (2 * N)
		poles.push([-sinh(mu) * sin(theta), cosh(mu) * cos(theta)])
	}
	if (N % 2 === 1) poles.push([-sinh(mu), 0])

	return poles
}
