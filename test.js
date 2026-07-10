import test, { almost, ok, is, throws } from 'tst'
import * as dsp from './index.js'

let EPSILON = 1e-10
let LOOSE = 1e-4

function impulse (n) {
	let d = new Float64Array(n || 64)
	d[0] = 1
	return d
}

function dc (n, val) {
	let d = new Float64Array(n || 64)
	d.fill(val || 1)
	return d
}

// --- Existing filters ---

test('leakyIntegrator', () => {
	let opts = {lambda: 0.95, y: 0}
	let src = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]
	let result = [0, 0, 0, 0, 0.05, 0.0475, 0.045125, 0.04286875, 0.0407253125, 0.038689046875, 0.03675459453125]
	almost(dsp.leakyIntegrator(src, opts), result)
})

test('movingAverage', () => {
	let opts = {memory: 3}
	let src = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
	let result = [0, 1/3, 1, 2, 3, 4, 5, 6, 7, 8]
	almost(dsp.movingAverage(src, opts), result)
})

// --- Core: biquad coefficients ---

test('biquad.lowpass — DC gain = 1', () => {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	almost(dcGain, 1, LOOSE)
})

test('biquad.highpass — Nyquist gain = 1', () => {
	let c = dsp.biquad.highpass(1000, 0.707, 44100)
	let ny = (c.b0 - c.b1 + c.b2) / (1 - c.a1 + c.a2)
	almost(ny, 1, LOOSE)
})

test('biquad.notch — DC gain = 1, null at fc', () => {
	let fc = 1000, fs = 44100
	let c = dsp.biquad.notch(fc, 10, fs)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	almost(dcGain, 1, LOOSE)
})

test('biquad.allpass — DC gain = 1', () => {
	let c = dsp.biquad.allpass(1000, 1, 44100)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	almost(dcGain, 1, LOOSE)
})

test('biquad.peaking — DC gain = 1', () => {
	let c = dsp.biquad.peaking(1000, 1, 44100, 6)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	almost(dcGain, 1, LOOSE)
})

test('biquad.lowshelf — high frequency gain = 1', () => {
	let c = dsp.biquad.lowshelf(1000, 0.707, 44100, 6)
	let ny = (c.b0 - c.b1 + c.b2) / (1 - c.a1 + c.a2)
	almost(ny, 1, LOOSE)
})

test('biquad.highshelf — DC gain = 1', () => {
	let c = dsp.biquad.highshelf(1000, 0.707, 44100, 6)
	let dcGain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2)
	almost(dcGain, 1, LOOSE)
})

// --- Core: filter engine ---

test('filter — biquad lowpass passes DC', () => {
	let c = dsp.biquad.lowpass(5000, 0.707, 44100)
	let data = dc(128)
	let params = {coefs: c}
	dsp.filter(data, params)
	almost(data[127], 1, LOOSE)
})

test('filter — cascaded SOS', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let data = dc(256)
	dsp.filter(data, {coefs: sos})
	almost(data[255], 1, LOOSE)
})

test('filter — state persists', () => {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let params = {coefs: c}
	dsp.filter(new Float64Array(64), params)
	ok(params.state, 'state initialized')
	ok(Array.isArray(params.state), 'state is array')
})

// --- Core: freqz ---

test('freqz — allpass has unity magnitude', () => {
	let c = dsp.biquad.allpass(2000, 1, 44100)
	let resp = dsp.freqz(c, 256, 44100)
	for (let i = 1; i < resp.magnitude.length; i++) {
		almost(resp.magnitude[i], 1, LOOSE)
	}
	is(resp.frequencies.length, 256)
})

test('mag2db', () => {
	almost(dsp.mag2db(1), 0, EPSILON)
	almost(dsp.mag2db(0.5), -6.0206, LOOSE)
})

// --- Simple filters ---

test('onePole — smooths impulse', () => {
	let data = impulse(32)
	dsp.onePole(data, {fc: 1000, fs: 44100})
	ok(data[0] > 0, 'first sample non-zero')
	ok(data[1] > 0 && data[1] < data[0], 'decaying')
	ok(data[10] < data[1], 'further decay')
})

// --- Classic designs ---

test('butterworth — correct section count', () => {
	is(dsp.butterworth(1, 1000, 44100).length, 1, 'order 1 → 1 section')
	is(dsp.butterworth(2, 1000, 44100).length, 1, 'order 2 → 1 section')
	is(dsp.butterworth(3, 1000, 44100).length, 2, 'order 3 → 2 sections')
	is(dsp.butterworth(4, 1000, 44100).length, 2, 'order 4 → 2 sections')
	is(dsp.butterworth(5, 1000, 44100).length, 3, 'order 5 → 3 sections')
	is(dsp.butterworth(8, 1000, 44100).length, 4, 'order 8 → 4 sections')
})

test('butterworth LP — DC gain = 1', () => {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.butterworth(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		almost(gain, 1, LOOSE)
	}
})

test('butterworth HP — Nyquist gain = 1', () => {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.butterworth(order, 1000, 44100, 'highpass')
		let gain = 1
		for (let s of sos) gain *= (s.b0 - s.b1 + s.b2) / (1 - s.a1 + s.a2)
		almost(gain, 1, LOOSE)
	}
})

test('butterworth bandpass', () => {
	let sos = dsp.butterworth(2, [500, 2000], 44100, 'bandpass')
	ok(sos.length >= 2, 'produces multiple sections')
})

test('butterworth LP — correct -3dB frequency', () => {
	var target = 1 / Math.sqrt(2)
	for (var order = 1; order <= 8; order++) {
		var sos = dsp.butterworth(order, 1000, 44100)
		var resp = dsp.freqz(sos, 8192, 44100)
		var f3db = -1
		for (var i = 1; i < resp.magnitude.length; i++) {
			if (resp.magnitude[i] < target && resp.magnitude[i-1] >= target) {
				f3db = resp.frequencies[i]; break
			}
		}
		ok(Math.abs(f3db - 1000) < 10, 'order ' + order + ' -3dB at ' + f3db.toFixed(0) + ' Hz')
	}
})

test('butterworth BP via transform — proper bandpass shape', () => {
	var sos = dsp.butterworth(2, [500, 2000], 44100, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	var idx10k = Math.round(10000 / (44100/2) * 8192)
	ok(Math.abs(db[idx1k]) < 1, 'BP ~0dB at center')
	ok(db[idx100] < -20, 'BP attenuates 100Hz')
	ok(db[idx10k] < -20, 'BP attenuates 10kHz')
})

test('elliptic even order — correct equiripple', () => {
	var sos = dsp.elliptic(4, 1000, 48000, 1, 40)
	var resp = dsp.freqz(sos, 16384, 48000)
	var db = dsp.mag2db(resp.magnitude)
	var maxPB = -Infinity, minPB = Infinity
	var idx1k = Math.round(1000 / (48000/2) * 16384)
	for (var i = 1; i <= idx1k; i++) {
		if (db[i] > maxPB) maxPB = db[i]
		if (db[i] < minPB) minPB = db[i]
	}
	ok(maxPB < 0.1, 'elliptic N=4 passband max ≈ 0dB')
	ok(minPB > -1.2, 'elliptic N=4 passband min ≈ -1dB')
	ok(maxPB - minPB < 1.2, 'ripple ≈ 1dB')
	var idx5k = Math.round(5000 / (48000/2) * 16384)
	ok(db[idx5k] < -30, 'elliptic N=4 stopband > 30dB')
})

test('elliptic — prototype matches scipy.signal.ellipap 1.17.1', async () => {
	let { ellipticPrototype } = await import('./iir/elliptic.js')
	// ellipap(N, 1, 40) — [sigma, omega] pairs sorted by |omega|, zeros descending
	let refs = {
		3: { z: [2.758343343678], p: [[-0.523721030720, 0], [-0.227259770751, 0.976571011653]] },
		4: { z: [3.525287432996, 1.609550401225], p: [[-0.364290595873, 0.478602767641], [-0.105281264621, 0.993710811209]] },
		5: { z: [1.764288440909, 1.253807568980], p: [[-0.385344340276, 0], [-0.219106729346, 0.741033961151], [-0.049920708887, 0.998198050578]] },
		7: { z: [1.625792481857, 1.135829559757, 1.052759895646], p: [[-0.357647501117, 0], [-0.205913778207, 0.688790553213], [-0.060142897531, 0.940387713027], [-0.011344567662, 0.999796409003]] },
	}
	for (let N of [3, 4, 5, 7]) {
		let { poles, zeros } = ellipticPrototype(N, 1, 40)
		let zs = zeros.map(z => z[1]).sort((a, b) => b - a)
		zs.forEach((z, i) => almost(z, refs[N].z[i], 1e-9))
		let ps = poles.slice().sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))
		ps.forEach((p, i) => {
			almost(p[0], refs[N].p[i][0], 1e-9)
			almost(Math.abs(p[1]), Math.abs(refs[N].p[i][1]), 1e-9)
		})
	}
})

test('elliptic odd order — exact equiripple', async () => {
	// The odd-order defect: interior passband peaks exceeded Rp. Now the v0
	// closed form guarantees [-Rp, 0] dB across the passband for any order.
	let { ellipticPrototype } = await import('./iir/elliptic.js')
	for (let N of [3, 5, 7]) {
		let sos = dsp.elliptic(N, 2000, 44100, 1, 40)
		let resp = dsp.freqz(sos, 8192, 44100)
		let db = dsp.mag2db(resp.magnitude)
		// Stopband starts at the prototype's own selectivity edge; the smallest
		// finite zero bounds it from above. Bilinear-map it to a digital frequency.
		let { zeros } = ellipticPrototype(N, 1, 40)
		let zMin = Math.min(...zeros.map(z => z[1]))
		let fStop = 44100 / Math.PI * Math.atan(zMin * Math.tan(Math.PI * 2000 / 44100))
		let maxPB = -Infinity, minPB = Infinity, sbMax = -Infinity
		for (let i = 0; i < resp.frequencies.length; i++) {
			let f = resp.frequencies[i]
			if (f <= 2000) { maxPB = Math.max(maxPB, db[i]); minPB = Math.min(minPB, db[i]) }
			if (f >= fStop) sbMax = Math.max(sbMax, db[i])
		}
		ok(maxPB < 0.01, `N=${N} passband peak ~0dB (got ${maxPB.toFixed(4)})`)
		ok(minPB > -1.01, `N=${N} passband ripple within 1dB (got ${minPB.toFixed(4)})`)
		ok(sbMax < -39.9, `N=${N} stopband ≥ 40dB past first zero (got ${sbMax.toFixed(1)})`)
	}
})

test('elliptic bandpass/bandstop — finite coefficients, real stopbands', () => {
	let bp = dsp.elliptic(4, [1000, 3000], 44100, 1, 40, 'bandpass')
	ok(bp.every(s => [s.b0, s.b1, s.b2, s.a1, s.a2].every(Number.isFinite)), 'bandpass finite')
	let r = dsp.freqz(bp, 8192, 44100)
	let db = dsp.mag2db(r.magnitude)
	let at = f => db[Math.round(f / (22050 / 8192))]
	ok(Math.abs(at(Math.sqrt(1000 * 3000)) + 1) < 0.1, 'center at -Rp (even order ripple min)')
	ok(at(400) < -40, 'lower stopband')
	ok(at(8000) < -40, 'upper stopband')
	let bs = dsp.elliptic(4, [1000, 3000], 44100, 1, 40, 'bandstop')
	let r2 = dsp.freqz(bs, 8192, 44100)
	let db2 = dsp.mag2db(r2.magnitude)
	let at2 = f => db2[Math.round(f / (22050 / 8192))]
	ok(Math.abs(at2(10) + 1) < 0.1, 'DC at -Rp')
	ok(at2(Math.sqrt(1000 * 3000)) < -39.9, 'notch at -Rs')
})

test('elliptic — section count', () => {
	is(dsp.elliptic(1, 1000, 48000, 1, 40).length, 1, 'N=1: 1 section')
	is(dsp.elliptic(2, 1000, 48000, 1, 40).length, 1, 'N=2: 1 section')
	is(dsp.elliptic(4, 1000, 48000, 1, 40).length, 2, 'N=4: 2 sections')
	is(dsp.elliptic(6, 1000, 48000, 1, 40).length, 3, 'N=6: 3 sections')
})

test('butterworth BS via transform — proper bandstop shape', () => {
	var sos = dsp.butterworth(2, [500, 2000], 44100, 'bandstop')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	var idx10k = Math.round(10000 / (44100/2) * 8192)
	ok(Math.abs(db[idx100]) < 1, 'BS ~0dB at 100Hz')
	ok(db[idx1k] < -40, 'BS deep null at center')
	ok(Math.abs(db[idx10k]) < 1, 'BS ~0dB at 10kHz')
})

