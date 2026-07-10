let {exp, abs, PI} = Math

/**
 * One Euro filter — adaptive lowpass for jitter removal.
 * Automatically adjusts cutoff based on signal speed:
 * slow signal → low cutoff (smooth), fast signal → high cutoff (responsive).
 *
 * Reference: Casiez et al., "1€ Filter", CHI 2012.
 *
 * @param {Float64Array} data - Input signal (modified in-place)
 * @param {object} params - {minCutoff, beta, dCutoff, fs}
 *   minCutoff: minimum cutoff frequency Hz (default 1)
 *   beta: speed coefficient — higher = more responsive (default 0.007)
 *   dCutoff: cutoff for derivative estimation (default 1)
 *   fs: sample rate (default 60 for UI, set to audio rate if needed)
 * @returns {Float64Array} filtered data
 */
export default function oneEuro (data, params) {
	let minCutoff = params.minCutoff || 1
	let beta = params.beta ?? 0.007   // ?? — beta 0 legitimately disables speed adaptation
	let dCutoff = params.dCutoff || 1
	let fs = params.fs || 60

	let x = params.x != null ? params.x : data[0]
	// Derivative uses the previous RAW sample (Casiez et al. 2012 reference
	// implementation, lastRawValue()), not the previous filtered output
	let xr = params.xr != null ? params.xr : data[0]
	let dx = params.dx ?? 0

	for (let i = 0; i < data.length; i++) {
		// Estimate derivative from raw input
		let rawDx = (data[i] - xr) * fs
		xr = data[i]
		let aDx = smoothingFactor(dCutoff, fs)
		dx = aDx * rawDx + (1 - aDx) * dx

		// Adaptive cutoff
		let cutoff = minCutoff + beta * abs(dx)
		let a = smoothingFactor(cutoff, fs)

		// Filter
		x = a * data[i] + (1 - a) * x
		data[i] = x
	}

	params.x = x
	params.xr = xr
	params.dx = dx
	return data
}

function smoothingFactor (cutoff, fs) {
	let tau = 1 / (2 * PI * cutoff)
	let te = 1 / fs
	return 1 / (1 + tau / te)
}
