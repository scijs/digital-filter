/**
 * Savitzky-Golay smoothing: local least-squares polynomial fit as an FIR.
 * Edges use clamp-to-boundary (nearest) padding — simpler than
 * scipy.signal.savgol_filter's default mode='interp', which refits a
 * polynomial on each edge window; interior samples are identical.
 *
 * @module  digital-filter/savitzky-golay
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { windowSize: odd window length (default 5),
 *   degree: polynomial order (default 2), derivative: order 0..degree (default 0) }
 * @returns {Float64Array} data
 */
export default function savitzkyGolay(data, params) {
	let m = params.windowSize || 5
	let p = params.degree || 2
	let d = params.derivative || 0

	// compute coefficients on first call, cache
	if (!params._coefs) {
		let halfM = (m - 1) / 2

		// build Vandermonde matrix J (m rows x (p+1) cols)
		let J = []
		for (let i = 0; i < m; i++) {
			let row = []
			let x = i - halfM
			for (let j = 0; j <= p; j++) {
				row.push(Math.pow(x, j))
			}
			J.push(row)
		}

		// compute J^T * J
		let cols = p + 1
		let JtJ = Array(cols).fill(null).map(() => Array(cols).fill(0))
		for (let i = 0; i < cols; i++) {
			for (let j = 0; j < cols; j++) {
				let sum = 0
				for (let k = 0; k < m; k++) sum += J[k][i] * J[k][j]
				JtJ[i][j] = sum
			}
		}

		// invert JtJ via Gauss-Jordan elimination
		let inv = Array(cols).fill(null).map((_, i) => {
			let row = Array(cols).fill(0)
			row[i] = 1
			return row
		})
		let mat = JtJ.map(r => r.slice())

		for (let i = 0; i < cols; i++) {
			let pivot = mat[i][i]
			for (let j = 0; j < cols; j++) {
				mat[i][j] /= pivot
				inv[i][j] /= pivot
			}
			for (let k = 0; k < cols; k++) {
				if (k === i) continue
				let factor = mat[k][i]
				for (let j = 0; j < cols; j++) {
					mat[k][j] -= factor * mat[i][j]
					inv[k][j] -= factor * inv[i][j]
				}
			}
		}

		// row d of (JtJ)^-1 * J^T gives derivative-order d coefficients
		// multiply by d! for proper scaling
		let coefs = new Float64Array(m)
		let dFact = 1
		for (let i = 2; i <= d; i++) dFact *= i

		for (let k = 0; k < m; k++) {
			let sum = 0
			for (let j = 0; j < cols; j++) {
				sum += inv[d][j] * J[k][j]
			}
			coefs[k] = sum * dFact
		}

		params._coefs = coefs
	}

	let coefs = params._coefs
	let halfM = (m - 1) / 2
	let n = data.length

	// apply centered FIR convolution, clamp edges
	let input = new Float64Array(data)

	for (let i = 0; i < n; i++) {
		let sum = 0
		for (let j = 0; j < m; j++) {
			let idx = i + j - halfM
			if (idx < 0) idx = 0
			if (idx >= n) idx = n - 1
			sum += coefs[j] * input[idx]
		}
		data[i] = sum
	}

	return data
}