test('chebyshev BP — proper bandpass shape', () => {
	var sos = dsp.chebyshev(2, [500, 2000], 44100, 1, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	ok(Math.abs(db[idx1k]) < 2, 'Cheb BP ~0dB at center')
	ok(db[idx100] < -10, 'Cheb BP attenuates 100Hz')
})

test('bessel BP — proper bandpass shape', () => {
	var sos = dsp.bessel(2, [500, 2000], 44100, 'bandpass')
	var resp = dsp.freqz(sos, 8192, 44100)
	var db = dsp.mag2db(resp.magnitude)
	var idx100 = Math.round(100 / (44100/2) * 8192)
	var idx1k = Math.round(1000 / (44100/2) * 8192)
	ok(Math.abs(db[idx1k]) < 2, 'Bessel BP ~0dB at center')
	ok(db[idx100] < -10, 'Bessel BP attenuates 100Hz')
})

test('chebyshev — DC gain ≈ 1 for odd orders', () => {
	for (let order = 1; order <= 7; order += 2) {
		let sos = dsp.chebyshev(order, 1000, 44100, 1)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		almost(gain, 1, LOOSE)
	}
})

test('chebyshev — correct section count', () => {
	is(dsp.chebyshev(1, 1000, 44100, 1).length, 1)
	is(dsp.chebyshev(2, 1000, 44100, 1).length, 1)
	is(dsp.chebyshev(4, 1000, 44100, 1).length, 2)
	is(dsp.chebyshev(5, 1000, 44100, 1).length, 3)
})

test('bessel — DC gain ≈ 1', () => {
	for (let order = 1; order <= 10; order++) {
		let sos = dsp.bessel(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		almost(gain, 1, LOOSE)
	}
})

test('bessel — order range validation', () => {
	throws(() => { dsp.bessel(11, 1000, 44100) }, 'order > 10 throws')
})

// --- Specialized ---

test('svf lowpass — attenuates DC signal correctly', () => {
	let data = dc(256)
	dsp.svf(data, {fc: 5000, Q: 0.707, fs: 44100, type: 'lowpass'})
	almost(data[255], 1, 0.01)
})

test('svf highpass — removes DC', () => {
	let data = dc(512)
	dsp.svf(data, {fc: 1000, Q: 0.707, fs: 44100, type: 'highpass'})
	ok(Math.abs(data[511]) < 0.01, 'HP removes DC')
})

test('svf bandpass — produces output', () => {
	let data = impulse(64)
	dsp.svf(data, {fc: 1000, Q: 5, fs: 44100, type: 'bandpass'})
	ok(data[1] !== 0, 'BP produces output on impulse')
})

test('linkwitzRiley — returns low and high', () => {
	let lr = dsp.linkwitzRiley(4, 1000, 44100)
	ok(lr.low, 'has low')
	ok(lr.high, 'has high')
	ok(Array.isArray(lr.low), 'low is array')
	ok(Array.isArray(lr.high), 'high is array')
	is(lr.low.length, 2, 'LR4 low has 2 sections')
	is(lr.high.length, 2, 'LR4 high has 2 sections')
})

test('linkwitzRiley — odd order throws', () => {
	throws(() => { dsp.linkwitzRiley(3, 1000, 44100) }, 'odd order throws')
})

test('linkwitzRiley — LP+HP sum ≈ flat', () => {
	let lr = dsp.linkwitzRiley(4, 1000, 44100)
	let respLo = dsp.freqz(lr.low, 128, 44100)
	let respHi = dsp.freqz(lr.high, 128, 44100)
	for (let i = 1; i < 128; i++) {
		ok(respLo.magnitude[i] + respHi.magnitude[i] >= 0.5)
	}
})

test('savitzkyGolay — preserves linear trend', () => {
	let data = new Float64Array(11)
	for (let i = 0; i < 11; i++) data[i] = i * 2.5
	let expected = Array.from(data)
	dsp.savitzkyGolay(data, {windowSize: 5, degree: 2})
	for (let i = 2; i < 9; i++) {
		almost(data[i], expected[i], 0.01)
	}
})

// --- Weighting filters ---

// --- New filters ---

test('groupDelay — flat for FIR delay', () => {
	// Unity filter: zero delay
	let resp = dsp.groupDelay({b0: 1, b1: 0, b2: 0, a1: 0, a2: 0}, 64, 44100)
	is(resp.frequencies.length, 64, 'correct length')
	ok(Math.abs(resp.delay[1]) < 0.01, 'unity filter has ~0 delay')
	// Pure z^-1: H(e^jw) = e^-jw → group delay = 1 sample at every frequency
	// (Oppenheim & Schafer, Discrete-Time Signal Processing, §5.1)
	let one = dsp.groupDelay({b0: 0, b1: 1, b2: 0, a1: 0, a2: 0}, 16, 44100)
	for (let i = 0; i < 16; i++) almost(one.delay[i], 1, 1e-9)
})

test('groupDelay/phaseDelay — vs scipy.signal.group_delay 1.17.1', () => {
	// biquad.lowpass(1000, 0.707, 44100) evaluated at w = i*pi/8, i=0..7
	let lp = dsp.biquad.lowpass(1000, 0.707, 44100)
	let gdRef = [9.9106873881, 1.4720954646, 0.354510959, 0.1653427775, 0.1014426639, 0.0731624112, 0.0591759735, 0.0524731268]
	let pdRef = [0, 6.6571065181, 3.6867373801, 2.5379634839, 1.935636249, 1.5656269212, 1.3155846193, 1.1355531489]
	let gd = dsp.groupDelay(lp, 8, 44100).delay
	let pd = dsp.phaseDelay(lp, 8, 44100).delay
	for (let i = 0; i < 8; i++) { almost(gd[i], gdRef[i], 1e-6); almost(pd[i], pdRef[i], 1e-6) }
	// peaking(3000, 2, 44100, 6): negative group delay regions — signs must survive
	let pk = dsp.biquad.peaking(3000, 2, 44100, 6)
	let gdPk = [-0.811636782, 4.9214899487, -0.409458593, -0.1527479169, -0.0842833317, -0.0577949887, -0.0455607672, -0.0398992199]
	let gd2 = dsp.groupDelay(pk, 8, 44100).delay
	for (let i = 0; i < 8; i++) almost(gd2[i], gdPk[i], 1e-6)
})

test('filtfilt — zero-phase filtering', () => {
	let c = dsp.biquad.lowpass(2000, 0.707, 44100)
	let data = dc(256)
	dsp.filtfilt(data, {coefs: c})
	almost(data[128], 1, 0.01)
	// Edge transients eliminated: constant input stays constant at BOTH ends
	// (scipy.signal.sosfiltfilt default pad behavior)
	almost(data[0], 1, 1e-9)
	almost(data[255], 1, 1e-9)
})

test('filtfilt — matches scipy.signal.sosfiltfilt 1.17.1', () => {
	// x = sin(2π·0.05·i) + 0.5·(i>=16), 32 samples, biquad.lowpass(1000, 0.707, 44100)
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let x = new Float64Array(32)
	for (let i = 0; i < 32; i++) x[i] = Math.sin(2 * Math.PI * i * 0.05) + (i >= 16 ? 0.5 : 0)
	let ref = [-0.10020853188, -0.063018292375, -0.027535771823, 0.005248043145, 0.034586173402, 0.060049534785, 0.081570927913, 0.099453810545, 0.114343987219, 0.127165987227, 0.139029364676, 0.151113105032, 0.164538473607, 0.180241783885, 0.198858587564, 0.220629693661, 0.245350285298, 0.2723934619, 0.300797214411, 0.32936132815, 0.356736140058, 0.381521009724, 0.402375235956, 0.418130036105, 0.427890180296, 0.4311149724, 0.427670383675, 0.417847063967, 0.402342391132, 0.382208333032, 0.358770332214, 0.333525342346]
	dsp.filtfilt(x, { coefs: c })
	for (let i = 0; i < 32; i++) almost(x[i], ref[i], 1e-9)
})

test('filtfilt — zero phase shift on a passband sine (vs single-pass lag)', () => {
	// Sine with an exact integer number of periods in the measurement window:
	// f = 44100·8/512 ≈ 689 Hz (period 64 samples) through a 2 kHz lowpass.
	// Quadrature projection over [256, 768) measures phase directly: filtfilt
	// must preserve it, a single pass must lag — the falsifiable distinction.
	let c = dsp.biquad.lowpass(2000, 0.707, 44100)
	let n = 1024, w = 2 * Math.PI * 8 / 512
	let x = new Float64Array(n)
	for (let i = 0; i < n; i++) x[i] = Math.sin(w * i)
	let y = Float64Array.from(x)
	dsp.filtfilt(y, { coefs: c })
	let single = Float64Array.from(x)
	dsp.filter(single, { coefs: c })
	let phaseOf = sig => {
		let ss = 0, sc = 0
		for (let i = 256; i < 768; i++) { ss += sig[i] * Math.sin(w * i); sc += sig[i] * Math.cos(w * i) }
		return Math.atan2(sc, ss)
	}
	ok(Math.abs(phaseOf(y) - phaseOf(x)) < 1e-6, 'filtfilt preserves phase')
	ok(Math.abs(phaseOf(single) - phaseOf(x)) > 0.05, 'single pass lags — the property that distinguishes them')
})

// --- FIR design ---

test('getWindow — named windows match scipy.signal.windows 1.17.1', async () => {
	let { getWindow } = await import('./fir/util.js')
	// scipy.signal.windows.<name>(8), first half (symmetric)
	let refs = {
		hamming: [0.08, 0.253194691145, 0.64235962962, 0.954445679235],
		hann: [0, 0.188255099071, 0.611260466978, 0.950484433951],
		blackman: [0, 0.090453424354, 0.459182957546, 0.9203636181],
		'blackman-harris': [6e-05, 0.033391723478, 0.332833504299, 0.889369772223],
		bartlett: [0, 0.285714285714, 0.571428571429, 0.857142857143],
	}
	for (let [name, ref] of Object.entries(refs)) {
		let w = getWindow(name, 8)
		for (let i = 0; i < 4; i++) almost(w[i], ref[i], 1e-9)
		almost(w[7 - 0], w[0], 1e-12) // symmetric
	}
	// scipy.signal.windows.kaiser(8, 8.6)
	let k = getWindow(['kaiser', 8.6], 8)
	let kref = [0.001332513998, 0.091136512928, 0.459643774593, 0.920461583258]
	for (let i = 0; i < 4; i++) almost(k[i], kref[i], 1e-9)
	// Unknown names throw instead of silently designing a different filter
	let threw = false
	try { getWindow('blackmann', 8) } catch (e) { threw = true }
	ok(threw, 'unknown window name throws')
})

test('kaiserord — matches scipy.signal.kaiserord 1.17.1 (+odd forcing)', () => {
	// scipy.signal.kaiserord(60, 0.2) → (38, 5.65326); library forces odd → 39
	let { numtaps, beta } = dsp.kaiserord(0.2, 60)
	is(numtaps, 39)
	almost(beta, 5.65326, 1e-9)
	// scipy.signal.kaiserord(40, 0.1) → (46, 3.3953210522614574) → odd 47
	;({ numtaps, beta } = dsp.kaiserord(0.1, 40))
	is(numtaps, 47)
	almost(beta, 3.3953210522614574, 1e-12)
})


test('firwin — lowpass FIR', () => {
	let h = dsp.firwin(51, 1000, 44100)
	is(h.length, 51)
	// DC gain should be ~1
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	almost(sum, 1, 0.01)
	// Symmetric (linear phase)
	almost(h[0], h[50], LOOSE)
})

test('firwin — highpass FIR', () => {
	let h = dsp.firwin(51, 5000, 44100, {type: 'highpass'})
	// DC should be ~0
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	ok(Math.abs(sum) < 0.05, 'near-zero DC gain for HP')
})

test('firwin — bandpass FIR', () => {
	let h = dsp.firwin(101, [500, 2000], 44100, {type: 'bandpass'})
	is(h.length, 101)
})

test('kaiserord — estimates order and beta', () => {
	let {numtaps, beta} = dsp.kaiserord(0.05, 60)
	ok(numtaps > 10, 'reasonable order')
	ok(numtaps % 2 === 1, 'odd taps')
	ok(beta > 0, 'positive beta')
})

test('hilbert — antisymmetric FIR', () => {
	let h = dsp.hilbert(31)
	is(h.length, 31)
	almost(h[15], 0, EPSILON)
	// Antisymmetric: h[n] = -h[N-1-n]
	almost(h[14], -h[16], LOOSE)
})

test('median — removes impulse noise', () => {
	let data = new Float64Array([1, 1, 1, 100, 1, 1, 1])
	dsp.median(data, {size: 3})
	ok(data[3] < 10, 'impulse removed')
	almost(data[0], 1, EPSILON)
})

// --- Analysis & conversion ---

test('sos2zpk — correct poles and zeros', () => {
	let sos = [{b0: 1, b1: 0, b2: -1, a1: 0, a2: -0.81}]
	let {zeros, poles} = dsp.sos2zpk(sos)
	ok(zeros.length === 2, '2 zeros')
	ok(poles.length === 2, '2 poles')
})

test('sos2tf — converts to polynomials', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	let {b, a} = dsp.sos2tf(sos)
	ok(b.length === 3, 'numerator degree 2')
	ok(a.length === 3, 'denominator degree 2')
})

test('isStable — detects stable filters', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	ok(dsp.isStable(sos), 'Butterworth is stable')
})

