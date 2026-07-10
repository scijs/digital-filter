/**
 * Convert linear-phase FIR to minimum-phase via the homomorphic (cepstral)
 * method — scipy.signal.minimum_phase(method='homomorphic', half=False):
 * magnitude response preserved, group delay roughly halved, same length.
 *
 * @module  digital-filter/minimum-phase
 */

let { log, exp, cos, sin, ceil, log2, max, hypot, PI } = Math

/**
 * @param {Float64Array} h - Linear-phase FIR coefficients
 * @returns {Float64Array} Minimum-phase FIR coefficients (same length)
 */
export default function minimumPhase (h) {
	let N = h.length
	// Dense grid keeps the cepstral aliasing error small enough that the
	// result's zeros actually stay inside the unit circle (scipy's rule)
	let nfft = 1 << max(6, ceil(log2(2 * (N - 1) / 0.01)))

	// |H(w)| on the dense grid
	let re = new Float64Array(nfft)
	let im = new Float64Array(nfft)
	re.set(h)
	fft(re, im, false)
	let logMag = new Float64Array(nfft)
	for (let k = 0; k < nfft; k++) {
		logMag[k] = log(max(hypot(re[k], im[k]), 1e-20))
	}

	// Real cepstrum = ifft(log|H|)
	let cr = Float64Array.from(logMag)
	let ci = new Float64Array(nfft)
	fft(cr, ci, true)

	// Fold: keep n=0 and n=nfft/2, double 1..nfft/2-1, zero the rest
	for (let n = 1; n < nfft / 2; n++) { cr[n] *= 2; ci[n] *= 2 }
	for (let n = nfft / 2 + 1; n < nfft; n++) { cr[n] = 0; ci[n] = 0 }

	// exp(fft(folded cepstrum)) → minimum-phase spectrum → ifft
	fft(cr, ci, false)
	for (let k = 0; k < nfft; k++) {
		let m = exp(cr[k])
		cr[k] = m * cos(ci[k])
		ci[k] = m * sin(ci[k])
	}
	fft(cr, ci, true)

	return Float64Array.from(cr.subarray(0, N))
}

// In-place iterative radix-2 FFT (inverse: conjugate twiddles + 1/n scale)
function fft (re, im, inverse) {
	let n = re.length
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1
		for (; j & bit; bit >>= 1) j ^= bit
		j ^= bit
		if (i < j) {
			let t = re[i]; re[i] = re[j]; re[j] = t
			t = im[i]; im[i] = im[j]; im[j] = t
		}
	}
	for (let len = 2; len <= n; len <<= 1) {
		let ang = (inverse ? 2 : -2) * PI / len
		let wr = cos(ang), wi = sin(ang)
		for (let i = 0; i < n; i += len) {
			let cwr = 1, cwi = 0
			for (let j = 0; j < len / 2; j++) {
				let ur = re[i + j], ui = im[i + j]
				let vr = re[i + j + len / 2] * cwr - im[i + j + len / 2] * cwi
				let vi = re[i + j + len / 2] * cwi + im[i + j + len / 2] * cwr
				re[i + j] = ur + vr; im[i + j] = ui + vi
				re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi
				let nwr = cwr * wr - cwi * wi
				cwi = cwr * wi + cwi * wr
				cwr = nwr
			}
		}
	}
	if (inverse) {
		for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n }
	}
}
