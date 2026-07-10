/**
 * Analog ↔ digital filter transforms
 *
 * Pipeline: prototype poles → analog transform → bilinear → digital SOS
 *
 * @module  digital-filter/transform
 */

let {tan, cos, sin, sqrt, PI, atan2, abs} = Math

/**
 * Convert normalized analog LP prototype poles to digital SOS.
 *
 * @param {Array} poles - [[sigma, omega], ...] normalized prototype (cutoff 1 rad/s)
 *   omega > 0 means conjugate pair, omega = 0 means real pole.
 * @param {number|Array} fc - cutoff Hz, or [fLow, fHigh] for BP/BS
 * @param {number} fs - sample rate
 * @param {string} type - 'lowpass','highpass','bandpass','bandstop'
 * @returns {Array} [{b0,b1,b2,a1,a2}, ...]
 */
export function polesSos (poles, fc, fs, type) {
	if (!type) type = 'lowpass'
	if (!fs) fs = 44100

	let edge = edgeSections(fc, fs, type)
	if (edge) return edge

	if (type === 'lowpass' || type === 'highpass') {
		let K = tan(PI * fc / fs)
		let C = 1 / K
		let hp = type === 'highpass'
		return lpHpSos(poles, C, hp)
	}

	if (type === 'bandpass') {
		return bpSos(poles, fc[0], fc[1], fs)
	}

	if (type === 'bandstop') {
		return bsSos(poles, fc[0], fc[1], fs)
	}

	throw Error('Unknown type: ' + type)
}

/**
 * Convert prototype poles + zeros to digital SOS.
 * For filters with finite zeros (Chebyshev Type II, Elliptic).
 */
export function poleZerosSos (poles, zeros, fc, fs, type) {
	if (!type) type = 'lowpass'
	if (!fs) fs = 44100

	let edge = edgeSections(fc, fs, type)
	if (edge) return edge

	if (type === 'lowpass' || type === 'highpass') {
		let K = tan(PI * fc / fs)
		let C = 1 / K
		let hp = type === 'highpass'
		return lpHpZerosSos(poles, zeros, C, hp)
	}

	if (type === 'bandpass') {
		return bpZerosSos(poles, zeros, fc[0], fc[1], fs)
	}

	if (type === 'bandstop') {
		return bsZerosSos(poles, zeros, fc[0], fc[1], fs)
	}

	throw Error('Unknown type: ' + type)
}

// Degenerate cutoffs resolve to silence/pass sections (same edge semantics as
// iir/biquad.js) instead of NaN coefficients from tan() blowing up.
const SILENCE = () => [{b0: 0, b1: 0, b2: 0, a1: 0, a2: 0}]
const PASS = () => [{b0: 1, b1: 0, b2: 0, a1: 0, a2: 0}]

function edgeSections (fc, fs, type) {
	let nyq = fs / 2
	// NaN/undefined would sail through the <=/>= guards into tan() and produce
	// silently-NaN coefficients — reject loudly instead
	if (type === 'lowpass' || type === 'highpass') {
		if (!Number.isFinite(fc)) throw Error(`transform: fc must be a finite number (got ${fc})`)
	} else if (!Array.isArray(fc) || !Number.isFinite(fc[0]) || !Number.isFinite(fc[1])) {
		throw Error(`transform: ${type} needs fc = [fLow, fHigh] (got ${fc})`)
	}
	if (type === 'lowpass') {
		if (fc <= 0) return SILENCE()
		if (fc >= nyq) return PASS()
	} else if (type === 'highpass') {
		if (fc <= 0) return PASS()
		if (fc >= nyq) return SILENCE()
	} else if (type === 'bandpass') {
		let [lo, hi] = fc
		if (!(lo > 0 && hi > lo && hi < nyq)) return SILENCE()
	} else if (type === 'bandstop') {
		let [lo, hi] = fc
		if (!(lo > 0 && hi > lo && hi < nyq)) return PASS()
	}
	return null
}

export { prewarp }

// ────── LP / HP (proven formulas, matches existing code exactly) ──────

function lpHpSos (poles, C, hp) {
	let sections = []

	for (let i = 0; i < poles.length; i++) {
		let sigma = poles[i][0], omega = poles[i][1]

		if (omega === 0) {
			sections.push(firstOrderSection(sigma, C, hp))
		} else {
			sections.push(secondOrderSection(sigma, omega, C, hp))
		}
	}

	return sections
}