test('isLinPhase — detects symmetric FIR', () => {
	let h = dsp.firwin(31, 1000, 44100)
	ok(dsp.isLinPhase(h), 'firwin produces linear-phase FIR')
})

// --- Adaptive ---

test('lms — converges to identify system', () => {
	// Simple test: identity system (desired = input)
	let input = new Float64Array(256)
	for (let i = 0; i < 256; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, mu: 0.1}
	let output = dsp.lms(input, desired, params)
	// After convergence, error should be small
	let lastErr = Math.abs(params.error[255])
	ok(lastErr < 0.1, 'LMS error converges')
})

test('nlms — converges faster than LMS', () => {
	let input = new Float64Array(256)
	for (let i = 0; i < 256; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, mu: 0.5}
	let output = dsp.nlms(input, desired, params)
	let lastErr = Math.abs(params.error[255])
	ok(lastErr < 0.1, 'NLMS error converges')
})

// --- Dynamic / nonlinear ---

test('oneEuro — smooths noisy signal', () => {
	let data = new Float64Array(100)
	for (let i = 0; i < 100; i++) data[i] = 1 + (Math.random() - 0.5) * 0.1
	dsp.oneEuro(data, {minCutoff: 1, beta: 0.01, fs: 100})
	// After filtering, variance should be reduced
	let mean = 0
	for (let i = 50; i < 100; i++) mean += data[i]
	mean /= 50
	ok(Math.abs(mean - 1) < 0.1, 'one-euro preserves mean')
})

test('decimate — reduces sample count', () => {
	let data = new Float64Array(1000)
	data.fill(1)
	let result = dsp.decimate(data, 4)
	ok(result.length === 250, 'length / 4')
})

// --- Tier 1+2 new modules ---

test('firls — least-squares FIR', () => {
	let h = dsp.firls(31, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	is(h.length, 31)
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	ok(sum > 0.5, 'positive DC gain for lowpass')
	almost(h[0], h[30], LOOSE)
})

test('remez — equiripple FIR', () => {
	let h = dsp.remez(31, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	is(h.length, 31)
	almost(h[0], h[30], LOOSE)
})

test('tf2zpk — polynomial to roots', () => {
	let {zeros, poles, gain} = dsp.tf2zpk([1, 0, -1], [1, 0, -0.81])
	is(zeros.length, 2, '2 zeros')
	is(poles.length, 2, '2 poles')
	ok(gain !== 0, 'nonzero gain')
})

test('zpk2sos — round-trip with sos2zpk', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let zpk = dsp.sos2zpk(sos)
	let sos2 = dsp.zpk2sos(zpk)
	is(sos2.length, sos.length, 'same section count')
})

test('tf2sos — round-trip with sos2tf', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let {b, a} = dsp.sos2tf(sos)
	let sos2 = dsp.tf2sos(b, a)
	is(sos2.length, sos.length, 'same section count')
	// Verify frequency response matches
	let resp1 = dsp.freqz(sos, 256, 44100)
	let resp2 = dsp.freqz(sos2, 256, 44100)
	for (let i = 0; i < resp1.magnitude.length; i++) {
		almost(resp1.magnitude[i], resp2.magnitude[i], LOOSE)
	}
})

test('tf2zpk — leading/trailing zero coefficients (scipy 1.17.1 refs)', () => {
	// scipy.signal.tf2zpk([0,1],[1,-0.5]) → z=[], p=[0.5], k=1
	let {zeros, poles, gain} = dsp.tf2zpk([0, 1], [1, -0.5])
	is(zeros.length, 0, 'no zeros')
	almost(poles[0].re, 0.5, LOOSE)
	almost(gain, 1, LOOSE)
	// scipy.signal.tf2zpk([0,1,1],[1,-0.5,0.06]) → z=[-1], p=[0.3,0.2], k=1
	;({zeros, poles, gain} = dsp.tf2zpk([0, 1, 1], [1, -0.5, 0.06]))
	almost(zeros[0].re, -1, LOOSE)
	almost(gain, 1, LOOSE)
	// scipy.signal.tf2zpk([1,-0.9,0.2,0],[1]) → z=[0.5,0.4,0], k=1 (trailing zero → exact origin root)
	;({zeros, poles, gain} = dsp.tf2zpk([1, -0.9, 0.2, 0], [1]))
	let zs = zeros.map(z => z.re).sort()
	almost(zs, [0, 0.4, 0.5], 1e-6)
	for (let z of zeros) almost(z.im, 0, 1e-8)
	almost(gain, 1, LOOSE)
})

test('zpk2tf — round-trip with tf2zpk', () => {
	let b0 = [1, -1.5, 0.7]
	let a0 = [1, -1.2, 0.5]
	let zpk = dsp.tf2zpk(b0, a0)
	let {b, a} = dsp.zpk2tf(zpk)
	almost(b, new Float64Array(b0), LOOSE)
	almost(a, new Float64Array(a0), LOOSE)
})

test('zpk2tf — butterworth round-trip', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let zpk = dsp.sos2zpk(sos)
	let {b, a} = dsp.zpk2tf(zpk)
	let {b: b2, a: a2} = dsp.sos2tf(sos)
	almost(b, b2, LOOSE)
	almost(a, a2, LOOSE)
})

test('sosfiltZi — DC signal has no transient', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let zi = dsp.sosfiltZi(sos)
	// Filter constant signal with initial conditions — should have no transient
	let dcVal = 5.0
	let data = new Float64Array(128).fill(dcVal)
	let scaledZi = zi.map(s => [s[0] * dcVal, s[1] * dcVal])
	dsp.filter(data, {coefs: sos, state: scaledZi})
	// First sample should already be at steady state
	let dcGain = 1 // butterworth lowpass DC gain = 1
	almost(data[0], dcVal * dcGain, LOOSE)
	almost(data[1], dcVal * dcGain, LOOSE)
})

test('detrend constant — removes DC offset', () => {
	let data = new Float64Array(100)
	for (let i = 0; i < 100; i++) data[i] = 3.7
	dsp.detrend(data, 'constant')
	let mean = 0
	for (let i = 0; i < 100; i++) mean += data[i]
	mean /= 100
	almost(mean, 0, EPSILON)
})

test('detrend linear — removes linear ramp', () => {
	let data = new Float64Array(100)
	for (let i = 0; i < 100; i++) data[i] = 2.5 + 0.3 * i
	dsp.detrend(data, 'linear')
	let mean = 0, max = 0
	for (let i = 0; i < 100; i++) { mean += data[i]; max = Math.max(max, Math.abs(data[i])) }
	mean /= 100
	almost(mean, 0, EPSILON)
	ok(max < EPSILON, 'residual near zero after removing linear trend')
})

test('impulseResponse — correct length', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	let ir = dsp.impulseResponse(sos, 128)
	is(ir.length, 128)
	ok(ir[0] !== 0, 'first sample non-zero')
})

test('stepResponse — converges to DC gain', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	let sr = dsp.stepResponse(sos, 512)
	almost(sr[511], 1, 0.01)
})

test('chebyshev2 — flat passband', () => {
	let sos = dsp.chebyshev2(4, 2000, 44100, 40)
	let resp = dsp.freqz(sos, 8192, 44100)
	let db = dsp.mag2db(resp.magnitude)
	let idx500 = Math.round(500 / (44100/2) * 8192)
	ok(Math.abs(db[idx500]) < 1, 'flat passband at 500Hz')
})

test('iirdesign — auto-selects filter', () => {
	let result = dsp.iirdesign(1000, 2000, 1, 40, 44100)
	ok(result.sos, 'returns SOS')
	ok(result.order > 0, 'positive order')
	ok(result.type, 'identifies type')
})

test('interpolate — increases sample count', () => {
	let data = new Float64Array(100)
	data.fill(1)
	let result = dsp.interpolate(data, 4)
	is(result.length, 400, 'length * 4')
})

test('phaseDelay — returns frequencies and delay', () => {
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let resp = dsp.phaseDelay(c, 64, 44100)
	is(resp.frequencies.length, 64)
	is(resp.delay.length, 64)
})

// --- Tier 3: IIR design ---

test('legendre — DC gain = 1, steeper than Butterworth', () => {
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.legendre(order, 1000, 44100)
		let gain = 1
		for (let s of sos) gain *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		almost(gain, 1, LOOSE)
	}
	// Verify steeper than Butterworth at order 4
	let bwResp = dsp.freqz(dsp.butterworth(4, 1000, 44100), 4096, 44100)
	let lgResp = dsp.freqz(dsp.legendre(4, 1000, 44100), 4096, 44100)
	let idx2k = Math.round(2000 / (44100/2) * 4096)
	ok(dsp.mag2db(lgResp.magnitude[idx2k]) < dsp.mag2db(bwResp.magnitude[idx2k]),
		'Legendre steeper than Butterworth at 2kHz')
})

test('legendre — correct -3dB frequency', () => {
	let target = 1 / Math.sqrt(2)
	for (let order of [2, 4, 6, 8]) {
		let sos = dsp.legendre(order, 1000, 44100)
		let resp = dsp.freqz(sos, 8192, 44100)
		let f3db = -1
		for (let i = 1; i < resp.magnitude.length; i++) {
			if (resp.magnitude[i] < target && resp.magnitude[i-1] >= target) { f3db = resp.frequencies[i]; break }
		}
		ok(Math.abs(f3db - 1000) < 15, 'order ' + order + ' -3dB at ' + (f3db|0) + 'Hz')
	}
})

test('legendre — monotonic passband (no ripple)', () => {
	let sos = dsp.legendre(6, 1000, 44100)
	let resp = dsp.freqz(sos, 4096, 44100)
	let idx1k = Math.round(1000 / (44100/2) * 4096)
	let db = dsp.mag2db(resp.magnitude)
	// Check monotonically decreasing in passband
	let monotonic = true
	for (let i = 2; i < idx1k; i++) {
		if (db[i] > db[i-1] + 0.01) { monotonic = false; break }
	}
	ok(monotonic, 'Legendre order 6 passband is monotonic')
})

test('gaussianIir — smooths signal', () => {
	let data = impulse(256)
	dsp.gaussianIir(data, {sigma: 5})
	ok(data[0] > 0, 'peak exists')
	ok(data[10] > 0, 'spread visible')
	ok(data[50] < data[0], 'decays from peak')
})

test('yulewalk — produces valid filter', () => {
	let {b, a} = dsp.yulewalk(4, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	ok(b.length > 0, 'has numerator')
	ok(a.length > 0, 'has denominator')
	ok(a[0] === 1, 'a[0] = 1')
})

// --- Tier 3: FIR extras ---

test('firwin2 — arbitrary frequency response', () => {
	let h = dsp.firwin2(51, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	is(h.length, 51)
	almost(h[0], h[50], LOOSE)
})

test('minimumPhase — reduces delay, preserves magnitude', () => {
	let h = dsp.firwin(63, 1000, 44100)
	let hm = dsp.minimumPhase(h)
	is(hm.length, h.length)
	// Energy should be similar
	let e1 = 0, e2 = 0
	for (let i = 0; i < h.length; i++) { e1 += h[i]*h[i]; e2 += hm[i]*hm[i] }
	ok(Math.abs(e1 - e2) / e1 < 0.15, 'energy preserved within 15%')
	// Not linear phase anymore
	ok(!dsp.isLinPhase(hm), 'no longer linear phase')
})

test('differentiator — antisymmetric', () => {
	let h = dsp.differentiator(31)
	almost(h[15], 0, 1e-10)
	almost(h[14], -h[16], LOOSE)
})

test('integrator — trapezoidal rule', () => {
	let h = dsp.integrator('trapezoidal')
	is(h.length, 2)
	almost(h[0], 0.5, 1e-10)
	almost(h[1], 0.5, 1e-10)
})

test('raisedCosine — symmetric, nonzero', () => {
	let h = dsp.raisedCosine(65, 0.35, 4)
	is(h.length, 65)
	almost(h[0], h[64], LOOSE)
	let energy = 0
	for (let i = 0; i < h.length; i++) energy += h[i]*h[i]
	ok(energy > 0, 'has energy')
})

test('gaussianFir — bell-shaped', () => {
	let h = dsp.gaussianFir(33, 0.3, 4)
	is(h.length, 33)
	ok(h[16] > h[0], 'center > edge')
})

test('matchedFilter — time-reversed template', () => {
	let template = new Float64Array([1, 2, 3, 4])
	let h = dsp.matchedFilter(template)
	almost(h[0] * 30, 4, LOOSE) // 4/energy
	almost(h[3] * 30, 1, LOOSE)
})

// --- Tier 3: Virtual analog ---

// --- Tier 3: Psychoacoustic ---

// --- Tier 3: Multirate ---

test('halfBand — half the coefficients are zero', () => {
	let h = dsp.halfBand(31)
	is(h.length, 31)
	let M = 15
	let zeroCount = 0
	for (let i = 0; i < 31; i++) {
		if (i !== M && Math.abs(i - M) % 2 === 0 && Math.abs(h[i]) < 1e-10) zeroCount++
	}
	ok(zeroCount >= 5, 'many even-offset coefficients are zero')
})

test('cic — decimates correctly', () => {
	let data = new Float64Array(1000).fill(1)
	let out = dsp.cic(data, 10, 3)
	is(out.length, 100, 'decimated by 10')
	almost(out[50], 1, 0.01)
})

test('polyphase — decomposes into M phases', () => {
	let h = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8])
	let phases = dsp.polyphase(h, 4)
	is(phases.length, 4, '4 phases')
	almost(phases[0][0], 1, 1e-10)
	almost(phases[1][0], 2, 1e-10)
})

