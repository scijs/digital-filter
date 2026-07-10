/**
 * One-pole lowpass filter (exponential moving average)
 * y[n] = (1-a) * x[n] + a * y[n-1]
 *
 * @module  digital-filter/one-pole
 */

let {exp, PI} = Math

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { fc: cutoff Hz, fs: sample rate (default 44100),
 *   a: pole coefficient override — the weight on the PREVIOUS output,
 *   a = exp(-2π·fc/fs) (note: one-euro's alpha is the opposite convention,
 *   the weight on the current sample); y1: state (managed) }
 * @returns {Float64Array} data
 */
export default function onePole (data, params) {
	let y1 = params.y1 != null ? params.y1 : 0
	let a = params.a
	if (a == null) a = exp(-2 * PI * params.fc / (params.fs || 44100))

	for (let i = 0, l = data.length; i < l; i++) {
		y1 = (1 - a) * data[i] + a * y1
		data[i] = y1
	}

	params.y1 = y1

	return data
}