function secondOrderSection (sigma, omega, C, hp) {
	let pmag2 = sigma * sigma + omega * omega
	let bs = -2 * sigma

	if (hp) {
		// LP→HP: s→1/s transforms prototype section
		// H(s) = s² / (s² + (bs/pmag2)*s + 1/pmag2)
		let B1 = bs / pmag2, B0 = 1 / pmag2
		let A = C * C + B1 * C + B0
		return {
			b0: C * C / A,
			b1: -2 * C * C / A,
			b2: C * C / A,
			a1: 2 * (B0 - C * C) / A,
			a2: (C * C - B1 * C + B0) / A
		}
	}

	// LP: H(s) = pmag2 / (s² + bs*s + pmag2)
	let A = C * C + bs * C + pmag2
	return {
		b0: pmag2 / A,
		b1: 2 * pmag2 / A,
		b2: pmag2 / A,
		a1: 2 * (pmag2 - C * C) / A,
		a2: (C * C - bs * C + pmag2) / A
	}
}

function firstOrderSection (sigma, C, hp) {
	let absS = -sigma

	if (hp) {
		// HP first-order: s / (s + 1/|p|)
		let B0 = 1 / absS
		let A = C + B0
		return {
			b0: C / A,
			b1: -C / A,
			b2: 0,
			a1: (B0 - C) / A,
			a2: 0
		}
	}

	// LP first-order: |p| / (s + |p|)
	let A = C + absS
	return {
		b0: absS / A,
		b1: absS / A,
		b2: 0,
		a1: (absS - C) / A,
		a2: 0
	}
}

// ────── LP / HP with zeros (Elliptic, Chebyshev Type II) ──────

function lpHpZerosSos (poles, zeros, C, hp) {
	let sections = []
	let zIdx = 0

	for (let i = 0; i < poles.length; i++) {
		let sigma = poles[i][0], omega = poles[i][1]

		if (omega === 0) {
			// Real pole — first order, no zero pairing for now
			sections.push(firstOrderSection(sigma, C, hp))
		} else {
			// Conjugate pair — pair with zero if available
			let zp = zIdx < zeros.length ? zeros[zIdx++] : null
			sections.push(secondOrderZerosSection(sigma, omega, zp, C, hp))
		}
	}

	return sections
}

function secondOrderZerosSection (sigma, omega, zero, C, hp) {
	let pmag2 = sigma * sigma + omega * omega
	let bs = -2 * sigma

	// Denominator: bilinear of (s² + bs*s + pmag2) or HP-transformed version
	// Numerator: bilinear of (s² + zmag2) for zero pair on jω axis, or constant

	if (hp) {
		let B1 = bs / pmag2, B0 = 1 / pmag2
		let A = C * C + B1 * C + B0

		if (zero) {
			// HP zero: jω zero pair on imaginary axis → transform to s² + zmag2/zero...
			// For elliptic/chebII, zeros are on jω axis: zero = [0, ωz]
			let zmag2 = zero[0] * zero[0] + zero[1] * zero[1]
			let Z0 = 1 / zmag2
			let An = C * C + Z0
			return {
				b0: An / A,
				b1: (-2 * C * C + 2 * Z0) / A,
				b2: An / A,
				a1: 2 * (B0 - C * C) / A,
				a2: (C * C - B1 * C + B0) / A
			}
		}

		return {
			b0: C * C / A,
			b1: -2 * C * C / A,
			b2: C * C / A,
			a1: 2 * (B0 - C * C) / A,
			a2: (C * C - B1 * C + B0) / A
		}
	}

	// LP
	let A = C * C + bs * C + pmag2

	if (zero) {
		// Zero pair on jω axis: H(s) has numerator (s² + zmag2)
		let zmag2 = zero[0] * zero[0] + zero[1] * zero[1]
		let An = C * C + zmag2
		return {
			b0: An / A,
			b1: (-2 * C * C + 2 * zmag2) / A,
			b2: An / A,
			a1: 2 * (pmag2 - C * C) / A,
			a2: (C * C - bs * C + pmag2) / A
		}
	}

	return {
		b0: pmag2 / A,
		b1: 2 * pmag2 / A,
		b2: pmag2 / A,
		a1: 2 * (pmag2 - C * C) / A,
		a2: (C * C - bs * C + pmag2) / A
	}
}

// ────── Bandpass via analog LP→BP transform ──────

function bpSos (poles, fLow, fHigh, fs) {
	// All-pole prototype: every mapped pole pair gets one zero at s=0
	return bpZerosSos(poles, [], fLow, fHigh, fs)
}