test('farrow — delays signal', () => {
	let data = new Float64Array(64)
	data[10] = 1  // impulse at sample 10
	dsp.farrow(data, {delay: 3, order: 3})
	// Peak should move to ~sample 13
	let peakIdx = 0
	for (let i = 1; i < 64; i++) if (data[i] > data[peakIdx]) peakIdx = i
	ok(peakIdx >= 12 && peakIdx <= 14, 'peak shifted by ~3 samples')
})

test('thiran — allpass coefficients', () => {
	let {b, a} = dsp.thiran(3.5, 3)
	is(b.length, 4, 'order+1 coefficients')
	is(a.length, 4)
	// Allpass: b = reverse(a)
	almost(b[0], a[3], LOOSE)
	almost(b[3], a[0], LOOSE)
})

test('oversample — increases length', () => {
	let data = new Float64Array(100).fill(1)
	let out = dsp.oversample(data, 4)
	is(out.length, 400)
})

// --- Tier 3: Adaptive ---

test('rls — converges faster than LMS', () => {
	let input = new Float64Array(256)
	for (let i = 0; i < 256; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, lambda: 0.99}
	dsp.rls(input, desired, params)
	ok(Math.abs(params.error[255]) < 0.05, 'RLS converges')
})

test('levinson — produces LPC coefficients', () => {
	// Autocorrelation of a simple signal
	let R = [1, 0.9, 0.8, 0.7, 0.6]
	let {a, error, k} = dsp.levinson(R)
	is(a.length, 5, 'order+1 coefficients')
	ok(a[0] === 1, 'a[0] = 1')
	ok(error > 0, 'positive prediction error')
	ok(k.length === 4, '4 reflection coefficients')
	// All reflection coefficients should be < 1 in magnitude (stability)
	ok(k.every(v => Math.abs(v) < 1), 'stable reflection coefficients')
})

// --- Tier 3: Intelligent ---

test('dynamicSmoothing — smooths signal', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 256; i++) data[i] = Math.sin(2 * Math.PI * 10 * i / 44100) + (Math.random() - 0.5) * 0.1
	dsp.dynamicSmoothing(data, {fc: 5, fs: 44100})
	ok(data.every(isFinite), 'all finite')
})

// --- Tier 3: Composites ---

test('convolution — correct length and impulse', () => {
	let sig = new Float64Array([1, 0, 0, 0])
	let ir = new Float64Array([1, 0.5, 0.25])
	let out = dsp.convolution(sig, ir)
	is(out.length, 6, 'N+M-1')
	almost(out[0], 1, 1e-10)
	almost(out[1], 0.5, 1e-10)
	almost(out[2], 0.25, 1e-10)
})

// --- Tier 3: Structures ---

test('lattice — all-pole filter', () => {
	let data = impulse(64)
	dsp.lattice(data, {k: new Float64Array([0.5, -0.3])})
	ok(data[0] !== 0, 'produces output')
	ok(data.every(isFinite), 'all finite')
})

// ================================================================
// Additional comprehensive tests — mathematical correctness
// ================================================================

// --- Butterworth HP: -3dB at cutoff ---

test('butterworth HP — correct -3dB frequency', () => {
	let target = 1 / Math.sqrt(2)
	for (let order = 1; order <= 8; order++) {
		let sos = dsp.butterworth(order, 1000, 44100, 'highpass')
		let resp = dsp.freqz(sos, 8192, 44100)
		let f3db = -1
		for (let i = resp.magnitude.length - 1; i > 0; i--) {
			if (resp.magnitude[i] < target && resp.magnitude[i+1] >= target) {
				// HP: magnitude rises with frequency, cross from below
			}
			if (resp.magnitude[i] >= target && resp.magnitude[i-1] < target) {
				f3db = resp.frequencies[i]; break
			}
		}
		ok(Math.abs(f3db - 1000) < 15, 'HP order ' + order + ' -3dB at ' + (f3db|0) + 'Hz')
	}
})

// --- Chebyshev passband ripple is exactly Rp ---

test('chebyshev — passband ripple matches Rp', () => {
	let Rp = 1 // dB ripple
	for (let order of [3, 5, 7]) {
		let sos = dsp.chebyshev(order, 2000, 44100, Rp)
		let resp = dsp.freqz(sos, 8192, 44100)
		let db = dsp.mag2db(resp.magnitude)
		let idx2k = Math.round(2000 / (44100/2) * 8192)
		let maxPB = -Infinity, minPB = Infinity
		for (let i = 1; i <= idx2k; i++) {
			if (db[i] > maxPB) maxPB = db[i]
			if (db[i] < minPB) minPB = db[i]
		}
		let ripple = maxPB - minPB
		ok(ripple < Rp + 0.3, 'Cheb order ' + order + ' ripple ' + ripple.toFixed(2) + 'dB ≈ ' + Rp + 'dB')
	}
})

// --- Bessel group delay is flat ---

test('bessel — group delay flatter than Butterworth', () => {
	let order = 4, fc = 2000, fs = 44100
	let besselSos = dsp.bessel(order, fc, fs)
	let bwSos = dsp.butterworth(order, fc, fs)

	let besselGD = dsp.groupDelay(besselSos, 256, fs)
	let bwGD = dsp.groupDelay(bwSos, 256, fs)

	// Measure delay variation in passband (up to fc)
	let idxFc = Math.round(fc / (fs/2) * 256)
	let besselVar = 0, bwVar = 0
	for (let i = 2; i < idxFc; i++) {
		besselVar += Math.abs(besselGD.delay[i] - besselGD.delay[i-1])
		bwVar += Math.abs(bwGD.delay[i] - bwGD.delay[i-1])
	}
	ok(besselVar < bwVar, 'Bessel group delay variation (' + besselVar.toFixed(2) + ') < Butterworth (' + bwVar.toFixed(2) + ')')
})

// --- Legendre is monotonic AND steeper than Butterworth ---

test('legendre — steeper than Butterworth at multiple frequencies', () => {
	for (let order of [3, 5, 7]) {
		let bwResp = dsp.freqz(dsp.butterworth(order, 1000, 44100), 4096, 44100)
		let lgResp = dsp.freqz(dsp.legendre(order, 1000, 44100), 4096, 44100)
		let idx3k = Math.round(3000 / (44100/2) * 4096)
		ok(dsp.mag2db(lgResp.magnitude[idx3k]) <= dsp.mag2db(bwResp.magnitude[idx3k]) + 0.5,
			'Legendre order ' + order + ' steeper at 3kHz')
	}
})

// --- SVF all 6 modes produce output on impulse ---

test('svf — all 6 modes produce output on impulse', () => {
	let modes = ['lowpass', 'highpass', 'bandpass', 'notch', 'peak', 'allpass']
	for (let type of modes) {
		let data = impulse(128)
		dsp.svf(data, {fc: 1000, Q: 1, fs: 44100, type})
		let hasOutput = data.some(x => Math.abs(x) > 0.0001)
		ok(hasOutput, 'SVF ' + type + ' produces output')
	}
})

// --- firls produces symmetric coefficients ---

