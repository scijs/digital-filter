/**
 * Levinson-Durbin recursion: solve Toeplitz system for LPC coefficients.
 * Given autocorrelation sequence R[0..order], compute the prediction-error
 * filter A(z) = 1 + a[1]z^-1 + ... + a[order]z^-order — the standard convention
 * (scipy solve_toeplitz(r[:p], -r[1:p+1]), MATLAB levinson, O&S): the signal is
 * predicted as x̂[n] = -Σ a[j]·x[n-j], and {b: [1], a} feeds this library's
 * filter/freqz/tf2zpk directly as a whitening filter.
 *
 * @param {Float64Array|Array} R - Autocorrelation values R[0], R[1], ..., R[order]
 * @param {number} order - LPC order (default R.length - 1)
 * @returns {{a: Float64Array, error: number, k: Float64Array}} Coefficients (a[0]=1), prediction error power, reflection coefficients
 */
export default function levinson (R, order) {
	if (order == null) order = R.length - 1

	let a = new Float64Array(order + 1)
	let k = new Float64Array(order) // reflection coefficients
	a[0] = 1
	let E = R[0]

	for (let i = 1; i <= order; i++) {
		// Reflection coefficient: k = -(R[i] + Σ a[j]·R[i-j]) / E
		let acc = R[i]
		for (let j = 1; j < i; j++) acc += a[j] * R[i - j]
		k[i - 1] = -acc / E

		// Update coefficients
		let prev = Float64Array.from(a)
		a[i] = k[i - 1]
		for (let j = 1; j < i; j++) a[j] = prev[j] + k[i - 1] * prev[i - j]

		// Update error
		E *= (1 - k[i - 1] * k[i - 1])
	}

	return { a, error: E, k }
}
