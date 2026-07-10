/**
 * LMS adaptive filter.
 * Adjusts FIR coefficients to minimize error between output and desired signal.
 *
 * @param {Float64Array} input - Input signal
 * @param {Float64Array} desired - Desired signal (same length)
 * @param {object} params - {order, mu, w, error}
 *   order: filter order (number of taps, default 32)
 *   mu: step size (default 0.01)
 *   w: coefficient vector (auto-initialized, persists)
 *   error: error signal output (auto-allocated)
 * @returns {Float64Array} filtered output
 */
export default function lms (input, desired, params) {
	let N = params.order || 32
	let mu = params.mu || 0.01

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
		// Shift input into buffer
		buf[ptr] = input[i]

		// Compute output: y = w^T * x
		let y = 0
		for (let j = 0; j < N; j++) {
			y += w[j] * buf[(ptr - j + N) % N]
		}
		output[i] = y

		// Compute error
		let e = desired[i] - y
		error[i] = e

		// Update weights: w += mu * e * x
		for (let j = 0; j < N; j++) {
			w[j] += mu * e * buf[(ptr - j + N) % N]
		}

		ptr = (ptr + 1) % N
	}

	params.ptr = ptr
	params.error = error

	return output
}