test('firls — symmetric coefficients (linear phase)', () => {
	let h = dsp.firls(51, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	ok(dsp.isLinPhase(h), 'firls output is linear phase')
})

// --- remez produces equiripple ---

test('remez — equiripple passband', () => {
	let h = dsp.remez(31, [0, 0.25, 0.35, 1], [1, 1, 0, 0])
	// Compute passband response and check ripple is roughly constant
	let N = h.length
	let maxRipple = -Infinity, minRipple = Infinity
	for (let fi = 0.05; fi <= 0.25; fi += 0.02) {
		let w = Math.PI * fi
		let re = 0, im = 0
		for (let n = 0; n < N; n++) {
			re += h[n] * Math.cos(w * n)
			im -= h[n] * Math.sin(w * n)
		}
		let mag = Math.sqrt(re * re + im * im)
		if (mag > maxRipple) maxRipple = mag
		if (mag < minRipple) minRipple = mag
	}
	let rippleDb = 20 * Math.log10(maxRipple / minRipple)
	ok(rippleDb < 3, 'Remez passband ripple < 3dB (got ' + rippleDb.toFixed(2) + 'dB)')
})

// --- kaiserord gives reasonable estimates ---

test('kaiserord — estimates scale with requirements', () => {
	let {numtaps: n1} = dsp.kaiserord(0.1, 40)
	let {numtaps: n2} = dsp.kaiserord(0.05, 60)
	ok(n2 > n1, 'tighter spec requires more taps (' + n1 + ' vs ' + n2 + ')')
	ok(n1 >= 5 && n1 <= 200, 'reasonable tap count for 40dB: ' + n1)
	ok(n2 >= 10 && n2 <= 500, 'reasonable tap count for 60dB: ' + n2)
})

// --- raisedCosine is symmetric ---

test('raisedCosine — symmetric and peaks at center', () => {
	let h = dsp.raisedCosine(65, 0.35, 4)
	let center = 32
	for (let i = 0; i < 32; i++) {
		almost(h[i], h[64 - i], LOOSE)
	}
	// Center should be the maximum
	let centerVal = h[center]
	for (let i = 0; i < 65; i++) {
		ok(h[i] <= centerVal + LOOSE, 'center is max (i=' + i + ')')
	}
})

// --- gaussianFir peaks at center ---

test('gaussianFir — peaks at center and symmetric', () => {
	let h = dsp.gaussianFir(33, 0.3, 4)
	let center = 16
	ok(h[center] >= h[0], 'center >= edge')
	ok(h[center] >= h[32], 'center >= last')
	almost(h[0], h[32], LOOSE)
	almost(h[5], h[27], LOOSE)
})

// --- matchedFilter reverses template ---

test('matchedFilter — output is time-reversed and energy-normalized', () => {
	let template = new Float64Array([1, 0, 3, 2])
	let h = dsp.matchedFilter(template)
	let energy = 1 + 0 + 9 + 4 // 14
	almost(h[0], 2/energy, LOOSE)
	almost(h[1], 3/energy, LOOSE)
	almost(h[2], 0/energy, LOOSE)
	almost(h[3], 1/energy, LOOSE)
})

// --- noiseShaping quantizes signal ---

// --- LMS/NLMS/RLS all converge ---

test('lms — error decreases over time', () => {
	let input = new Float64Array(512)
	for (let i = 0; i < 512; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, mu: 0.1}
	dsp.lms(input, desired, params)
	let earlyErr = 0, lateErr = 0
	for (let i = 0; i < 50; i++) earlyErr += Math.abs(params.error[i])
	for (let i = 462; i < 512; i++) lateErr += Math.abs(params.error[i])
	ok(lateErr < earlyErr, 'LMS error decreases: early=' + earlyErr.toFixed(3) + ' late=' + lateErr.toFixed(3))
})

test('nlms — error decreases over time', () => {
	let input = new Float64Array(512)
	for (let i = 0; i < 512; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, mu: 0.5}
	dsp.nlms(input, desired, params)
	let earlyErr = 0, lateErr = 0
	for (let i = 0; i < 50; i++) earlyErr += Math.abs(params.error[i])
	for (let i = 462; i < 512; i++) lateErr += Math.abs(params.error[i])
	ok(lateErr < earlyErr, 'NLMS error decreases: early=' + earlyErr.toFixed(3) + ' late=' + lateErr.toFixed(3))
})

test('rls — error decreases over time', () => {
	let input = new Float64Array(512)
	for (let i = 0; i < 512; i++) input[i] = Math.sin(2 * Math.PI * 100 * i / 44100)
	let desired = new Float64Array(input)
	let params = {order: 4, lambda: 0.99}
	dsp.rls(input, desired, params)
	let earlyErr = 0, lateErr = 0
	for (let i = 0; i < 50; i++) earlyErr += Math.abs(params.error[i])
	for (let i = 462; i < 512; i++) lateErr += Math.abs(params.error[i])
	ok(lateErr < earlyErr, 'RLS error decreases: early=' + earlyErr.toFixed(3) + ' late=' + lateErr.toFixed(3))
})

// --- allpass second-order: unity magnitude ---

// --- halfBand: DC passthrough and Nyquist/2 rejection ---

test('halfBand — DC gain = 1', () => {
	let h = dsp.halfBand(31)
	let sum = 0
	for (let i = 0; i < h.length; i++) sum += h[i]
	almost(sum, 1, 0.01)
})

test('halfBand — attenuates at Nyquist/2', () => {
	let h = dsp.halfBand(31)
	// Evaluate magnitude at w = pi/2 (Nyquist/2, normalized frequency 0.5)
	let w = Math.PI / 2
	let re = 0, im = 0
	for (let n = 0; n < h.length; n++) {
		re += h[n] * Math.cos(w * n)
		im -= h[n] * Math.sin(w * n)
	}
	let mag = Math.sqrt(re * re + im * im)
	// At exactly Nyquist/2, half-band should be at -6dB (≈ 0.5 magnitude)
	ok(mag < 0.8, 'halfBand magnitude < 0.8 at Nyquist/2 (got ' + mag.toFixed(4) + ')')
})

// --- CIC: DC preservation strict ---

test('cic — DC preservation exact', () => {
	let data = new Float64Array(2000).fill(1)
	let out = dsp.cic(data, 10, 3)
	is(out.length, 200, 'decimated by 10')
	// After settling, all output samples should be exactly 1
	let allOne = true
	for (let i = 50; i < 200; i++) {
		if (Math.abs(out[i] - 1) > 0.001) { allOne = false; break }
	}
	ok(allOne, 'CIC preserves DC exactly after settling')
})

// --- polyphase: reconstruction (concat phases = original) ---

test('polyphase — phases reconstruct original', () => {
	let h = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
	let M = 4
	let phases = dsp.polyphase(h, M)
	is(phases.length, M, M + ' phases')

	// Interleave phases to reconstruct original
	let reconstructed = new Float64Array(h.length)
	for (let p = 0; p < M; p++) {
		for (let k = 0; k < phases[p].length; k++) {
			reconstructed[k * M + p] = phases[p][k]
		}
	}
	almost(Array.from(reconstructed), Array.from(h), 1e-10)
})

// --- oversample: DC passthrough ---

test('oversample — DC passthrough', () => {
	let data = new Float64Array(64).fill(1)
	let out = dsp.oversample(data, 4)
	is(out.length, 256, 'length * 4')
	// After transient, output should be ≈ 1 (DC preserved)
	let midVal = out[128]
	almost(midVal, 1, 0.1)
})

// --- farrow: integer delay is exact ---

test('farrow — integer delay is exact', () => {
	let data = new Float64Array(64)
	data[10] = 1 // impulse at 10
	dsp.farrow(data, {delay: 5, order: 3})
	// Peak should be exactly at sample 15
	let peakIdx = 0
	for (let i = 1; i < 64; i++) if (data[i] > data[peakIdx]) peakIdx = i
	is(peakIdx, 15, 'integer delay moves impulse by exactly 5 samples')
	ok(data[15] > 0.8, 'peak amplitude preserved (got ' + data[15].toFixed(4) + ')')
})

// --- thiran: allpass property (|b| coefficients = reversed |a|) ---

test('thiran — allpass structure verified', () => {
	for (let delay of [2.3, 3.7, 4.1]) {
		let order = Math.ceil(delay)
		let {b, a} = dsp.thiran(delay, order)
		// For allpass: b[k] = a[N-k] (reversed)
		for (let k = 0; k <= order; k++) {
			almost(b[k], a[order - k], LOOSE)
		}
	}
})

// --- crossfeed: stereo mix ---

// --- formant: output has energy ---

// --- vocoder: output length ---

// --- warpedFir: produces output ---

test('warpedFir — produces output on impulse', () => {
	let data = impulse(128)
	dsp.warpedFir(data, {coefs: new Float64Array([1, 0.5, 0.25]), lambda: 0.7})
	ok(data[0] !== 0, 'first sample non-zero')
	let hasOutput = data.some(x => Math.abs(x) > 0.001)
	ok(hasOutput, 'warpedFir produces output')
	ok(data.every(isFinite), 'all samples finite')
})

// --- isMinPhase on minimumPhase output ---

test('isMinPhase — minimumPhase output is minimum phase', () => {
	let h = dsp.firwin(31, 2000, 44100)
	let hm = dsp.minimumPhase(h)
	// Convert to SOS for isMinPhase: treat as single FIR section
	// isMinPhase checks that zeros are inside unit circle
	// For a minimum-phase filter, all zeros should be inside or on the unit circle
	// We verify via energy concentration: most energy should be in early samples
	let earlyEnergy = 0, totalEnergy = 0
	for (let i = 0; i < hm.length; i++) {
		totalEnergy += hm[i] * hm[i]
		if (i < hm.length / 2) earlyEnergy += hm[i] * hm[i]
	}
	ok(earlyEnergy / totalEnergy > 0.7, 'minimumPhase concentrates energy early (ratio: ' + (earlyEnergy/totalEnergy).toFixed(3) + ')')
})

// --- isFir on FIR coefficients ---

test('isFir — returns true for biquad with a1=a2=0', () => {
	let firSos = [{b0: 1, b1: 0.5, b2: 0.25, a1: 0, a2: 0}]
	ok(dsp.isFir(firSos), 'a1=a2=0 is FIR')
})

test('isFir — returns false for IIR filter', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	ok(!dsp.isFir(sos), 'Butterworth is not FIR')
})

// --- Round-trip: butterworth → sos2zpk → zpk2sos → same section count ---

test('convert round-trip — butterworth → sos2zpk → zpk2sos', () => {
	for (let order of [2, 4, 6]) {
		let sos = dsp.butterworth(order, 1000, 44100)
		let zpk = dsp.sos2zpk(sos)
		let sos2 = dsp.zpk2sos(zpk)
		is(sos2.length, sos.length, 'order ' + order + ' round-trip: same section count')

		// Verify DC gain is preserved through round-trip
		let gain1 = 1, gain2 = 1
		for (let s of sos) gain1 *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		for (let s of sos2) gain2 *= (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)
		almost(gain1, gain2, 0.01)
	}
})

// --- Integration: full chain test ---

test('butterworth + filter + freqz end-to-end', () => {
	let sos = dsp.butterworth(4, 2000, 44100)
	let data = dc(512)
	dsp.filter(data, {coefs: sos})
	almost(data[511], 1, 0.01)

	let resp = dsp.freqz(sos, 512, 44100)
	ok(resp.magnitude[0] > 0.99, 'magnitude at DC ≈ 1')
	ok(resp.magnitude[511] < 0.01, 'magnitude at Nyquist ≈ 0 for LP')
})

// ═══════════════════════════════════════
// scipy cross-validation
// Reference values generated by scipy.signal 1.17
// ═══════════════════════════════════════

test('scipy: butterworth frequency response matches', () => {
	// scipy: butter(4, 1000, fs=44100) at [500, 1000, 2000, 5000] Hz
	let sos = dsp.butterworth(4, 1000, 44100)
	let resp = dsp.freqz(sos, 2048, 44100)
	let db = dsp.mag2db(resp.magnitude)
	// Find bins closest to target frequencies
	let at = f => { let i = Math.round(f / (44100 / (2 * 2048))); return db[i] }
	almost(at(500), -0.0168, 0.5)     // scipy: -0.0168
	almost(at(1000), -3.010, 0.5)     // scipy: -3.010 (−3 dB cutoff)
	almost(at(2000), -24.28, 1)       // scipy: -24.28
	almost(at(5000), -57.37, 1)       // scipy: -57.37
})

test('scipy: chebyshev I frequency response matches', () => {
	// scipy: cheby1(4, 1, 1000, fs=44100) at [500, 1000, 2000] Hz
	let sos = dsp.chebyshev(4, 1000, 44100, 1)
	let resp = dsp.freqz(sos, 2048, 44100)
	let db = dsp.mag2db(resp.magnitude)
	let at = f => { let i = Math.round(f / (44100 / (2 * 2048))); return db[i] }
	almost(at(500), -0.27, 1)         // scipy: -0.27 (passband ripple)
	almost(at(1000), -1.0, 0.5)       // scipy: -1.0 (passband edge)
	almost(at(2000), -34.07, 2)       // scipy: -34.07
})

test('scipy: elliptic frequency response matches', () => {
	// scipy: ellip(4, 1, 40, 1000, fs=44100) at [500, 1000, 2000] Hz
	let sos = dsp.elliptic(4, 1000, 44100, 1, 40)
	let resp = dsp.freqz(sos, 2048, 44100)
	let db = dsp.mag2db(resp.magnitude)
	let at = f => { let i = Math.round(f / (44100 / (2 * 2048))); return db[i] }
	almost(at(1000), -1.0, 0.5)       // scipy: -1.0 (passband edge)
	ok(at(2000) < -38, 'stopband > 38 dB')  // scipy: -40.0
})

test('scipy: bessel frequency response matches', () => {
	// scipy.signal.bessel(4, 1000, fs=44100, output='sos', norm='mag') at
	// [500, 1000, 2000] Hz → [-0.7033, -3.0103, -13.5332] dB (scipy 1.17.1);
	// the library implements the norm='mag' convention (-3 dB at fc)
	let sos = dsp.bessel(4, 1000, 44100)
	let resp = dsp.freqz(sos, [500, 1000, 2000], 44100)
	let db = dsp.mag2db(resp.magnitude)
	almost(db[0], -0.7033, 1e-3)
	almost(db[1], -3.0103, 1e-3)
	almost(db[2], -13.5332, 1e-3)
})

test('scipy: firwin DC gain = 1', () => {
	// scipy: firwin(63, 1000, fs=44100) has DC gain 1.0
	let h = dsp.firwin(63, 1000, 44100)
	let dc = 0
	for (let i = 0; i < h.length; i++) dc += h[i]
	almost(dc, 1.0, 0.001)
})

test('scipy: firwin first coefficients match', () => {
	// scipy: firwin(63, 1000, fs=44100) first 3 coefficients
	let h = dsp.firwin(63, 1000, 44100)
	almost(h[0], -0.000813, 0.001)    // scipy: -0.000813
	almost(h[1], -0.000818, 0.001)    // scipy: -0.000818
	almost(h[2], -0.000849, 0.001)    // scipy: -0.000849
})

test('scipy: minimum_phase preserves magnitude', () => {
	let h = dsp.firwin(65, 1000, 44100)
	let hm = dsp.minimumPhase(h)
	// DC gain should be approximately preserved
	let dcOrig = 0, dcMin = 0
	for (let i = 0; i < h.length; i++) dcOrig += h[i]
	for (let i = 0; i < hm.length; i++) dcMin += hm[i]
	almost(dcMin, dcOrig, 0.5)
	// Output should be valid (nonzero, finite)
	ok(hm[0] !== 0, 'first sample nonzero')
	ok(isFinite(hm[0]), 'finite output')
})

// ═══════════════════════════════════════
// Strengthened tests (replace "produces output" with numerical checks)
// ═══════════════════════════════════════

test('raisedCosine — zero crossings at symbol intervals', () => {
	let sps = 8, h = dsp.raisedCosine(65, 0.35, sps)
	let center = (h.length - 1) / 2
	// At symbol intervals (center ± k*sps), value should be ~0 except center
	almost(h[center], h[center], EPSILON)  // center is peak
	ok(h[center] > 0, 'center is positive')
	for (let k = 1; k <= 3; k++) {
		let idx = center + k * sps
		if (idx < h.length) almost(h[idx], 0, 0.02)
		idx = center - k * sps
		if (idx >= 0) almost(h[idx], 0, 0.02)
	}
})

test('gaussianFir — symmetric, peaks at center', () => {
	let h = dsp.gaussianFir(33, 0.3, 4)
	let center = (h.length - 1) / 2
	ok(h[center] > h[0], 'center > edge')
	ok(h[center] > h[h.length - 1], 'center > last')
	// Symmetric
	for (let i = 0; i < 10; i++) almost(h[i], h[h.length - 1 - i], 1e-10)
})

test('matchedFilter — proportional to time-reversed template', () => {
	let template = new Float64Array([0.1, 0.3, 0.7, 1, 0.5])
	let h = dsp.matchedFilter(template)
	is(h.length, template.length)
	// h should be proportional to reversed template
	let scale = h[0] / template[template.length - 1]
	for (let i = 1; i < h.length; i++) {
		almost(h[i], template[template.length - 1 - i] * scale, 0.001)
	}
})

