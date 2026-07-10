/**
 * SVG plot generation for filter documentation.
 *
 * Usage:
 *   import { plotFilter, plotFir, plotCompare, theme } from 'digital-filter/plot/index.js'
 *
 *   // Single SOS filter → 4-panel SVG string
 *   let svg = plotFilter(sos, 'Butterworth order 4, fc=1kHz')
 *
 *   // Single impulse response → 4-panel SVG string
 *   let svg = plotFir(h, 'firwin lowpass, 63 taps')
 *
 *   // Multiple SOS overlaid → 4-panel SVG string
 *   let svg = plotCompare([
 *     ['Butterworth', butterworth(4, 1000, 44100)],
 *     ['Chebyshev', chebyshev(4, 1000, 44100, 1)],
 *   ], 'IIR comparison')
 *
 *   // Customize colors
 *   theme.colors = ['#e74c3c', '#2ecc71']
 *   theme.fill = false
 *
 * @module digital-filter/plot
 */
import { freqz, mag2db, groupDelay, impulseResponse } from '../index.js'

// ── Theme (customizable) ──

export let theme = {
	grid: '#e5e7eb',
	axis: '#d1d5db',
	text: '#6b7280',
	colors: ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#f97316', '#a855f7', '#06b6d4', '#64748b'],  // tw blue, red, green, yellow, orange, purple, cyan, slate 500
	fill: true,
	fs: 44100,
	bins: 2048,
}

// ── Layout ──

let LM = 34, TM = 16, RM = 20, GAP = 50, PW = 358, PH = 155
let W = LM + PW + GAP + PW + RM, H = TM + PH + GAP + PH + 16
let P1 = { x: LM, y: TM, w: PW, h: PH }
let P2 = { x: LM + PW + GAP, y: TM, w: PW, h: PH }
let P3 = { x: LM, y: TM + PH + GAP, w: PW, h: PH }
let P4 = { x: LM + PW + GAP, y: TM + PH + GAP, w: PW, h: PH }
let fTicks = [10, 100, 1000, 10000]

// ── SVG primitives ──

let _gradId = 0
let _defs = ''

function svgOpen () { _gradId = 0; _defs = ''; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="font-family:system-ui,-apple-system,sans-serif">\n` }

function svgWrap (s) {
	if (!_defs) return s + '</svg>\n'
	// Insert defs after first newline (after <svg ...>)
	let i = s.indexOf('\n') + 1
	return s.slice(0, i) + `  <defs>${_defs}  </defs>\n` + s.slice(i) + '</svg>\n'
}

function panel (p, xLabel, yLabel, yMin, yMax, zeroAt) {
	let axisY = (zeroAt != null && yMin != null) ?
		(p.y + p.h - (zeroAt - yMin) / (yMax - yMin) * p.h) : (p.y + p.h)
	let clipId = 'clip' + (++_gradId)
	p._clipId = clipId
	_defs += `\n    <clipPath id="${clipId}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath>\n`
	return `  <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y+p.h}" stroke="${theme.axis}"/>\n` +
		`  <line x1="${p.x}" y1="${axisY.toFixed(1)}" x2="${p.x+p.w}" y2="${axisY.toFixed(1)}" stroke="${theme.axis}"/>\n` +
		`  <text x="${p.x+p.w/2}" y="${p.y+p.h+26}" text-anchor="middle" font-size="9" fill="${theme.text}">${xLabel}</text>\n` +
		`  <text x="${p.x-22}" y="${p.y+p.h/2}" text-anchor="middle" font-size="9" fill="${theme.text}" transform="rotate(-90 ${p.x-22} ${p.y+p.h/2})">${yLabel}</text>\n`
}

