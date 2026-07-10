/**
 * Filter analysis utilities
 *
 * @module  digital-filter/analysis
 */

import filter from './filter.js'
import { sos2zpk } from './convert.js'

// ────── Group delay ──────

/**
 * Group delay computation from SOS coefficients.
 * Returns -d\u03c6/d\u03c9 for each frequency bin.
 *
 * @param {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>|{b0:number,b1:number,b2:number,a1:number,a2:number}} coefs - SOS section(s)
 * @param {number} [n=512] - Number of frequency points
 * @param {number} [fs=44100] - Sample rate in Hz
 * @returns {{frequencies: Float64Array, delay: Float64Array}}
 */
export function groupDelay (coefs, n, fs) {
	if (!n) n = 512
	if (!fs) fs = 44100
	if (!Array.isArray(coefs)) coefs = [coefs]

	let frequencies = new Float64Array(n)
	let delay = new Float64Array(n)

	for (let i = 0; i < n; i++) {
		let w = i * Math.PI / n
		frequencies[i] = i * fs / (2 * n)

		let totalDelay = 0

		for (let j = 0; j < coefs.length; j++) {
			let c = coefs[j]
			let cosw = Math.cos(w), sinw = Math.sin(w)
			let cos2w = Math.cos(2 * w), sin2w = Math.sin(2 * w)

			// Numerator: B(z) = b0 + b1*z^-1 + b2*z^-2
			let br = c.b0 + c.b1 * cosw + c.b2 * cos2w
			let bi = -c.b1 * sinw - c.b2 * sin2w
			let dbr = -c.b1 * sinw - 2 * c.b2 * sin2w
			let dbi = -c.b1 * cosw - 2 * c.b2 * cos2w

			// Denominator: A(z) = 1 + a1*z^-1 + a2*z^-2
			let ar = 1 + c.a1 * cosw + c.a2 * cos2w
			let ai = -c.a1 * sinw - c.a2 * sin2w
			let dar = -c.a1 * sinw - 2 * c.a2 * sin2w
			let dai = -c.a1 * cosw - 2 * c.a2 * cos2w

			// τ(w) = -dφ/dw, φ = arg(B) - arg(A); d(arg X)/dw = Im{X'/X}
			// → τ = Im{A'/A} - Im{B'/B}, with Im{X'/X} = (X'i·Xr - X'r·Xi)/|X|²
			let bMag = br * br + bi * bi
			let aMag = ar * ar + ai * ai
			// At an exact on-circle zero/pole the delay is singular — report 0 (scipy convention)
			if (bMag < 1e-30 || aMag < 1e-30) { totalDelay = 0; break }
			let numGD = (dbi * br - dbr * bi) / bMag
			let denGD = (dai * ar - dar * ai) / aMag

			totalDelay += denGD - numGD
		}

		delay[i] = totalDelay
	}

	return { frequencies, delay }
}

// ────── Phase delay ──────

/**
 * Compute phase delay of a filter.
 * Phase delay = -phase(\u03c9) / \u03c9
 *
 * @param {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>|{b0:number,b1:number,b2:number,a1:number,a2:number}} coefs - SOS section(s)
 * @param {number} [n=512] - Number of frequency points
 * @param {number} [fs=44100] - Sample rate in Hz
 * @returns {{frequencies: Float64Array, delay: Float64Array}}
 */