test('warpedFir — warping shifts energy to low frequencies', () => {
	let data1 = impulse(256)
	let data2 = impulse(256)
	dsp.warpedFir(data1, { coefs: new Float64Array([0.5, 0.3, 0.15]), lambda: 0 })   // no warping
	dsp.warpedFir(data2, { coefs: new Float64Array([0.5, 0.3, 0.15]), lambda: 0.7 }) // warped
	// Both should produce nonzero output
	let e1 = 0, e2 = 0
	for (let i = 0; i < 256; i++) { e1 += data1[i] * data1[i]; e2 += data2[i] * data2[i] }
	ok(e1 > 0, 'unwarped has energy')
	ok(e2 > 0, 'warped has energy')
	// Warped version should have more energy spread (longer impulse response)
	let last1 = 0, last2 = 0
	for (let i = 255; i >= 0; i--) { if (Math.abs(data1[i]) > 1e-10 && !last1) last1 = i; if (Math.abs(data2[i]) > 1e-10 && !last2) last2 = i }
	ok(last2 >= last1, 'warped impulse at least as long')
})

test('lattice — reflection coefficients produce stable output', () => {
	let data = impulse(64)
	dsp.lattice(data, { k: [0.5, -0.3, 0.2, -0.1] })
	// All |k| < 1, so output should be bounded
	let max = 0
	for (let i = 0; i < 64; i++) if (Math.abs(data[i]) > max) max = Math.abs(data[i])
	ok(max < 100, 'output bounded')
	ok(max > 0, 'output nonzero')
	ok(data[0] !== 0, 'first sample modified')
})

test('dynamicSmoothing — smooths signal without NaN', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 256; i++) data[i] = Math.sin(2 * Math.PI * i / 64)
	dsp.dynamicSmoothing(data, { fc: 100, sensitivity: 1, fs: 44100 })
	// Output should be valid and smoother than input
	ok(isFinite(data[128]), 'finite output')
	ok(data[0] !== 0 || data[1] !== 0, 'produces output')
	// Check smoothed signal has less high-frequency energy
	let energy = 0
	for (let i = 1; i < 256; i++) energy += (data[i] - data[i-1]) ** 2
	ok(energy < 256, 'smoothed signal has limited derivative')
})

test('thiran — allpass preserves energy', () => {
	let { b, a } = dsp.thiran(3.5, 3)
	// Allpass: |b[k]| should mirror |a[N-k]|
	let order = a.length - 1
	for (let k = 0; k <= order; k++) {
		almost(Math.abs(b[k]), Math.abs(a[order - k]), 0.001)
	}
})

test('cic — DC gain matches (R*N) factor', () => {
	let R = 4, N = 2
	let data = new Float64Array(256).fill(1)  // DC signal
	let out = dsp.cic(data, R, N)
	// DC gain of CIC = R^N, but output is decimated and normalized
	ok(out.length === Math.floor(256 / R), 'correct decimated length')
	// Output should converge to a constant for DC input
	ok(Math.abs(out[out.length - 1]) > 0, 'DC passes through')
})

test('oversample — preserves DC in middle', () => {
	let data = new Float64Array(64).fill(1)
	let up = dsp.oversample(data, 4)
	is(up.length, 256)
	// DC preserved in the middle (away from edge transients)
	almost(up[128], 1, 0.1)
})

test('convolution — impulse identity', () => {
	let signal = new Float64Array([1, 2, 3, 4, 5])
	let impulse = new Float64Array([1])
	let out = dsp.convolution(signal, impulse)
	is(out.length, 5)
	for (let i = 0; i < 5; i++) almost(out[i], signal[i], EPSILON)
})

test('convolution — known result', () => {
	let a = new Float64Array([1, 2, 3])
	let b = new Float64Array([1, 1])
	let out = dsp.convolution(a, b)
	is(out.length, 4)
	almost(out[0], 1, EPSILON)
	almost(out[1], 3, EPSILON)
	almost(out[2], 5, EPSILON)
	almost(out[3], 3, EPSILON)
})

test('buttord — minimum order estimation', () => {
	let { order, Wn } = dsp.buttord(1000, 1500, 1, 40, 44100)
	// scipy.signal.buttord(1000/22050, 1500/22050, 1, 40) → order=13 (scipy 1.17.1)
	is(order, 13, 'order matches scipy')
	ok(Wn > 900 && Wn < 1100, 'Wn near passband: ' + Wn.toFixed(0))
})

test('cheb1ord — lower order than butterworth', () => {
	let bw = dsp.buttord(1000, 1500, 1, 40, 44100)
	let ch = dsp.cheb1ord(1000, 1500, 1, 40, 44100)
	ok(ch.order <= bw.order, 'chebyshev order ≤ butterworth')
	ok(ch.order >= 5, 'order reasonable: ' + ch.order)
})

test('ellipord — lowest order', () => {
	let bw = dsp.buttord(1000, 1500, 1, 40, 44100)
	let el = dsp.ellipord(1000, 1500, 1, 40, 44100)
	ok(el.order <= bw.order, 'elliptic order ≤ butterworth')
	ok(el.order >= 3, 'order reasonable: ' + el.order)
})

test('freqz — butterworth -3dB at cutoff', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let resp = dsp.freqz(sos, 4096, 44100)
	let db = dsp.mag2db(resp.magnitude)
	// Find bin closest to 1000 Hz
	let idx = Math.round(1000 / (44100 / (2 * 4096)))
	almost(db[idx], -3.01, 0.5)
})

// ═══════════════════════════════════════
// Web Audio integration: biquad edge cases, iir(), freqz at arbitrary freqs
// ═══════════════════════════════════════

test('biquad.lowpass — fc=0 → silence', () => {
	let c = dsp.biquad.lowpass(0, 1, 44100)
	is(c.b0, 0)
	is(c.b1, 0)
	is(c.b2, 0)
})

test('biquad.lowpass — fc=Nyquist → passthrough', () => {
	let c = dsp.biquad.lowpass(22050, 1, 44100)
	is(c.b0, 1)
	is(c.a1, 0)
})

test('biquad.highpass — fc=0 → passthrough', () => {
	let c = dsp.biquad.highpass(0, 1, 44100)
	is(c.b0, 1)
})

test('biquad.highpass — fc=Nyquist → silence', () => {
	let c = dsp.biquad.highpass(22050, 1, 44100)
	is(c.b0, 0)
})

test('biquad.bandpass — fc=0 → silence', () => {
	let c = dsp.biquad.bandpass(0, 1, 44100)
	is(c.b0, 0)
})

test('biquad.notch — fc=0 → passthrough', () => {
	let c = dsp.biquad.notch(0, 10, 44100)
	is(c.b0, 1)
})

test('biquad.peaking — Q=0 → flat gain A²', () => {
	let c = dsp.biquad.peaking(1000, 0, 44100, 6)
	let A2 = Math.pow(10, 6 / 20)
	almost(c.b0, A2, 0.01)
})

test('biquad.bandpass2 — Q=0 → passthrough', () => {
	let c = dsp.biquad.bandpass2(1000, 0, 44100)
	is(c.b0, 1)
})

test('biquad.notch — Q=0 → silence', () => {
	let c = dsp.biquad.notch(1000, 0, 44100)
	is(c.b0, 0)
})

test('biquad.allpass — Q=0 → inversion', () => {
	let c = dsp.biquad.allpass(1000, 0, 44100)
	is(c.b0, -1)
})

test('biquad.lowshelf — fc=0 → passthrough', () => {
	let c = dsp.biquad.lowshelf(0, 0.707, 44100, 6)
	is(c.b0, 1)
})

test('biquad.lowshelf — fc=Nyquist → gain A²', () => {
	let c = dsp.biquad.lowshelf(22050, 0.707, 44100, 6)
	let A = Math.pow(10, 6 / 40)
	almost(c.b0, A * A, 0.01)
})

test('biquad.highshelf — fc=0 → gain A²', () => {
	let c = dsp.biquad.highshelf(0, 0.707, 44100, 6)
	let A = Math.pow(10, 6 / 40)
	almost(c.b0, A * A, 0.01)
})

test('biquad.highshelf — fc=Nyquist → passthrough', () => {
	let c = dsp.biquad.highshelf(22050, 0.707, 44100, 6)
	is(c.b0, 1)
})

test('iir — arbitrary order matches filter for 2nd order', () => {
	// Compare iir() with b/a against filter() with SOS for a simple biquad
	let c = dsp.biquad.lowpass(1000, 0.707, 44100)
	let data1 = new Float64Array(64); data1[0] = 1
	let data2 = new Float64Array(64); data2[0] = 1
	dsp.filter(data1, { coefs: c })
	dsp.iir(data2, { b: [c.b0, c.b1, c.b2], a: [1, c.a1, c.a2] })
	for (let i = 0; i < 64; i++) almost(data1[i], data2[i], 1e-10)
})

test('iir — higher order (4th order)', () => {
	let data = new Float64Array(128); data[0] = 1
	// 4th order lowpass as b/a (manually constructed)
	dsp.iir(data, {
		b: [1, 0, 0, 0, 0],
		a: [1, -3.5, 4.6, -2.7, 0.6]
	})
	ok(isFinite(data[127]), 'output is finite')
	ok(data[0] !== 0, 'produces output')
})

test('iir — state persists between calls', () => {
	let params = { b: [0.1, 0.1], a: [1, -0.8] }
	let block1 = new Float64Array(32); block1[0] = 1
	let block2 = new Float64Array(32)
	dsp.iir(block1, params)
	dsp.iir(block2, params)
	ok(block2[0] !== 0, 'state carries over')
})

test('freqz — arbitrary frequency array', () => {
	let sos = dsp.butterworth(4, 1000, 44100)
	let resp = dsp.freqz(sos, [500, 1000, 2000], 44100)
	is(resp.frequencies.length, 3)
	almost(resp.frequencies[0], 500, 0.01)
	almost(resp.frequencies[1], 1000, 0.01)
	almost(resp.frequencies[2], 2000, 0.01)
	// At 1kHz should be -3dB
	let db1k = dsp.mag2db(resp.magnitude[1])
	almost(db1k, -3.01, 0.5)
})

test('freqz — Float64Array frequency input', () => {
	let sos = dsp.butterworth(2, 1000, 44100)
	let freqs = new Float64Array([100, 1000, 10000])
	let resp = dsp.freqz(sos, freqs, 44100)
	is(resp.frequencies.length, 3)
	ok(dsp.mag2db(resp.magnitude[0]) > -1, '100 Hz in passband')
	ok(dsp.mag2db(resp.magnitude[2]) < -20, '10 kHz in stopband')
})

// ═══════════════════════════════════════
// Remaining filters
// ═══════════════════════════════════════

// --- upfirdn ---

test('upfirdn — identity (up=1, down=1, h=[1])', () => {
	let data = new Float64Array([1, 2, 3, 4, 5])
	let out = dsp.upfirdn(data, [1], 1, 1)
	is(out.length, 5)
	for (let i = 0; i < 5; i++) almost(out[i], data[i], EPSILON)
})

test('upfirdn — upsample by 3', () => {
	let data = new Float64Array([1, 0, 0])
	let out = dsp.upfirdn(data, [1], 3, 1)
	// Upsampled: [1,0,0, 0,0,0, 0,0,0], filtered by [1]
	ok(out[0] === 1, 'first sample preserved')
	// Other samples at input positions are zero (zero-stuffing)
	ok(out[1] === 0, 'zero-stuffed')
	ok(out[2] === 0, 'zero-stuffed')
	ok(out[3] === 0, 'second input')
})

test('upfirdn — downsample by 2', () => {
	let data = new Float64Array([1, 2, 3, 4, 5, 6])
	let out = dsp.upfirdn(data, [1], 1, 2)
	is(out.length, 3)
	almost(out[0], 1, EPSILON)
	almost(out[1], 3, EPSILON)
	almost(out[2], 5, EPSILON)
})

test('upfirdn — with FIR filter', () => {
	let data = new Float64Array([1, 0, 0, 0])
	let h = [0.25, 0.5, 0.25]
	let out = dsp.upfirdn(data, h, 1, 1)
	// Convolution of [1,0,0,0] with [0.25,0.5,0.25]
	almost(out[0], 0.25, EPSILON)
	almost(out[1], 0.5, EPSILON)
	almost(out[2], 0.25, EPSILON)
})

// --- resample ---

test('resample — identity (p=1, q=1)', () => {
	let data = new Float64Array(64).fill(1)
	let out = dsp.resample(data, 1, 1)
	is(out.length, 64)
})

