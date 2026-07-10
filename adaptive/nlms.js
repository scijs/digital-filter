/**
 * Normalized LMS adaptive filter.
 * Step size normalized by input power — converges faster than LMS.
 *
 * @param {Float64Array} input - Input signal
 * @param {Float64Array} desired - Desired signal
 * @param {object} params - {order, mu, eps, w}
 *   order: filter order (default 32)
 *   mu: step size 0-2 (default 0.5)
 *   eps: regularization (default 1e-8)
 * @returns {Float64Array} filtered output
 */
export default function nlms (input, desired, params) {
	let N = params.order || 32
	let mu = params.mu || 0.5
	let eps = params.eps || 1e-8

	// (Re)allocate state when absent or when order changed between calls
	if (!params.w || params.w.length !== N) {
		params.w = new Float64Array(N)
		params.buf = new Float64Array(N)
		params.ptr = 0
	}

	let w = params.w
	let buf = params.buf
	let ptr = params.ptr || 0
	let output = new Float64Array(input.length)
	let error = new Float64Array(input.length)

	for (let i = 0; i < input.length; i++) {
		buf[ptr] = input[i]

		// Output and input power
		let y = 0, power = 0
		for (let j = 0; j < N; j++) {
			let x = buf[(ptr - j + N) % N]
			y += w[j] * x
			power += x * x
		}
		output[i] = y

		let e = desired[i] - y
		error[i] = e

		// Normalized update
		let step = mu / (power + eps)
		for (let j = 0; j < N; j++) {
			w[j] += step * e * buf[(ptr - j + N) % N]
		}

		ptr = (ptr + 1) % N
	}

	params.ptr = ptr
	params.error = error
	return output
}
