/**
 * IIR filter design matching arbitrary frequency response (Yule-Walker method)
 *
 * @module  digital-filter/yulewalk
 */

import levinson from '../adaptive/levinson.js'

let { cos, sin, sqrt, PI } = Math

/**
 * @param {number} order - Filter order (number of poles = number of zeros)
 * @param {Array} frequencies - Frequency points [0-1] where 1 = Nyquist
 * @param {Array} magnitudes - Desired magnitude at each frequency point
 * @returns {{b: Float64Array, a: Float64Array}} Numerator and denominator coefficients
 */
export default function yulewalk (order, frequencies, magnitudes) {
	let N = 512

	// Interpolate desired magnitude onto a dense grid over [0, Nyquist]:
	// grid index i ↔ f = i/N ↔ w = π·i/N (the response is symmetric, so only
	// the half-spectrum is sampled — using the full circle would alias)
	let H = new Float64Array(N + 1)
	for (let i = 0; i <= N; i++) {
		let f = i / N
		let j = 0
		while (j < frequencies.length - 1 && frequencies[j + 1] < f) j++
		if (j >= frequencies.length - 1) { H[i] = magnitudes[magnitudes.length - 1]; continue }
		let t = (f - frequencies[j]) / (frequencies[j + 1] - frequencies[j])
		H[i] = magnitudes[j] + t * (magnitudes[j + 1] - magnitudes[j])
	}

	// Autocorrelation of the desired power spectrum:
	// R[k] = (1/π)∫₀^π H²(w)·cos(kw) dw, trapezoid rule on w = π·i/N
	let R = new Float64Array(order + 1)
	for (let k = 0; k <= order; k++) {
		let sum = 0
		for (let i = 0; i <= N; i++) {
			let wgt = (i === 0 || i === N) ? 0.5 : 1
			sum += wgt * H[i] * H[i] * cos(PI * k * i / N)
		}
		R[k] = sum / N
	}

	// Solve Yule-Walker equations via Levinson-Durbin
	let a = levinson(R, order).a

	// Numerator: zero-phase cosine-series fit of B(w) ≈ H(w)·|A(w)|
	let b = new Float64Array(order + 1)
	for (let k = 0; k <= order; k++) {
		let sum = 0
		for (let i = 0; i <= N; i++) {
			let w = PI * i / N
			let ar = 1, ai = 0
			for (let j = 1; j <= order; j++) {
				ar += a[j] * cos(j * w)
				ai -= a[j] * sin(j * w)
			}
			let Amag = sqrt(ar * ar + ai * ai)
			let wgt = (i === 0 || i === N) ? 0.5 : 1
			sum += wgt * H[i] * Amag * cos(k * w) * (k === 0 ? 1 : 2)
		}
		b[k] = sum / N
	}

	return { b: Float64Array.from(b), a: Float64Array.from(a) }
}