function hTicks (p, ticks, yMin, yMax) {
	let s = ''
	for (let v of ticks) {
		let y = (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
		if (v !== 0) s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${theme.text}">${v}</text>\n`
	}
	return s
}

function logXTicks (p, ticks, fMin, fMax) {
	let s = '', lr = Math.log10(fMax / fMin)
	let decade = Math.pow(10, Math.floor(Math.log10(fMin)))
	while (decade < fMax) {
		for (let m = 2; m <= 9; m++) {
			let f = decade * m
			if (f >= fMin && f <= fMax) {
				let x = (p.x + Math.log10(f / fMin) / lr * p.w).toFixed(1)
				s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
			}
		}
		decade *= 10
	}
	for (let f of ticks) {
		let x = (p.x + Math.log10(f / fMin) / lr * p.w).toFixed(1)
		s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
		s += `  <text x="${x}" y="${p.y+p.h+12}" text-anchor="middle" font-size="8" fill="${theme.text}">${f >= 1000 ? (f/1000) + 'k' : f}</text>\n`
	}
	return s
}

function linXTicks (p, ticks, xMin, xMax) {
	let s = ''
	for (let v of ticks) {
		let x = (p.x + (v - xMin) / (xMax - xMin) * p.w).toFixed(1)
		s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
		s += `  <text x="${x}" y="${p.y+p.h+12}" text-anchor="middle" font-size="8" fill="${theme.text}">${v}</text>\n`
	}
	return s
}

function logPoly (p, freqs, vals, fMin, fMax, yMin, yMax, clr, w, fill, fillBase) {
	let clip = p._clipId ? ` clip-path="url(#${p._clipId})"` : ''
	let lr = Math.log10(fMax / fMin)

	// fillPts: all points clamped to range (continuous, for gradient fill)
	// segments: line segments that break when values leave [yMin, yMax]
	let fillPts = [], segments = [[]]
	let wasOut = false
	for (let i = 0; i < freqs.length; i++) {
		let f = freqs[i]
		if (f < fMin || f > fMax) continue
		let v = vals[i]
		let x = p.x + Math.log10(f / fMin) / lr * p.w
		if (!isFinite(x) || !isFinite(v)) { wasOut = true; if (segments[segments.length-1].length) segments.push([]); continue }

		let clamped = Math.max(yMin, Math.min(yMax, v))
		let y = p.y + p.h - (clamped - yMin) / (yMax - yMin) * p.h
		let pt = `${x.toFixed(1)},${y.toFixed(1)}`

		// Fill always gets the clamped point
		fillPts.push(pt)

		// Line segments break at boundaries
		let out = v < yMin || v > yMax
		if (out) {
			if (!wasOut && segments[segments.length-1].length) {
				segments[segments.length-1].push(pt) // clamped endpoint
				segments.push([])
			}
			wasOut = true
		} else {
			if (wasOut && segments[segments.length-1].length === 0 && i > 0) {
				// Re-entering: add previous clamped point as segment start
				let pf = freqs[i-1]
				if (pf >= fMin && pf <= fMax) {
					let px = p.x + Math.log10(pf / fMin) / lr * p.w
					let pv = Math.max(yMin, Math.min(yMax, vals[i-1]))
					let py = p.y + p.h - (pv - yMin) / (yMax - yMin) * p.h
					segments[segments.length-1].push(`${px.toFixed(1)},${py.toFixed(1)}`)
				}
			}
			segments[segments.length-1].push(pt)
			wasOut = false
		}
	}

	if (fillPts.length < 2) return ''
	let s = ''

	// Fill uses all clamped points (continuous)
	if (fill && fillBase) {
		let baseY = fillBase === 'down' ? (p.y + p.h) : fillBase === 'zero' ?
			(p.y + p.h - (0 - yMin) / (yMax - yMin) * p.h) : (p.y + p.h)
		let minY = baseY, maxY = baseY
		for (let pt of fillPts) { let y = +pt.split(',')[1]; if (y < minY) minY = y; if (y > maxY) maxY = y }
		let aboveExt = baseY - minY, belowExt = maxY - baseY
		if (aboveExt >= 1) {
			let id = 'g' + (++_gradId)
			_defs += `\n    <linearGradient id="${id}" x1="0" y1="${minY.toFixed(0)}" x2="0" y2="${baseY.toFixed(0)}" gradientUnits="userSpaceOnUse">` +
				`<stop offset="0%" stop-color="${clr}" stop-opacity="0.15"/>` +
				`<stop offset="100%" stop-color="${clr}" stop-opacity="0.01"/>` +
				`</linearGradient>\n`
			let abovePts = fillPts.map(pt => { let [x, y] = pt.split(','); return `${x},${Math.min(+y, baseY).toFixed(1)}` })
			s += `  <polygon points="${abovePts[0].split(',')[0]},${baseY.toFixed(1)} ${abovePts.join(' ')} ${abovePts[abovePts.length-1].split(',')[0]},${baseY.toFixed(1)}" fill="url(#${id})"/>\n`
		}
		if (belowExt >= 1) {
			let id = 'g' + (++_gradId)
			_defs += `\n    <linearGradient id="${id}" x1="0" y1="${baseY.toFixed(0)}" x2="0" y2="${maxY.toFixed(0)}" gradientUnits="userSpaceOnUse">` +
				`<stop offset="0%" stop-color="${clr}" stop-opacity="0.01"/>` +
				`<stop offset="100%" stop-color="${clr}" stop-opacity="0.15"/>` +
				`</linearGradient>\n`
			let belowPts = fillPts.map(pt => { let [x, y] = pt.split(','); return `${x},${Math.max(+y, baseY).toFixed(1)}` })
			s += `  <polygon points="${belowPts[0].split(',')[0]},${baseY.toFixed(1)} ${belowPts.join(' ')} ${belowPts[belowPts.length-1].split(',')[0]},${baseY.toFixed(1)}" fill="url(#${id})"/>\n`
		}
	}

	// Draw each segment as a separate polyline (breaks at out-of-range values)
	for (let seg of segments) {
		if (seg.length >= 2) s += `  <polyline points="${seg.join(' ')}" fill="none" stroke="${clr}" stroke-width="${w}" stroke-linejoin="round"/>\n`
	}
	return clip ? `  <g${clip}>\n${s}  </g>\n` : s
}

function linPoly (p, data, xMin, xMax, yMin, yMax, clr, fill) {
	let clip = p._clipId ? ` clip-path="url(#${p._clipId})"` : ''
	let pts = []
	let N = typeof data.length !== 'undefined' ? data.length : 0
	for (let i = 0; i < N; i++) {
		let x = p.x + (xMin + i * (xMax - xMin) / N - xMin) / (xMax - xMin) * p.w
		let v = Math.max(yMin, Math.min(yMax, data[i]))
		let y = p.y + p.h - (v - yMin) / (yMax - yMin) * p.h
		pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
	}
	if (pts.length < 2) return ''
	let s = ''
	if (fill) {
		let baseY = p.y + p.h - (0 - yMin) / (yMax - yMin) * p.h
		let minY = baseY, maxY = baseY
		for (let pt of pts) { let y = +pt.split(',')[1]; if (y < minY) minY = y; if (y > maxY) maxY = y }
		let aboveExt = baseY - minY, belowExt = maxY - baseY
		if (aboveExt >= 1) {
			let id = 'g' + (++_gradId)
			_defs += `\n    <linearGradient id="${id}" x1="0" y1="${minY.toFixed(0)}" x2="0" y2="${baseY.toFixed(0)}" gradientUnits="userSpaceOnUse">` +
				`<stop offset="0%" stop-color="${clr}" stop-opacity="0.15"/>` +
				`<stop offset="100%" stop-color="${clr}" stop-opacity="0.01"/>` +
				`</linearGradient>\n`
			let abovePts = pts.map(pt => { let [x, y] = pt.split(','); return `${x},${Math.min(+y, baseY).toFixed(1)}` })
			s += `  <polygon points="${abovePts[0].split(',')[0]},${baseY.toFixed(1)} ${abovePts.join(' ')} ${abovePts[abovePts.length-1].split(',')[0]},${baseY.toFixed(1)}" fill="url(#${id})"/>\n`
		}
		if (belowExt >= 1) {
			let id = 'g' + (++_gradId)
			_defs += `\n    <linearGradient id="${id}" x1="0" y1="${baseY.toFixed(0)}" x2="0" y2="${maxY.toFixed(0)}" gradientUnits="userSpaceOnUse">` +
				`<stop offset="0%" stop-color="${clr}" stop-opacity="0.01"/>` +
				`<stop offset="100%" stop-color="${clr}" stop-opacity="0.15"/>` +
				`</linearGradient>\n`
			let belowPts = pts.map(pt => { let [x, y] = pt.split(','); return `${x},${Math.max(+y, baseY).toFixed(1)}` })
			s += `  <polygon points="${belowPts[0].split(',')[0]},${baseY.toFixed(1)} ${belowPts.join(' ')} ${belowPts[belowPts.length-1].split(',')[0]},${baseY.toFixed(1)}" fill="url(#${id})"/>\n`
		}
	}
	s += `  <polyline points="${pts.join(' ')}" fill="none" stroke="${clr}" stroke-width="1.2" stroke-linejoin="round"/>\n`
	return clip ? `  <g${clip}>\n${s}  </g>\n` : s
}


function irRefLines (p, yMin, yMax) {
	let s = ''
	for (let v of [1, -1]) {
		if (v >= yMin && v <= yMax) {
			let y = (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
			s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${theme.grid}" stroke-width="0.5" stroke-dasharray="3 2"/>\n`
			s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="7" fill="${theme.text}">${v > 0 ? '+' : ''}${v}</text>\n`
		}
	}
	return s
}

function dbGrid (p) {
	let yMin = -80, yMax = 20, s = ''
	let toY = v => (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
	// Grid lines (with labels)
	for (let v of [-80, -60, -40, -20, 20]) {
		let y = toY(v)
		s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
	}
	// Lines without labels
	for (let v of [-10, 10]) {
		let y = toY(v)
		s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
	}
	let fmt = v => v > 0 ? '+' + v : '' + v
	for (let v of [-80, -60, -40, -20, 0, 20]) {
		s += `  <text x="${p.x-4}" y="${(+toY(v)+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${theme.text}">${fmt(v)}</text>\n`
	}
	return s
}

function phaseGrid (p) {
	let yMin = -180, yMax = 180, s = ''
	let toY = v => (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
	for (let v of [90, -90]) {
		let y = toY(v)
		s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
	}
	let fmt = v => v > 0 ? '+' + v : '' + v
	for (let v of [180, 0, -180]) {
		let y = toY(v)
		if (v !== 0) s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${theme.grid}" stroke-width="0.5"/>\n`
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${theme.text}">${fmt(v)}</text>\n`
	}
	return s
}

function fcLine (p, fc, fMin = 10, fMax = 20000) {
	if (!fc || fc < fMin || fc > fMax) return ''
	let x = (p.x + Math.log10(fc / fMin) / Math.log10(fMax / fMin) * p.w).toFixed(1)
	return `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${theme.axis}" stroke-width="1" stroke-dasharray="4 3"/>\n`
}

/**
 * Render inline legend.
 * @param {Array} items - [[name, color], ...]
 * @param {object} [pos] - { x, y } starting position. Defaults to title line (top-left of P1).
 */
export function legend (items, pos) {
	// Default: same line as title (y aligns with title baseline at P2.y-5)
	let s = '', x = pos?.x ?? P1.x, y = pos?.y ?? (P2.y - 5)
	for (let [name, clr] of items) {
		s += `  <line x1="${x}" y1="${y-3}" x2="${x+12}" y2="${y-3}" stroke="${clr}" stroke-width="2"/>\n`
		s += `  <text x="${x+15}" y="${y.toFixed(1)}" font-size="11" fill="${theme.text}">${name}</text>\n`
		x += 15 + name.length * 5.5 + 10
	}
	return s
}

function parseFc (title) {
	let m = title?.match(/fc=(\d+(?:\.\d+)?)\s*(k?)\s*Hz/i)
	if (!m) return null
	return +m[1] * (m[2].toLowerCase() === 'k' ? 1000 : 1)
}


function autoTicks (lo, hi, n) {
	let range = hi - lo
	if (range === 0) return [lo]
	let step = range / n
	let mag = Math.pow(10, Math.floor(Math.log10(step)))
	step = Math.ceil(step / mag) * mag
	let ticks = []
	let start = Math.ceil(lo / step) * step
	for (let v = start; v <= hi + step * 0.01; v += step) ticks.push(Math.round(v * 1000) / 1000)
	return ticks
}

// ── Public API ──

/**
 * Generate 4-panel SVG for an SOS (biquad cascade) filter.
 * @param {Array} sos - SOS coefficient array [{b0,b1,b2,a1,a2}, ...]
 * @param {string} [title] - Plot title
 * @param {object} [opts] - Options: { fs, bins, color, fill }
 * @returns {string} SVG markup
 */
export function plotFilter (sos, title, opts = {}) {
	let fs = opts.fs || theme.fs, NF = opts.bins || theme.bins
	let clr = opts.color || theme.colors
	let doFill = opts.fill ?? theme.fill

	let r = freqz(sos, NF, fs)
	let db = mag2db(r.magnitude)
	let phase = Array.from(r.phase).map(v => v * 180 / Math.PI)
	let gd = groupDelay(sos, NF, fs)
	let ir = impulseResponse(sos, 128)

	let fc = parseFc(title)
	let s = svgOpen()
	if (title) s += `  <text x="${P2.x+P2.w}" y="${P2.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${theme.text}">${title}</text>\n`

	s += panel(P1, 'Hz', 'dB', -80, 20, 0) + logXTicks(P1, fTicks, 10, 20000) + dbGrid(P1) + fcLine(P1, fc)
	s += logPoly(P1, r.frequencies, Array.from(db), 10, 20000, -80, 20, clr[0], 1.5, doFill, 'down')

	s += panel(P2, 'Hz', 'Phase (deg)', -180, 180, 0) + logXTicks(P2, fTicks, 10, 20000) + phaseGrid(P2) + fcLine(P2, fc)
	s += logPoly(P2, r.frequencies, phase, 10, 20000, -180, 180, clr[1], 1.5, doFill, 'zero')

	let gdLo = -100, gdHi = 100
	s += panel(P3, 'Hz', 'Delay (smp)', gdLo, gdHi, 0) + logXTicks(P3, fTicks, 10, 20000) + hTicks(P3, [-100, -50, 0, 50, 100], gdLo, gdHi) + fcLine(P3, fc)
	s += logPoly(P3, gd.frequencies, Array.from(gd.delay), 10, 20000, gdLo, gdHi, clr[2], 1.5, doFill, 'zero')

	let irLo = -1.2, irHi = 1.2
	s += panel(P4, 'Samples', 'Impulse', irLo, irHi, 0) + linXTicks(P4, [0, 32, 64, 96, 128], 0, 128) + hTicks(P4, [-1, 0, 1], irLo, irHi) + irRefLines(P4, irLo, irHi)
	s += linPoly(P4, ir, 0, 128, irLo, irHi, clr[3], doFill)

	return svgWrap(s)
}

/**
 * Generate 4-panel SVG for an impulse response (FIR or processed buffer).
 * @param {Float64Array|Array} h - Impulse response samples
 * @param {string} [title] - Plot title
 * @param {object} [opts] - Options: { fs, bins, color, fill }
 * @returns {string} SVG markup
 */
export function plotFir (h, title, opts = {}) {
	let fs = opts.fs || theme.fs, NF = opts.bins || theme.bins
	let clr = opts.color || theme.colors
	let doFill = opts.fill ?? theme.fill

	let freqs = new Float64Array(NF)
	let mag = new Float64Array(NF)
	let phase = new Float64Array(NF)
	for (let k = 0; k < NF; k++) {
		freqs[k] = k * fs / (2 * NF)
		let re = 0, im = 0, w = Math.PI * k / NF
		for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(w * n); im -= h[n] * Math.sin(w * n) }
		mag[k] = 20 * Math.log10(Math.max(Math.sqrt(re * re + im * im), 1e-15))
		phase[k] = Math.atan2(im, re) * 180 / Math.PI
	}

	let gdFreqs = freqs, gdVals = new Float64Array(NF)
	for (let k = 1; k < NF - 1; k++) {
		let dp = phase[k + 1] - phase[k - 1]
		if (dp > 180) dp -= 360; if (dp < -180) dp += 360
		gdVals[k] = -dp / (2 * Math.PI / NF * 180 / Math.PI)
	}
	gdVals[0] = gdVals[1]

	let fc = parseFc(title)
	let s = svgOpen()
	if (title) s += `  <text x="${P2.x+P2.w}" y="${P2.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${theme.text}">${title}</text>\n`

	s += panel(P1, 'Hz', 'dB', -80, 20, 0) + logXTicks(P1, fTicks, 10, 20000) + dbGrid(P1) + fcLine(P1, fc)
	s += logPoly(P1, freqs, Array.from(mag), 10, 20000, -80, 20, clr[0], 1.5, doFill, 'down')

	s += panel(P2, 'Hz', 'Phase (deg)', -180, 180, 0) + logXTicks(P2, fTicks, 10, 20000) + phaseGrid(P2) + fcLine(P2, fc)
	s += logPoly(P2, freqs, Array.from(phase), 10, 20000, -180, 180, clr[1], 1.5, doFill, 'zero')

	let gdLo = -100, gdHi = 100
	s += panel(P3, 'Hz', 'Delay (smp)', gdLo, gdHi, 0) + logXTicks(P3, [100, 1000, 10000], 10, 20000) + hTicks(P3, [-100, -50, 0, 50, 100], gdLo, gdHi) + fcLine(P3, fc)
	s += logPoly(P3, gdFreqs, Array.from(gdVals), 10, 20000, gdLo, gdHi, clr[2], 1.5, doFill, 'zero')

	let irLo = -1.2, irHi = 1.2
	s += panel(P4, 'Samples', 'Impulse', irLo, irHi, 0) + linXTicks(P4, autoTicks(0, h.length, 3).map(Math.round), 0, h.length) + hTicks(P4, [-1, 0, 1], irLo, irHi) + irRefLines(P4, irLo, irHi)
	s += linPoly(P4, h, 0, h.length, irLo, irHi, clr[3], doFill)

	return svgWrap(s)
}

/**
 * Generate 4-panel SVG comparing multiple SOS filters or FIR impulse responses overlaid.
 * @param {Array} filters - Array of [name, sos|fir] or [name, sos|fir, color]
 *   sos: [{b0,b1,b2,a1,a2}, ...] — IIR biquad cascade
 *   fir: Float64Array|number[]  — impulse response
 * @param {string} [title] - Plot title
 * @param {object} [opts] - Options: { fs, bins, irLength, irMax, gdMin, gdMax }
 * @returns {string} SVG markup
 */
export function plotCompare (filters, title, opts = {}) {
	let fs = opts.fs || theme.fs, NF = opts.bins || theme.bins

	function isSos (data) {
		if (data && typeof data === 'object' && 'b0' in data) return true  // single SOS
		return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'b0' in data[0]
	}

	function firFreqz (h) {
		let frequencies = new Float64Array(NF), magnitude = new Float64Array(NF), phase = new Float64Array(NF)
		for (let k = 0; k < NF; k++) {
			frequencies[k] = k * fs / (2 * NF)
			let re = 0, im = 0, w = Math.PI * k / NF
			for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(w * n); im -= h[n] * Math.sin(w * n) }
			magnitude[k] = Math.sqrt(re * re + im * im)
			phase[k] = Math.atan2(im, re)
		}
		let delay = new Float64Array(NF)
		let phDeg = Array.from(phase).map(v => v * 180 / Math.PI)
		for (let k = 1; k < NF - 1; k++) {
			let dp = phDeg[k + 1] - phDeg[k - 1]
			if (dp > 180) dp -= 360; if (dp < -180) dp += 360
			delay[k] = -dp / (2 * Math.PI / NF * 180 / Math.PI)
		}
		delay[0] = delay[1]
		return { frequencies, magnitude, phase, delay }
	}

	// Pre-compute all responses for range detection
	let defaultIrLen = opts.irLength || 128
	let computed = filters.map(([, data]) => {
		if (!isSos(data)) {
			let r = firFreqz(data)
			return { r, ir: data, gdFreqs: r.frequencies, gdDelay: r.delay }
		}
		let sos = Array.isArray(data) ? data : [data]
		let r = freqz(sos, NF, fs)
		let gd = groupDelay(sos, NF, fs)
		return { r, ir: impulseResponse(sos, defaultIrLen), gdFreqs: gd.frequencies, gdDelay: gd.delay }
	})

	let irLen = opts.irLength ?? Math.max(...computed.map(({ ir }) => ir.length))

	let gdLo = opts.gdMin ?? -100, gdHi = opts.gdMax ?? 100
	let irLo = -1.2, irHi = 1.2

	let s = svgOpen()
	if (title) s += `  <text x="${P2.x+P2.w}" y="${P2.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${theme.text}">${title}</text>\n`

	let fc = parseFc(title)
	s += panel(P1, 'Hz', 'dB', -80, 20, 0) + logXTicks(P1, fTicks, 10, 20000) + dbGrid(P1) + fcLine(P1, fc)
	s += panel(P2, 'Hz', 'Phase (deg)', -180, 180, 0) + logXTicks(P2, fTicks, 10, 20000) + phaseGrid(P2) + fcLine(P2, fc)
	s += panel(P3, 'Hz', 'Delay (smp)', gdLo, gdHi, 0) + logXTicks(P3, fTicks, 10, 20000) + hTicks(P3, [-100, -50, 0, 50, 100], gdLo, gdHi) + fcLine(P3, fc)
	s += panel(P4, 'Samples', 'Impulse', irLo, irHi, 0) + linXTicks(P4, autoTicks(0, irLen, 3).map(Math.round), 0, irLen) + hTicks(P4, [-1, 0, 1], irLo, irHi) + irRefLines(P4, irLo, irHi)

	for (let i = 0; i < filters.length; i++) {
		let [,, c] = filters[i]
		c = c || theme.colors[i % theme.colors.length]
		let { r, ir, gdFreqs, gdDelay } = computed[i]
		let db = Array.from(mag2db(r.magnitude))
		let phase = Array.from(r.phase).map(v => v * 180 / Math.PI)
		s += logPoly(P1, r.frequencies, db, 10, 20000, -80, 20, c, 1.3, false)
		s += logPoly(P2, r.frequencies, phase, 10, 20000, -180, 180, c, 1.3, false)
		s += logPoly(P3, gdFreqs, Array.from(gdDelay), 10, 20000, gdLo, gdHi, c, 1.3, false)
		s += linPoly(P4, ir, 0, irLen, irLo, irHi, c)
	}

	s += legend(filters.map((f, i) => [f[0], f[2] || theme.colors[i % theme.colors.length]]))
	return svgWrap(s)
}
