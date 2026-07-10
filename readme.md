# digital-filter [![test](https://github.com/audiojs/digital-filter/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/digital-filter/actions/workflows/test.yml) [![npm](https://img.shields.io/npm/v/digital-filter)](https://www.npmjs.com/package/digital-filter) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Digital filter design and processing.

<table><tr><td valign="top">

**[IIR](#iir)**<br>
<sub>[biquad](#biquad) · [svf](#svfdata-params) · [butterworth](#butterworthorder-fc-fs-type) · [chebyshev](#chebyshevorder-fc-fs-ripple-type) · [chebyshev2](#chebyshev2order-fc-fs-attenuation-type) · [elliptic](#ellipticorder-fc-fs-ripple-attenuation-type) · [bessel](#besselorder-fc-fs-type) · [legendre](#legendreorder-fc-fs-type) · [linkwitzRiley](#linkwitzrileyorder-fc-fs) · [iirdesign](#iirdesignfpass-fstop-rp-rs-fs) · [buttord](#buttordfpass-fstop-rp-rs-fs) · [cheb1ord](#cheb1ordfpass-fstop-rp-rs-fs) · [cheb2ord](#cheb2ordfpass-fstop-rp-rs-fs) · [ellipord](#ellipordfpass-fstop-rp-rs-fs)</sub>

**[FIR](#fir)**<br>
<sub>[firwin](#firwinnumtaps-cutoff-fs-opts) · [firls](#firlsnumtaps-bands-desired-weight) · [remez](#remeznumtaps-bands-desired-weight) · [firwin2](#firwin2numtaps-freq-gain-opts) · [hilbert](#hilbertn) · [differentiator](#differentiatorn-opts) · [raisedCosine](#raisedcosinen-beta-sps-opts) · [gaussianFir](#gaussianfirn-bt-sps) · [matchedFilter](#matchedfiltertemplate) · [minimumPhase](#minimumphaseh) · [yulewalk](#yulewalkorder-frequencies-magnitudes) · [kaiserord](#kaiserorddeltaf-attenuation) · [integrator](#integratorrule) · [lattice](#latticedata-params) · [warpedFir](#warpedfirdata-params)</sub>

**[Smooth](#smooth)**<br>
<sub>[onePole](#onepoledata-params) · [movingAverage](#movingaveragedata-params) · [leakyIntegrator](#leakyintegratordata-params) · [savitzkyGolay](#savitzkygolaydata-params) · [gaussianIir](#gaussianiirdata-params) · [dynamicSmoothing](#dynamicsmoothingdata-params) · [median](#mediandata-params) · [oneEuro](#oneeuropdata-params)</sub>

</td><td valign="top">

**[Adaptive](#adaptive)**<br>
<sub>[lms](#lmsinput-desired-params) · [nlms](#nlmsinput-desired-params) · [rls](#rlsinput-desired-params) · [levinson](#levinsonr-order)</sub>

**[Multirate](#multirate)**<br>
<sub>[decimate](#decimatedata-factor-opts) · [interpolate](#interpolatedata-factor-opts) · [resample](#resampledata-p-q-opts) · [upfirdn](#upfirdndata-h-up-down) · [halfBand](#halfbandnumtaps) · [cic](#cicdata-r-n) · [polyphase](#polyphaseh-m) · [farrow](#farrowdata-params) · [thiran](#thirandelay-order) · [oversample](#oversampledata-factor-opts)</sub>

**[Core](#core)**<br>
<sub>[filter](#filterdata-params) · [iir](#iirdata-params) · [filtfilt](#filtfiltdata-params) · [convolution](#convolutionsignal-ir) · [detrend](#detrenddata-type) · [freqz](#freqzcoefs-n-fs) · [mag2db](#mag2dbmag) · [groupDelay](#groupdelaycoefs-n-fs) · [phaseDelay](#phasedelaycoefs-n-fs) · [impulseResponse](#impulseresponsecoefs-n) · [stepResponse](#stepresponsecoefs-n) · [isStable](#isstablesos) · [isMinPhase](#isminphasesos) · [isFir](#isfirsos) · [isLinPhase](#islinphaseh) · [sos2zpk](#sos2zpksos) · [sos2tf](#sos2tfsos) · [tf2zpk](#tf2zpkb-a) · [tf2sos](#tf2sosb-a) · [zpk2sos](#zpk2soszpk) · [zpk2tf](#zpk2tfzpk) · [tf2ss](#tf2ssb-a--ss2tfa-b-c-d) · [ss2tf](#tf2ssb-a--ss2tfa-b-c-d) · [residue](#residueb-a) · [matchedZ](#matchedzpoles-zeros-fs-normfreq) · [deconvolve](#deconvolveb-a) · [wiener](#wienerdata-opts) · [sosfiltZi](#sosfiltzisos) · [transform](#transform)</sub>

</td></tr></table>

## Install

```
npm install digital-filter
```

```js
import { butterworth, filter, onePole } from 'digital-filter'
// import butterworth from 'digital-filter/iir/butterworth.js'

onePole(data, { fc: 100, fs: 44100 })           // smooth in-place

let sos = butterworth(4, 1000, 44100)            // design a 4th-order lowpass
filter(data, { coefs: sos })                     // apply in-place

let params = { coefs: sos }
filter(block1, params)                           // state persists between blocks
filter(block2, params)
```

> For audio-domain filters (weighting, EQ, synth, measurement) see [audio-filter](https://github.com/audiojs/audio-filter).

## Intro

**Filter.** Takes an array of samples, outputs an array of samples. `output[i] = (input[i] + input[i-1] + input[i-2]) / 3` smooths out fast changes – that's a lowpass.

**Frequency response.** Every filter passes some frequencies and cuts others. The plots show how much each frequency is kept (magnitude, in dB) and how much it's delayed (phase). 0 dB = unchanged, –3 dB = half power.

**IIR vs FIR.**

| | IIR | FIR |
|---|---|---|
| **How** | Feedback (output depends on previous output) | No feedback |
| **Efficiency** | 5–20 multiplies for sharp lowpass | 100–1000+ multiplies |
| **Phase** | Nonlinear (always) | Linear (symmetric coefficients) |
| **Stability** | Can blow up | Always stable |
| **Latency** | Low (few samples) | High (N/2 samples) |
| **Adaptive** | Hard to adapt coefficients in real time | Easy – coefficients are the taps (LMS, NLMS) |
| **Use for** | Real-time, low latency | Offline, linear phase, adaptive |

**Adaptive**. Means the filter adjusts its own coefficients in real time to minimize error against a reference signal — used for echo cancellation, noise cancellation, system identification.

**SOS.** Second-Order Sections – an IIR filter split into a chain of biquads (2nd-order, 5 coefficients each). A 4th-order Butterworth = 2 biquads. All design functions return SOS arrays to avoid float64 precision loss.

**Plots.** Four panels. Top-left: magnitude (dB vs Hz). Top-right: phase (degrees vs Hz). Bottom-left: group delay (samples vs Hz), flat = no distortion. Bottom-right: impulse response. Dashed line = $f_c$.

**Formulas.** $|H(j\omega)|^2$: analog prototype magnitude. $H(z)$: digital transfer function. $h[n]$: impulse response / FIR coefficients.


## IIR

IIR filters use feedback – efficient (5–20 multiplies for a sharp lowpass), low latency, nonlinear phase. Designed from analog prototypes via the [bilinear transform](#faq) (or matched-z transform), implemented as cascaded second-order sections (SOS).[^sos]

[^sos]: Direct form above order ~6 loses precision with float64. Cascaded biquads don't.

### `biquad`

Nine second-order filter types – the building block for everything else. Every parametric EQ, every crossover, every Butterworth cascade is made of these.[^rbj]

[^rbj]: Robert Bristow-Johnson, [Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/), 1998.

* `biquad.lowpass(fc, Q, fs)` · `highpass` · `bandpass` · `bandpass2` · `notch` · `allpass`
* `biquad.peaking(fc, Q, fs, dBgain)` · `lowshelf` · `highshelf`

<sup>Q controls peak width – 0.707 is Butterworth-flat, higher = sharper resonance.</sup>

$H(z) = (b_0 + b_1 z^{-1} + b_2 z^{-2}) / (1 + a_1 z^{-1} + a_2 z^{-2})$

```js
let lp = biquad.lowpass(1000, 0.707, 44100)
filter(data, { coefs: lp })
```

**Use when**: single-band EQ, notch, shelf, simple 2nd-order filter.<br>
**Not for**: steeper than –12 dB/oct (use butterworth/chebyshev which cascade biquads).<br>
**scipy**: `scipy.signal.iirfilter(1, ...)`. **MATLAB**: various Audio Toolbox functions.

<img src="plot/biquad-types.svg">

### `svf(data, params)`

State variable filter – same transfer function as a biquad, but trapezoidal integration allows zero-delay feedback. Safe for per-sample parameter modulation. Six response types from one topology. Simper/Cytomic (2011). Params: `fc`, `Q`, `fs`, `type`.

$g = \tan(\pi f_c/f_s)$, $k = 1/Q$

```js
svf(data, { fc: 1000, Q: 2, fs: 44100, type: 'lowpass' })
```

**Use when**: real-time synthesis with parameter modulation (LFO, envelope, touch).<br>
**Not for**: need SOS coefficients for analysis (use biquad), higher than 2nd order.

<img src="plot/svf-lowpass.svg">

### `butterworth(order, fc, fs, type?)`

Maximally flat magnitude – no ripple anywhere. The safe default for anti-aliasing, crossovers, general-purpose filtering. Butterworth (1930).[^bw]

[^bw]: S. Butterworth, "On the Theory of Filter Amplifiers," *Wireless Engineer*, 1930.

$|H(j\omega)|^2 = 1/(1 + (\omega/\omega_c)^{2N})$<br>
Poles at $s_k = \omega_c \cdot e^{j\pi(2k+N+1)/(2N)}$.

**–3 dB at fc · –6N dB/oct slope · 10.9% overshoot at order 4 · 73 samples settling**

```js
let sos = butterworth(4, 1000, 44100)
filter(data, { coefs: sos })
```

**Use when**: general-purpose filtering, anti-aliasing, crossovers.<br>
**Not for**: sharpest transition (use [chebyshev](#chebyshev2order-fc-fs-attenuation-type)/[elliptic](#ellipticorder-fc-fs-ripple-attenuation-type)), waveform preservation (use [bessel](#besselorder-fc-fs-type)).<br>
**scipy**: `scipy.signal.butter`. **MATLAB**: `butter`.

<img src="plot/butterworth.svg">


### `chebyshev(order, fc, fs, ripple?, type?)`

Steeper cutoff than Butterworth for the same order – at the cost of passband ripple.

$|H(j\omega)|^2 = 1/(1 + \varepsilon^2 T_N^2(\omega/\omega_c))$ — $T_N$ is the Nth Chebyshev polynomial (oscillates in passband, grows fast in stopband). $\varepsilon = \sqrt{10^{R_p/10} - 1}$.

**Default 1 dB ripple · –34 dB at 2× fc · 8.7% overshoot · 256 samples settling**

```js
let sos = chebyshev(4, 1000, 44100, 1)  // 1 dB ripple
```

**Use when**: sharper cutoff than Butterworth, passband ripple tolerable.<br>
**Not for**: passband flatness (use butterworth/legendre), waveform shape (use bessel).<br>
**scipy**: `scipy.signal.cheby1`. **MATLAB**: `cheby1`.

<img src="plot/chebyshev.svg">


### `chebyshev2(order, fc, fs, attenuation?, type?)`

Flat passband, equiripple stopband. The ripple goes into the rejection region instead. **`fc` is the STOPBAND edge** — the frequency where attenuation first reaches the floor — not the passband edge like every other IIR family.

$|H(j\omega)|^2 = 1/(1 + 1/(\varepsilon^2 T_N^2(\omega_c/\omega)))$ — inverse of Type I. Zeros on $j\omega$ axis enforce stopband floor.

**Flat passband · –40 dB stopband floor · –40 dB at 2× fc**

```js
let sos = chebyshev2(4, 2000, 44100, 40)  // exactly -40 dB at 2 kHz, flat below
```

**Use when**: flat passband needed with sharper rolloff than Butterworth.<br>
**Not for**: deep stopband at high frequencies (Butterworth keeps falling; Cheby II bounces).<br>
**scipy**: `scipy.signal.cheby2`. **MATLAB**: `cheby2`.

<img src="plot/chebyshev2.svg">

### `elliptic(order, fc, fs, ripple?, attenuation?, type?)`

Sharpest transition for a given order – ripple in both passband and stopband. A 4th-order elliptic matches a 7th-order Butterworth. Cauer (1958).[^cauer]

[^cauer]: W. Cauer, *Synthesis of Linear Communication Networks*, 1958.

$|H(j\omega)|^2 = 1/(1 + \varepsilon^2 R_N^2(\omega/\omega_c))$ — $R_N$ is a rational Chebyshev (Jacobi elliptic) function.

**Default 1 dB ripple, 40 dB attenuation · –40 dB at 2× fc · 10.6% overshoot**

```js
let sos = elliptic(4, 1000, 44100, 1, 40)
```

**Use when**: minimum order / sharpest transition is critical.<br>
**Not for**: passband flatness or waveform shape (worst phase response of all families).<br>
**scipy**: `scipy.signal.ellip`. **MATLAB**: `ellip`.

<img src="plot/elliptic.svg">

### `bessel(order, fc, fs, type?)`

Maximally flat group delay – preserves waveform shape with near-zero overshoot. For biomedical signals (ECG, EEG), control systems, anywhere ringing distorts the measurement. Thomson (1949).[^thomson]

[^thomson]: W.E. Thomson, "Delay Networks Having Maximally Flat Frequency Characteristics," *Proc. IEE*, 1949.

$H(s) = \theta_N(0)/\theta_N(s/\omega_c)$ — $\theta_N$ is the reverse Bessel polynomial. Poles cluster near negative real axis.

**–3 dB at fc · –14 dB at 2× fc (gentlest rolloff) · 0.9% overshoot · 28 samples settling**

```js
let sos = bessel(4, 1000, 44100)
```

**Use when**: waveform preservation (ECG, transients, control systems).<br>
**Not for**: sharp frequency cutoff (gentlest rolloff of all families).<br>
**scipy**: `scipy.signal.bessel`. **MATLAB**: `besself` (analog only).

<img src="plot/bessel.svg">

### `legendre(order, fc, fs, type?)`

Steepest monotonic (ripple-free) rolloff. Between Butterworth and Chebyshev. Papoulis (1958), Bond (2004).[^papoulis]

[^papoulis]: A. Papoulis, "Optimum Filters with Monotonic Response," *Proc. IRE*, 1958.

$|H(j\omega)|^2 = 1 - P_N(1 - 2(\omega/\omega_c)^2)$ — $P_N$ maximizes rolloff slope while staying monotonic.

**–3 dB at fc · –31 dB at 2× fc · no ripple · 11.3% overshoot**

```js
let sos = legendre(4, 1000, 44100)
```

**Use when**: sharpest cutoff without any ripple.<br>
**Not for**: ripple tolerable (chebyshev is steeper), waveform shape (use bessel).

<img src="plot/legendre.svg">

### `linkwitzRiley(order, fc, fs)`

Crossover: LP + HP sum to perfectly flat magnitude. Two cascaded Butterworth filters. Linkwitz & Riley (1976).[^lr] Returns `{ low, high }`. Order must be even (2, 4, 6, 8).

[^lr]: S.H. Linkwitz, "Active Crossover Networks for Noncoincident Drivers," *JAES*, 1976.

**–6 dB at fc (both bands) · bands sum to 0 dB at all frequencies**

```js
let { low, high } = linkwitzRiley(4, 2000, 44100)
```

**Use when**: crossover networks, multiband processing.<br>
**Not for**: single LP or HP (use butterworth directly), more than 2 bands (use crossover from audio-filter).<br>
**MATLAB**: `fdesign.crossover` (Audio Toolbox).

<img src="plot/linkwitz-riley-low.svg">

### `iirdesign(fpass, fstop, rp?, rs?, fs?)`

Give it your specs and it picks the best family and minimum order automatically. Returns `{ sos, order, type }`.

```js
let { sos, order, type } = iirdesign(1000, 1500, 1, 40, 44100)
```

**Use when**: you know specs (passband, stopband, ripple, attenuation) but not the family.<br>
**Not for**: specific family needed (use butterworth/chebyshev/etc directly).<br>
**scipy**: `scipy.signal.iirdesign`. **MATLAB**: `designfilt`.

### `buttord(fpass, fstop, rp, rs, fs)` · `cheb1ord` · `cheb2ord` · `ellipord`

Estimate minimum filter order needed to meet specs. Returns `{ order, Wn }`.

```js
let { order, Wn } = buttord(1000, 1500, 1, 40, 44100)     // → order = 13
let { order: nEl } = ellipord(1000, 1500, 1, 40, 44100)   // → order = 5 (much lower)
```

**scipy**: `scipy.signal.buttord`, `cheb1ord`, `cheb2ord`, `ellipord`.<br>
**MATLAB**: `buttord`, `cheb1ord`, `cheb2ord`, `ellipord`.

### IIR comparison

All at order 4, $f_c = 1\text{kHz}$, $f_s = 44100\text{Hz}$:

<img src="plot/iir-comparison.svg">

| | Butterworth | Chebyshev I | Chebyshev II | Elliptic | Bessel | Legendre |
|---|---|---|---|---|---|---|
| **Passband** | Flat | 1 dB ripple | Flat | 1 dB ripple | Flat (soft) | Flat |
| **@2 kHz** | –24 dB | –34 dB | –40 dB | –40 dB | –14 dB | –31 dB |
| **Overshoot** | 10.9% | 8.7% | 13.0% | 10.6% | **0.9%** | 11.3% |
| **Best for** | General | Sharp cutoff | Flat pass | Min order | No ringing | Sharp, no ripple |


## FIR

Finite impulse response – no feedback, always stable. Symmetric coefficients give perfect linear phase. More taps = sharper cutoff = more latency. All design functions return `Float64Array`.

### `firwin(numtaps, cutoff, fs, opts?)`

Window method FIR – truncated sinc multiplied by a window function. Supports `lowpass`, `highpass`, `bandpass`, `bandstop`. `opts.window`: `'hamming'` (default), `'hann'`, `'blackman'`, `'blackman-harris'`, `'bartlett'`, `'rectangular'`, `['kaiser', beta]`, a `Float64Array`, or a `(N) => array` function — unknown names throw.

$h[n] = \sin(\omega_c n)/(\pi n) \cdot w[n]$ — sinc gives ideal brick-wall, window smooths truncation.

**Linear phase · delay = (N–1)/2 samples · –43 dB sidelobes (Hamming)**

```js
let h = firwin(63, 1000, 44100)
```

**Use when**: 80% of FIR tasks – quick, predictable LP/HP/BP/BS.<br>
**Not for**: tight specs (use remez), arbitrary shapes (use firwin2).<br>
**scipy**: `scipy.signal.firwin`. **MATLAB**: `fir1`.

<img src="plot/firwin-lp.svg">

### `firls(numtaps, bands, desired, weight?)`

Least-squares optimal – minimizes total squared error. Smoother transitions than remez.

$\min \int |W(\omega)(H(\omega) - D(\omega))|^2 d\omega$

**Linear phase · smooth transition · no equiripple**

```js
let h = firls(63, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
```

**Use when**: average error matters more than worst-case, audio interpolation.<br>
**Not for**: tight stopband specs (use remez).<br>
**scipy**: `scipy.signal.firls`. **MATLAB**: `firls`.

<img src="plot/firls.svg">

### `remez(numtaps, bands, desired, weight?)`

Parks-McClellan equiripple – narrowest transition band for given taps. Parks & McClellan (1972).[^pm]

[^pm]: T.W. Parks, J.H. McClellan, "Chebyshev Approximation for Nonrecursive Digital Filters," *IEEE Trans.*, 1972.

$\min \max_\omega |W(\omega)(H(\omega) - D(\omega))|$ — minimizes peak (worst-case) error.

**Linear phase · equiripple · sharpest cutoff per tap**

```js
let h = remez(63, [0, 0.3, 0.4, 1], [1, 1, 0, 0])
```

**Use when**: tight specs, guaranteed worst-case rejection.<br>
**Not for**: sidelobes must decay (use firwin with window), average error (use firls).<br>
**scipy**: `scipy.signal.remez`. **MATLAB**: `firpm`.

<img src="plot/remez.svg">

### `firwin2(numtaps, freq, gain, opts?)`

Arbitrary magnitude response via frequency sampling. Specify gain at any frequency points.

$H(\omega_k) = G_k$

**Linear phase · any shape**

```js
let h = firwin2(201, [0, 0.1, 0.2, 0.4, 0.5, 1], [0, 0, 1, 1, 0, 0])
```

**Use when**: custom EQ curves, matching measured responses.<br>
**scipy**: `scipy.signal.firwin2`. **MATLAB**: `fir2`.

<img src="plot/firwin2.svg">

### `hilbert(N)`

90° phase shift at unity magnitude. For analytic signal, envelope extraction, SSB modulation, pitch detection.

$h[n] = 2/(\pi n)$ for odd $n$, $0$ for even — ideal Hilbert transformer, windowed.

**Linear phase · zero at DC and Nyquist**

```js
let h = hilbert(65)
```

**Use when**: analytic signal, envelope, instantaneous frequency.<br>
**Not for**: wideband to DC (Hilbert is zero at DC/Nyquist).<br>
**scipy**: `scipy.signal.hilbert` (different – applies to signal, not design).<br>
**MATLAB**: `hilbert` (same caveat).

<img src="plot/hilbert.svg">

### `differentiator(N, opts?)`

FIR derivative with better noise immunity than a first difference.

$h[n] = (-1)^n/n$ windowed.

**Antisymmetric · linear phase**

```js
let h = differentiator(31)
```

**Use when**: rate-of-change, velocity from position, edge detection.<br>
**Not for**: noisy data needing simultaneous smoothing (use savitzkyGolay with derivative:1).

<img src="plot/differentiator.svg">

### `raisedCosine(N, beta?, sps?, opts?)`

Pulse shaping for digital communications (QAM, PSK, OFDM). Zero ISI at symbol centers. `root: true` for matched TX/RX pair.

$h(t) = \text{sinc}(t/T) \cdot \cos(\pi\beta t/T)/(1-(2\beta t/T)^2)$

$\beta$ controls excess bandwidth: 0 = minimum (long ringing), 0.35 = standard, 1 = widest.

```js
let h = raisedCosine(101, 0.35, 8, { root: true })
```

**Use when**: QAM/PSK pulse shaping, SDR baseband.<br>
**MATLAB**: `rcosdesign`.

<img src="plot/raised-cosine.svg">

### `gaussianFir(N, bt?, sps?)`

Gaussian pulse shaping – the standard for GMSK (GSM) and Bluetooth. More spectrally compact than raised cosine at the cost of some ISI.

$h(t) = \exp(-2\pi^2(BT)^2 t^2/T^2)$

```js
let h = gaussianFir(33, 0.3, 4)
```

**Use when**: GMSK/Bluetooth modulation.<br>
**Not for**: ISI-free pulses (use raisedCosine).<br>
**MATLAB**: `gaussdesign`.

<img src="plot/gaussian-fir.svg">

### `matchedFilter(template)`

Optimal detector for a known waveform in white noise – time-reversed, energy-normalized template. Maximizes SNR at detection point; correlating against the template itself peaks at exactly 1.

$h[n] = s[N-1-n] / \|s\|^2$

```js
let h = matchedFilter(template)
let corr = convolution(received, h)
```

**Use when**: radar, sonar, preamble/sync detection.<br>
**Not for**: colored noise (pre-whiten first), unknown template (use adaptive).

<img src="plot/matched-filter.svg">

### `minimumPhase(h)`

Convert linear-phase FIR to minimum-phase via cepstral method. Same magnitude, ~half the delay.

$h_{min} = \text{IFFT}(\exp(\text{hilbert}(\log|H|)))$

```js
let hMin = minimumPhase(firwin(101, 4000, 44100))
```

**Use when**: FIR latency too high, linear phase not required.<br>
**scipy**: `scipy.signal.minimum_phase`.

<img src="plot/minimum-phase.svg">

### `yulewalk(order, frequencies, magnitudes)`

IIR approximation of an arbitrary magnitude response via Yule-Walker method. Returns `{ b, a }`.

$R \cdot a = r$ (Yule-Walker equations from target autocorrelation).

```js
let { b, a } = yulewalk(8, [0, 0.2, 0.3, 0.5, 1], [1, 1, 0, 0, 0])
```

**Use when**: IIR match to target curve. **MATLAB**: `yulewalk`.

<img src="plot/yulewalk.svg">

### `integrator(rule?)`

Newton-Cotes quadrature coefficients. Rules: `rectangular` [1], `trapezoidal` [0.5, 0.5], `simpson` [1/6, 4/6, 1/6], `simpson38` [1/8, 3/8, 3/8, 1/8].

Simpson: $h = [1/6, 4/6, 1/6]$

```js
let h = integrator('simpson')
```

**Use when**: numerical integration of sampled data.

<img src="plot/integrator.svg">

### `lattice(data, params)`

Lattice filter over reflection coefficients (PARCOR). Alternative topology to direct form – each stage is independently stable when $|k_i| < 1$. Params: `k` (reflection coefficients), `type` (`'fir'` analysis/whitening — default, or `'iir'` all-pole synthesis), `v` (ladder/feedforward, optional). `iir` inverts `fir` exactly: `lattice(lattice(x, {k}), {k, type: 'iir'}) === x`.

```js
// Reflection coefficients from levinson LPC analysis
let { k } = levinson(autocorrelation, 12)
let error = lattice(data, { k })     // analysis: whiten to prediction error
lattice(error, { k, type: 'iir' })   // synthesis: rebuild the signal
```

**Use when**: LPC analysis/synthesis, speech coding, adaptive structures.<br>
**Not for**: general filtering (use filter with SOS).<br>
**MATLAB**: `latcfilt`.

<img src="plot/lattice.svg">

### `warpedFir(data, params)`

Frequency-warped FIR – replaces unit delays with allpass delays. Concentrates frequency resolution at low frequencies, matching how the ear perceives pitch. Params: `coefs`, `lambda` (warping factor).

```js
// lambda ≈ 0.7 for 44.1 kHz maps to Bark-like resolution
warpedFir(data, { coefs: new Float64Array([0.5, 0.3, 0.15, 0.05]), lambda: 0.7 })
```

**Use when**: perceptual audio coding, low-order EQ that sounds better than uniform-resolution FIR.<br>
**Not for**: linear phase (warped FIR is not linear phase).

<img src="plot/warped-fir.svg">

### `kaiserord(deltaF, attenuation)`

Estimates how many FIR taps you need and what Kaiser window $\beta$ to use, given your transition width and desired stopband rejection. Feed the result into `firwin`.

```js
// "I need 60 dB rejection with 10% of Nyquist transition width"
let { numtaps, beta } = kaiserord(0.1, 60)
// numtaps ≈ 75, beta ≈ 5.65
let h = firwin(numtaps, 4000, 44100, { window: ['kaiser', beta] })
```

**Use when**: estimating FIR order before designing with firwin.<br>
**scipy**: `scipy.signal.kaiserord`. **MATLAB**: `kaiserord`.

### FIR comparison

| Method | Optimality | Best for | Weakness |
|---|---|---|---|
| `firwin` | Good enough | Quick prototyping, 80% of tasks | Not optimal for tight specs |
| `firls` | Least-squares | Smooth specs, audio | Wider transition than remez |
| `remez` | Minimax | Sharpest transitions, tight specs | Convergence issues at high order |
| `firwin2` | Frequency sampling | Arbitrary shapes, EQ curves | Not formally optimal |

## Smooth

Smoothing and denoising. All operate in-place: `fn(data, params) → data`.

### `onePole(data, params)`

Exponential moving average – the simplest IIR smoother. One multiply, no overshoot. Params: `fc`, `fs`.

$y[n] = (1-a)\,x[n] + a\,y[n-1]$, $a = e^{-2\pi f_c/f_s}$, $H(z) = (1-a)/(1-az^{-1})$

**–6 dB/oct · 1 multiply · IIR**

```js
onePole(data, { fc: 100, fs: 44100 })
```

**Use when**: smoothing control signals, sensor data, parameter changes.<br>
**Not for**: sharp cutoff (use butterworth), preserving peaks (use savitzkyGolay).<br>
**scipy**: `scipy.signal.lfilter([1-a], [1, -a])`. **MATLAB**: `filter(1-a, [1 -a], x)`.

<img src="plot/one-pole.svg">

### `movingAverage(data, params)`

Boxcar average of last N samples. Params: `memory`.

$h[n] = 1/N$ for $n = 0..N-1$, $H(z) = (1 - z^{-N})/(N(1 - z^{-1}))$

**Linear phase · FIR · nulls at multiples of fs/N**

```js
movingAverage(data, { memory: 8 })
```

**Use when**: periodic noise removal, simple averaging.<br>
**Not for**: preserving peaks (use savitzkyGolay).<br>
**MATLAB**: `movmean`.

<img src="plot/moving-average.svg">

### `leakyIntegrator(data, params)`

Exponential decay accumulator. Same as onePole but parameterized by decay factor. Params: `lambda` (0–1).

$y[n] = \lambda\,y[n-1] + (1-\lambda)\,x[n]$

**1 multiply · IIR**

```js
leakyIntegrator(data, { lambda: 0.95 })
```

**Use when**: running average, DC estimation.

<img src="plot/leaky-integrator.svg">

### `savitzkyGolay(data, params)`

Polynomial fit to sliding window – preserves peak height, width, and shape. Also computes smooth derivatives. Savitzky & Golay (1964).[^sg] Params: `windowSize`, `degree`, `derivative`.

[^sg]: A. Savitzky, M.J.E. Golay, "Smoothing and Differentiation of Data," *Analytical Chemistry*, 1964.

Fits polynomial of degree $d$ to window of $2m+1$ samples by least-squares.

**FIR · linear phase · preserves moments up to degree**

```js
savitzkyGolay(data, { windowSize: 11, degree: 3 })
```

**Use when**: spectroscopy, chromatography, peak-sensitive measurement.<br>
**Not for**: frequency-selective filtering, causal/online processing.<br>
**scipy**: `scipy.signal.savgol_filter`. **MATLAB**: `sgolayfilt`.

<img src="plot/savitzky-golay.svg">

### `gaussianIir(data, params)`

Recursive Gaussian (Young-van Vliet). O(1) cost regardless of sigma. Forward-backward for zero phase. Params: `sigma`.

Approximates $h(t) = \exp(-t^2/(2\sigma^2))$ using 3rd-order recursive filter.

**IIR · zero phase (offline) · O(1) per sample**

```js
gaussianIir(data, { sigma: 10 })
```

**Use when**: large-kernel Gaussian smoothing.<br>
**Not for**: exact Gaussian (approximation), causal filtering.

<img src="plot/gaussian-iir.svg">

### `dynamicSmoothing(data, params)`

Self-modulating lowpass – the filter's own band energy opens its cutoff, so it snaps to fast changes and settles glassy-smooth. Simper (2016).[^dynsmooth] Params: `fc` (base cutoff), `sensitivity`, `fs`.

[^dynsmooth]: A. Simper, ["Dynamic Smoothing Using Self Modulating Filter"](https://cytomic.com/files/dsp/DynamicSmoothing.pdf), Cytomic technical paper, 2016.

$g = \min(g_0 + s \cdot |low_1 - low_2|,\ 1)$ — two cascaded one-pole stages sharing the modulated coefficient $g$

**Adaptive · 2 cascaded one-pole stages**

```js
dynamicSmoothing(data, { fc: 1, sensitivity: 1, fs: 44100 })
```

**Use when**: audio parameter smoothing at audio rate.<br>
**Not for**: non-audio rate (use oneEuro).

<img src="plot/dynamic-smoothing.svg">

### `median(data, params)`

Nonlinear – replaces each sample with neighborhood median. Removes impulse noise while preserving edges. Params: `size`.

**Nonlinear · preserves edges · O(N log N) per sample**

```js
median(data, { size: 5 })
```

**Use when**: clicks, pops, sensor outliers, edge-preserving denoising.<br>
**Not for**: frequency-selective filtering (no defined frequency response).<br>
**scipy**: `scipy.signal.medfilt`. **MATLAB**: `medfilt1`.

<img src="plot/median.svg">

### `oneEuro(data, params)`

Adaptive lowpass – cutoff increases with signal speed. Smooth at rest, responsive when moving. Casiez et al. (2012).[^euro] Params: `minCutoff`, `beta`, `dCutoff`, `fs`.

[^euro]: G. Casiez et al., "1€ Filter," *CHI*, 2012.

$f_c(n) = f_{min} + \beta \cdot |\dot{x}[n]|$

**Adaptive · 1st-order IIR with time-varying cutoff**

```js
oneEuro(data, { minCutoff: 1, beta: 0.007, fs: 60 })
```

**Use when**: mouse/touch/gaze input, sensor fusion, UI jitter.<br>
**Not for**: audio-rate processing (use dynamicSmoothing).

<img src="plot/one-euro.svg">

### Smooth comparison

| Filter | Type | Phase | Edge preservation | Adaptive | Best for |
|---|---|---|---|---|---|
| `onePole` | IIR | Nonlinear | No | No | Simplest smoothing |
| `movingAverage` | FIR | Linear | No | No | Periodic noise, simple |
| `leakyIntegrator` | IIR | Nonlinear | No | No | Decay-factor control |
| `median` | Nonlinear | — | Yes | No | Impulse noise, outliers |
| `savitzkyGolay` | FIR | Linear | Yes (peaks) | No | Peak-preserving measurement |
| `gaussianIir` | IIR | Zero (offline) | No | No | Large-kernel smoothing |
| `oneEuro` | IIR | Nonlinear | No | Yes | UI jitter, sensor fusion |
| `dynamicSmoothing` | IIR | Nonlinear | No | Yes | Audio parameter smoothing |

## Adaptive

Filters that learn from a reference signal. Returns filtered output; `params.error` contains error; `params.w` updated in place.

### `lms(input, desired, params)`

Least Mean Squares – stochastic gradient descent. Widrow & Hoff (1960).[^lms] Params: `order`, `mu`.

[^lms]: B. Widrow, M.E. Hoff, "Adaptive Switching Circuits," *IRE WESCON*, 1960.

$\mathbf{w}[n+1] = \mathbf{w}[n] + \mu\,e[n]\,\mathbf{x}[n]$, $e[n] = d[n] - \mathbf{w}^T\mathbf{x}[n]$. Convergence: $0 < \mu < 2/(N\sigma_x^2)$.

**O(N)/sample · slow convergence · very robust**

```js
lms(input, desired, { order: 128, mu: 0.01 })
```

**Use when**: educational, simple implementation.<br>
**Not for**: practice – almost always use nlms instead.<br>
**MATLAB**: `dsp.LMSFilter`.

<img src="plot/lms.svg">

### `nlms(input, desired, params)`

Normalized LMS – step size adapts to input power. The practical default. Params: `order`, `mu` (0–2), `eps`.

$\mathbf{w}[n+1] = \mathbf{w}[n] + \mu\,e[n]\,\mathbf{x}[n] / (\mathbf{x}^T\mathbf{x} + \varepsilon)$. Convergence: $0 < \mu < 2$ regardless of input level.

**O(N)/sample · medium convergence · robust**

```js
nlms(farEnd, microphone, { order: 512, mu: 0.5 })
// params.error = cleaned signal
```

**Use when**: echo cancellation, noise cancellation, system identification. Start here.<br>
**Not for**: fastest convergence (use rls).<br>
**MATLAB**: `dsp.LMSFilter` (normalized mode).

<img src="plot/nlms.svg">

### `rls(input, desired, params)`

Recursive Least Squares – fastest convergence (~2N samples) via inverse correlation matrix. Params: `order`, `lambda`, `delta`.

$\mathbf{w}[n] = \mathbf{w}[n-1] + \mathbf{k}[n] \cdot e[n]$ where $\mathbf{k} = P\mathbf{x}/(\lambda + \mathbf{x}^T P\mathbf{x})$

**O(N²)/sample · fast convergence · fragile if lambda wrong · use for N ≤ 64**

```js
rls(input, desired, { order: 32, lambda: 0.99, delta: 100 })
```

**Use when**: fast-changing systems, short filters.<br>
**Not for**: N > 128 (O(N²) too expensive), robustness matters (use nlms).<br>
**MATLAB**: `dsp.RLSFilter`.

<img src="plot/rls.svg">

### `levinson(R, order?)`

Levinson-Durbin recursion – takes autocorrelation values, returns LPC prediction coefficients. The standard way to compute linear prediction for speech, spectral estimation, and lattice filter coefficients. Returns `{ a, error, k }` (prediction coefficients, prediction error power, reflection coefficients).

Solves $R\mathbf{a} = \mathbf{r}$ recursively (Toeplitz structure gives O(N²) instead of O(N³)).

**O(N²)/block · batch (not real-time)**

```js
// Compute autocorrelation of a speech frame, then solve for LPC coefficients
let R = new Float64Array(13)
for (let lag = 0; lag < 13; lag++)
  for (let i = 0; i < frame.length - lag; i++)
    R[lag] += frame[i] * frame[i + lag]

let { a, error, k } = levinson(R, 12)
// a = prediction coefficients, k = reflection coefficients for lattice
```

**Use when**: LPC analysis, speech coding (CELP, LPC-10), AR spectral estimation.<br>
**Not for**: real-time sample-by-sample adaptation (use nlms/rls).<br>
**MATLAB**: `levinson`.

<img src="plot/levinson.svg">

### Adaptive comparison

| Algorithm | Complexity | Convergence | Tracking | Stability | Best for |
|---|---|---|---|---|---|
| `lms` | O(N)/sample | Slow | Slow | Very robust | Educational |
| `nlms` | O(N)/sample | Medium | Medium | Robust | Real-world default |
| `rls` | O(N²)/sample | Fast (~2N) | Fast | Fragile | Short filters, fast-changing |
| `levinson` | O(N²)/block | Instant (batch) | N/A | Stable | LPC, speech coding |

## Multirate

Change sample rates without aliasing. Anti-alias before decimating, anti-image after interpolating.

### `decimate(data, factor, opts?)`

Anti-alias FIR lowpass + downsample by factor M. Returns shorter `Float64Array`.

$y[m] = (h * x)[mM]$

```js
let down = decimate(data, 4)
```

**Use when**: reducing sample rate, downsampling for analysis.<br>
**scipy**: `scipy.signal.decimate`. **MATLAB**: `decimate`.

<img src="plot/decimate.svg">

### `interpolate(data, factor, opts?)`

Upsample by factor L + anti-image FIR lowpass. Returns longer `Float64Array`.

$y[n] = (h * x_\uparrow)[n]$

```js
let up = interpolate(data, 4)
```

**Use when**: increasing sample rate, upsampling before nonlinear processing.<br>
**scipy**: `scipy.signal.resample_poly`. **MATLAB**: `interp`.

<img src="plot/interpolate.svg">

### `resample(data, p, q, opts?)`

Rational-rate resampling by p/q — upsample, anti-alias/anti-image FIR, downsample in one pass (via `upfirdn`), delay-compensated to sample-exact alignment.

```js
let out = resample(data, 3, 2)   // 44.1k → 66.15k: 1.5× the rate
let cd = resample(data, 160, 147) // 44.1k → 48k
```

**Use when**: converting between arbitrary rational rates.<br>
**scipy**: `scipy.signal.resample_poly`. **MATLAB**: `resample`.

### `upfirdn(data, h, up, down)`

Upsample → FIR → downsample, the general multirate primitive. No intermediate upsampled buffer.

```js
let out = upfirdn(data, h, 3, 2)
```

**scipy**: `scipy.signal.upfirdn`.

### `halfBand(numtaps?)`

Half-band FIR – nearly half the coefficients are zero, halving multiply count. The building block for efficient 2× rate changes.

$h[n] = 0$ for even $n \neq 0$, $h[0] = 0.5$

```js
let h = halfBand(31)
```

**Use when**: efficient 2× decimation/interpolation. Cascade for 4×, 8×.<br>
**Not for**: non-2x rate changes.

<img src="plot/half-band.svg">

### `cic(data, R, N?)`

Cascaded Integrator-Comb – multiplier-free decimation. Only additions and subtractions.

$H(z) = ((1 - z^{-RM})/(1 - z^{-1}))^N$

**Multiplier-free · sinc-shaped passband droop**

```js
let down = cic(data, 8, 3)
```

**Use when**: high decimation ratios (10×–1000×), hardware/FPGA, SDR.<br>
**Not for**: precision (sinc-shaped passband droop needs compensation).<br>
**MATLAB**: `dsp.CICDecimator`.

<img src="plot/cic.svg">

### `polyphase(h, M)`

Decompose FIR into M polyphase components. Compute only the output samples you keep. Returns `Array<Float64Array>`.

$H(z) = \sum_{k=0}^{M-1} z^{-k} E_k(z^M)$

```js
let phases = polyphase(firCoefs, 4)
```

**Use when**: efficient multirate filtering.

<img src="plot/polyphase.svg">

### `farrow(data, params)`

Fractional delay via polynomial interpolation. Delay can change every sample. Params: `delay`, `order`.

$y(d) = \sum_{k=0}^{N} c_k(n) \cdot d^k$

```js
farrow(data, { delay: 3.7, order: 3 })
```

**Use when**: pitch shifting, variable-rate resampling, time-stretching.<br>
**Not for**: fixed delay (use thiran – allpass, preserves all frequencies).

<img src="plot/farrow.svg">

### `thiran(delay, order?)`

Allpass fractional delay – unity magnitude, maximally flat group delay. Returns `{ b, a }`.

$a_k = (-1)^k \binom{N}{k} \prod_{n=0}^{N} (D-N+n)/(D-N+k+n)$

```js
let { b, a } = thiran(3.7)
```

**Use when**: physical modeling synthesis (waveguide strings, tubes).<br>
**Not for**: variable delay per sample (use farrow).

<img src="plot/thiran.svg">

### `oversample(data, factor, opts?)`

Upsampling with a Kaiser anti-image FIR designed from an attenuation spec — the filter length scales with the factor, so rejection holds at any factor. Oversample before nonlinear processing, then decimate back. Params: `attenuation?` (dB, default 70), `numtaps?` (override).

```js
let up = oversample(data, 4)
let hq = oversample(data, 8, { attenuation: 90 })
```

**Use when**: oversampling before distortion/waveshaping/saturation.<br>
**Not for**: integer rate changes (use decimate/interpolate).

<img src="plot/oversample.svg">


## Core

Apply coefficients, analyze responses, convert formats.

### `filter(data, params)`

Applies SOS coefficients to data in-place. Direct Form II Transposed. State persists between calls. Params: `coefs`.

$y[n] = b_0 x[n] + b_1 x[n-1] + b_2 x[n-2] - a_1 y[n-1] - a_2 y[n-2]$

```js
let sos = butterworth(4, 1000, 44100)
let params = { coefs: sos }
filter(block1, params)   // state preserved
filter(block2, params)   // seamless
```

### `iir(data, params)`

Arbitrary-order IIR processing. Direct Form II Transposed with feedforward/feedback coefficient arrays (up to any order). Params: `b` (numerator), `a` (denominator), `state`.

```js
iir(data, { b: [0.1, 0.2, 0.1], a: [1, -0.8, 0.2] })
```

**Use when**: need direct transfer function form (b/a arrays), higher than 2nd order without SOS, Web Audio IIRFilterNode compatibility.

### `filtfilt(data, params)`

Zero-phase forward-backward filtering. Doubles effective order, eliminates phase distortion. Odd-reflection padding + steady-state initial conditions keep the edges transient-free (scipy `sosfiltfilt` semantics). Offline only. Params: `coefs`, `padlen?` (default `3·(2·sections+1)`, `0` disables).

```js
filtfilt(data, { coefs: butterworth(4, 1000, 44100) })
```

### `detrend(data, type?)`

Remove DC offset or linear trend from data in-place. Types: `'linear'` (default), `'constant'`/`'dc'`.

```js
detrend(data)              // remove linear trend
detrend(data, 'constant')  // remove DC offset only
```

**scipy**: `scipy.signal.detrend`. **MATLAB**: `detrend`.

### `convolution(signal, ir)`

Direct convolution. Returns `Float64Array` of length N + M – 1.

$(f * g)[n] = \sum_k f[k]\,g[n-k]$

```js
let out = convolution(signal, firCoefs)
```

### `freqz(coefs, n?, fs?)` · `mag2db(mag)`

Frequency response of an SOS filter or a `{b, a}` transfer function (the shape `yulewalk`/`thiran` return). Returns `{ frequencies, magnitude, phase }`. Second argument can be a number (evenly spaced points) or an array of Hz values.

```js
let resp = freqz(sos, 512, 44100)                  // 512 evenly spaced points
let picked = freqz(sos, [100, 1000, 10000], 44100) // at specific frequencies
let tfResp = freqz(thiran(3.5), 512, 44100)        // {b, a} transfer function
let dB = mag2db(resp.magnitude)                    // 20·log10(mag)
```

### `groupDelay(coefs, n?, fs?)` · `phaseDelay(coefs, n?, fs?)`

$\tau_g = -d\phi/d\omega$ (group delay), $\tau_p = -\phi/\omega$ (phase delay). Returns `{ frequencies, delay }`.

```js
let { frequencies, delay } = groupDelay(sos, 512, 44100)
```

### `impulseResponse(coefs, N?)` · `stepResponse(coefs, N?)`

Time-domain analysis. Returns `Float64Array`.

```js
let ir = impulseResponse(sos, 256)
let step = stepResponse(sos, 256)
```

### `isStable(sos)` · `isMinPhase(sos)` · `isFir(sos)` · `isLinPhase(h)`

Filter property tests.

```js
isStable(sos)     // all poles inside unit circle?
isMinPhase(sos)   // all zeros inside unit circle?
isFir(sos)        // a1=a2=0 (no feedback)?
isLinPhase(h)     // symmetric/antisymmetric coefficients?
```

### `sos2zpk` · `sos2tf` · `tf2zpk` · `tf2sos` · `zpk2sos` · `zpk2tf`

Format conversion between SOS, transfer function (b/a), and zeros/poles/gain.

```js
let { zeros, poles, gain } = sos2zpk(sos)
let { b, a } = sos2tf(sos)
let zpk = tf2zpk(b, a)
let sos2 = zpk2sos(zpk)
let sos3 = tf2sos(b, a)       // shortcut: tf → zpk → sos
let { b: b2, a: a2 } = zpk2tf(zpk)
```

### `tf2ss(b, a)` · `ss2tf(A, B, C, D)`

Transfer function ↔ state-space (controllable canonical form).

```js
let { A, B, C, D } = tf2ss([1, 0.5], [1, -0.8])
let { b, a } = ss2tf(A, B, C, D)
```

**scipy**: `scipy.signal.tf2ss` / `ss2tf`.

### `residue(b, a)`

Partial fraction expansion of $B(z)/A(z)$ over $z^{-1}$: $H(z) = \sum_k r_k/(1 - p_k z^{-1}) + \sum_m k_m z^{-m}$. Simple poles only — repeated poles throw.

```js
let { r, p, k } = residue([1], [1, -1.5, 0.5])
// r: residues, p: poles, k: direct FIR terms
```

**scipy**: `scipy.signal.residuez`. **MATLAB**: `residuez`.

### `matchedZ(poles, zeros, fs, normFreq?)`

Matched-z transform: map analog poles/zeros to digital via $z = e^{sT}$ — an alternative to the bilinear transform that preserves pole frequencies exactly (no warping) at the cost of aliasing the response.

```js
let sos = matchedZ([{re: -1000, im: 8000}], [], 44100, 0)
```

**MATLAB**: `impinvar`-adjacent; classic matched-z from Rabiner & Gold.

### `deconvolve(b, a)`

Polynomial long division — inverse of `convolution`: recover a signal from its convolution with a known kernel.

```js
let { q, r } = deconvolve(convolved, kernel)  // q: quotient, r: remainder
```

**scipy**: `scipy.signal.deconvolve`. **MATLAB**: `deconv`.

### `wiener(data, opts?)`

Local adaptive Wiener denoising — attenuates toward the local mean where the local variance is near the noise floor.

```js
wiener(data, { size: 5 })          // noise power estimated from the signal
wiener(data, { size: 5, noise: 0.01 })
```

**scipy**: `scipy.signal.wiener`. **MATLAB**: `wiener2` (1-D analog).

### `sosfiltZi(sos)`

Compute initial conditions for SOS filter to start in steady state (no transient when input starts at a non-zero value). Scale by the first sample: `zi.map(([a, b]) => [a * x0, b * x0])`.

```js
let sos = butterworth(4, 1000, 44100)
let zi = sosfiltZi(sos)
filter(data, { coefs: sos, state: zi })  // no startup transient for unit-level input
```

### `transform`

Analog prototype → digital SOS pipeline. Used internally by IIR design functions.

```js
transform.polesSos(poles, fc, fs, 'lowpass')
transform.poleZerosSos(poles, zeros, [fLow, fHigh], fs, 'bandpass')
transform.prewarp(fc, fs)  // bilinear frequency prewarping
```


## FAQ

**What does the dB scale mean?** $\text{dB} = 20\log_{10}(\text{ratio})$. 0 dB = unchanged, –3 dB = half power, –6 dB = half amplitude, –20 dB = 10%, –60 dB = 0.1%.

**When does phase matter?** When waveform shape must be preserved: crossovers (drivers must sum correctly), biomedical (ECG/EEG morphology), communications (intersymbol interference). For EQ, phase is usually inaudible.

**What is the bilinear transform?** Maps analog prototypes to digital: $s = (2/T)(z-1)/(z+1)$. All IIR design functions prewarp automatically – the cutoff you specify is the cutoff you get.

**When can a filter become unstable?** When poles move outside the unit circle. Causes: coefficient quantization (use SOS, not direct form), Q approaching 0, feedback gain too high. Check with `isStable(sos)`. FIR is always stable.

**What is aliasing?** Frequencies above $f_s/2$ (Nyquist) fold back as artifacts. `decimate` and `interpolate` handle anti-aliasing automatically.


## Choosing a filter

| I need to… | Use | Notes |
|---|---|---|
| Remove frequencies above/below a cutoff | `butterworth(N, fc, fs)` | Default, flat passband |
| Sharpest possible cutoff | `elliptic(N, fc, fs, rp, rs)` | Minimum order for specs |
| Sharp, passband ripple OK | `chebyshev(N, fc, fs, ripple)` | Steeper than Butterworth |
| Sharp, no ripple anywhere | `legendre(N, fc, fs)` | Between Butterworth and Chebyshev |
| Auto-select family + order | `iirdesign(fpass, fstop, rp, rs, fs)` | From specs |
| Notch out one frequency | `biquad.notch(fc, Q, fs)` | Q=30 for narrow null |
| Boost/cut a band | `biquad.peaking(fc, Q, fs, dB)` | Parametric EQ |
| Split into bands | `linkwitzRiley(4, fc, fs)` | LP+HP sum to flat |
| No ringing/overshoot | `bessel(N, fc, fs)` | Flat group delay |
| No phase distortion | `filtfilt(data, {coefs})` | Zero-phase, offline |
| Smooth a signal | `onePole(data, {fc, fs})` | Simplest |
| Smooth, preserve peaks | `savitzkyGolay(data, {windowSize, degree})` | Polynomial fit |
| Reduce sensor jitter | `oneEuro(data, params)` | Adaptive |
| Cancel echo/noise | `nlms(input, desired, params)` | Start here |
| Quick FIR | `firwin(N, fc, fs, {type})` | Window method |
| Sharp FIR | `remez(N, bands, desired)` | Parks-McClellan |
| Downsample | `decimate(data, factor)` | Anti-alias included |
| Upsample | `interpolate(data, factor)` | Anti-image included |

### IIR family decision tree

```
Linear phase needed?
├── Yes → FIR or filtfilt (offline)
└── No
    Waveform must be preserved?
    ├── Yes → bessel
    └── No
        Passband ripple OK?
        ├── Yes
        │   ├── Stopband ripple also OK? → elliptic
        │   └── Stopband monotonic → chebyshev
        └── No (passband must be flat)
            ├── Stopband ripple OK? → chebyshev2
            └── No ripple anywhere?
                ├── Steepest monotonic? → legendre
                └── Default → butterworth
```


## Recipes

### Hum removal

```js
for (let f of [60, 120, 180]) filter(data, { coefs: biquad.notch(f, 30, 44100) })
```

### Echo cancellation

```js
let params = { order: 512, mu: 0.5 }
nlms(farEnd, microphone, params)
// params.error = cleaned signal
```

### ECG filtering

```js
filter(data, { coefs: butterworth(2, 0.5, 500, 'highpass') })  // baseline wander
filter(data, { coefs: butterworth(4, 40, 500) })                 // noise
filter(data, { coefs: biquad.notch(50, 35, 500) })               // powerline
```

### Pulse shaping

```js
let htx = raisedCosine(101, 0.35, 8, { root: true })
let shaped = convolution(symbols, htx)
```

### EEG band extraction

```js
let fs = 256
let delta = butterworth(4, [0.5, 4], fs, 'bandpass')   // deep sleep
let theta = butterworth(4, [4, 8], fs, 'bandpass')      // drowsiness
let alpha = butterworth(4, [8, 13], fs, 'bandpass')     // relaxed, eyes closed
let beta  = butterworth(4, [13, 30], fs, 'bandpass')    // active thinking

let signal = Float64Array.from(data)
filter(signal, { coefs: alpha })
// Band power:
let power = 0
for (let i = 0; i < signal.length; i++) power += signal[i] ** 2
power /= signal.length
```

### LPC analysis

```js
// Autocorrelation → LPC coefficients → lattice synthesis
let order = 12, R = new Float64Array(order + 1)
for (let k = 0; k <= order; k++)
  for (let i = 0; i < frame.length - k; i++)
    R[k] += frame[i] * frame[i + k]

let { a, k } = levinson(R, order)
// k = reflection coefficients, use with lattice() for synthesis
// a = prediction coefficients, use with iir() for inverse filtering
```

### Karplus-Strong string

Uses `comb` from the companion [audio-filter](https://github.com/audiojs/audio-filter) package (not part of digital-filter):

```js
import { comb } from 'audio-filter'          // external package
import { onePole } from 'digital-filter'

let delay = Math.round(44100 / 440)  // A4
let data = new Float64Array(44100)
for (let i = 0; i < delay; i++) data[i] = Math.random() * 2 - 1
comb(data, { delay, gain: 0.996, type: 'feedback' })
onePole(data, { fc: 4000, fs: 44100 })
// delay sets pitch, gain ≈ 1 = long sustain, lower fc = duller (nylon)
```


## Pitfalls

- **FIR when IIR suffices** – Butterworth order 4: 10 multiplies. Equivalent FIR: 100+.
- **High order when elliptic works** – elliptic 4 ≈ Butterworth 12. Use `iirdesign`.
- **Forgetting SOS** – never use high-order direct form. This library returns SOS by default.
- **filtfilt in real-time** – needs entire signal for backward pass.
- **LP+HP for crossover** – doesn't sum flat. Use `linkwitzRiley`.
- **Q too high** – Q > 10 creates tall resonance. For EQ: 0.5–8.
- **In-place** – `filter()` modifies data. Copy first: `Float64Array.from(data)`.
- **Stale state** – state persists in params. New signal → new params.


## Plot generation

Generate 4-panel SVG plots (magnitude, phase, group delay, impulse response) for any filter. Used internally for this readme's illustrations; available for downstream packages like [audio-filter](https://github.com/audiojs/audio-filter).

```js
import { plotFilter, plotFir, plotCompare, theme } from 'digital-filter/plot'
import { writeFileSync } from 'node:fs'

// SOS filter → SVG string
writeFileSync('my-filter.svg', plotFilter(sos, 'Butterworth order 4, fc=1kHz'))

// Impulse response → SVG string
writeFileSync('my-fir.svg', plotFir(h, 'firwin lowpass, 63 taps'))

// Compare multiple filters overlaid
writeFileSync('comparison.svg', plotCompare([
  ['Butterworth', butterworth(4, 1000, 44100)],
  ['Chebyshev', chebyshev(4, 1000, 44100, 1)],
], 'IIR comparison, fc=1kHz'))
```

**`plotFilter(sos, title?, opts?)`** – SOS (biquad cascade) → 4-panel SVG.
**`plotFir(h, title?, opts?)`** – impulse response array → 4-panel SVG.
**`plotCompare(filters, title?, opts?)`** – multiple SOS overlaid → 4-panel SVG. `filters`: array of `[name, sos]` or `[name, sos, color]`.

Options: `{ fs, bins, color, fill }`. Defaults from `theme`.

**`theme`** – mutable object controlling defaults:

```js
theme.colors = ['#4a90d9', '#e74c3c', '#2ecc71']  // per-panel or per-series
theme.fill = true      // fill under curves
theme.fs = 44100
theme.bins = 2048      // FFT bins
theme.grid = '#e5e7eb' // grid line color
theme.axis = '#d1d5db' // axis color
theme.text = '#6b7280' // label color
```

Regenerate all plots: `npm run plot`

## References

**Textbooks**
- Oppenheim & Schafer, *Discrete-Time Signal Processing*, 3rd ed, 2009 – the canonical DSP textbook
- J.O. Smith III, [*Introduction to Digital Filters*](https://ccrma.stanford.edu/~jos/filters/) – free, audio-focused
- Zolzer, *DAFX: Digital Audio Effects*, 2nd ed, 2011 – audio effects
- Haykin, *Adaptive Filter Theory*, 5th ed, 2014 – LMS, RLS, Kalman
- Zavalishin, [*The Art of VA Filter Design*](https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.2.pdf) – virtual analog, SVF, ZDF

**Papers & standards**
- [RBJ Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/) (W3C Note, 1998) – biquad coefficient formulas[^rbj]
- Butterworth, "On the Theory of Filter Amplifiers," 1930[^bw]
- Thomson, "Delay Networks Having Maximally Flat Frequency Characteristics," 1949[^thomson]
- Papoulis, "Optimum Filters with Monotonic Response," 1958[^papoulis]
- Cauer, *Synthesis of Linear Communication Networks*, 1958[^cauer]
- Parks & McClellan, "Chebyshev Approximation for Nonrecursive Digital Filters," 1972[^pm]
- Linkwitz, "Active Crossover Networks for Noncoincident Drivers," 1976[^lr]
- Widrow & Hoff, "Adaptive Switching Circuits," 1960[^lms]
- Savitzky & Golay, "Smoothing and Differentiation of Data," 1964[^sg]
- Casiez et al., "1€ Filter," CHI, 2012[^euro]
- Simper, "Linear Trapezoidal Integrated SVF," Cytomic, 2011

**Online**
- [ccrma.stanford.edu/~jos](https://ccrma.stanford.edu/~jos/) – J.O. Smith's 4 DSP books (free)
- [earlevel.com](https://www.earlevel.com/main/) – biquad tutorials (Nigel Redmon)
- [musicdsp.org](https://www.musicdsp.org/) – audio DSP snippet archive
- [dsprelated.com](https://www.dsprelated.com/) – DSP community and free books

## See also

- **[audio-filter](https://github.com/audiojs/audio-filter)** – weighting, EQ, synthesis, measurement, effects
- **[window-function](https://github.com/scijs/window-function)** – collection of window functions
