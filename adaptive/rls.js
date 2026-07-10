/**
 * RLS (Recursive Least Squares) adaptive filter.
 * Faster convergence than LMS, O(N²) per sample.
 * @param {Float64Array} input - Input signal
 * @param {Float64Array} desired - Desired signal
 * @param {object} params - { order, lambda (forgetting factor, default 0.99), delta (init, default 100) }
 * @returns {Float64Array} Output signal
 */
export default function rls (input, desired, params) {
	let N = params.order || 16
	let lambda = params.lambda != null ? params.lambda : 0.99
	let delta = params.delta || 100

	// (Re)allocate state when absent or when order changed between calls
	if (!params.w || params.w.length !== N) {
		params.w = new Float64Array(N)
		params.buf = new Float64Array(N)
		params.ptr = 0
		params.P = null
	}
	if (!params.P) {
		// Initialize inverse correlation matrix as delta*I
		params.P = new Array(N)
		for (let i = 0; i < N; i++) {
			params.P[i] = new Float64Array(N)
			params.P[i][i] = delta
		}
	}

	let w = params.w, P = params.P, buf = params.buf
	let ptr = params.ptr || 0
	let output = new Float64Array(input.length)
	let error = new Float64Array(input.length)
	let x = new Float64Array(N)
	let Px = new Float64Array(N)
	let k = new Float64Array(N)

	for (let i = 0; i < input.length; i++) {
		buf[ptr] = input[i]

		// x vector (circular buffer to array)
		for (let j = 0; j < N; j++) x[j] = buf[(ptr - j + N) % N]

		// Output
		let y = 0
		for (let j = 0; j < N; j++) y += w[j] * x[j]
		output[i] = y

		let e = desired[i] - y
		error[i] = e

		// Gain vector: k = P*x / (lambda + x'*P*x)
		let xPx = 0
		for (let j = 0; j < N; j++) {
			let s = 0
			for (let l = 0; l < N; l++) s += P[j][l] * x[l]
			Px[j] = s
			xPx += x[j] * s
		}

		let denom = lambda + xPx
		for (let j = 0; j < N; j++) k[j] = Px[j] / denom

		// Update weights
		for (let j = 0; j < N; j++) w[j] += k[j] * e

		// Update P: P = (P - k*Px') / lambda
		let trace = 0
		for (let j = 0; j < N; j++) {
			for (let l = 0; l < N; l++) {
				P[j][l] = (P[j][l] - k[j] * Px[l]) / lambda
			}
			trace += P[j][j]
		}

		// Covariance anti-windup: with lambda < 1 and no excitation, P grows as
		// P/lambda each step without bound. delta·I is the maximum-uncertainty
		// prior, so cap trace(P) at its initial value N·delta (covariance
		// limiting — Åström & Wittenmark, Adaptive Control §11).
		let cap = N * delta
		if (trace > cap) {
			let scale = cap / trace
			for (let j = 0; j < N; j++) {
				for (let l = 0; l < N; l++) P[j][l] *= scale
			}
		}

		ptr = (ptr + 1) % N
	}

	params.ptr = ptr
	params.error = error
	return output
}
