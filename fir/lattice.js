/**
 * Lattice filter over reflection coefficients (k) — better numerical behavior
 * than direct form for adaptive and LPC applications.
 *
 * type 'fir' (default): analysis / prediction-error (whitening) lattice,
 *   output f_N[n] — an all-zero filter.
 * type 'iir': synthesis all-pole lattice — the inverse structure; with the
 *   optional ladder v it becomes the pole-zero lattice-ladder (MATLAB latcfilt).
 * iir(fir(x)) with the same k is the identity.
 *
 * @module  digital-filter/lattice
 */

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { k: reflection coefficients, v: ladder coefficients (optional), type: 'fir'|'iir' }
 */
export default function lattice (data, params) {
	let k = params.k  // reflection coefficients
	let v = params.v  // ladder (feedforward) coefficients, optional
	let N = k.length

	if (!params._state) params._state = new Float64Array(N)
	let s = params._state  // s[j] = backward error g_j[n-1]

	if (params.type === 'iir') return iirLattice(data, k, v, s, N)

	// Pre-allocate work arrays
	if (!params._f) { params._f = new Float64Array(N + 1); params._g = new Float64Array(N + 1) }
	let f = params._f, g = params._g

	for (let i = 0, len = data.length; i < len; i++) {
		f[0] = data[i]
		g[0] = data[i]

		for (let j = 0; j < N; j++) {
			f[j + 1] = f[j] + k[j] * s[j]
			g[j + 1] = k[j] * f[j] + s[j]
		}

		// State = backward outputs (delayed one sample for next iteration)
		for (let j = 0; j < N; j++) s[j] = g[j]

		if (v) {
			let y = 0
			for (let j = 0; j <= N; j++) y += (v[j] || 0) * f[j]
			data[i] = y
		} else {
			data[i] = f[N]
		}
	}

	return data
}

// All-pole synthesis lattice: input is f_N[n]; run the recursion backwards
//   f_{j-1}[n] = f_j[n] - k_j·g_{j-1}[n-1]
//   g_j[n]     = k_j·f_{j-1}[n] + g_{j-1}[n-1]
// output y = f_0 (= g_0), or the ladder sum Σ v_j·g_j[n] when v is given.
function iirLattice (data, k, v, s, N) {
	for (let i = 0, len = data.length; i < len; i++) {
		// downward: f_{j}[n] = f_{j+1}[n] - k_j·g_j[n-1] recovers f_0
		let f = data[i]
		for (let j = N - 1; j >= 0; j--) f -= k[j] * s[j]
		// upward: g_0[n] = f_0[n]; g_{j+1}[n] = k_j·f_j[n] + g_j[n-1],
		// recomputing f_{j+1} = f_j + k_j·g_j[n-1] on the way (no work array)
		let y = f          // f_0
		let g = f          // g_0[n]
		let ladder = v ? (v[0] || 0) * g : 0
		for (let j = 0; j < N; j++) {
			let gNext = k[j] * y + s[j]  // g_{j+1}[n], with y = f_j[n]
			let fNext = y + k[j] * s[j]  // f_{j+1}[n]
			s[j] = g
			g = gNext
			y = fNext
			if (v) ladder += (v[j + 1] || 0) * g
		}
		data[i] = v ? ladder : f
	}
	return data
}
