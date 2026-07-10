/**
 * Compute frequency response of SOS filter sections, or of a {b, a} transfer
 * function (the shape yulewalk/thiran return, scipy.signal.freqz style).
 *
 * @param {Array<{b0,b1,b2,a1,a2}>|{b0,b1,b2,a1,a2}|{b: ArrayLike, a: ArrayLike}} coefs - SOS section(s) or transfer function
 * @param {number} [n=512] - Number of frequency points
 * @param {number} [fs=44100] - Sample rate in Hz
 * @returns {{frequencies: Float64Array, magnitude: Float64Array, phase: Float64Array}}
 */
export default function freqz (coefs, n, fs) {
	if (!fs) fs = 44100
	let tf = null
	if (!Array.isArray(coefs)) {
		if (coefs.b && coefs.a) tf = coefs
		else if (coefs.b0 == null) throw Error('freqz: coefs must be SOS ({b0,b1,b2,a1,a2}) or a {b, a} transfer function')
		coefs = tf ? [] : [coefs]
	}

	// n can be a number (evenly spaced) or an array of Hz values
	let freqArr = null
	if (Array.isArray(n) || (n && n.length !== undefined && typeof n !== 'number')) {
		freqArr = n
		n = freqArr.length
	} else {
		if (!n) n = 512
	}

	let frequencies = new Float64Array(n)
	let magnitude = new Float64Array(n)
	let phase = new Float64Array(n)

	for (let i = 0; i < n; i++) {
		let w = freqArr ? (2 * Math.PI * freqArr[i] / fs) : (i * Math.PI / n)
		frequencies[i] = freqArr ? freqArr[i] : (i * fs / (2 * n))

		let cosw = Math.cos(w), sinw = Math.sin(w)
		let cos2w = Math.cos(2 * w), sin2w = Math.sin(2 * w)

		let totalMag = 1
		let totalPhase = 0

		if (tf) {
			// Polynomial ratio B(e^-jw)/A(e^-jw), coefficients ascending z^-1
			let br = 0, bi = 0, ar = 0, ai = 0
			for (let k = 0; k < tf.b.length; k++) { br += tf.b[k] * Math.cos(k * w); bi -= tf.b[k] * Math.sin(k * w) }
			for (let k = 0; k < tf.a.length; k++) { ar += tf.a[k] * Math.cos(k * w); ai -= tf.a[k] * Math.sin(k * w) }
			totalMag = Math.sqrt((br * br + bi * bi) / (ar * ar + ai * ai))
			totalPhase = Math.atan2(bi, br) - Math.atan2(ai, ar)
		}

		for (let j = 0; j < coefs.length; j++) {
			let c = coefs[j]
			let br = c.b0 + c.b1 * cosw + c.b2 * cos2w
			let bi = -c.b1 * sinw - c.b2 * sin2w
			let ar = 1 + c.a1 * cosw + c.a2 * cos2w
			let ai = -c.a1 * sinw - c.a2 * sin2w

			totalMag *= Math.sqrt((br * br + bi * bi) / (ar * ar + ai * ai))
			totalPhase += Math.atan2(bi, br) - Math.atan2(ai, ar)
		}

		magnitude[i] = totalMag
		phase[i] = totalPhase
	}

	return { frequencies, magnitude, phase }
}

/**
 * Convert magnitude to decibels.
 *
 * @param {number|Float64Array|Array<number>} mag - Magnitude value(s)
 * @returns {number|Float64Array} dB value(s)
 */
export function mag2db (mag) {
	if (typeof mag === 'number') return 20 * Math.log10(mag)
	let db = new Float64Array(mag.length)
	for (let i = 0; i < mag.length; i++) db[i] = 20 * Math.log10(mag[i])
	return db
}
