import firwin from '../fir/firwin.js'

/**
 * Generate half-band FIR filter coefficients.
 * Nearly half the coefficients are zero, halving multiply count.
 * @param {number} numtaps - Filter length (should be 4k+3 form for proper half-band)
 * @returns {Float64Array}
 */
export default function halfBand (numtaps) {
	if (!numtaps) numtaps = 31
	// Half-band: cutoff at Nyquist/2, constrained symmetry.
	// Kaiser beta 7.857 ≈ 80 dB stopband (beta = 0.1102*(A - 8.7), Kaiser 1974)
	let h = firwin(numtaps, 0.5, 2, {type: 'lowpass', window: ['kaiser', 7.857]})
	// Force half-band constraint: even-indexed coefficients (except center) = 0,
	// center tap = 0.5, then rescale the odd taps so DC gain stays exactly 1
	// (windowing perturbs their sum away from the ideal 0.5)
	let M = (numtaps - 1) / 2
	let oddSum = 0
	for (let i = 0; i < numtaps; i++) {
		if (i !== M && (i - M) % 2 === 0) h[i] = 0
		else if (i !== M) oddSum += h[i]
	}
	h[M] = 0.5
	if (oddSum !== 0) {
		let scale = 0.5 / oddSum
		for (let i = 0; i < numtaps; i++) if (i !== M) h[i] *= scale
	}
	return h
}
