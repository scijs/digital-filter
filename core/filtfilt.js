/**
 * Zero-phase forward-backward filtering.
 * Odd-reflection padding + steady-state initial conditions on both passes keep
 * edges transient-free (scipy.signal.sosfiltfilt's default method='pad').
 *
 * @module  digital-filter/filtfilt
 */

import filter, { sosfiltZi } from './filter.js'

/**
 * @param {Float64Array|Array<number>} data - Signal, filtered in place
 * @param {{coefs: object|Array<object>, padlen?: number}} params - SOS coefficients;
 *   padlen overrides the default 3*(2*sections+1) edge padding (0 disables)
 * @returns {Float64Array|Array<number>} data
 */
export default function filtfilt (data, params) {
	let sos = Array.isArray(params.coefs) ? params.coefs : [params.coefs]
	let n = data.length
	let padlen = Math.min(params.padlen ?? 3 * (2 * sos.length + 1), n - 1)
	if (padlen < 0) padlen = 0

	// Odd extension: 2*x[edge] - x[mirrored] on both ends
	let ext = new Float64Array(n + 2 * padlen)
	for (let i = 0; i < padlen; i++) ext[i] = 2 * data[0] - data[padlen - i]
	for (let i = 0; i < n; i++) ext[padlen + i] = data[i]
	for (let i = 0; i < padlen; i++) ext[padlen + n + i] = 2 * data[n - 1] - data[n - 2 - i]

	// Forward pass, seeded with steady state scaled to the first sample
	let zi = sosfiltZi(sos)
	filter(ext, { coefs: sos, state: zi.map(([z1, z2]) => [z1 * ext[0], z2 * ext[0]]) })

	// Backward pass, same seeding from the (reversed) first sample
	ext.reverse()
	filter(ext, { coefs: sos, state: zi.map(([z1, z2]) => [z1 * ext[0], z2 * ext[0]]) })
	ext.reverse()

	for (let i = 0; i < n; i++) data[i] = ext[padlen + i]
	return data
}
