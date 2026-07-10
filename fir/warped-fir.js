/**
 * Frequency-warped FIR filter using first-order allpass delay elements.
 * Concentrates frequency resolution at low frequencies (matches hearing).
 *
 * @module  digital-filter/warped-fir
 */

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { coefs: FIR coefficients, lambda: warping factor (-1 to 1) }
 */
export default function warpedFir (data, params) {
	let h = params.coefs
	let lambda = params.lambda ?? 0.7  // ?? — lambda 0 legitimately disables warping (plain FIR); 0.7 typical for audio at 44.1kHz
	let N = h.length

	if (!params._s) params._s = new Float64Array(N)
	let s = params._s

	for (let i = 0, len = data.length; i < len; i++) {
		// Warped delay line: unit delays replaced by first-order allpasses
		// D(z) = (z^-1 - λ)/(1 - λ·z^-1)  (Härmä et al., "Frequency-Warped
		// Signal Processing for Audio Applications"). Per stage, DF2T:
		//   out = -λ·u + state;  state' = u + λ·out
		let u = data[i]
		let y = h[0] * u
		for (let j = 1; j < N; j++) {
			let out = -lambda * u + s[j - 1]
			s[j - 1] = u + lambda * out
			y += h[j] * out
			u = out
		}
		data[i] = y
	}

	return data
}
