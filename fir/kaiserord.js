/**
 * Estimate Kaiser window FIR filter order and beta parameter.
 * @param {number} deltaF - Transition bandwidth as fraction of Nyquist (0-1)
 * @param {number} attenuation - Desired stopband attenuation in dB
 * @returns {{numtaps: number, beta: number}}
 */
export default function kaiserord (deltaF, attenuation) {
	let A = attenuation
	let beta

	if (A > 50) {
		beta = 0.1102 * (A - 8.7)
	} else if (A >= 21) {
		beta = 0.5842 * Math.pow(A - 21, 0.4) + 0.07886 * (A - 21)
	} else {
		beta = 0
	}

	// Kaiser's formula: N = (A - 7.95)/(2.285*Δω) + 1 (scipy.signal.kaiserord)
	let numtaps = Math.ceil((A - 7.95) / (2.285 * deltaF * Math.PI) + 1)
	// Ensure odd (Type I — no forced zero at Nyquist)
	if (numtaps % 2 === 0) numtaps++

	return { numtaps, beta }
}
