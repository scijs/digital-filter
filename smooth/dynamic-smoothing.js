/**
 * Dynamic smoothing — self-modulating lowpass: cutoff opens when the signal
 * moves fast, closes when it is stable. Implements the "efficient" algorithm
 * from Andrew Simper, "Dynamic Smoothing Using Self Modulating Filter"
 * (Cytomic technical paper, 2016): two cascaded one-pole stages whose shared
 * coefficient g is driven by the band difference between them,
 *   g = min(g0 + sensitivity·|low1 - low2|, 1)
 *
 * @module  digital-filter/dynamic-smoothing
 */

let { abs, min, tan, PI } = Math

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { fc: base cutoff Hz (default 1), sensitivity (default 1, 0 = plain lowpass), fs }
 */
export default function dynamicSmoothing (data, params) {
	if (params.maxFc != null) throw new TypeError('dynamicSmoothing: maxFc is gone — the 2.4 algorithm (Simper self-modulating) takes a single fc; pass { fc }')
	let fc = params.fc || params.minFc || 1
	let sens = params.sensitivity ?? 1
	let fs = params.fs || 44100

	// Base coefficient from cutoff (TPT one-pole): g0 = 2·gc/(1+gc), gc = tan(π·fc/fs)
	let gc = tan(PI * fc / fs)
	let g0 = 2 * gc / (1 + gc)

	let low1 = params._low1 ?? data[0] ?? 0
	let low2 = params._low2 ?? data[0] ?? 0

	for (let i = 0, n = data.length; i < n; i++) {
		let band = low1 - low2
		let g = min(g0 + sens * abs(band), 1)
		low1 = low1 + g * (data[i] - low1)
		low2 = low2 + g * (low1 - low2)
		data[i] = low2
	}

	params._low1 = low1
	params._low2 = low2
	return data
}
