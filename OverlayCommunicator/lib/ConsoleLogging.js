var Logger = require("winston"),
	Blessed = require("blessed"),
	Util = require("util"),
	colors = require('colors/safe');

var screen = Blessed.screen({
	dockBorders: true,
	autoPadding: true,
	title: 'Overlay Control Websockets Interface'
});

var body = Blessed.box({
	top: 2,
	bottom: 1,
	left: 0,
	right: 0,
	scrollable: true,
	alwaysScroll: true,
	border: {
		type: 'line'
	},
	scrollbar: true,
	style: {
		scrollbar: {
			bg: 'gray',
			fg: 'blue'
		}
	},
	label: 'Log'
});

var status = Blessed.table({
	top: 0,
	height: 3,
	left: 0,
	width: '100%',
	noCellBorders: true,
	border: {
		type: 'line'
	},
	bg: 'white',
	fg: 'black'
});
screen.render();
screen.append(status);
screen.append(body);
screen.key(["escape", "C-c"], (ch, key) => {
	return process.exit(0);
});
screen.key(["up"], (ch, key) => {
    body.scroll(-1);
});
screen.key(["down"], (ch, key) => {
    body.scroll(1);
});
screen.key(["pageup"], (ch, key) => {
    body.scroll(-10);
});
screen.key(["pagedown"], (ch, key) => {
    body.scroll(10);
});
screen.key(["home"], (ch, key) => {
    body.setScrollPerc(0);
});
screen.key(["end"], (ch, key) => {
    body.setScrollPerc(100);
});
var updateStatus = module.exports.updateStatus = function (cells) {
	for (var i=0;i<cells.length;i++) {
		cells[i] = Blessed.parseTags(cells[i]);
	}
	status.setData([cells]);
	screen.render();
}

var customLogger = Logger.transports.customLogger = function (options) {
	Logger.Transport.call(this, options);
	options = options || {};
	this.name         = "customLogger";
	this.json         = options.json        || false;
	this.colorize     = options.colorize    || true;
	this.prettyPrint  = options.prettyPrint || false;
	this.timestamp    = typeof options.timestamp !== 'undefined' ? options.timestamp : false;
	this.showLevel    = options.showLevel === undefined ? true : options.showLevel;
	this.label        = options.label       || null;
	this.logstash     = options.logstash    || false;
	this.depth        = options.depth       || null;
	this.align        = options.align       || false;
	this.level        = options.level || "info";
	if (this.json) {
		this.stringify = options.stringify || function (obj) {
			return JSON.stringify(obj, null, 2);
		};
	}
}
Util.inherits(customLogger, Logger.Transport);
customLogger.prototype.log = function (level, msg, meta, callback) {
	var output = "", levelfg = "gray", levelbg = "black";
	colors.setTheme({
		silly: 'rainbow',
		debug: 'blue',
		verbose: 'cyan',
		info: 'green',
		warn: ['bgYellow', 'black'],
		error: ['bgRed', 'white']
	});
	output += new Date().toISOString() + ": ";
	output += colors[level](("       " + level).substr(-7));
	output += ": ";
	if (typeof meta == 'array') { //typeof meta != 'undefined') {
		output += Util.format(msg, ...meta);
	} else if (typeof meta == 'object' && Object.keys(meta).length !== 0) {
		output += Util.format(msg, meta);
	}
	else output += msg;
	body.pushLine(output);
	body.setScrollPerc(100);
	screen.render();
}
Logger.add(Logger.transports.customLogger, { level: 'debug', handleExceptions: true, humanReadableUnhandledException: true}).remove(Logger.transports.Console);
Logger.exitOnError = false;
module.exports.log = Logger;