function bpZerosSos (poles, zeros, fLow, fHigh, fs) {
	// LP→BP on both poles and finite zeros (scipy lp2bp_zpk): each prototype
	// point q maps through s² - B·q·s + w0² = 0; the degree deficit becomes
	// zeros at s=0. Without this, elliptic/Type-II bandpass loses its stopband.
	let wL = prewarp(fLow, fs), wH = prewarp(fHigh, fs)
	let w0 = sqrt(wL * wH)
	let B = wH - wL
	let Cs = 2 * fs

	let polePairs = mapPrototypePairs(poles, q => lpToBpPole(q, w0, B))
	let zeroPairs = mapPrototypePairs(zeros, q => lpToBpPole(q, w0, B))

	let sections = []
	for (let i = 0; i < polePairs.length; i++) {
		let pp = polePairs[i]
		let zp = i < zeroPairs.length ? zeroPairs[i] : null
		// Leftover pole pairs carry the LP prototype's degree deficit: one zero at s=0
		sections.push(zp
			? biquadFromComplexPoles(pp[0], pp[1], zp[0], zp[1], 1, Cs)
			: biquadWithOriginZero(pp[0], pp[1], Cs))
	}

	normalizeAtFreq(sections, sqrt(fLow * fHigh), fs)
	return sections
}

// Map prototype [sigma, omega] entries (omega>0 = conjugate pair) through an
// analog point transform returning 2 mapped points each; group results into
// conjugate pairs → one biquad section per pair.
function mapPrototypePairs (protos, mapPoint) {
	let pairs = []
	for (let i = 0; i < protos.length; i++) {
		let sigma = protos[i][0], omega = protos[i][1]
		if (omega === 0) {
			pairs.push(mapPoint({re: sigma, im: 0}))
		} else {
			let m1 = mapPoint({re: sigma, im: omega})
			let m2 = mapPoint({re: sigma, im: -omega})
			pairs.push(...groupConjugatePairs([m1[0], m1[1], m2[0], m2[1]]))
		}
	}
	return pairs
}

// ────── Bandstop via analog LP→BS transform ──────

function bsSos (poles, fLow, fHigh, fs) {
	// All-pole prototype: every mapped pole pair gets zeros at ±j·w0
	return bsZerosSos(poles, [], fLow, fHigh, fs)
}

function bsZerosSos (poles, zeros, fLow, fHigh, fs) {
	// LP→BS on both poles and finite zeros (scipy lp2bs_zpk): each prototype
	// point q maps through s² - (B/q)·s + w0² = 0; the degree deficit becomes
	// zero pairs at ±j·w0.
	let wL = prewarp(fLow, fs), wH = prewarp(fHigh, fs)
	let w0 = sqrt(wL * wH)
	let B = wH - wL
	let Cs = 2 * fs

	let polePairs = mapPrototypePairs(poles, q => lpToBsPole(q, w0, B))
	let zeroPairs = mapPrototypePairs(zeros, q => lpToBsPole(q, w0, B))

	let sections = []
	for (let i = 0; i < polePairs.length; i++) {
		let pp = polePairs[i]
		let zp = i < zeroPairs.length ? zeroPairs[i] : [{re: 0, im: w0}, {re: 0, im: -w0}]
		sections.push(biquadFromComplexPoles(pp[0], pp[1], zp[0], zp[1], 1, Cs))
	}

	normalizeAtFreq(sections, 0, fs)
	return sections
}

// ────── Bilinear helpers for BP/BS ──────

// Bilinear transform a second-order analog polynomial as^2 + bs + c
function bilinearPoly (a, b, c, Cs) {
	let C2 = Cs * Cs
	return [
		a * C2 + b * Cs + c,
		-2 * a * C2 + 2 * c,
		a * C2 - b * Cs + c
	]
}

// Build biquad from conjugate pole pair with one zero at s=0 (for bandpass)
// H(s) = s / ((s-p1)(s-p2))  — one zero at origin
function biquadWithOriginZero (p1, p2, Cs) {
	let denB = -(p1.re + p2.re)
	let denC = p1.re * p2.re - p1.im * p2.im
	let den = bilinearPoly(1, denB, denC, Cs)
	// s → bilinear: s*(1+z^-1)^2 / (1+z^-1)^2 → C(1-z^-1)(1+z^-1) = C(1-z^-2)
	// So numerator = [C, 0, -C]
	return {
		b0: Cs / den[0],
		b1: 0,
		b2: -Cs / den[0],
		a1: den[1] / den[0],
		a2: den[2] / den[0]
	}
}

