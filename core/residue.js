/**
 * Partial fraction expansion of B(z)/A(z) — scipy.signal.residuez convention.
 * Coefficients ascending in z^-1 (b0-first, the library-wide filter convention):
 *   H(z) = B(z)/A(z) = sum(r[k] / (1 - p[k]*z^-1)) + k[0] + k[1]*z^-1 + ...
 * Simple (distinct) poles only — repeated poles throw rather than return garbage.
 *
 * @param {Array<number>|Float64Array} b - Numerator [b0, b1, ...] ascending z^-1
 * @param {Array<number>|Float64Array} a - Denominator [a0, a1, ...] ascending z^-1, a0 != 0
 * @returns {{r: Array<{re:number,im:number}>, p: Array<{re:number,im:number}>, k: Float64Array}}
 *   r: residues, p: poles, k: direct (FIR) terms ascending z^-1
 */
import { polyRoots } from './convert.js'

export default function residue (b, a) {
	b = trimTrailing(Array.from(b))
	a = trimTrailing(Array.from(a))
	if (!a.length || a[0] === 0) throw Error('residue: a[0] must be nonzero')

	// Normalize by a[0]
	if (a[0] !== 1) {
		let a0 = a[0]
		b = b.map(v => v / a0)
		a = a.map(v => v / a0)
	}

	// Direct terms: divide B(v) by A(v) (v = z^-1) from the highest power down,
	// leaving deg(R) < deg(A). Quotient collects ascending in v, like scipy.
	let k = [], rem = b.slice()
	if (rem.length >= a.length) {
		k = new Array(rem.length - a.length + 1).fill(0)
		for (let d = rem.length - a.length; d >= 0; d--) {
			let c = rem[d + a.length - 1] / a[a.length - 1]
			k[d] = c
			for (let i = 0; i < a.length; i++) rem[d + i] -= c * a[i]
		}
		rem = trimTrailing(rem.slice(0, a.length - 1))
	}

	// Poles: A(v) = prod(1 - p_j*v), so p_j are the roots of the ascending array
	// read as a monic descending-z polynomial (multiply A(z^-1) by z^n).
	let poles = polyRoots(a)

	// Residues at simple poles: r_k = R(1/p_k) / prod_{j!=k}(1 - p_j/p_k)
	let r = []
	for (let i = 0; i < poles.length; i++) {
		let pk = poles[i]
		let pMag = pk.re * pk.re + pk.im * pk.im
		if (pMag < 1e-30) throw Error('residue: pole at z=0 (trailing a coefficient is zero)')
		let vr = pk.re / pMag, vi = -pk.im / pMag  // v_k = 1/p_k

		// R(v_k) via Horner on ascending rem: R(v) = rem[0] + rem[1]*v + ...
		let nr = 0, ni = 0
		for (let j = rem.length - 1; j >= 0; j--) {
			let tr = nr * vr - ni * vi + rem[j]
			let ti = nr * vi + ni * vr
			nr = tr; ni = ti
		}

		// prod_{j!=k}(1 - p_j/p_k) = prod_{j!=k}(1 - p_j*v_k)
		let dr = 1, di = 0
		for (let j = 0; j < poles.length; j++) {
			if (i === j) continue
			let fr = 1 - (poles[j].re * vr - poles[j].im * vi)
			let fi = -(poles[j].re * vi + poles[j].im * vr)
			let tr = dr * fr - di * fi
			let ti = dr * fi + di * fr
			dr = tr; di = ti
		}
		let dMag = dr * dr + di * di
		if (dMag < 1e-24) throw Error('residue: repeated poles are not supported')
		r.push({
			re: (nr * dr + ni * di) / dMag,
			im: (ni * dr - nr * di) / dMag
		})
	}

	return { r, p: poles, k: new Float64Array(k) }
}

function trimTrailing (p) {
	let n = p.length
	while (n > 1 && p[n - 1] === 0) n--
	return p.slice(0, n)
}
