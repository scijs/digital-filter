/**
 * Nth-order Butterworth filter → cascaded SOS
 * Maximally flat magnitude response
 *
 * @module  digital-filter/butterworth
 */

let {sin, floor, PI} = Math
import { polesSos } from '../core/transform.js'

/**
 * Design Nth-order Butterworth filter as cascaded second-order sections.
 *
 * @param {number} order - Filter order
 * @param {number} fc - Cutoff frequency in Hz
 * @param {number} [fs=44100] - Sample rate in Hz
 * @param {string} [type='lowpass'] - Filter type: 'lowpass', 'highpass', 'bandpass', 'bandstop'
 * @returns {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} SOS sections
 */
export default function butterworth (order, fc, fs, type) {
	if (!type) type = 'lowpass'
	if (!fs) fs = 44100

	return polesSos(butterworthPoles(order), fc, fs, type)
}

// Butterworth prototype poles (normalized LP at 1 rad/s, unit circle)
export { butterworthPoles as poles }  // pre-2.4 subpath export kept
function butterworthPoles (N) {
	let poles = []
	for (let m = 0; m < floor(N / 2); m++) {
		let theta = PI * (2 * m + 1) / (2 * N)
		poles.push([-sin(theta), Math.cos(theta)])
	}
	if (N % 2 === 1) poles.push([-1, 0])
	return poles
}

