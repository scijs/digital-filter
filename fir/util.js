let { cos, sqrt, abs, PI } = Math

// Symmetric (sym=true) window definitions, N-1 denominator — matches
// scipy.signal.windows / Harris 1978 "On the use of windows..." conventions.

/**
 * Hamming window.
 * @param {number} N - Window length
 * @returns {Float64Array}
 */
export function hamming (N) {
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) w[i] = 0.54 - 0.46 * cos(2 * PI * i / (N - 1))
	return w
}

/**
 * Hann window.
 * @param {number} N
 * @returns {Float64Array}
 */
export function hann (N) {
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * cos(2 * PI * i / (N - 1))
	return w
}

/**
 * Blackman window (a0=0.42, a1=0.5, a2=0.08).
 * @param {number} N
 * @returns {Float64Array}
 */
export function blackman (N) {
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		let x = 2 * PI * i / (N - 1)
		w[i] = 0.42 - 0.5 * cos(x) + 0.08 * cos(2 * x)
	}
	return w
}

/**
 * 4-term Blackman-Harris window (-92 dB sidelobes).
 * @param {number} N
 * @returns {Float64Array}
 */
export function blackmanHarris (N) {
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		let x = 2 * PI * i / (N - 1)
		w[i] = 0.35875 - 0.48829 * cos(x) + 0.14128 * cos(2 * x) - 0.01168 * cos(3 * x)
	}
	return w
}

/**
 * Bartlett (triangular, zero-ended) window.
 * @param {number} N
 * @returns {Float64Array}
 */
export function bartlett (N) {
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) w[i] = 1 - abs(2 * i / (N - 1) - 1)
	return w
}

/**
 * Rectangular (boxcar) window.
 * @param {number} N
 * @returns {Float64Array}
 */
export function rectangular (N) {
	return new Float64Array(N).fill(1)
}

/**
 * Kaiser window: I0(beta*sqrt(1-x^2))/I0(beta), x = 2i/(N-1) - 1.
 * @param {number} N
 * @param {number} beta - Shape parameter (0 = rectangular; ~0.1102*(A-8.7) for A dB stopband)
 * @returns {Float64Array}
 */
export function kaiser (N, beta) {
	let w = new Float64Array(N)
	let denom = besselI0(beta)
	for (let i = 0; i < N; i++) {
		let x = 2 * i / (N - 1) - 1
		w[i] = besselI0(beta * sqrt(1 - x * x)) / denom
	}
	return w
}

// Modified Bessel function of the first kind, order 0 (series expansion)
function besselI0 (x) {
	let sum = 1, term = 1
	for (let k = 1; k < 50; k++) {
		term *= (x / (2 * k)) * (x / (2 * k))
		sum += term
		if (term < sum * 1e-16) break
	}
	return sum
}

const WINDOWS = {
	hamming, hann, hanning: hann, blackman,
	blackmanharris: blackmanHarris, 'blackman-harris': blackmanHarris,
	bartlett, triangular: bartlett,
	rectangular, boxcar: rectangular, rect: rectangular,
}

/**
 * Resolve a window argument to a Float64Array.
 * Accepts: Float64Array/Array (pass through), function(N)→array, a window name
 * ('hamming', 'hann', 'blackman', 'blackman-harris', 'bartlett', 'rectangular'),
 * ['kaiser', beta], or nothing (default hamming). Unknown names throw — a silent
 * fallback would design a different filter than asked for.
 * @param {Float64Array|Array|Function|string|[string, number]|undefined} win
 * @param {number} N
 * @returns {Float64Array|Array}
 */
export function getWindow (win, N) {
	if (win == null) return hamming(N)
	if (win instanceof Float64Array) return win
	if (Array.isArray(win)) {
		// ['kaiser', beta] parameterized form (scipy get_window style)
		if (typeof win[0] === 'string') {
			let name = win[0].toLowerCase()
			if (name === 'kaiser') return kaiser(N, win[1] ?? 0)
			throw Error(`getWindow: '${win[0]}' takes no parameters — pass the bare name`)
		}
		return win
	}
	if (typeof win === 'function') return win(N)
	if (typeof win === 'string') {
		let name = win.toLowerCase()
		if (name === 'kaiser') throw Error("getWindow: kaiser needs a beta parameter — pass ['kaiser', beta]")
		let fn = WINDOWS[name]
		if (!fn) throw Error(`getWindow: unknown window '${win}' (available: ${Object.keys(WINDOWS).join(', ')}, ['kaiser', beta])`)
		return fn(N)
	}
	throw Error(`getWindow: unsupported window spec ${win}`)
}
