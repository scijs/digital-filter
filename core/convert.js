/**
 * Format conversion utilities (SOS, transfer function, zeros/poles/gain)
 *
 * @module  digital-filter/convert
 */

let {sqrt, atan2, PI} = Math

// ────── SOS → ZPK ──────

/**
 * Convert SOS array to zeros, poles, and gain.
 *
 * @param {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} sos - SOS sections
 * @returns {{zeros: Array<{re:number,im:number}>, poles: Array<{re:number,im:number}>, gain: number}}
 */
export function sos2zpk (sos) {
	let zeros = []
	let poles = []
	let gain = 1

	for (let s of sos) {
		// Numerator roots: b0*z^2 + b1*z + b2 = 0
		// z = (-b1 ± sqrt(b1^2 - 4*b0*b2)) / (2*b0)
		if (s.b0 !== 0) {
			gain *= s.b0
			let roots = quadRoots(1, s.b1 / s.b0, s.b2 / s.b0)
			zeros.push(...roots)
		} else if (s.b1 !== 0) {
			// First-order: b1*z + b2 = 0 → z = -b2/b1
			gain *= s.b1
			zeros.push({re: -s.b2 / s.b1, im: 0})
		} else if (s.b2 !== 0) {
			// Constant numerator b2 (pure scaled two-sample delay): gain only, no zeros
			gain *= s.b2
		}

		// Denominator roots: z^2 + a1*z + a2 = 0 (a0 = 1)
		if (s.a2 !== 0) {
			let roots = quadRoots(1, s.a1, s.a2)
			poles.push(...roots)
		} else if (s.a1 !== 0) {
			// First-order: z + a1 = 0 → z = -a1
			poles.push({re: -s.a1, im: 0})
		}
	}

	return {zeros, poles, gain}
}

// ────── SOS → TF ──────

/**
 * Convert SOS to transfer function polynomial coefficients.
 *
 * @param {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} sos - SOS sections
 * @returns {{b: Float64Array, a: Float64Array}} numerator and denominator polynomials
 */
export function sos2tf (sos) {
	let b = [1]  // start with [1], multiply in each section
	let a = [1]

	for (let s of sos) {
		let nb = s.b2 !== 0 ? [s.b0, s.b1, s.b2] : (s.b1 !== 0 ? [s.b0, s.b1] : [s.b0])
		let na = s.a2 !== 0 ? [1, s.a1, s.a2] : (s.a1 !== 0 ? [1, s.a1] : [1])
		b = polymul(b, nb)
		a = polymul(a, na)
	}

	return {b: new Float64Array(b), a: new Float64Array(a)}
}

// ────── TF → ZPK ──────

/**
 * Convert transfer function polynomial coefficients to zeros, poles, gain.
 * Coefficients are highest-power-first (scipy convention); leading zeros are
 * stripped, matching scipy.signal.tf2zpk / numpy.roots semantics.
 *
 * @param {Array<number>|Float64Array} b - Numerator polynomial coefficients
 * @param {Array<number>|Float64Array} a - Denominator polynomial coefficients
 * @returns {{zeros: Array<{re:number,im:number}>, poles: Array<{re:number,im:number}>, gain: number}}
 */
export function tf2zpk (b, a) {
	let bn = trimLeadingZeros(Array.from(b))
	let an = trimLeadingZeros(Array.from(a))
	if (!an.length) throw Error('tf2zpk: denominator is zero')
	if (!bn.length) return { zeros: [], poles: polyRoots(an.map(x => x / an[0])), gain: 0 }

	let gain = bn[0] / an[0]
	let zeros = polyRoots(bn.map(x => x / bn[0]))
	let poles = polyRoots(an.map(x => x / an[0]))

	return { zeros, poles, gain }
}

function trimLeadingZeros (p) {
	let i = 0
	while (i < p.length && p[i] === 0) i++
	return p.slice(i)
}

// ────── ZPK → SOS ──────

/**
 * Convert zeros/poles/gain to second-order sections.
 * Pairs poles with nearest zeros for best numerical stability.
 *
 * @param {{zeros: Array<{re:number,im:number}>, poles: Array<{re:number,im:number}>, gain: number}} zpk
 * @returns {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>}
 */