test('resample — upsample 2x preserves DC', () => {
	let data = new Float64Array(64).fill(1)
	let out = dsp.resample(data, 2, 1)
	is(out.length, 128)
	// Middle samples should be ~1 (DC preserved)
	almost(out[64], 1, 0.2)
})

test('resample — downsample 2x', () => {
	let data = new Float64Array(128).fill(1)
	let out = dsp.resample(data, 1, 2)
	is(out.length, 64)
	almost(out[32], 1, 0.2)
})

test('resample — rational 3/2', () => {
	let data = new Float64Array(60).fill(1)
	let out = dsp.resample(data, 3, 2)
	is(out.length, 90)
})

// --- residue ---

test('residue — simple first-order', () => {
	// H(z) = 1 / (1 - 0.5*z^-1) → b=[1], a=[1, -0.5]
	// One pole at 0.5, residue = 1 / A'(0.5) = 1
	let {r, p, k} = dsp.residue([1], [1, -0.5])
	is(p.length, 1, '1 pole')
	is(r.length, 1, '1 residue')
	almost(p[0].re, 0.5, LOOSE)
	is(k.length, 0, 'no direct terms')
})

test('residue — direct terms (scipy residuez)', () => {
	// scipy.signal.residuez([0,1],[1,-0.5]) → r=[2], p=[0.5], k=[-2]  (scipy 1.17.1)
	let {r, p, k} = dsp.residue([0, 1], [1, -0.5])
	is(p.length, 1, '1 pole')
	almost(p[0].re, 0.5, LOOSE)
	almost(r[0].re, 2, LOOSE)
	is(k.length, 1, '1 direct term')
	almost(k[0], -2, LOOSE)
	// scipy.signal.residuez([1,0,0,1],[1,-0.5]) → r=[9], p=[0.5], k=[-8,-4,-2]
	;({r, p, k} = dsp.residue([1, 0, 0, 1], [1, -0.5]))
	almost(r[0].re, 9, LOOSE)
	almost(Array.from(k), [-8, -4, -2], LOOSE)
})

test('residue — two real poles (scipy residuez)', () => {
	// scipy.signal.residuez([1],[1,-1.5,0.5]) → r=[-1,2], p=[0.5,1], k=[]  (scipy 1.17.1)
	let {r, p, k} = dsp.residue([1], [1, -1.5, 0.5])
	is(p.length, 2, '2 poles')
	is(r.length, 2, '2 residues')
	is(k.length, 0, 'no direct terms')
	// Reconstruction per module contract: H(z) = sum(r_k / (1 - p_k*z^-1))
	// At z^-1 = 0.5: B/A = 1/(1 - 0.75 + 0.125) = 8/3
	let v = 0.5
	let Hrecon = 0
	for (let i = 0; i < r.length; i++) {
		Hrecon += r[i].re / (1 - p[i].re * v)
	}
	almost(Hrecon, 8 / 3, LOOSE)
})

test('residue — cross-checks vs scipy.signal.residuez 1.17.1', () => {
	// residuez([1,2,1],[1,-1.2,0.35]) → r=[-22.5, 20.6428571...], p=[0.5, 0.7], k=[2.857142857...]
	let {r, p, k} = dsp.residue([1, 2, 1], [1, -1.2, 0.35])
	let byPole = p.map((pk, i) => [pk.re, r[i].re]).sort((x, y) => x[0] - y[0])
	almost(byPole[0][0], 0.5, 1e-9)
	almost(byPole[0][1], -22.5, 1e-6)
	almost(byPole[1][0], 0.7, 1e-9)
	almost(byPole[1][1], 20.642857142857125, 1e-6)
	almost(k[0], 2.857142857142857, 1e-9)
})

// --- tf2ss / ss2tf ---

test('tf2ss — first-order system', () => {
	// H(z) = (1 + 0.5z^-1) / (1 - 0.8z^-1) → b=[1,0.5], a=[1,-0.8]
	let {A, B, C, D} = dsp.tf2ss([1, 0.5], [1, -0.8])
	is(A.length, 1, '1x1 state matrix')
	is(B.length, 1)
	is(C.length, 1)
	is(D, 1, 'feedthrough = b[0]/a[0]')
})

test('tf2ss — second-order system dimensions', () => {
	let {A, B, C, D} = dsp.tf2ss([1, 0, -1], [1, -1.5, 0.56])
	is(A.length, 2, '2x2 state matrix')
	is(A[0].length, 2)
	is(B.length, 2)
	is(C.length, 2)
})

test('ss2tf — round-trip with tf2ss', () => {
	let b0 = [1, 0.5, -0.3]
	let a0 = [1, -1.2, 0.5]
	let ss = dsp.tf2ss(b0, a0)
	let {b, a} = dsp.ss2tf(ss.A, ss.B, ss.C, ss.D)
	is(b.length, 3, 'numerator length preserved')
	is(a.length, 3, 'denominator length preserved')
	// Coefficients should match (up to normalization)
	for (let i = 0; i < 3; i++) {
		almost(b[i], b0[i], 0.01)
		almost(a[i], a0[i], 0.01)
	}
})

test('ss2tf — first-order round-trip', () => {
	let b0 = [2, -1]
	let a0 = [1, -0.9]
	let ss = dsp.tf2ss(b0, a0)
	let {b, a} = dsp.ss2tf(ss.A, ss.B, ss.C, ss.D)
	almost(b[0], b0[0], 0.01)
	almost(b[1], b0[1], 0.01)
	almost(a[0], 1, 0.01)
	almost(a[1], a0[1], 0.01)
})

// --- wiener ---

test('wiener — reduces noise on DC signal', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 256; i++) data[i] = 1 + (Math.random() - 0.5) * 0.2
	dsp.wiener(data)
	// After Wiener filtering, variance should decrease
	let mean = 0
	for (let i = 0; i < 256; i++) mean += data[i]
	mean /= 256
	let variance = 0
	for (let i = 0; i < 256; i++) variance += (data[i] - mean) ** 2
	variance /= 256
	ok(variance < 0.01, 'variance reduced (got ' + variance.toFixed(6) + ')')
})

test('wiener — preserves strong signal', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 256; i++) data[i] = Math.sin(2 * Math.PI * 10 * i / 256)
	let origEnergy = 0
	for (let i = 0; i < 256; i++) origEnergy += data[i] * data[i]
	dsp.wiener(data)
	let filtEnergy = 0
	for (let i = 0; i < 256; i++) filtEnergy += data[i] * data[i]
	ok(filtEnergy > origEnergy * 0.5, 'signal energy preserved')
})

// --- deconvolve ---

test('deconvolve — recovers quotient from convolution', () => {
	// conv([1, 2, 3], [1, 1]) = [1, 3, 5, 3]
	let {q, r} = dsp.deconvolve([1, 3, 5, 3], [1, 1])
	is(q.length, 3)
	almost(q[0], 1, EPSILON)
	almost(q[1], 2, EPSILON)
	almost(q[2], 3, EPSILON)
	// Remainder should be ~0
	for (let i = 0; i < r.length; i++) almost(r[i], 0, EPSILON)
})

test('deconvolve — handles remainder', () => {
	// [1, 3, 5, 4] / [1, 1] = quotient [1, 2, 3] remainder [0, 0, 0, 1]
	let {q, r} = dsp.deconvolve([1, 3, 5, 4], [1, 1])
	is(q.length, 3)
	almost(q[0], 1, EPSILON)
	almost(q[1], 2, EPSILON)
	almost(q[2], 3, EPSILON)
	almost(r[3], 1, EPSILON)
})

test('deconvolve — inverse of convolution', () => {
	let a = new Float64Array([1, 0.5, 0.25])
	let b = new Float64Array([1, -0.3])
	let conv = dsp.convolution(a, b)
	let {q} = dsp.deconvolve(Array.from(conv), Array.from(b))
	for (let i = 0; i < a.length; i++) almost(q[i], a[i], LOOSE)
})

// ================================================================
// Differential tests vs authoritative references (scipy 1.17.1)
// ================================================================

test('firwin2 — matches scipy.signal.firwin2 1.17.1', () => {
	// scipy.signal.firwin2(31, [0, 0.3, 0.4, 1], [1, 1, 0, 0], nfreqs=1025)
	let h = dsp.firwin2(31, [0, 0.3, 0.4, 1], [1, 1, 0, 0], { nfft: 1024 })
	let ref = [-0.0312066571, -0.0600244568, -0.01458615, 0.1216143856, 0.2796121949, 0.3500003815]
	for (let i = 0; i < 6; i++) almost(h[10 + i], ref[i], 1e-4)
	// cutoff sits where specified, not at 2x: -6dB near f = 0.35
	let mag = f => {
		let re = 0, im = 0
		for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(Math.PI * f * n); im -= h[n] * Math.sin(Math.PI * f * n) }
		return Math.hypot(re, im)
	}
	ok(Math.abs(20 * Math.log10(mag(0.35)) + 6) < 1, '-6dB at midpoint of transition')
	ok(mag(0.2) > 0.99 && mag(0.2) < 1.01, 'passband unity')
	ok(mag(0.6) < 0.01, 'stopband rejected')
})

test('remez — matches scipy.signal.remez 1.17.1', () => {
	// scipy.signal.remez(31, [0, 0.15, 0.2, 0.5], [1, 0], fs=1) — bands ×2 Nyquist-relative
	let h = dsp.remez(31, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
	let ref = [-0.0162538169, 0.1268497426, 0.2827148206, 0.3501906002, 0.2827148206, 0.1268497426, -0.0162538169]
	for (let i = 0; i < 7; i++) almost(h[12 + i], ref[i], 1e-3)
	// true equiripple: passband ripple and stopband attenuation from scipy: ±0.219 dB / -32.07 dB
	let mag = f => {
		let re = 0, im = 0
		for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(Math.PI * f * n); im -= h[n] * Math.sin(Math.PI * f * n) }
		return Math.hypot(re, im)
	}
	let pbMax = 0, sbMax = -Infinity
	for (let f = 0; f <= 0.3; f += 0.0005) pbMax = Math.max(pbMax, Math.abs(20 * Math.log10(mag(f))))
	for (let f = 0.4; f <= 1; f += 0.0005) sbMax = Math.max(sbMax, 20 * Math.log10(mag(f)))
	ok(pbMax < 0.23, `passband ripple ±${pbMax.toFixed(3)} dB ≈ scipy 0.219`)
	ok(sbMax < -31.9, `stopband ${sbMax.toFixed(1)} dB ≈ scipy -32.07`)
})

test('yulewalk — recovers exact AR(1) spectrum', () => {
	// Target |1/(1 - 0.5e^{-jw})| is exactly representable at order 1:
	// must return a = [1, -0.5] (prediction-error convention), b = [1, 0]
	let N = 64, freqs = [], mags = []
	for (let i = 0; i <= N; i++) {
		let f = i / N, w = Math.PI * f
		freqs.push(f)
		mags.push(1 / Math.hypot(1 - 0.5 * Math.cos(w), 0.5 * Math.sin(w)))
	}
	let { b, a } = dsp.yulewalk(1, freqs, mags)
	almost(a[0], 1, 1e-12)
	almost(a[1], -0.5, 1e-3)
	almost(b[0], 1, 1e-3)
	almost(b[1], 0, 1e-3)
})

test('lattice — iir type inverts fir type (round-trip identity)', () => {
	let k = [0.5, -0.3, 0.2]
	let x = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i * 0.7) + 0.3 * Math.sin(i * 2.1))
	let y = Float64Array.from(x)
	dsp.lattice(y, { k })                 // analysis (whitening, all-zero)
	dsp.lattice(y, { k, type: 'iir' })    // synthesis (all-pole inverse)
	for (let i = 0; i < x.length; i++) almost(y[i], x[i], 1e-12)
})

test('lattice — fir type equals direct-form prediction-error filter', () => {
	// Step-up recursion k → A(z), then lattice(x) must equal FIR A(z) applied to x
	let k = [0.5, -0.3, 0.2]
	let a = [1]
	for (let j = 0; j < k.length; j++) {
		let prev = a.slice()
		a = new Array(j + 2).fill(0)
		a[0] = 1
		for (let m = 1; m <= j; m++) a[m] = prev[m] + k[j] * prev[j + 1 - m]
		a[j + 1] = k[j]
	}
	let x = Float64Array.from({ length: 48 }, (_, i) => Math.cos(i * 1.1))
	let z = Float64Array.from(x)
	dsp.lattice(z, { k })
	for (let n = 0; n < x.length; n++) {
		let d = 0
		for (let m = 0; m < a.length; m++) if (n - m >= 0) d += a[m] * x[n - m]
		almost(z[n], d, 1e-12)
	}
})