export function phaseDelay (coefs, n, fs) {
	if (!n) n = 512
	if (!fs) fs = 44100
	if (!Array.isArray(coefs)) coefs = [coefs]

	let frequencies = new Float64Array(n)
	let delay = new Float64Array(n)
	let phase = new Float64Array(n)

	for (let i = 0; i < n; i++) {
		let w = i * Math.PI / n
		frequencies[i] = i * fs / (2 * n)

		let totalPhase = 0

		for (let j = 0; j < coefs.length; j++) {
			let c = coefs[j]
			let cosw = Math.cos(w), sinw = Math.sin(w)
			let cos2w = Math.cos(2*w), sin2w = Math.sin(2*w)

			let br = c.b0 + c.b1*cosw + c.b2*cos2w
			let bi = -c.b1*sinw - c.b2*sin2w
			let ar = 1 + c.a1*cosw + c.a2*cos2w
			let ai = -c.a1*sinw - c.a2*sin2w

			totalPhase += Math.atan2(bi, br) - Math.atan2(ai, ar)
		}

		phase[i] = totalPhase
	}

	// Unwrap along the frequency axis (atan2 wraps at ±π, and higher-order
	// filters accumulate more than π of phase), then delay = -φ/ω in samples
	let offset = 0
	for (let i = 1; i < n; i++) {
		let jump = phase[i] + offset - phase[i - 1]
		if (jump > Math.PI) offset -= 2 * Math.PI
		else if (jump < -Math.PI) offset += 2 * Math.PI
		phase[i] += offset
	}
	for (let i = 0; i < n; i++) {
		let w = i * Math.PI / n
		delay[i] = w > 0 ? -phase[i] / w : 0
	}

	return { frequencies, delay }
}

// ────── Impulse & step response ──────

/**
 * Compute impulse response of a filter.
 *
 * @param {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>|{b0:number,b1:number,b2:number,a1:number,a2:number}} coefs - SOS section(s)
 * @param {number} [N=256] - Number of samples
 * @returns {Float64Array}
 */
export function impulseResponse (coefs, N) {
	if (!N) N = 256
	let data = new Float64Array(N)
	data[0] = 1
	filter(data, { coefs })
	return data
}

/**
 * Compute step response of a filter.
 *
 * @param {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>|{b0:number,b1:number,b2:number,a1:number,a2:number}} coefs - SOS section(s)
 * @param {number} [N=256] - Number of samples
 * @returns {Float64Array}
 */
export function stepResponse (coefs, N) {
	if (!N) N = 256
	let data = new Float64Array(N)
	data.fill(1)
	filter(data, { coefs })
	return data
}

// ────── Filter info ──────

/**
 * Check if filter is stable (all poles inside unit circle).
 *
 * @param {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} sos - SOS sections
 * @returns {boolean}
 */
export function isStable (sos) {
	let {poles} = sos2zpk(sos)
	return poles.every(p => p.re * p.re + p.im * p.im < 1)
}

/**
 * Check if filter is minimum phase (all zeros inside or on unit circle).
 * Zeros legitimately ON the circle (every FIR stopband zero) plus root-finder
 * noise need headroom — pass a larger tol for numerically-derived filters
 * (e.g. minimumPhase() output carries ~1e-3 cepstral residue).
 *
 * @param {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} sos - SOS sections
 * @param {number} [tol=1e-8] - Allowed excursion of |zero| beyond 1
 * @returns {boolean}
 */
export function isMinPhase (sos, tol) {
	if (tol == null) tol = 1e-8
	let {zeros} = sos2zpk(sos)
	return zeros.every(z => z.re * z.re + z.im * z.im <= (1 + tol) * (1 + tol))
}

/**
 * Check if filter is FIR (all poles at origin, i.e., a1=a2=0).
 *
 * @param {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} sos - SOS sections
 * @returns {boolean}
 */
export function isFir (sos) {
	return sos.every(s => s.a1 === 0 && s.a2 === 0)
}

/**
 * Check if FIR coefficients have linear phase (symmetric or antisymmetric).
 *
 * @param {Float64Array|Array<number>} h - FIR coefficients
 * @returns {boolean}
 */
export function isLinPhase (h) {
	if (!(h instanceof Float64Array || Array.isArray(h))) return false
	let N = h.length
	// Check symmetric (Type I/II)
	let sym = true, antisym = true
	for (let i = 0; i < Math.floor(N / 2); i++) {
		if (Math.abs(h[i] - h[N - 1 - i]) > 1e-10) sym = false
		if (Math.abs(h[i] + h[N - 1 - i]) > 1e-10) antisym = false
	}
	return sym || antisym
}
