/**
 * Arbitrary-order IIR filter processing (Direct Form II Transposed).
 * Processes data in-place using feedforward (b) and feedback (a) coefficient arrays.
 *
 * @param {Float64Array} data - Input/output samples (modified in-place)
 * @param {object} params
 * @param {Array|Float64Array} params.b - Feedforward coefficients (numerator)
 * @param {Array|Float64Array} params.a - Feedback coefficients (denominator, a[0] should be 1)
 * @param {Float64Array} [params.state] - Filter state (persisted between calls)
 * @returns {Float64Array} data (same reference)
 */
export default function iir (data, params) {
	let { b, a } = params
	if (!b || !a) {
		throw Error(params.coefs
			? 'iir: got SOS coefs — use filter(data, {coefs})'
			: 'iir: params must carry {b, a} coefficient arrays')
	}
	let nb = b.length, na = a.length
	let order = Math.max(nb, na) - 1

	// Normalize by a[0] if needed
	let a0 = a[0] || 1
	if (a0 !== 1) {
		b = Array.from(b, v => v / a0)
		a = Array.from(a, v => v / a0)
	}

	// Initialize or reuse state
	if (!params.state) params.state = new Float64Array(order)
	let state = params.state

	for (let i = 0; i < data.length; i++) {
		let x = data[i]
		let y = b[0] * x + (order > 0 ? state[0] : 0)
		for (let j = 0; j < order - 1; j++) {
			state[j] = (j + 1 < nb ? b[j + 1] : 0) * x - (j + 1 < na ? a[j + 1] : 0) * y + state[j + 1]
		}
		if (order > 0) {
			state[order - 1] = (order < nb ? b[order] : 0) * x - (order < na ? a[order] : 0) * y
		}
		data[i] = y
	}

	return data
}
