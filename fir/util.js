// Windows come from window-function (scijs) — the canonical per-sample evaluators
// (symmetric, N-1 denominator: scipy.signal.windows / Harris 1978 conventions).
// This module only adapts them to FIR design's fill shape: name(N) → Float64Array.
import {
	hamming as wfHamming, hann as wfHann, blackman as wfBlackman,
	blackmanHarris as wfBlackmanHarris, bartlett as wfBartlett,
	rectangular as wfRectangular, kaiser as wfKaiser,
} from 'window-function'

const fill = (fn, N, ...args) => {
	let w = new Float64Array(N)
	for (let i = 0; i < N; i++) w[i] = fn(i, N, ...args)
	return w
}

/** Hamming window. @param {number} N @returns {Float64Array} */
export const hamming = (N) => fill(wfHamming, N)

/** Hann window. @param {number} N @returns {Float64Array} */
export const hann = (N) => fill(wfHann, N)

/** Blackman window (a0=0.42, a1=0.5, a2=0.08). @param {number} N @returns {Float64Array} */
export const blackman = (N) => fill(wfBlackman, N)

/** 4-term Blackman-Harris window (−92 dB sidelobes). @param {number} N @returns {Float64Array} */
export const blackmanHarris = (N) => fill(wfBlackmanHarris, N)

/** Bartlett (triangular, zero-ended) window. @param {number} N @returns {Float64Array} */
export const bartlett = (N) => fill(wfBartlett, N)

/** Rectangular (boxcar) window. @param {number} N @returns {Float64Array} */
export const rectangular = (N) => fill(wfRectangular, N)

/**
 * Kaiser window: I0(beta·sqrt(1−x²))/I0(beta), x = 2i/(N−1) − 1.
 * @param {number} N
 * @param {number} beta - Shape parameter (0 = rectangular; ~0.1102·(A−8.7) for A dB stopband)
 * @returns {Float64Array}
 */
export const kaiser = (N, beta) => fill(wfKaiser, N, beta)

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
