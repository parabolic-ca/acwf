//===================================================================
// Alternating Current Waveform Library
// Classes to display AC waveform information in HTML5.
// Copyright 2014-2016 Jeffrey Yeo. All rights reserved.
//===================================================================
(function (ACWF, undefined) {

	//=========================================================
	// Draws AC waveforms onto a canvas.
	ACWF.WaveformCanvas = function (element_id) {
		// Specifies padding above the maximum value of the waveform for
		// the display canvas.
		this.scalePadding = 1.1;	// add a little extra for labelling etc.

		var element = document.getElementById(element_id);
		var width = element.clientWidth;
		var height = element.clientHeight;
		console.log("WaveformCanvas: width=" + width + "; height=" + height);
		var maxYCoord = height / 2;
		var canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		var context = canvas.getContext("2d");
		var xoffset = context.measureText("000").width + 3;
		var plotWidth = width - xoffset;
		context.translate(xoffset, height / 2);
		element.appendChild(canvas);

		var scales = [{ name: 'default', value: this.scalePadding * maxYCoord }];

		this.addUnitScale = function (unitName, maxValue) {
			scales.push({ name: unitName, value: this.scalePadding * maxValue });
		};

		function getScalePadding(name) {
			// find the scale by name, using default if none found;
			var scale = scales[0];
			for (var i = 0; i < scales.length; i++) {
				if (scales[i].name == name) {
					if (scales[i].value != 0) {
						scale = scales[i];
					}
					break;
				}
			}
			var scalePadding = (maxYCoord / scale.value);
			return scalePadding;
		}


		function drawAxis() {
			context.strokeStyle = "#eee";
			context.lineWidth = 3;
			// draw horizontal lines
			var lines = [-0.5, 0.5];
			context.beginPath();
			context.lineWidth = 1;
			for (var pos in lines) {
				var y = lines[pos] * maxYCoord;
				context.moveTo(0, y);
				context.lineTo(width, y);
				context.stroke();
			}
			// draw center line and left axis
			context.beginPath();
			context.lineWidth = 3;
			context.moveTo(0, 0);
			context.lineTo(width, 0);
			context.moveTo(-2, -maxYCoord);
			context.lineTo(-2, maxYCoord);
			context.stroke();
		}

		// Draws the waveform to the canvas and labels it.
		this.addWaveform = function (waveform, style, unit) {
			var n = waveform.samples.length;
			var scalePadding = getScalePadding(unit);
			style.apply(context);
			context.beginPath();
			var x, y, labelY;
			waveform.samples.forEach(function (sample, i) {
				x = i * plotWidth / n;
				y = -maxYCoord * (sample * scalePadding / maxYCoord);
				context.lineTo(x, y);
				if (i == 0) labelY = y;
			});
			context.stroke();
			// Display the label at the end of the line
			context.textAlign = "left";
			context.textBaseline = "middle";
			context.fillText(waveform.label, -xoffset + 2, labelY);
		};

		this.plot = function () {
		};

		drawAxis();

	};


	//=========================================================
	// Draws shapes that comprise phasors onto a canvas.
	// The minimum dimension of the canvas element is used to 
	// determine the maximum size of the  phasor lines. A minimum
	// size of 300 pixels is set as smaller plots aren't very legible.
	// Use the PhasorEngine to generate the shapes.
	ACWF.PhasorCanvas = function (element_id) {
		var element = document.getElementById(element_id);
		// Handle the case where no sizes are given and the browser layout
		// engine sets the height to 0 which will result in no plot display.
		var defaultHeight = 300;
		// Phasor plot really doesn't work smaller than 200
		var minimumSize = 200;

		var size = Math.min(element.clientWidth, element.clientHeight || defaultHeight);
		size = Math.max(size, minimumSize);
		console.log("PhasorCanvas: size=" + size);
		// add spacer element used to center phasor
		var spacer = document.createElement("div");
		element.appendChild(spacer);
		var canvas = document.createElement("canvas");
		// center new element inside its container
		canvas.style.margin = "auto";
		canvas.style.display = "block";
		// set the size of the canvas - always square :)
		canvas.width = size, canvas.height = size;
		var context = canvas.getContext("2d");
		element.appendChild(canvas);
		var currentShape = null;

		// Returns a PhasorEngine initialized with the correct
		// size for this canvas.
		this.getEngine = function () {
			this.updateSize();
			console.log("Initialize phasor engine with size: " + size);
			return new ACWF.PhasorEngine(size);
		};

		this.updateSize = function () {
			size = Math.min(element.clientWidth, element.clientHeight || defaultHeight);
			size = Math.max(size, minimumSize);
			console.log("PhasorCanvas: size=" + size);
			canvas.width = size, canvas.height = size;
			context = canvas.getContext("2d");
		};

		this.updateSpacer = function () {
			var larger = Math.max(element.clientHeight, element.clientWidth);
			var smaller = Math.min(element.clientHeight, element.clientWidth);
			var space = (larger - smaller) / 2;
			var style = "display:none;";
			if (element.clientHeight > element.clientWidth) {
				if (size < element.clientHeight) {
					style = "width:0;height:" + space + ";";
				}
			} else {
				if (size < element.clientWidth) {
					style = "display:inline-block;height:0;width:" + space + ";";
				}
			}
			spacer.setAttribute("style", style);
			return spacer;
		}

		// Resets the canvas and prepares the background grid.
		this.reset = function () {
			this.updateSpacer();
			this.drawGrid();
		};

		this.drawGrid = function () {
			var middle = canvas.width / 2;
			// draw the axes
			context.beginPath();
			context.moveTo(0, middle);
			context.lineTo(canvas.width, middle);
			context.moveTo(middle, 0);
			context.lineTo(middle, canvas.width);
			getAxesStyle().apply(context);
			context.stroke();
			// context.beginPath();
			// context.arc(middle, middle, middle, 0, 2 * Math.PI);
			// context.stroke();
			// label the axes
			context.font = "12px sans-serif";
			context.textAlign = "right";
			context.textBaseline = "top";
			context.fillText(" 0", canvas.width, middle);
			context.textAlign = "left";
			context.fillText(" 90", middle, 0);
			context.fillText(" 180", 0, middle);
			context.textBaseline = "bottom";
			context.fillText(" 270", middle, canvas.height);
		};

		// Draws the phasors described by the array of shapes.
		this.drawPhasors = function (shapes) {
			this.reset();
			for (var i = 0; i < shapes.length; i++) {
				currentShape = shapes[i];
				this.setStyle();
				this.drawCircle();
				this.drawLine();
				this.drawPolygon();
				this.drawText();
				this.checkResult();
			}
		};

		this.isItemType = function (type) {
			return (currentShape && currentShape.type == type);
		};

		this.setItemComplete = function () {
			currentShape = { type: 'done', item: currentShape };
		};

		this.setStyle = function () {
			if (this.isItemType("style")) {
				currentShape.style.apply(context);
				this.setItemComplete();
			}
		};

		this.drawLine = function () {
			if (this.isItemType('line')) {
				context.beginPath();
				context.moveTo(currentShape.points[0].x, currentShape.points[0].y);
				context.lineTo(currentShape.points[1].x, currentShape.points[1].y);
				context.stroke();
				this.setItemComplete();
			}
		};

		this.drawPolygon = function () {
			if (this.isItemType('polygon')) {
				context.beginPath();
				context.moveTo(currentShape.points[0].x, currentShape.points[0].y);
				for (var i = currentShape.points.length - 1; i >= 0; i--) {
					var point = currentShape.points[i];
					context.lineTo(point.x, point.y);
				}
				context.closePath();
				context.fill();
				this.setItemComplete();
			}
		};

		this.drawCircle = function () {
			if (this.isItemType('circle')) {
				context.beginPath();
				var center = currentShape.points[0];
				context.arc(center.x, center.y, currentShape.radius, 0, 2 * Math.PI);
				context.stroke();
				this.setItemComplete();
			}
		}

		this.drawText = function () {
			if (this.isItemType('text')) {
				context.font = "10px sans-serif";
				var style = new ACWF.PlotStyle().store(context);
				context.fillStyle = "black";
				context.textAlign = currentShape.align;
				context.textBaseline = currentShape.baseline;
				context.fillText(currentShape.text, currentShape.points[0].x, currentShape.points[0].y);
				style.apply(context);
				this.setItemComplete();
			}
		};

		this.checkResult = function () {
			if (!currentShape) {
				return { type: 'error', error: 'Phasor item was falsy.', item: item };
			}
			if (this.isItemType('done')) return;
			if (this.isItemType('error')) return;
			// probably an unknown drawing item
			currentShape = { type: 'unknown', item: item };
		};

		function getAxesStyle() {
			var style = new ACWF.PlotStyle()
				.setColor("gray")
				.setWidth(1)
				.setDashed(false);
			return style;

		}

		this.reset();

	};

	//=========================================================
	// Class that generates shapes for the PhasorCanvas to draw.
	ACWF.PhasorEngine = function (_size) {
		var size = _size;
		var headSize = Math.max(size / 50, 7);	// 1/50 looks nice
		var headAngle = 2.618;	// 150 deg
		// Allows room for phasor labels and prevent crowding.
		var scalePadding = 1.2;

		var shapes = [];
		var maxValue = size / 2;
		var center = { x: maxValue, y: maxValue };
		var scales = new ACWF.Scaler();

		var radialAngles = ACWF.iterable([Math.PI / 6, Math.PI / 3, Math.PI / -6, Math.PI / -3]);
		var ringRadii = ACWF.iterable([maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25]);

		var phasors = ACWF.iterable([]);

		// Gets the shapes that make up the phasors.
		this.getShapes = function (showGrid) {
			shapes = [];
			if (showGrid) addRingsAndLines();
			phasors.forEach(function (phasor) {
				addStyle(phasor.style);
				var length = scaleMagnitude(phasor.mag, phasor.scale);
				// phasor consists of the main line, the arrow on the tip, and an optional label
				var end = addPhasorLine(length, phasor.angle);
				addPhasorArrow(end, phasor.angle);
				addPhasorLabel(end, phasor.label);
			});
			return shapes;
		};

		function addRingsAndLines() {
			var radius = maxValue;
			addStyle(ACWF.PhasorEngine.getAxesStyle());
			ringRadii.forEach(function (radius) {
				addPhasorRing(radius);
			});
			radialAngles.forEach(function (angle) {
				addRadialLine(angle);
			})
		}

		// Sets length of phasor arrow lines.
		this.setPhasorArrowSize = function (arrowSize) {
			headSize = arrowSize;
		};

		// Sets angle of phasor arrow lines in radians.
		this.setPhasorArrowAngle = function (arrowAngle) {
			headAngle = arrowAngle;
		};

		// Sets multiplier to apply to maximum value for axis scaling.
		this.setScalePadding = function (padding) {
			scalePadding = padding;
		};

		// Sets a new named scale value.
		// Each phasor may be assigned to a named scale that allows
		// the engine to size the line correctly.
		function setScale(name, value) {
			scales.setScale(name, scalePadding * value);
		};

		function scaleMagnitude(value, name) {
			// find the scale by name, using default if none found;
			var scale = scales.getScale(name, scalePadding * maxValue);
			var scaled = (maxValue / scale) * value;
			return scaled;
		}

		this.addPhasor = function (mag, angle, style, name, scale) {
			// Store the phasor info for later
			phasors.push({ mag: mag, angle: angle, style: style, label: name, scale: scale });
			// Track the magnitudes so we can scale our phasors later
			setScale(scale, mag);
			return this;
		};

		function computeEnd(start, length, angle) {
			var deltaX = length * Math.cos(angle);
			var deltaY = length * Math.sin(angle);
			var endX = start.x + deltaX;
			var endY = start.y - deltaY;
			return { x: endX, y: endY };
		}

		function addStyle(style) {
			var style = {
				type: 'style',
				style: style
			};
			shapes.push(style);
		}

		function addPhasorLine(length, angle) {
			var end = computeEnd(center, length, angle);
			var shape = {
				type: 'line',
				points: [center, end]
			};
			shapes.push(shape);
			return end;
		}

		function addPhasorArrow(head, angle) {
			var end1 = computeEnd(head, headSize, angle + headAngle);
			var end2 = computeEnd(head, headSize, angle - headAngle);
			var shape = {
				type: 'polygon',
				points: [head, end1, end2]
			};
			shapes.push(shape);
		}

		function addPhasorLabel(head, label) {
			var align = (head.x < center.x) ? 'right' : 'left';
			var baseline = (head.y > center.y) ? 'top' : 'bottom';
			var shape = {
				type: 'text',
				points: [head],	// used array for consistency
				text: label,
				align: align,
				baseline: baseline
			};
			shapes.push(shape);
		}

		function addCircle(center, radius) {
			var shape = {
				type: 'circle',
				points: [center],
				radius: radius
			};
			shapes.push(shape);
		}

		function addPhasorRing(radius) {
			addCircle(center, radius || maxValue);
		}

		function addRadialLine(angle) {
			var end1 = computeEnd(center, maxValue, angle);
			var end2 = computeEnd(center, maxValue, angle + Math.PI);
			var shape = {
				type: 'line',
				points: [end1, end2]
			};
			shapes.push(shape);
		}

	};

	ACWF.PhasorEngine.getAxesStyle = function () {
		var style = new ACWF.PlotStyle()
			.setColor("lightgray")
			.setWidth(1)
			.setDashed(false);
		return style;

	}

	//=========================================================
	// Class to display a phasor diagram on a HTML5 page.
	// Acts as a facade over the PhasorCanvas and PhasorEngine
	// classes.
	ACWF.PhasorDiagram = function (_elementId, acwfOptions) {
		var elementId = _elementId;
		var phasor = new ACWF.PhasorCanvas(elementId);
		
		var options = acwfOptions || ACWF.defaultOptions;
		var showGrid = options.phasor.showGrid || false;

		this.plotWaveformSet = function (waveformSet, reference, acwfOptions) {
			var engine = phasor.getEngine();
			var referenceAngle = waveformSet.phasor(reference) ? waveformSet.phasor(reference).angle : 0;
			waveformSet.iteratePhasors(function (phasor, style, info) {
				engine.addPhasor(
					phasor.magnitude,
					phasor.relative(referenceAngle),
					style,
					phasor.label,
					info.unit);

			});
			phasor.drawPhasors(engine.getShapes(showGrid));		
		}

	};


//=========================================================
})(window.ACWF = window.ACWF || {});