export function zpk2sos (zpk) {
	let { zeros, poles, gain } = zpk
	let z = zeros.slice(), p = poles.slice()
	let sections = []

	// Pair conjugate poles first, then pair with nearest zeros
	let polePairs = pairConjugates(p)
	let zeroPairs = pairConjugates(z)

	// Match zero pairs to pole pairs by proximity
	let used = new Array(zeroPairs.length).fill(false)

	for (let pp of polePairs) {
		let bestIdx = -1, bestDist = Infinity
		for (let i = 0; i < zeroPairs.length; i++) {
			if (used[i]) continue
			let dist = pairDistance(pp, zeroPairs[i])
			if (dist < bestDist) { bestDist = dist; bestIdx = i }
		}

		let zp = bestIdx >= 0 ? zeroPairs[bestIdx] : null
		if (bestIdx >= 0) used[bestIdx] = true

		sections.push(makeSosSection(pp, zp))
	}

	// Handle remaining unpaired zeros
	for (let i = 0; i < zeroPairs.length; i++) {
		if (!used[i]) {
			sections.push(makeSosSection(null, zeroPairs[i]))
		}
	}

	// Apply gain to first section
	if (gain !== 1 && sections.length > 0) {
		sections[0].b0 *= gain
		sections[0].b1 *= gain
		sections[0].b2 *= gain
	}

	return sections
}

// ────── TF → SOS ──────

/**
 * Convert transfer function polynomials to second-order sections.
 * Chains tf2zpk → zpk2sos internally.
 *
 * @param {Array<number>|Float64Array} b - Numerator polynomial coefficients
 * @param {Array<number>|Float64Array} a - Denominator polynomial coefficients
 * @returns {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>}
 */
export function tf2sos (b, a) {
	return zpk2sos(tf2zpk(b, a))
}

// ────── ZPK → TF ──────

/**
 * Convert zeros/poles/gain to transfer function polynomial coefficients.
 * Inverse of tf2zpk.
 *
 * @param {{zeros: Array<{re:number,im:number}>, poles: Array<{re:number,im:number}>, gain: number}} zpk
 * @returns {{b: Float64Array, a: Float64Array}} numerator and denominator polynomials
 */
export function zpk2tf ({ zeros, poles, gain }) {
	let b = polyFromRoots(zeros)
	let a = polyFromRoots(poles)
	for (let i = 0; i < b.length; i++) b[i] *= gain
	return { b: new Float64Array(b), a: new Float64Array(a) }
}

// Expand polynomial from complex roots: product of (z - r_k)
function polyFromRoots (roots) {
	// Start with [1], multiply (z - r_k) for each root
	// Coefficients are complex {re, im} during computation
	let p = [{ re: 1, im: 0 }]
	for (let r of roots) {
		let rr = r.re ?? r, ri = r.im ?? 0
		let np = new Array(p.length + 1)
		np[0] = { re: p[0].re, im: p[0].im }
		for (let i = 1; i < p.length; i++) {
			// newp[i] = p[i] - r * p[i-1]
			np[i] = {
				re: p[i].re - (rr * p[i - 1].re - ri * p[i - 1].im),
				im: p[i].im - (rr * p[i - 1].im + ri * p[i - 1].re)
			}
		}
		// Last term: -r * p[last]
		let last = p.length - 1
		np[p.length] = {
			re: -(rr * p[last].re - ri * p[last].im),
			im: -(rr * p[last].im + ri * p[last].re)
		}
		p = np
	}
	// Imaginary parts cancel for conjugate pairs — return real parts
	return p.map(v => v.re)
}

// ────── Private helpers ──────

function quadRoots (a, b, c) {
	let disc = b * b - 4 * a * c
	if (disc >= 0) {
		let sq = sqrt(disc)
		return [
			{re: (-b + sq) / (2 * a), im: 0},
			{re: (-b - sq) / (2 * a), im: 0}
		]
	}
	let sq = sqrt(-disc)
	return [
		{re: -b / (2 * a), im: sq / (2 * a)},
		{re: -b / (2 * a), im: -sq / (2 * a)}
	]
}

function polymul (p1, p2) {
	let n = p1.length + p2.length - 1
	let result = new Array(n).fill(0)
	for (let i = 0; i < p1.length; i++) {
		for (let j = 0; j < p2.length; j++) {
			result[i + j] += p1[i] * p2[j]
		}
	}
	return result
}

// Find roots of monic polynomial p = [1, p1, p2, ...] (leading coefficient = 1).
// Trailing zeros are factored out as exact roots at the origin before iterating —
// a zero constant term would otherwise collapse Durand-Kerner's initial radius to 0.
// Shared by residue.js (partial fractions) — keep the one copy here.
export function polyRoots (p) {
	let originRoots = 0
	while (p.length > 1 && p[p.length - 1] === 0) { p = p.slice(0, -1); originRoots++ }
	let roots = polyRootsCore(p)
	for (let i = 0; i < originRoots; i++) roots.push({ re: 0, im: 0 })
	return roots
}

function polyRootsCore (p) {
	let n = p.length - 1
	if (n === 0) return []
	if (n === 1) return [{ re: -p[1], im: 0 }]
	if (n === 2) return quadRoots(1, p[1], p[2])

	return durandKerner(p)
}