// Build biquad from two complex poles (which should be conjugates) and optional two zeros
function biquadFromComplexPoles (p1, p2, z1, z2, gain, Cs) {
	// Denominator: (s - p1)(s - p2) = s² - (p1+p2)s + p1*p2
	let denB = -(p1.re + p2.re)    // -(sigma1+sigma2) for conjugates = -2*sigma
	let denC = p1.re * p2.re - p1.im * p2.im  // real part of p1*p2

	// For conjugate pair: denB = -2*sigma, denC = sigma²+omega² = |p|²
	let den = bilinearPoly(1, denB, denC, Cs)

	let num
	if (z1 && z2) {
		let numB = -(z1.re + z2.re)
		let numC = z1.re * z2.re - z1.im * z2.im
		num = bilinearPoly(1, numB, numC, Cs)
	} else {
		// All-pole: constant numerator → (1+z^-1)² after bilinear
		num = [1, 2, 1]
	}

	return {
		b0: gain * num[0] / den[0],
		b1: gain * num[1] / den[0],
		b2: gain * num[2] / den[0],
		a1: den[1] / den[0],
		a2: den[2] / den[0]
	}
}

// Group 4 poles into 2 conjugate pairs
function groupConjugatePairs (poles) {
	let used = [false, false, false, false]
	let pairs = []

	for (let i = 0; i < poles.length; i++) {
		if (used[i]) continue
		used[i] = true
		// Find conjugate: same real part, negated imaginary part
		let best = -1, bestDist = Infinity
		for (let j = i + 1; j < poles.length; j++) {
			if (used[j]) continue
			let dist = abs(poles[i].re - poles[j].re) + abs(poles[i].im + poles[j].im)
			if (dist < bestDist) { bestDist = dist; best = j }
		}
		if (best >= 0) {
			used[best] = true
			pairs.push([poles[i], poles[best]])
		}
	}

	return pairs
}

// Normalize sections so combined gain = 1 at given frequency.
// Exported for designers that must renormalize at their passband reference
// (DC for lowpass, Nyquist for highpass — bp/bs are normalized here already).
export function normalizeAtFreq (sections, freq, fs) {
	let w = 2 * PI * freq / fs
	let cosw = cos(w), sinw = sin(w)
	let cos2w = cos(2 * w), sin2w = sin(2 * w)
	let mag = 1

	for (let i = 0; i < sections.length; i++) {
		let c = sections[i]
		let br = c.b0 + c.b1 * cosw + c.b2 * cos2w
		let bi = -c.b1 * sinw - c.b2 * sin2w
		let ar = 1 + c.a1 * cosw + c.a2 * cos2w
		let ai = -c.a1 * sinw - c.a2 * sin2w
		mag *= sqrt((br * br + bi * bi) / (ar * ar + ai * ai))
	}

	if (mag > 0 && mag !== 1) {
		let scale = 1 / mag
		sections[0].b0 *= scale
		sections[0].b1 *= scale
		sections[0].b2 *= scale
	}
}

// ────── Analog transform pole mappings ──────

// LP → BP: solve s² - B*p*s + w0² = 0
function lpToBpPole (p, w0, B) {
	let bp = cScale2(p, B)
	let disc = cSub2(cMul2(bp, bp), {re: 4 * w0 * w0, im: 0})
	let sq = cSqrt2(disc)
	return [
		cScale2(cAdd2(bp, sq), 0.5),
		cScale2(cSub2(bp, sq), 0.5)
	]
}

// LP → BS: solve s² - (B/p)*s + w0² = 0
function lpToBsPole (p, w0, B) {
	let bOverP = cDiv2({re: B, im: 0}, p)
	let disc = cSub2(cMul2(bOverP, bOverP), {re: 4 * w0 * w0, im: 0})
	let sq = cSqrt2(disc)
	return [
		cScale2(cAdd2(bOverP, sq), 0.5),
		cScale2(cSub2(bOverP, sq), 0.5)
	]
}

function prewarp (f, fs) {
	return 2 * fs * tan(PI * f / fs)
}

// ────── Complex arithmetic ──────

function cMul2 (a, b) { return {re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re} }
function cDiv2 (a, b) { let d = b.re * b.re + b.im * b.im; return {re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d} }
function cAdd2 (a, b) { return {re: a.re + b.re, im: a.im + b.im} }
function cSub2 (a, b) { return {re: a.re - b.re, im: a.im - b.im} }
function cScale2 (a, s) { return {re: a.re * s, im: a.im * s} }
function cSqrt2 (a) {
	let r = sqrt(a.re * a.re + a.im * a.im)
	let theta = atan2(a.im, a.re)
	let sr = sqrt(r)
	return {re: sr * cos(theta / 2), im: sr * sin(theta / 2)}
}
