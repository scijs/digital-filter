/**
 * Upsample, FIR filter, downsample — the general multirate primitive.
 * Direct evaluation without an intermediate upsampled buffer: each output
 * taps only the input samples aligned to the upsample grid.
 *
 * @param {Float64Array|Array<number>} data - Input signal
 * @param {Float64Array|Array<number>} h - FIR filter coefficients
 * @param {number} [up=1] - Upsampling factor
 * @param {number} [down=1] - Downsampling factor
 * @returns {Float64Array} Output signal
 */
export default function upfirdn (data, h, up, down) {
	if (!up) up = 1
	if (!down) down = 1

	let xLen = data.length
	let hLen = h.length
	let outLen = Math.floor(((xLen - 1) * up + hLen + down - 1) / down)
	let out = new Float64Array(outLen)

	for (let n = 0; n < outLen; n++) {
		let sum = 0
		// Output sample n corresponds to upsampled index n*down
		let upIdx = n * down
		for (let k = 0; k < hLen; k++) {
			let srcIdx = upIdx - k
			// srcIdx must be a multiple of `up` to correspond to an actual input sample
			if (srcIdx >= 0 && srcIdx % up === 0) {
				let xi = srcIdx / up
				if (xi < xLen) sum += h[k] * data[xi]
			}
		}
		out[n] = sum
	}

	return out
}
