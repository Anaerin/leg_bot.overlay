var Logger = require("winston");
var updateStatus = module.exports.updateStatus = function (cells) {
	/* for (var i=0;i<cells.length;i++) {
		cells[i] = Blessed.parseTags(cells[i]);
	}
	status.setData([cells]);
	screen.render();
	*/
}

Logger.add(Logger.transports.File, { filename: 'overlay.log', level: 'debug', handleExceptions: true, exitOnError: false, humanReadableUnhandledException: true });
Logger.exitOnError = false;
Logger.handleExceptions = true;
Logger.humanReadableUnhandledException = true;
module.exports.log = Logger;