/**
 * Filter order estimation functions.
 * Given passband/stopband specs, return the minimum order needed.
 *
 * @module digital-filter/iir/ordest
 */

/**
 * Butterworth minimum order estimation.
 * @param {number} fpass - Passband edge Hz
 * @param {number} fstop - Stopband edge Hz
 * @param {number} rp - Max passband ripple dB
 * @param {number} rs - Min stopband attenuation dB
 * @param {number} fs - Sample rate Hz
 * @returns {{order: number, Wn: number}} Minimum order and natural frequency
 */
export function buttord (fpass, fstop, rp, rs, fs) {
	let wp = Math.tan(Math.PI * fpass / fs)
	let ws = Math.tan(Math.PI * fstop / fs)
	let ratio = ws / wp
	if (ratio < 1) ratio = 1 / ratio
	let N = Math.ceil(Math.log10((Math.pow(10, rs / 10) - 1) / (Math.pow(10, rp / 10) - 1)) / (2 * Math.log10(ratio)))
	N = Math.max(N, 1)
	// Natural frequency: geometric mean of passband and stopband (prewarped)
	let Wn = fpass < fstop
		? Math.atan(wp * Math.pow(Math.pow(10, rp / 10) - 1, -1 / (2 * N))) * fs / Math.PI
		: Math.atan(ws * Math.pow(Math.pow(10, rs / 10) - 1, 1 / (2 * N))) * fs / Math.PI
	return { order: N, Wn }
}

/**
 * Chebyshev Type I minimum order estimation.
 * @param {number} fpass - Passband edge Hz
 * @param {number} fstop - Stopband edge Hz
 * @param {number} rp - Max passband ripple dB
 * @param {number} rs - Min stopband attenuation dB
 * @param {number} fs - Sample rate Hz
 * @returns {{order: number, Wn: number}} Minimum order and natural frequency
 */
export function cheb1ord (fpass, fstop, rp, rs, fs) {
	let wp = Math.tan(Math.PI * fpass / fs)
	let ws = Math.tan(Math.PI * fstop / fs)
	let ratio = ws / wp
	if (ratio < 1) ratio = 1 / ratio
	let eps = Math.sqrt(Math.pow(10, rp / 10) - 1)
	let N = Math.ceil(Math.acosh(Math.sqrt((Math.pow(10, rs / 10) - 1) / (eps * eps))) / Math.acosh(ratio))
	N = Math.max(N, 1)
	return { order: N, Wn: fpass }
}

/**
 * Chebyshev Type II minimum order estimation.
 * @param {number} fpass - Passband edge Hz
 * @param {number} fstop - Stopband edge Hz
 * @param {number} rp - Max passband ripple dB
 * @param {number} rs - Min stopband attenuation dB
 * @param {number} fs - Sample rate Hz
 * @returns {{order: number, Wn: number}} Minimum order and natural frequency
 */
export function cheb2ord (fpass, fstop, rp, rs, fs) {
	// Same order formula as cheb1ord (dual relationship).
	// Wn convention: the stopband edge, ready to feed chebyshev2(order, Wn, ...)
	// whose fc parameter IS the stopband edge — the stopband spec is then met
	// exactly and the passband over-satisfied. (scipy's cheb2ord instead pulls
	// Wn below fstop so the passband is exact; same order, different Wn.)
	let { order } = cheb1ord(fpass, fstop, rp, rs, fs)
	return { order, Wn: fstop }
}

/**
 * Elliptic minimum order estimation.
 * @param {number} fpass - Passband edge Hz
 * @param {number} fstop - Stopband edge Hz
 * @param {number} rp - Max passband ripple dB
 * @param {number} rs - Min stopband attenuation dB
 * @param {number} fs - Sample rate Hz
 * @returns {{order: number, Wn: number}} Minimum order and natural frequency
 */
export function ellipord (fpass, fstop, rp, rs, fs) {
	let wp = Math.tan(Math.PI * fpass / fs)
	let ws = Math.tan(Math.PI * fstop / fs)
	let k = wp / ws
	if (k > 1) k = 1 / k
	let k1 = Math.sqrt(1 - k * k)
	let eps = Math.sqrt(Math.pow(10, rp / 10) - 1)
	let delta = Math.sqrt((Math.pow(10, rs / 10) - 1) / (eps * eps))
	// Landen transformation for complete elliptic integral ratio
	let q0 = 0.5 * (1 - Math.sqrt(k1)) / (1 + Math.sqrt(k1))
	let q = q0 + 2 * Math.pow(q0, 5) + 15 * Math.pow(q0, 9) + 150 * Math.pow(q0, 13)
	let D = (Math.log10(16 * delta * delta) / Math.log10(1 / q))
	let N = Math.max(Math.ceil(D), 1)
	return { order: N, Wn: fpass }
}
