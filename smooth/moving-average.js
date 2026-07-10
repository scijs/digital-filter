/**
 * Moving average — boxcar FIR, O(1) per sample via running sum.
 *
 * @module  digital-filter/moving-average
 */

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { memory: window size (number) or pre-seeded history
 *   array (avoids startup ramp); ptr: internal write index (managed) }
 * @returns {Float64Array} data
 */
export default function movingAverage (data, params) {
	let ptr = params.ptr
	let mem = params.memory

	//init memory, if ptr is not defined
	if (ptr == null) {
		if (!mem) mem = 8
		// a number allocates zeroed history; a supplied array is honored as
		// pre-seeded history (e.g. to avoid a startup ramp)
		if (typeof mem === 'number') mem = new Array(mem).fill(0)
		ptr = params.ptr = 0
		params.memory = mem
	}

	let m = mem.length
	let sum = params._sum
	if (sum == null) {
		sum = 0
		for (let j = 0; j < m; j++) sum += mem[j]
	}

	for (let i = 0, l = data.length; i < l; i++) {
		sum += data[i] - mem[ptr]
		mem[ptr] = data[i]
		ptr = (ptr + 1) % m
		data[i] = sum / m
		// refresh the running sum periodically to bound float drift
		if (ptr === 0) {
			sum = 0
			for (let j = 0; j < m; j++) sum += mem[j]
		}
	}

	params.ptr = ptr
	params._sum = sum

	return data
}
