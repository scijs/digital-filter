/**
 * Elliptic (Cauer) filter → cascaded SOS
 * Sharpest transition band for given order. Equiripple in both bands.
 * Prototype matches scipy.signal.ellipap: exact v0 via inverse Jacobi sc.
 *
 * @module  digital-filter/elliptic
 */

let {sqrt, pow, sin, cos, abs, atan, PI, floor, max} = Math
import { poleZerosSos, normalizeAtFreq } from '../core/transform.js'

/**
 * Design elliptic (Cauer) filter as cascaded second-order sections.
 *
 * @param {number} order - Filter order
 * @param {number} fc - Cutoff frequency in Hz
 * @param {number} [fs=44100] - Sample rate in Hz
 * @param {number} [ripple=1] - Passband ripple in dB
 * @param {number} [attenuation=40] - Stopband attenuation in dB
 * @param {string} [type='lowpass'] - Filter type: 'lowpass', 'highpass', 'bandpass', 'bandstop'
 * @returns {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} SOS sections
 */
export default function elliptic (order, fc, fs, ripple, attenuation, type) {
	if (!fs) fs = 44100
	if (!ripple) ripple = 1
	if (!attenuation) attenuation = 40
	if (!type) type = 'lowpass'

	let proto = ellipticPrototype(order, ripple, attenuation)
	let sections = poleZerosSos(proto.poles, proto.zeros, fc, fs, type)

	// Normalize at the passband reference (prototype Ω=0): DC for lowpass,
	// Nyquist for highpass; bandpass/bandstop are reference-normalized inside
	// the transform. The reference gain is a ripple minimum for even orders.
	if (type === 'lowpass') normalizeAtFreq(sections, 0, fs)
	else if (type === 'highpass') normalizeAtFreq(sections, fs / 2, fs)

	let eps = sqrt(pow(10, ripple / 10) - 1)
	let target = order % 2 === 0 ? 1 / sqrt(1 + eps * eps) : 1
	// Degenerate cutoffs return a bare pass/silence section — leave those exact
	let degenerate = sections.length === 1 && sections[0].a1 === 0 && sections[0].a2 === 0 && sections[0].b1 === 0 && sections[0].b2 === 0
	if (target !== 1 && !degenerate) {
		sections[0].b0 *= target
		sections[0].b1 *= target
		sections[0].b2 *= target
	}

	return sections
}

/**
 * Normalized elliptic lowpass prototype (cutoff 1 rad/s) — scipy.signal.ellipap
 * equivalent. Exported for differential testing and zpk workflows.
 * @param {number} N - order
 * @param {number} Rp - passband ripple dB
 * @param {number} Rs - stopband attenuation dB
 * @returns {{poles: Array<[number, number]>, zeros: Array<[number, number]>}} [sigma, omega] pairs (omega > 0 = conjugate pair)
 */
export function ellipticPrototype (N, Rp, Rs) {
	let eps = sqrt(pow(10, Rp / 10) - 1)

	if (N === 1) {
		// First-order: single real pole, no zeros
		return { poles: [[-1 / eps, 0]], zeros: [] }
	}

	let epsS = sqrt(pow(10, Rs / 10) - 1)
	let k1 = eps / epsS

	// Selectivity k from degree equation: K(k)/K'(k) = N * K(k1)/K'(k1)
	let Kk1 = ellipk(k1 * k1)
	let Kk1p = ellipk(1 - k1 * k1)
	let ratio = N * Kk1 / Kk1p
	let m = solveM(ratio)
	let k = sqrt(m)
	let Km = ellipk(m)

	let zeros = []
	let poles = []

	// Pole shift v0 — exact closed form (same as scipy.signal.ellipap):
	// sc(u0, 1-k1²) = 1/eps  ⇔  u0 = F(atan(1/eps) | 1-k1²)
	// v0 = K(m)·u0 / (N·K(k1²))
	let u0 = ellipticF(atan(1 / eps), 1 - k1 * k1)
	let v0 = Km * u0 / (N * ellipk(k1 * k1))
	let {sn: sv, cn: cv, dn: dv} = ellipj(v0, 1 - m)

	// scipy's grid: u_j = j·K(m)/N for j = 0,2,4,… (odd N) / 1,3,5,… (even N).
	// Zeros on jω axis at ±j/(k·sn(u_j)); j=0 (odd N) is the real pole, no zero.
	// Pole: p = -(cu·du·sv·cv + j·su·dv) / (1 - (du·sv)²)
	for (let j = N % 2 === 1 ? 0 : 1; j < N; j += 2) {
		let {sn: su, cn: cu, dn: du} = ellipj(j * Km / N, m)
		if (j > 0) zeros.push([0, 1 / (k * su)])
		let den = 1 - du * du * sv * sv
		let sigma = -(cu * du * sv * cv) / den
		let omega = (su * dv) / den
		poles.push([sigma, j === 0 ? 0 : abs(omega)])
	}

	return { poles, zeros }
}

