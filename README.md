# ACWF.js
 
 ACWF.js is an analysis library for alternating current waveforms. 

 Alternating current (AC) waveforms (WF) carry three-phase electrical power
 to commercial and industrial customers. The library was written with the 
 intent of providing visualizations of waveforms and analysis results 
 using charts and plots. There are a number of standard JavaScript charting 
 libraries available that can handle displaying waveforms and harmonics; 
 jqPlot and jqChart are typical examples. There did not seem to be any that 
 included a chart type suitable for a phasor diagram. ACWF.js includes a 
 simple HTML5 canvas phasor diagram plotting component.

## USAGE

### Basic Phasor Plot

[sample.html](sample.html)

    <html>
    <head>
    <script type="text/javascript" src="dsp.js"></script>
    <script type="text/javascript" src="acwf-core.js"></script>
    <script type="text/javascript" src="acwf-canvas.js"></script>
    <script type="text/javascript" src="sample-data.js"></script>
    </head>
    <body>
    	<div id="phasor" style="width:400px;height:400px" />
    <script>
    	// generate a waveform set from the source data; this can contain multiple 
		// series of waveform data that contain multiple cycles of wavefom samples.
    	var wfSet = ACWF.WaveformSet.create(sampleData);
    	// analyze a cycle of data starting at the specified sample 
    	wfSet.analyze(0);
    	// initialize the phasor plot to display itself inside the element
    	// with id="phasor"
    	var phasor = new ACWF.PhasorDiagram("phasor");
    	// plot the waveform data
    	phasor.plotWaveformSet(wfSet, 0);
    </script>
    </body>
	</html>

### Input Data Format

	var dataFormat = {
		title: "My Waveform",
		samplesPerCycle: 32,
		lineFrequency: 60,
		// data is an array of waveform data objects
		data: [
			{
				// Samples for one or more complete cycles.
				samples: [0, 58.52, 114.80, 166.67, 212.13, 249.44, 277.16, ...],
				label: "V1",		// Label used to identify channel.
				unit: "Voltage",	// Unit is used to scale groups of similar waveforms.
				phase: "1"		// Phase is used to color waveforms.
			},
			{
				samples: [300.00, 294.23, 277.16, 249.44, 212.13, 166.67, 114.80, ...],	
				label: "I1",
				unit: "Current",
				phase: "1"
			}
		]
	};

### Options
Some of the plotting functions take an options argument. If no argument is provided
these default values are used. 

	var acwfOptions = {
		// Defines unit styles. These options are used to set line
		// styles for units shown on the plots.
		unitStyles: [
			{ name: "Voltage", style: { width: 1, isDashed: false } },
			{ name: "Current", style: { width: 1, isDashed: true } }
		],
		// Defines style variations for phases. Each phase is shown
		// in a different color. These colors are "added" to the
		// unit styles.
		phaseStyles: [
			{ name: "1", style: { color: "red" } },
			{ name: "2", style: { color: "blue" } },
			{ name: "3", style: { color: "green" } }
		]
	};

### Phasor Data
Phasors are represented by the `ACWF.Phasor` class. It has three properties:

 - magnitude
 - angle
 - label

Note that the angle property is in radians.

### Harmonic Data
Harmonics are represented by an array of two-dimensional arrays. The inner
array contains the harmonic number as the first value and the harmonic RMS
magnitude as the second value. 

	var harmonicData = [
		[0, 0],		// 0th harmonic = DC offset if any
		[1, 26],	// 1st harmonic = fundamental
		[2, 0],
		[3, 4]		
	];


## Classes

### acwf-core.js
Core classes for waveform representation and analysis.

- ACWF.Waveform

    Represents a waveform, exposing an array of samples and a label. Performs
    RMS and peak analysis on the waveform.

- ACWF.WaveformAnalyzer

    Performs a spectral analysis on a set of samples. Provides RMS, frequency
    spectrum, phasor, harmonics and THD.     

- ACWF.Phasor
    
    As described above, represents a phasor for an AC waveform. Provides 
    magnitude, phase angle in radians, and a label.

- ACWF.WaveformSet

    Contains one or more ACWF.Waveform objects. Manages scales for the various
    waveform units (i.e. voltage, current). Provides iterator methods for ease
    of access to waveform analysis results. 

- ACWF.PlotStyle
    
    Waveforms in a set are often related, and when plotting waveform data it
    is helpful to use a consistent set of colors and line styles. The PlotStyle 
    class represents the settings used to plot a specific waveform, but also
    allows altering the plot style to represent different but related waveforms.
    For example perhaps voltage waveforms are solid with a different color for
    each phase. The base line style can be defined and then a new plot style 
    created that differs only by color.   

### acwf-canvas.js
Renders phasor plots using HTML5 canvas. 

- ACWF.PhasorCanvas

    Draws a phasor diagram onto a canvas element. The constructor takes an id 
    for a div that will be used to contain the canvas. This class only performs
    the drawing steps based on a data structure containing descriptions of the
    drawing elements that make up a phasor diagram. The data structure is 
    generated by the ACWF.PhasorEngine class; both these classes must be used
    to produce a phasor diagram.

- ACWF.PhasorEngine

    Given a set of ACWF.Phasor objects, generates drawing instructions for use
    by ACWF.PhasorCanvas. This approach allows the phasor engine to be unit
    tested.  

- ACWF.PhasorDiagram

    A facade class that provides a single class to generate a phasor diagram. 
    Makes use of the ACWF.PhasorEngine and ACWF.PhasorCanvas classes to 
    produce a phasor diagram. Most applications should simply use this class.

- ACWF.WaveformCanvas

    A rudimentary multi-channel waveform plotter. Used to visualize waveforms
    when a full-featured plotting library is not needed.  
 

## Background
For those not familiar with AC systems the next couple of paragraphs attempt
to provide a basic explanation for the layperson. 

### Harmonics
Ideally the AC signals are perfectly sinusoidal at the power system frequency; 
in reality this is often not the case. Nonlinear loads such as switch-mode 
power supplies and variable frequency drives draw distorted current waveforms.
AC power sytems are designed and sized to operate at the power system frequency
(also called the fundamental frequency). Different waveshapes can cause 
equipment overheating and misoperation. Harmonic analysis is used to measure
the amount of "extra" signal present and how it might affect the power system.

### Phasors
A three-phase AC power system uses three sets of sinusoidal power waveforms
separated 120 degrees from one another. The current and voltage wavefors 
generally differ by a small amount. Inspecting variations from this normal 
arrangement can tell you if the system is correctly wired or is in some other
unusual state. This information is often represented by a phasor diagram
in which the waveforms are represented by vectors or arrows. The length of
the arrow shows the magnitude of the waveform and the angle between the 
arrows represents the phase shift between the waveforms. 


----------
Copyright (c) 2014 Jeffrey Yeo, released under the MIT license.
