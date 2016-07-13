"use strict";
var secrets = require('./secrets.js');

var overlayConnections = [];
var controlConnections = [];
var receivedMessage = {};

var ControlConnection = require("./lib/ControlConnection.js");
var OverlayConnection = require("./lib/WebsocketListener.js");
var LegBotConnector = require("./lib/LegBotConn.js");
var TwitchConnector = require("./lib/TwitchConnector.js");
var StreamTipConnector = require("./lib/StreamTipConnector.js");

var WebSocketServer = require('websocket').server,
	http = require('http'),
	https = require('https'),
	querystring = require('querystring'),
	url = require("url"),
	path = require("path"),
	fs = require("fs"),
    clients = [],
    open = require("open");

var contentTypesByExtension = {
	'.html': "text/html",
	'.css': "text/css",
	'.js': "text/javascript"
};

var bShotOnGoal = false;

var server = http.createServer(function (request, response) {
	console.log((new Date()) + ' Received request for ' + request.url);
    var uri = url.parse(request.url, true);
    var wwwpath = uri.pathname, filename = path.join(process.cwd(), "Overlay", wwwpath);
	fs.exists(filename, function (exists) {
		if (!exists) {
			response.writeHead(404, { "Content-Type": "text/plain" });
			response.write("404 Not Found\n");
			response.end();
			return;
		}
        if (uri.query && uri.query["code"]) {
            switch (uri.query["state"]) {
                case "Twitch":
                    TwitchConn.receivedCode(uri.query["code"]);
                    break;
                case "StreamTip":
                    StreamTipConn.receivedCode(uri.query["code"]);
                    break;
                default:
                    console.log("Got code for unknown service (%s)", uri.query["state"]);
            }
            ControlConn.getNextAuthRequest();
        }
		if (fs.statSync(filename).isDirectory()) filename += '/index.html';
		
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

function SendAuthCodes(code) {
    TwitchConn.receivedCode(code);
    StreamTipConn.receivedCode(code);
}

server.listen(8000, function () {
	console.log((new Date()) + ' Server is listening on port 8000');
});

var wsServer = new WebSocketServer({
	httpServer: server,
	autoAcceptConnections: false
});

var ControlConn = new ControlConnection(wsServer);

ControlConn.on("ReceivedJSON", message => {
    OverlayConn.send({ type: "ControlMessage", value: message });
});

var OverlayConn = new OverlayConnection(wsServer, "Overlay");

var TwitchConn = new TwitchConnector("anaerin");
TwitchConn.on("NeedAuth", authURL => {
    ControlConn.sendAuthRequest({ type: "NeedAuth", value: authURL });
});
TwitchConn.on("ChatMessage", message => {
    OverlayConn.send({ type: "ChatMessage", value: message });
    ControlConn.send({ type: "ChatMessage", value: message });
});
TwitchConn.connect();

var StreamTipConn = new StreamTipConnector();
StreamTipConn.on("NeedAuth", authURL => {
    ControlConn.sendAuthRequest({ type: "NeedAuth", value: authURL });
});
StreamTipConn.connect();

var LegBotConn = new LegBotConnector("anaerin");
// open("http://localhost:8000/OverlayControl.html");