// ────── Elliptic integrals via Carlson R_F ──────

// Carlson's symmetric elliptic integral of the first kind
function carlsonRF (x, y, z) {
	for (let i = 0; i < 100; i++) {
		let lam = sqrt(x * y) + sqrt(y * z) + sqrt(z * x)
		x = (x + lam) / 4
		y = (y + lam) / 4
		z = (z + lam) / 4
		let A = (x + y + z) / 3
		let dx = 1 - x / A, dy = 1 - y / A, dz = 1 - z / A
		if (max(abs(dx), abs(dy), abs(dz)) < 3e-8) {
			let E2 = dx * dy + dy * dz + dz * dx
			let E3 = dx * dy * dz
			return (1 - E2 / 10 + E3 / 14 + E2 * E2 / 24 - 3 * E2 * E3 / 44) / sqrt(A)
		}
	}
	return 1 / sqrt((x + y + z) / 3)
}

// Complete elliptic integral K(m) where m = k²
function ellipk (m) {
	if (m >= 1) return Infinity
	if (m <= 0) return PI / 2
	return carlsonRF(0, 1 - m, 1)
}

// Incomplete elliptic integral F(phi, m)
function ellipticF (phi, m) {
	if (abs(phi) < 1e-15) return 0
	if (abs(m) < 1e-15) return phi
	if (abs(phi - PI / 2) < 1e-15) return ellipk(m)
	let s = sin(phi), c = cos(phi)
	return s * carlsonRF(c * c, 1 - m * s * s, 1)
}

// ────── Jacobi elliptic functions via AGM ──────

function ellipj (u, m) {
	if (m < 1e-15) return { sn: sin(u), cn: cos(u), dn: 1 }
	if (m > 1 - 1e-15) return { sn: Math.tanh(u), cn: 1 / Math.cosh(u), dn: 1 / Math.cosh(u) }

	// AGM descending: compute sequences
	let a = [1], b = [sqrt(1 - m)], c = [sqrt(m)]
	while (abs(c[c.length - 1]) > 1e-15 && a.length < 50) {
		let n = a.length - 1
		a.push((a[n] + b[n]) / 2)
		c.push((a[n] - b[n]) / 2)
		b.push(sqrt(a[n] * b[n]))
	}

	// Forward: phi_N = 2^N * a_N * u
	let n = a.length - 1
	let phi = pow(2, n) * a[n] * u

	// Backward recurrence
	for (let i = n; i > 0; i--) {
		phi = (phi + Math.asin(c[i] / a[i] * sin(phi))) / 2
	}

	let sn = sin(phi), cn = cos(phi)
	return { sn, cn, dn: sqrt(1 - m * sn * sn) }
}

// ────── Solve K(m)/K(1-m) = ratio for m ──────

function solveM (ratio) {
	let lo = 1e-15, hi = 1 - 1e-15
	for (let i = 0; i < 100; i++) {
		let mid = (lo + hi) / 2
		let r = ellipk(mid) / ellipk(1 - mid)
		if (r < ratio) lo = mid
		else hi = mid
		if (hi - lo < 1e-15) break
	}
	return (lo + hi) / 2
}
