//===================================================================
// Alternating Current Waveform Library
// Core classes and functions to represent and work with AC waveforms.
// Copyright 2014-2016 Jeffrey Yeo. All rights reserved.
//===================================================================
(function (ACWF, undefined) {

	//===================================================================
	// Options for AC Waveform library.
	ACWF.defaultOptions = {
		// Defines unit styles. These options are used to set line
		// styles for units shown on the plots.
		unitStyles: [
			{ name: "Voltage", style: { width: 2, isDashed: false } },
			{ name: "Current", style: { width: 2, isDashed: true } }
		],
		// Defines style variations for phases. Each phase is shown
		// in a different color. These colors are "added" to the
		// unit styles.
		// colors from 
		phaseStyles: [
			{ name: "1", style: { color: "#AA4644" } },
			{ name: "2", style: { color: "#89A54E" } },
			{ name: "3", style: { color: "#4573A7" } },
			{ name: "4", style: { color: "#93A9D0" } },
			{ name: "5", style: { color: "#D09392" } }
		],
		waveform: {
			cycleHighlightColor: "rgba(180,180,180,0.2)",
			showRms: true
		},
		phasor: {
			showGrid: true
		},
		harmonics: {
			// Some chart libs don't behave nicely with large numbers of bars.
			// Limit things for now to ensure nice behaviour.
			limit: 31,
			// First harmonic doesn't contain useful information when plotting
			// percent harmonics (it will always be 100%).
			showFirst: false
		},
		// Labels used in the plots. Localize the plot text with
		// these settings.
		labels: {
			percentHarmonic: "% of Fundamental",
			harmonicPlotTitle: "Harmonics",
			waveformPlotTitle: "Waveforms",
			dragToZoom: "Drag to zoom",
			restoreZoom: "Click to zoom out",
			noData: "No Data"
		}
	};

	// Sampling frequency to pass into the Fourier Transform.
	// The actual sampling frequency is not used in ACWF at the
	// moment. The default value (1920) is 32 samples / cycle at 60 Hz.
	ACWF.SAMPLING_FREQUENCY = 1920;

	//===================================================================
	// Represents an AC waveform as samples, harmonic spectrum,
	// and a phasor.
	ACWF.Waveform = function (samples, label) {
		// Samples of this waveform.
		this.samples = iterable(samples);
		// Label of this waveform.
		this.label = (label) ? label : "";

		// RMS value of the waveform.
		var rms = null;
		this.getRms = function () {
			if (rms === null) {
				computeValues(this.samples);
			}
			return rms;
		};

		// Peak value of waveform samples, which is the largest absolute sample value.
		var peak = null;
		this.getPeak = function () {
			if (peak === null) {
				computeValues(this.samples);
			}
			return peak;
		};

		function computeValues(samples) {
			rms = 0;
			peak = 0;
			values = computePeakAndRms(samples);
			peak = values.peak;
			rms = values.rms;
		}

	};

	//===================================================================
	// Performs frequency domain analysis of the waveform.
	// Optional samples argument allows the caller to specify a custom
	// sample set for analysis. It will "inherit" some information from
	// the complete ACWF.Waveform instance.
	ACWF.WaveformAnalyzer = function (samples, label) {
		samples = samples || [0];
		label = label || "";
		var rms = 0;
		var spectrum = iterable([]);
		var phasor = null;
		var rmsSamples = iterable([]);

		// Perform spectral analysis.
		(function () {
			var values = computePeakAndRms(samples);
			rms = values.rms;
			// We're not using sampling frequency for anything at the moment.
			// Rather than forcing clients to provide this we'll just use
			// a fixed value for now and figure out how to add this in later.
			// 1920 is 32 samples / cycle at 60 Hz.
			var fft = new DFT(samples.length, ACWF.SAMPLING_FREQUENCY);
			fft.forward(samples);
			spectrum = iterable(fft.spectrum);
			var angle = computePhaseAngle(fft.real[1], fft.imag[1]);
			// More useful/expected to use the RMS value for the magnitude.
			// This is the value that is typically used when thinking of the magnitude.
			phasor = new ACWF.Phasor(rms, angle, label);
		})();

		// Returns the RMS value for the waveform.
		this.getRms = function () {
			return rms;
		};

		// Returns the frequency spectrum for the waveform.
		this.getSpectrum = function () {
			return spectrum;
		};

		// Returns the phasor for this waveform.
		this.getPhasor = function () {
			return phasor;
		}

		// Returns the harmonic spectrum for the waveform.
		// The data format is an array of arrays. Each inner array has
		// two elements: the harmonic number and the value.
		// Example: [ [1, H1], [2, H2] ]
		this.getHarmonics = function () {
			var harmonics = [];
			spectrum.forEach(function (v, i) {
				// Could do this a couple of ways but this one is compatible with
				// jqPlot and is as good as any other.
				harmonics.push([i, v]);
			});
			return harmonics;
		};

		this.getThd = function () {
			var sumOfSquares = 0;
			var fundamental = 1;
			spectrum.forEach(function (v, i) {
				if (i == 0) return; // THD doesn't count H0
				if (i == 1) {
					fundamental = v;
				} else {
					sumOfSquares += v * v;
				}
			});
			var thd = Math.sqrt(sumOfSquares) / fundamental;
			return thd;
		}

	};

	//===================================================================
	// Class representing a phasor having a magnitude and angle.
	ACWF.Phasor = function (magnitude, angle, label) {
		// Magnitude of the phasor.
		this.magnitude = magnitude;
		// Angle of the phasor in radians.
		this.angle = angle;
		// Label that identifies the phasor.
		this.label = (label) ? label : "";

		// Returns the angle of the phasor in radians relative
		// to the given reference angle in radians.
		this.relative = function (reference) {
			if (reference instanceof ACWF.Phasor) {
				return this.angle - reference.angle;
			}
			else {
				return this.angle - reference;
			}
		};

	};

	ACWF.Phasor.prototype.toString = function () {
		return "Phasor " + this.label + ": " + this.magnitude + " @ " + rad2deg(this.angle) + " deg";
	};


	//=========================================================
	// Defines plot styles and applies them selectively.
	// It will only apply the style if the property has been set.
	// This allows multiple plot styles to be combined.
	ACWF.PlotStyle = function (defn) {
		this.color = null;
		this.width = null;
		this.isDashed = null;

		if (defn) {
			for (var opt in defn) {
				switch (opt) {
					case "color":
						this.color = defn[opt];
						break;
					case "width":
						this.width = defn[opt];
						break;
					case "isDashed":
						this.isDashed = defn[opt];
						break;
					default:
						break;
				}
			}
		}

		this.setColor = function (color) {
			if (color) {
				this.color = color;
			}
			return this;
		};

		this.setWidth = function (width) {
			if (width) {
				this.width = width;
			}
			return this;
		};

		this.setDashed = function (isDashed) {
			if (isDashed === true) {
				this.isDashed = true;
			}
			else {
				this.isDashed = false;
			}
			return this;
		};

		this.reset = function () {
			this.color = null;
			this.width = null;
			this.isDashed = null;
			return this;
		};

		this.apply = function (context) {
			if (this.color) {
				context.strokeStyle = this.color;
				context.fillStyle = this.color;
			}
			if (this.width) {
				context.lineWidth = this.width;
			}
			// new feature that may not be available in all browsers
			if (context.setLineDash) {
				if (this.isDashed != null) {
					var setting = this.isDashed ? [5] : [];
					context.setLineDash(setting);
				}
			}
			return this;
		};

		this.clone = function (other) {
			this.color = other.color;
			this.width = other.width;
			this.isDashed = other.isDashed;
			return this;
		};

		this.store = function (context) {
			this.color = context.strokeStyle;
			this.width = context.lineWidth;
			if (context.getLineDash) {
				this.isDashed = context.getLineDash().length > 0;
			}
			return this;
		};

		this.getBorderStyle = function () {
			var style = "";
			if (this.width) {
				// if width not set we won't have a border :)
				style += this.width + "px ";
			}
			style += this.isDashed ? "dashed " : "solid ";
			if (this.color) {
				style += this.color + " ";
			}
			style += ";"
			return style;
		};

		this.default = function () {
			this.color = "black";
			this.width = 1;
			this.isDashed = false;
		};
	};

	//=========================================================
	// Manages a set of waveforms to be plotted. Tracks scales
	// by unit (voltage, current, etc.) and plot type (peak and RMS).
	// Tracks line styles by unit. Tracks colors by phase.
	ACWF.WaveformSet = function (_samplesPerCycle) {
		if (_samplesPerCycle === undefined) {
			throw "Samples per cycle must be provided.";
		}
		var samplesPerCycle = _samplesPerCycle;
		var waveforms = iterable([]);
		var unitStyles = [];
		var unitScales = new ACWF.Scaler();
		var phaseColors = [];
		var rmsData = iterable([]);

		// Returns the waveform at the given index.
		this.waveform = function (index) {
			return waveforms[index];
		};

		this.rmsData = function (index) {
			return rmsData[index];
		};

		// Returns the phasor for the waveform at the given index.
		// If analyze() has not been called will return undefined.
		this.phasor = function (index) {
			var wf = this.waveform(index);
			if (wf && wf.analysis) {
				return wf.analysis.getPhasor();
			}
		}

		this.getSamplesPerCycle = function () {
			return samplesPerCycle;
		};

		// Adds a base style for the unit.
		this.addUnitStyle = function (unit, style) {
			unitStyles[unit] = style;
			return this;
		};

		// Adds a phase color.
		this.addPhaseColor = function (phase, color) {
			phaseColors[phase] = color;
			return this;
		};

		// Adds a waveform to the set along with its unit and phase.
		this.addWaveform = function (waveform, unit, phase) {
			// add some properties for later use
			waveform.unit = unit;
			waveform.phase = phase;
			waveforms.push(waveform);
			setUnitScales(waveform, unit);
			return this;
		};

		this.computeRms = function () {
			waveforms.forEach(function (wf) {
				rms = ACWF.getSlidingRms(wf.samples, samplesPerCycle);
				var rmswf = new ACWF.Waveform(rms, wf.label + " RMS");
				rmswf.unit = wf.unit;
				rmswf.phase = wf.phase;
				rmsData.push(rmswf);
			});
			return this;
		}

		// Performs a spectral analysis of once cycle of the waveform,
		// starting with the specified first sample.
		// This makes the phasor and harmonic series data available.
		this.analyze = function (firstSample) {
			firstSample = firstSample || 0;
			waveforms.forEach(function (waveform) {
				var lastSample = firstSample + samplesPerCycle;
				// Prevent us from walking off the end of the data.
				if (lastSample >= waveform.samples.length) {
					lastSample = waveform.samples.length;
					firstSample = lastSample - samplesPerCycle;
				}
				var samplesToAnalyze = waveform.samples.slice(firstSample, lastSample);
				waveform.analysis = new ACWF.WaveformAnalyzer(samplesToAnalyze, waveform.label);
			});
			return this;
		};

		// Updates the scale value for the unit based on the waveform values.
		function setUnitScales(waveform, unit) {
			unitScales.setScale(unit, waveform.getPeak());
		}

		// Given a waveform determines the plot style
		function getPlotStyle(waveform) {
			var style = unitStyles[waveform.unit];
			if (style && style instanceof ACWF.PlotStyle) {
				style = new ACWF.PlotStyle().clone(style);
			}
			else {
				style = new ACWF.PlotStyle().default();
			}
			var phaseColor = phaseColors[waveform.phase];
			style.setColor(phaseColor);
			return style;
		}

		// Calls the iterator with scale in turn,
		// passing the unit name and peak scale value.
		this.iterateScales = function (iterator) {
			unitScales.forEach(iterator);
		};

		// Calls the iterator function with each waveform in turn,
		// also passing its style and phase scale name.
		this.iterateWaveforms = function (iterator) {
			waveforms.forEach(function (waveform) {
				var style = getPlotStyle(waveform);
				var scaleName = waveform.unit;
				if (!scaleName) scaleName = "default";
				iterator(waveform, style, scaleName);
			});
		};

		// Calls the iterator function with each waveform in turn,
		// also passing its style and phase scale name.
		this.iterateRms = function (iterator) {
			rmsData.forEach(function (rms) {
				var style = getPlotStyle(rms);
				var scaleName = waveform.unit;
				if (!scaleName) scaleName = "default";
				iterator(rms, style, scaleName);
			});
		};

		// Calls the iterator function with each phasor in turn,
		// also passing its style and phase scale name.
		this.iteratePhasors = function (iterator) {
			waveforms.forEach(function (waveform) {
				if (waveform.analysis) {
					var style = getPlotStyle(waveform);
					var info = {
						unit: waveform.unit || "default",
						phase: waveform.phase || -1
					};
					var scaleName = waveform.unit;
					if (!scaleName) scaleName = "default";
					iterator(waveform.analysis.getPhasor(), style, info);
				}
			});
		}

		// Calls the iterator function with each harmonic series in turn,
		// also passing the label, style, and unit.
		this.iterateHarmonics = function (iterator) {
			waveforms.forEach(function (waveform) {
				if (waveform.analysis) {
					var style = getPlotStyle(waveform);
					var unit = waveform.unit || "Default";
					iterator(waveform.label, waveform.analysis.getHarmonics(), style, unit);
				}
			});
		};
	};

	ACWF.WaveformSet.create = function (waveformData, options) {
		var waveformSet = new ACWF.WaveformSet(waveformData.samplesPerCycle);
		options = options || ACWF.defaultOptions;
		// Add base unit styles.
		for (var item in options.unitStyles) {
			var styleDefn = options.unitStyles[item];
			var style = new ACWF.PlotStyle(styleDefn.style);
			waveformSet.addUnitStyle(styleDefn.name, style);
		}
		// Add phase variation styles.
		for (var item in options.phaseStyles) {
			var styleDefn = options.phaseStyles[item];
			var style = new ACWF.PlotStyle(styleDefn.style);
			waveformSet.addPhaseColor(styleDefn.name, style.color);
		}
		// Add waveform data.
		for (var i = 0; i < waveformData.data.length; i++) {
			var data = waveformData.data[i];
			waveformSet.addWaveform(new ACWF.Waveform(data.samples, data.label), data.unit, data.phase);
		}
		
		// Get ready to show RMS trace if configured
		if (options.waveform.showRms) {
			waveformSet.computeRms();
		}
		return waveformSet;
	};

	//===================================================================
	// Tracks the largest value set for a given named scale.
	ACWF.Scaler = function () {
		var scales = [];

		// Updates the named scale value.
		this.setScale = function (name, value) {
			var scale = value;
			if (scales[name]) {
				scale = scales[name];
				scale = Math.max(scale, value);
			}
			scales[name] = scale;
		};

		// Returns the named scale value. If the scale value is not found
		// returns the defaultValue. If no default value is given returns
		// undefined.
		this.getScale = function (name, defaultValue) {
			var scale = defaultValue;
			if (scales[name]) {
				scale = scales[name];
			}
			return scale;
		};

		// Iterates over each scale value and calls the iterator with the
		// scale name and the scale value.
		this.forEach = function (iterator) {
			for (var name in scales) {
				iterator(name, scales[name]);
			}
		};

	};

	//===================================================================
	// Transforms raw magnitude-based harmonic data to suit different
	// visualizations.
	ACWF.HarmonicTransform = function (harmonics) {
		this.harmonics = harmonics;

		// Transforms the harmonic spectrum based on the operations
		// described in the parameter object.
		this.transform = function (operation) {
			for (var op in operation) {
				switch (op) {
					case "remove":
						this.remove(operation[op]);
						break;
					case "percentOf":
						this.percentOf(operation[op]);
						break;
					case "limit":
						this.limit(operation[op]);
						break;
					case "label":
						this.label(operation[op]);
					default:
						break;
				}
			}
			// Enable chaining.
			return this;
		};

		this.limit = function (maxN) {
			if (typeof maxN !== "number" || maxN < 0) return;
			var limited = [];
			for (var i = 0, c = this.harmonics.length; i < c; i++) {
				var data = this.harmonics[i];
				if (data[0] > maxN) break;
				limited.push(data);
			}
			this.harmonics = limited;
			return this;
		};

		this.largest = function () {
			var largest = [-1, 0];
			for (var n in this.harmonics) {
				var data = this.harmonics[n];
				if (data[1] > largest[1]) {
					largest = data;
				}
			}
			return largest;
		};

		// Removes zero or more harmonic frequency values from the spectrum.
		this.remove = function (list) {
			for (var i = 0; i < list.length; i++) {
				var toRemove = list[i];
				var temp = [];
				for (var n in this.harmonics) {
					var data = this.harmonics[n];
					if (data[0] != toRemove) {
						temp.push(data);
					}
				}
				this.harmonics = temp;
			}
			return this;	// enable chaining
		};

		// Updates all harmonic frequency values in the spectrum so that they
		// are a percentage of the reference harmonic number.
		this.percentOf = function (reference) {
			var referenceHarmonic = findHarmonic(reference, this.harmonics);
			if (referenceHarmonic) {
				var referenceValue = referenceHarmonic[1];
				if (referenceValue && referenceValue != 0) {
					for (var n in this.harmonics) {
						this.harmonics[n][1] = 100 * this.harmonics[n][1] / referenceValue;
					}
				}
			}
			return this;
		};

		// Changes the "label" of the harmonic from a number
		// to some other text. Format: { i: harmonic, label: "label" }
		this.label = function(labelDef) {
			labelDef = iterable(labelDef);
			var me = this;
			labelDef.forEach(function(def) {
				var harmonic = findHarmonic(def.i, me.harmonics);
				if (harmonic && def.label && def.label.length > 0) {
					harmonic[0] = def.label;
				}
			});
			return this;
		};

		// Finds the n-th harmonic in the given spectrum.
		// If not found returns undefined.
		function findHarmonic(n, harmonics) {
			for (var i = 0, c = harmonics.length; i < c; i++) {
				var data = harmonics[i];
				if (data[0] == n) return data;
			}
		}

	};

	ACWF.HarmonicTransform.batch = function (arrayOfHarmonicSeries, operations) {
		var results = [];
		for (var i = 0; i < arrayOfHarmonicSeries.length; i++) {
			var ht = new ACWF.HarmonicTransform(arrayOfHarmonicSeries[i]);
			ht.transform(operations);
			results.push(ht.harmonics);
		}
		return results;
	};

	//===================================================================
	// Computes a sliding RMS value based on the given samples.
	ACWF.getSlidingRms = function (samples, samplesPerCycle) {
		if (!samplesPerCycle) {
			samplesPerCycle = ACWF.estimateSamplesPerCycle(samples);
		}
		var lastCycleStart = samples.length - samplesPerCycle;
		var rmsSeries = [];
		for (var i = 0; i < samples.length; i++) {
			if (i >= lastCycleStart) {
				// append nulls to the values so the number of 
				// samples remains the same
				rmsSeries.push(null);
				continue;
			}
			var cycleSamples = samples.slice(i, i + samplesPerCycle);
			var analyzer = new ACWF.WaveformAnalyzer(cycleSamples);
			var rms = analyzer.getRms();
			rmsSeries.push(rms);
		}
		return rmsSeries;
	};

	//===================================================================
	// Converts degrees to radians.
	ACWF.deg2rad = function deg2rad(deg) {
		var rad = (deg * Math.PI) / 180;
		return rad;
	};

	//===================================================================
	// Converts radians to degrees.
	ACWF.rad2deg = function rad2deg(rad) {
		var deg = (rad * 180) / Math.PI;
		if (deg > 180) {
			deg = deg - 360;
		} 
		if (deg < -180) {
			deg = deg + 360;
		}
		return deg;
	};

	//===================================================================
	// Given the total number of samples and the number of samples per
	// cycle, computes the range of zero-based starting index values that
	// would include a complete cycle.
	ACWF.getWaveformCycleRange = function (totalNumberOfSamples, samplesPerCycle) {
		var max = totalNumberOfSamples - samplesPerCycle;
		max = Math.max(0, max);
		var range = [0, max];
		return range;
	};

	//===================================================================
	// Provides a forEach method on the given object that
	// iterates over the object.
	function iterable(obj) {
		if (!obj.forEach)
			obj.forEach = function (iterator) {
				var i, n = this.length;
				for (i = 0; i < n; i++)
					iterator(this[i], i, n);
			};
		return obj;
	}
	// Expose it for external use
	ACWF.iterable = iterable;

	//===================================================================
	// Given the real and imaginary portions, computes the phase angle in radians.
	function computePhaseAngle(real, imag) {
		return Math.atan2(real, imag);
	}

	//===================================================================
	// Computes the RMS (root mean square) value for the given samples.
	function computePeakAndRms(samples) {
		var peak = 0;
		var sumOfSquares = 0;
		samples = iterable(samples);
		samples.forEach(function (v) {
			peak = Math.max(peak, Math.abs(v));
			sumOfSquares += (v * v);
		});
		var rms = Math.sqrt(sumOfSquares / samples.length);
		return { peak: peak, rms: rms };
	}
	ACWF.computePeakAndRms = computePeakAndRms;

	//===================================================================
	// Estimates the samples per cycle by performing a harmonic analysis
	// and looking for the largest harmonic value. This assumes that the
	// fundamental frequency will be the largest contributor to the
	// waveform and that the samples contain one or more waveforms.
	function estimateSamplesPerCycle(samples) {
		var analyzer = new ACWF.WaveformAnalyzer(samples);
		var transform = new ACWF.HarmonicTransform(analyzer.getHarmonics());
		var largest = transform.largest();
		var samplesPerCycle = samples.length;
		if (largest[0] > 0) {
			samplesPerCycle = samples.length / largest[0];
		}
		return samplesPerCycle;
	}
	ACWF.estimateSamplesPerCycle = estimateSamplesPerCycle;

	//===================================================================
	// Make sure that we have a keys method.
	if (!Object.keys) {
		Object.keys = function (obj) {
			var keys = [],
				k;
			for (k in obj) {
				if (Object.prototype.hasOwnProperty.call(obj, k)) {
					keys.push(k);
				}
			}
			return keys;
		};
	}

})(window.ACWF = window.ACWF || {});
