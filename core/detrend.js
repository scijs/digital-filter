/**
 * Remove DC offset or linear trend from data (in-place).
 *
 * @module  digital-filter/detrend
 * @param {Float64Array|Float32Array|Array<number>} data - Input samples (modified in-place)
 * @param {'linear'|'constant'|'dc'} [type='linear'] - Type of trend to remove
 * @returns {Float64Array|Float32Array|Array<number>} Detrended data (same reference as input)
 */
export default function detrend (data, type) {
	if (!type) type = 'linear'
	let N = data.length
	if (type === 'constant' || type === 'dc') {
		let mean = 0
		for (let i = 0; i < N; i++) mean += data[i]
		mean /= N
		for (let i = 0; i < N; i++) data[i] -= mean
	} else {
		// Linear: fit y = a + b*x by least squares, subtract
		let sx = 0, sy = 0, sxx = 0, sxy = 0
		for (let i = 0; i < N; i++) { sx += i; sy += data[i]; sxx += i * i; sxy += i * data[i] }
		let b = (N * sxy - sx * sy) / (N * sxx - sx * sx)
		let a = (sy - b * sx) / N
		for (let i = 0; i < N; i++) data[i] -= (a + b * i)
	}
	return data
}