// Durand-Kerner method for polynomial roots
function durandKerner (p) {
	let n = p.length - 1

	// Initial guesses: points on a circle (radius fallback 1 guards |p[n]|=0)
	let roots = []
	for (let i = 0; i < n; i++) {
		let angle = 2 * Math.PI * i / n + 0.4
		let r = Math.pow(Math.abs(p[n]), 1 / n) || 1
		roots.push({ re: r * Math.cos(angle), im: r * Math.sin(angle) })
	}

	for (let iter = 0; iter < 100; iter++) {
		let maxChange = 0
		for (let i = 0; i < n; i++) {
			// Evaluate p at roots[i] via Horner's method
			let pr = p[0], pi = 0
			for (let k = 1; k < p.length; k++) {
				let newR = pr * roots[i].re - pi * roots[i].im + p[k]
				let newI = pr * roots[i].im + pi * roots[i].re
				pr = newR; pi = newI
			}

			// Compute denominator: product of (roots[i] - roots[j]) for j != i
			let dr = 1, di = 0
			for (let j = 0; j < n; j++) {
				if (i === j) continue
				let diffR = roots[i].re - roots[j].re
				let diffI = roots[i].im - roots[j].im
				let newR = dr * diffR - di * diffI
				let newI = dr * diffI + di * diffR
				dr = newR; di = newI
			}

			// delta = p(z_i) / product(z_i - z_j)
			let dMag = dr * dr + di * di
			let deltaR = (pr * dr + pi * di) / dMag
			let deltaI = (pi * dr - pr * di) / dMag

			roots[i].re -= deltaR
			roots[i].im -= deltaI

			maxChange = Math.max(maxChange, Math.abs(deltaR) + Math.abs(deltaI))
		}
		if (maxChange < 1e-14) break
	}

	// Snap near-real roots to real axis
	for (let r of roots) {
		if (Math.abs(r.im) < 1e-10) r.im = 0
	}

	return roots
}

function pairConjugates (list) {
	let pairs = []
	let used = new Array(list.length).fill(false)

	for (let i = 0; i < list.length; i++) {
		if (used[i]) continue
		used[i] = true

		if (list[i].im === 0 || Math.abs(list[i].im) < 1e-12) {
			// Real: try to pair with another real
			let bestJ = -1
			for (let j = i + 1; j < list.length; j++) {
				if (used[j]) continue
				if (Math.abs(list[j].im) < 1e-12) { bestJ = j; break }
			}
			if (bestJ >= 0) {
				used[bestJ] = true
				pairs.push([list[i], list[bestJ]])
			} else {
				pairs.push([list[i], null])
			}
		} else {
			// Complex: find conjugate — accept only a genuine match, never force-pair
			// a distant point. Tolerance is loose (1e-3, magnitude-relative) because
			// Durand-Kerner clusters around an m-fold root only to ~eps^(1/m).
			let bestJ = -1, bestDist = Infinity
			for (let j = i + 1; j < list.length; j++) {
				if (used[j]) continue
				let dist = Math.abs(list[i].re - list[j].re) + Math.abs(list[i].im + list[j].im)
				if (dist < bestDist) { bestDist = dist; bestJ = j }
			}
			let tol = 1e-3 * (1 + Math.abs(list[i].re) + Math.abs(list[i].im))
			if (bestJ >= 0 && bestDist < tol) {
				used[bestJ] = true
				pairs.push([list[i], list[bestJ]])
			} else {
				pairs.push([list[i], null])
			}
		}
	}

	return pairs
}

function pairDistance (pp, zp) {
	let pr = (pp[0].re + (pp[1] ? pp[1].re : 0)) / 2
	let pi = Math.abs(pp[0].im)
	let zr = (zp[0].re + (zp[1] ? zp[1].re : 0)) / 2
	let zi = Math.abs(zp[0].im)
	return Math.abs(pr - zr) + Math.abs(pi - zi)
}

function makeSosSection (polePair, zeroPair) {
	let a1 = 0, a2 = 0, b0 = 1, b1 = 0, b2 = 0

	if (polePair) {
		let p1 = polePair[0], p2 = polePair[1]
		if (p2) {
			// Two poles: (z - p1)(z - p2) = z^2 - (p1+p2)z + p1*p2
			a1 = -(p1.re + p2.re)
			a2 = p1.re * p2.re - p1.im * p2.im
		} else {
			// One pole: (z - p1) = z - p1.re
			a1 = -p1.re
		}
	}

	if (zeroPair) {
		let z1 = zeroPair[0], z2 = zeroPair[1]
		if (z2) {
			b0 = 1
			b1 = -(z1.re + z2.re)
			b2 = z1.re * z2.re - z1.im * z2.im
		} else {
			b0 = 1
			b1 = -z1.re
		}
	}

	return { b0, b1, b2, a1, a2 }
}
