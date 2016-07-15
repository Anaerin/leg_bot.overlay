"use strict";
var secrets = require('./secrets.js');

var overlayConnections = [];
var controlConnections = [];
var receivedMessage = {};

var ControlConnection = require("./lib/ControlConnection.js");
var OverlayConnection = require("./lib/OverlayConnection.js");
var LegBotConnector = require("./lib/LegBotConn.js");
var TwitchConnector = require("./lib/TwitchConnector.js");
var StreamTipConnector = require("./lib/StreamTipConnector.js");

var WebSocketServer = require('websocket').server,
	http = require('http'),
	url = require("url"),
	path = require("path"),
	fs = require("fs"),
    open = require("open");

var contentTypesByExtension = {
	'.html': "text/html",
	'.css': "text/css",
	'.js': "text/javascript"
};

var bShotOnGoal = false;

var server = http.createServer(function (request, response) {
	//console.log((new Date()) + ' Received request for ' + request.url);
    var uri = url.parse(request.url, true);
    var wwwpath = uri.pathname, filename = path.join(process.cwd(), "Overlay", wwwpath);
    if (uri.query && uri.query["code"]) {
        switch (uri.query["state"]) {
            case "Twitch":
                //console.log("Got code for Twitch");
                TwitchConn.receivedCode(uri.query["code"]);
                break;
            case "StreamTip":
                //console.log("Got code for StreamTip");
                StreamTipConn.receivedCode(uri.query["code"]);
                break;
            default:
                console.log("Got code for unknown service (%s)", uri.query["state"]);
        }
        ControlConn.getNextAuthRequest();
        response.writeHead(302, "Moved temporarily", { location: "/OverlayControl.html" });
        response.end();
    } else {
        fs.exists(filename, function (exists) {
            if (!exists) {
                response.writeHead(404, { "Content-Type": "text/plain" });
                response.write("404 Not Found\n");
                response.end();
                return;
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
    }
});

function SendAuthCodes(code) {
    TwitchConn.receivedCode(code);
    StreamTipConn.receivedCode(code);
}

server.listen(8000, function () {
	console.log((new Date()) + ' Server is listening on port 8000');
});

server.on("error", err => {
    console.log("Server error: %s", err);
});

var wsServer = new WebSocketServer({
	httpServer: server,
	autoAcceptConnections: false
});

var ControlConn = new ControlConnection(wsServer);

ControlConn.on("ReceivedJSON", message => {
    OverlayConn.send({ type: "ControlMessage", value: message });
    if (message.type == "ChatInput") {
        TwitchConn.sendChat(message.value);
    }
});

var OverlayConn = new OverlayConnection(wsServer);

var TwitchConn = new TwitchConnector(secrets.Streamer);
TwitchConn.on("NeedAuth", authURL => {
    ControlConn.sendAuthRequest({ type: "NeedAuth", value: authURL });
});
TwitchConn.on("ChatMessage", (userstate, message, self) => {
    OverlayConn.send({ type: "ChatMessage", userstate: userstate, message: message, self: self });
    ControlConn.send({ type: "ChatMessage", userstate: userstate, message: message, self: self });
});
TwitchConn.connect();
TwitchConn.on("NewFollower", follower => {
	OverlayConn.send({ type: "NewFollower", value: follower });
	ControlConn.send({ type: "NewFollower", value: follower });
});
TwitchConn.on("ChatHosted", (username, viewers) => {
	OverlayConn.send({ type: "ChatHosted", username: username, viewers: viewers });
	ControlConn.send({ type: "ChatHosted", username: username, viewers: viewers });
});
TwitchConn.on("ChatSubscription", username => {
	OverlayConn.send({ type: "ChatSubscription", username: username });
	ControlConn.send({ type: "ChatSubscription", username: username });
});
TwitchConn.on("ChatResubscription", (username, months, message) => {
	OverlayConn.send({ type: "ChatResubscription", username: username, months: months, message: message });
	ControlConn.send({ type: "ChatResubscription", username: username, months: months, message: message });
});
TwitchConn.on("ChatAction", (username, userstate, message, self) => {
	OverlayConn.send({ type: "ChatAction", username: username, userstate: userstate, message: message, self: self });
	ControlConn.send({ type: "ChatAction", username: username, userstate: userstate, message: message, self: self });
});
TwitchConn.on("ChatWhisper", (from, userstate, message, self) => {
	ControlConn.send({ type: "ChatWhisper", from: from, userstate: userstate, message: message, self: self });
});
TwitchConn.on("FollowersPopulated", followers => {
	ControlConn.sendOne({ type: "FollowerList", followers: followers });
	OverlayConn.sendOne({ type: "FollowerList", followers: followers });
});

var StreamTipConn = new StreamTipConnector();
StreamTipConn.on("NeedAuth", authURL => {
    ControlConn.sendAuthRequest({ type: "NeedAuth", value: authURL });
});
StreamTipConn.connect();

var LegBotConn = new LegBotConnector("anaerin");
// open("http://localhost:8000/OverlayControl.html");
LegBotConn.on("GameChanged", game => {
	ControlConn.sendOne({ type: "GameChanged", value: game });
    OverlayConn.sendOne({ type: "GameChanged", value: game });
});
LegBotConn.on("StatChanged", (stat, value) => {
    ControlConn.sendByFunc({ type: "StatChanged", stat: stat, value: value }, test => test.stat == stat);
    OverlayConn.sendByFunc({ type: "StatChanged", stat: stat, value: value }, test => test.stat == stat);
});
LegBotConn.connect();
