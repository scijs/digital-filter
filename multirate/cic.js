/**
 * CIC (Cascaded Integrator-Comb) filter for decimation.
 * Multiplier-free: only additions and subtractions.
 * @param {Float64Array} data - Input signal
 * @param {number} R - Decimation ratio
 * @param {number} N - Number of CIC stages (default 3)
 * @returns {Float64Array} Decimated signal
 */
export default function cic (data, R, N) {
	if (!N) N = 3
	let len = data.length

	// Integrator stages (operate at input rate)
	let integ = new Float64Array(N)

	// Output
	let outLen = Math.floor(len / R)
	let output = new Float64Array(outLen)

	// Comb state (operates at output rate): previous input of each stage
	let combState = new Float64Array(N)

	let outIdx = 0
	for (let i = 0; i < len; i++) {
		// Integrator cascade (at input rate)
		let x = data[i]
		for (let j = 0; j < N; j++) {
			integ[j] += x
			x = integ[j]
		}

		// Decimation: take every R-th sample
		if ((i + 1) % R === 0 && outIdx < outLen) {
			// Comb cascade (at output rate)
			let y = x
			for (let j = 0; j < N; j++) {
				let prev = combState[j]
				combState[j] = y
				y = y - prev
			}
			output[outIdx++] = y / Math.pow(R, N) // normalize by R^N
		}
	}

	return output
}
