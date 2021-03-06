﻿const log = require("./ConsoleLogging.js").log;
var path = require("path"),
	fs = require("fs"),
	open = require("open");

var contentTypesByExtension = {
	'.html': "text/html",
	'.css': "text/css",
	'.js': "text/javascript"
};

module.exports = function serveStatic(url, request, response) {
	var pathPacked = path.join(__dirname, "Overlay");
	var pathUnpacked = path.join(__dirname, "..","Overlay");
	var wwwpath = url.pathname, filename
	if (fs.existsSync(pathPacked)) filename = path.join(pathPacked, wwwpath);
	else filename = path.join(pathUnpacked, wwwpath);
	log.info("Found path and filename", filename);
	fs.exists(filename, function (exists) {
		if (!exists) {
			response.writeHead(404, { "Content-Type": "text/plain" });
			response.write("404 Not Found\n");
			response.end();
			return;
		}

		if (fs.statSync(filename).isDirectory()) filename += '/index.html';
		fs.exists(filename, function (exists) {
			if (!exists) {
				response.writeHead(404, { "Content-Type": "text/plain" });
				response.write("404 Not Found\n");
				response.end();
				return;
			}
			fs.readFile(filename, "binary", function (err, file) {
				if (err) {
					response.writeHead(500, { "Content-Type": "text/plain" });
					response.write(err + "\n");
					response.end();
					return;
				}
				var headers = {};
				var contentType = contentTypesByExtension[path.extname(filename)];
				if (contentType) headers["Content-Type"] = contentType;
				response.writeHead(200, headers);
				response.write(file, "binary");
				response.end();
			});
		});
	});
}