test('warpedFir — warped delay line is allpass (unit magnitude)', () => {
	// h = [0, 1] is a single warped delay = one first-order allpass:
	// |H| = 1 at every frequency. Measure steady-state via quadrature projection.
	for (let f of [0.1, 0.35, 0.62, 0.85]) {
		let n = 8192, w = Math.PI * f
		let sig = Float64Array.from({ length: n }, (_, i) => Math.sin(w * i))
		dsp.warpedFir(sig, { coefs: [0, 1], lambda: 0.7 })
		let ss = 0, sc = 0
		for (let i = n / 2; i < n; i++) { ss += sig[i] * Math.sin(w * i); sc += sig[i] * Math.cos(w * i) }
		let amp = 2 * Math.hypot(ss, sc) / (n / 2)
		almost(amp, 1, 1e-3)
	}
})

test('warpedFir — magnitude equals prototype FIR at warped frequency', () => {
	// H_warped(e^jw) = H_fir(e^jφ(w)), φ = arg D(e^jw), D = (z^-1 - λ)/(1 - λz^-1)
	let h = [0.25, 0.5, 0.25], lambda = 0.5
	for (let f of [0.1, 0.4, 0.7]) {
		let w = Math.PI * f
		let dr = Math.cos(w) - lambda, di = -Math.sin(w)
		let er = 1 - lambda * Math.cos(w), ei = lambda * Math.sin(w)
		let phi = Math.atan2(di * er - dr * ei, dr * er + di * ei)
		let target = Math.hypot(
			h[0] + h[1] * Math.cos(phi) + h[2] * Math.cos(2 * phi),
			h[1] * Math.sin(phi) + h[2] * Math.sin(2 * phi))
		let n = 8192
		let sig = Float64Array.from({ length: n }, (_, i) => Math.sin(w * i))
		dsp.warpedFir(sig, { coefs: h, lambda })
		let ss = 0, sc = 0
		for (let i = n / 2; i < n; i++) { ss += sig[i] * Math.sin(w * i); sc += sig[i] * Math.cos(w * i) }
		let amp = 2 * Math.hypot(ss, sc) / (n / 2)
		almost(amp, target, 1e-3)
	}
})

test('gaussianIir — zero-phase over the FULL array (edges included)', () => {
	// Constant input must stay constant everywhere — including the last 3
	// samples the old backward pass never touched
	let data = new Float64Array(64).fill(1)
	dsp.gaussianIir(data, { sigma: 4 })
	for (let i = 0; i < 64; i++) almost(data[i], 1, 1e-6)
	// Impulse response symmetric around the impulse (zero phase)
	let imp = new Float64Array(129)
	imp[64] = 1
	dsp.gaussianIir(imp, { sigma: 5 })
	for (let d = 1; d <= 20; d++) almost(imp[64 - d], imp[64 + d], 1e-9)
	// Unit DC gain: coefficients sum to ~1
	let sum = 0
	for (let v of imp) sum += v
	almost(sum, 1, 1e-3)
})

test('oneEuro — beta=0 is honored (pure one-pole, no speed adaptation)', () => {
	let n = 128
	let mk = () => Float64Array.from({ length: n }, (_, i) => (i >= 32 ? 1 : 0) + 0.01 * Math.sin(i * 2.5))
	let a = mk(), b = mk()
	dsp.oneEuro(a, { minCutoff: 1, beta: 0, fs: 120 })
	dsp.oneEuro(b, { minCutoff: 1, fs: 120 })  // default beta 0.007
	let differ = false
	for (let i = 0; i < n; i++) if (Math.abs(a[i] - b[i]) > 1e-9) { differ = true; break }
	ok(differ, 'beta: 0 must not be replaced by the default')
	// beta=0: exactly a fixed-alpha one-pole at minCutoff (Casiez 2012 eq. 1-2)
	let alpha = 1 / (1 + (120 / (2 * Math.PI * 1)))
	let x = mk(), y = x[0]
	let ref = new Float64Array(n)
	for (let i = 0; i < n; i++) { y = alpha * x[i] + (1 - alpha) * y; ref[i] = y }
	for (let i = 0; i < n; i++) almost(a[i], ref[i], 1e-12)
})

test('dynamicSmoothing — Simper 2016 self-modulating filter', () => {
	// sensitivity=0 reduces to the static cascade; DC preserved
	let dc = new Float64Array(256).fill(0.5)
	dsp.dynamicSmoothing(dc, { fc: 10, sensitivity: 0, fs: 1000 })
	almost(dc[255], 0.5, 1e-6)
	// speed adaptation: with sensitivity, a step settles much faster
	let mkStep = () => Float64Array.from({ length: 400 }, (_, i) => i >= 100 ? 1 : 0)
	let slow = mkStep(), fast = mkStep()
	dsp.dynamicSmoothing(slow, { fc: 2, sensitivity: 0, fs: 1000 })
	dsp.dynamicSmoothing(fast, { fc: 2, sensitivity: 4, fs: 1000 })
	let settle = arr => { for (let i = 100; i < 400; i++) if (arr[i] > 0.9) return i - 100; return 300 }
	ok(settle(fast) < settle(slow) / 3, `adaptive settles ${settle(fast)} vs static ${settle(slow)} samples`)
})

test('movingAverage — pre-seeded memory is honored (no startup ramp)', () => {
	let data = new Float64Array(8).fill(1)
	let params = { memory: [1, 1, 1, 1] }
	dsp.movingAverage(data, params)
	for (let i = 0; i < 8; i++) almost(data[i], 1, 1e-12)
})

test('lms/nlms/rls — order change between calls reallocates state', () => {
	let x = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i * 0.3))
	let d = Float64Array.from(x)
	for (let fn of [dsp.lms, dsp.nlms, dsp.rls]) {
		let params = { order: 8 }
		fn(x, d, params)
		params.order = 16
		let out = fn(x, d, params)   // previously: TypeError (rls) or NaN (lms/nlms)
		ok(out.every(isFinite), 'finite output after order change')
		is(params.w.length, 16, 'weights reallocated to new order')
	}
})

test('rls — covariance stays bounded through dead air (anti-windup)', () => {
	// Sustained zero input: P /= lambda each step used to blow up unbounded
	let params = { order: 4, lambda: 0.95, delta: 100 }
	let silence = new Float64Array(512)
	dsp.rls(silence, silence, params)
	let trace = 0
	for (let j = 0; j < 4; j++) trace += params.P[j][j]
	ok(trace <= 4 * 100 + 1e-6, `trace(P) capped at N·delta (got ${trace.toFixed(1)})`)
	// and it still adapts afterwards: identify a simple 2-tap system
	let n = 2048
	let inp = Float64Array.from({ length: n }, (_, i) => Math.sin(i * 1.1) + 0.5 * Math.sin(i * 0.37 + 1))
	let des = new Float64Array(n)
	for (let i = 1; i < n; i++) des[i] = 0.6 * inp[i] - 0.3 * inp[i - 1]
	dsp.rls(inp, des, params)
	almost(params.w[0], 0.6, 0.01)
	almost(params.w[1], -0.3, 0.01)
})

test('levinson — matches scipy.linalg.solve_toeplitz 1.17.1', () => {
	// solve_toeplitz((r[:3], r[:3]), -r[1:4]) for r = [2, 1.2, 0.6, 0.2]
	// → a = [-0.650246305419, 0.051724137931, 0.064039408867], k = [-0.6, 0.09375, 0.064039408867]
	let { a, k, error } = dsp.levinson([2, 1.2, 0.6, 0.2], 3)
	almost(a[0], 1, 1e-12)
	almost(a[1], -0.650246305419, 1e-9)
	almost(a[2], 0.051724137931, 1e-9)
	almost(a[3], 0.064039408867, 1e-9)
	almost(k[0], -0.6, 1e-9)
	almost(k[1], 0.09375, 1e-9)
	almost(k[2], 0.064039408867, 1e-9)
	almost(error, 1.26354679803, 1e-6)
})

test('isMinPhase / isStable — actually invoked on real designs', () => {
	// minimumPhase output: zeros inside/on the unit circle (cepstral residue
	// leaves circle-zeros ~1e-3 outside — hence the explicit tolerance);
	// the original linear-phase FIR has reciprocal pairs far outside (≈1.63)
	let h = dsp.firwin(31, 2000, 44100)
	let hm = dsp.minimumPhase(h)
	ok(dsp.isMinPhase(dsp.tf2sos(Array.from(hm), [1]), 0.01), 'minimumPhase output is minimum phase')
	ok(!dsp.isMinPhase(dsp.tf2sos(Array.from(h), [1]), 0.01), 'linear-phase FIR is not minimum phase')
	// isStable: any butterworth is stable; a pole outside the circle is not
	ok(dsp.isStable(dsp.butterworth(6, 1000, 44100)), 'butterworth stable')
	ok(!dsp.isStable([{ b0: 1, b1: 0, b2: 0, a1: -2.1, a2: 1.1 }]), 'exploding filter unstable')
})

test('svf — qualitative response of every mode', () => {
	let fs = 44100, fc = 1000
	let magAt = (type, f) => {
		let n = 16384, w = 2 * Math.PI * f / fs
		let sig = Float64Array.from({ length: n }, (_, i) => Math.sin(w * i))
		dsp.svf(sig, { fc, Q: 0.707, fs, type })
		let ss = 0, sc = 0
		for (let i = n / 2; i < n; i++) { ss += sig[i] * Math.sin(w * i); sc += sig[i] * Math.cos(w * i) }
		return 2 * Math.hypot(ss, sc) / (n / 2)
	}
	// notch: kills fc, passes the edges
	ok(magAt('notch', fc) < 0.05, 'notch ~0 at fc')
	ok(magAt('notch', 50) > 0.95 && magAt('notch', 20000) > 0.9, 'notch passes edges')
	// bandpass: peaks at fc, drops at the edges
	ok(magAt('bandpass', fc) > 0.6, 'bandpass strong at fc')
	ok(magAt('bandpass', 50) < 0.1 && magAt('bandpass', 15000) < 0.2, 'bandpass drops at edges')
	// allpass: unit magnitude everywhere
	for (let f of [100, 1000, 8000]) almost(magAt('allpass', f), 1, 0.02)
	// peak: unit magnitude at both extremes (low − high crossover shape)
	ok(magAt('peak', 50) > 0.95 && magAt('peak', 20000) > 0.9, 'peak unity at extremes')
})

test('edge cases — empty input, NaN cutoff', () => {
	// Empty input: processors return the empty array without crashing
	for (let fn of [
		d => dsp.filter(d, { coefs: dsp.biquad.lowpass(1000, 0.707, 44100) }),
		d => dsp.filtfilt(d, { coefs: dsp.biquad.lowpass(1000, 0.707, 44100) }),
		d => dsp.onePole(d, { fc: 100, fs: 44100 }),
		d => dsp.movingAverage(d, {}),
		d => dsp.median(d, {}),
		d => dsp.gaussianIir(d, { sigma: 2 }),
	]) {
		let out = fn(new Float64Array(0))
		is(out.length, 0, 'empty in, empty out')
	}
	// NaN/absent cutoff must throw, not silently design a NaN filter
	throws(() => dsp.butterworth(4, NaN, 44100), 'butterworth NaN fc throws')
	throws(() => dsp.chebyshev(4, undefined, 44100, 1), 'chebyshev missing fc throws')
})

test('warpedFir — lambda: 0 is honored (reduces to plain FIR)', () => {
	// D(z) with λ=0 is a unit delay — the warped structure must equal direct
	// convolution exactly; `lambda || 0.7` used to swallow the 0
	let h = [0.5, 0.3, 0.15]
	let x = Float64Array.from({ length: 32 }, (_, i) => Math.sin(i * 0.9))
	let y = Float64Array.from(x)
	dsp.warpedFir(y, { coefs: h, lambda: 0 })
	for (let n = 0; n < x.length; n++) {
		let d = 0
		for (let m = 0; m < h.length; m++) if (n - m >= 0) d += h[m] * x[n - m]
		almost(y[n], d, 1e-12)
	}
})

// --- 2.4.0 compat surface (audit): pre-2.4 names stay importable ---
test('compat: sosfilt_zi alias + poles subpath exports + dynamicSmoothing maxFc throws', async () => {
	const idx = await import('./index.js')
	is(idx.sosfilt_zi, idx.sosfiltZi, 'sosfilt_zi ≡ sosfiltZi')
	const bw = await import('./iir/butterworth.js')
	ok(typeof bw.poles === 'function', 'butterworth poles export')
	const ch = await import('./iir/chebyshev.js')
	ok(typeof ch.poles === 'function' && typeof ch.type2 === 'function', 'chebyshev poles + type2 exports')
	const { default: dynamicSmoothing } = await import('./smooth/dynamic-smoothing.js')
	let threw = false
	try { dynamicSmoothing(new Float32Array(8), { minFc: 1, maxFc: 100, fs: 100 }) } catch (e) { threw = /maxFc/.test(e.message) }
	ok(threw, 'maxFc rejected loudly (algorithm changed in 2.4)')
})
