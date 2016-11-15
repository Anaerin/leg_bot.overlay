"use strict";
var ControlConnection = require("./lib/ControlConnection.js");
var OverlayConnection = require("./lib/OverlayConnection.js");
var LegBotConnector = require("./lib/LegBotConn.js");
var TwitchConnector = require("./lib/TwitchConnector.js");
var StreamTipConnector = require("./lib/StreamTipConnector.js");
var ServeStatic = require("./lib/ServeStatic.js");
var log = require("./lib/ConsoleLogging.js");
var open = require("open");
var LegBotConn;
var WebSocketServer = require('websocket').server,
	http = require('http'),
	url = require("url");

process.on("beforeExit", (exitCode) => {
	log.log.error("beforeExit called - No more events?", exitCode);
});
process.on("uncaughtException", (err) => {
	log.log.error("Process error", err);
});
process.on("unhandledRejection", (reason, p) => {
	log.log.error("Unhandled Rejection of promise", reason, p);
});
log.log.debug("Hi, Reila! Glad to see files have been updated!");
var server = http.createServer(function (request, response) {
	//console.log((new Date()) + ' Received request for ' + request.url);
	var uri = url.parse(request.url, true);
	
	if (uri.query && uri.query["code"]) {
		switch (uri.query["state"]) {
			case "Twitch":
				log.log.debug("Got code for Twitch");
				TwitchConn.receivedCode(uri.query["code"]);
				break;
			case "StreamTip":
				log.log.debug("Got code for StreamTip");
				StreamTipConn.receivedCode(uri.query["code"]);
				break;
			default:
				log.log.warn("Got code for unknown service (%s)", uri.query["state"]);
		}
		ControlConn.getNextAuthRequest();
		response.writeHead(302, "Moved temporarily", { location: "/OverlayControl.html" });
		response.end();
	} else {
		ServeStatic(uri, request, response);
	}
});

function SendAuthCodes(code) {
	TwitchConn.receivedCode(code);
	StreamTipConn.receivedCode(code);
}

server.listen(8000, function () {
	log.log.info((new Date()) + ' Server is listening on port 8000');
});

server.on("error", err => {
	log.log.error("Server error: %s", err);
});

var wsServer = new WebSocketServer({
	httpServer: server,
	autoAcceptConnections: false
});

var ControlConn = new ControlConnection(wsServer);

ControlConn.on("ReceivedJSON", message => {
	switch (message.type) {
		case "ChangeScene":
		case "UpdateAFK":
			OverlayConn.sendOne(message);
			break;
		case "NewFollower":
		case "NewTip":
		case "ToggleWebcam":
			OverlayConn.sendOnce(message);
			break;
		case "ChatInput":
			TwitchConn.sendChat(message.value);
			break;
		case "UpdateTwitch":
			TwitchConn.setStreamDetails(message.game, message.title);
			break;
		default:
			OverlayConn.send(message);
	}
});

var OverlayConn = new OverlayConnection(wsServer);

var TwitchConn = new TwitchConnector();
TwitchConn.on("ValidatedToken", streamer => {
    LegBotConn = new LegBotConnector(streamer);
    LegBotConn.on("Status", state => {
        ControlConn.sendOne({ type: "Status(LegBot)", status: state });
        updateStatus();
    });
    LegBotConn.on("GameChanged", (game, stat) => {
        log.log.info("Got GameChanged from LegBotConn. Sending it on");
        ControlConn.sendOne({ type: "GameChanged", value: game, stat: stat });
        OverlayConn.sendOne({ type: "GameChanged", value: game, stat: stat });
    });
    LegBotConn.on("StatChanged", stat => {
        log.log.info("Got StatChanged event", stat, LegBotConn.stats[stat]);
        ControlConn.sendByFunc({ type: "StatChanged", stat: stat, value: LegBotConn.stats[stat] }, function (test) { return test.stat == stat; });
        OverlayConn.sendByFunc({ type: "StatChanged", stat: stat, value: LegBotConn.stats[stat] }, function (test) { return test.stat == stat; });
    });
    LegBotConn.connect();
});
TwitchConn.on("Status", state => {
	ControlConn.sendOne({ type: "Status(Twitch)", status: state });
	updateStatus();
});
TwitchConn.on("NeedAuth", authURL => {
	ControlConn.sendAuthRequest({ type: "NeedAuth", value: authURL });
});
TwitchConn.on("ChatMessage", (userstate, message, self) => {
	OverlayConn.send({ type: "ChatMessage", userstate: userstate, message: message, self: self });
	ControlConn.send({ type: "ChatMessage", userstate: userstate, message: message, self: self });
});
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
TwitchConn.on("ChatAction", (userstate, message, self) => {
	OverlayConn.send({ type: "ChatAction", userstate: userstate, message: message, self: self });
	ControlConn.send({ type: "ChatAction", userstate: userstate, message: message, self: self });
});
TwitchConn.on("ChatWhisper", (from, userstate, message, self) => {
	ControlConn.send({ type: "ChatWhisper", from: from, userstate: userstate, message: message, self: self });
});
TwitchConn.on("ChatTimeout", (username, reason, duration) => {
	OverlayConn.send({ type: "ChatTimeout", username: username, reason: reason, duration: duration });
	ControlConn.send({ type: "ChatTimeout", username: username, reason: reason, duration: duration });
	OverlayConn.removeByCallback(item => {
		if (item.userstate && item.userstate.username && item.userstate.username == username) return true;
		if (item.username && item.username == username) return true;
		if (item.follower && item.follower == username) return true;
		return false;
	});
	ControlConn.removeByCallback(item => {
		if (item.userstate && item.userstate.username && item.userstate.username == username) return true;
		if (item.username && item.username == username) return true;
		if (item.follower && item.follower == username) return true;
		return false;
	});
});

TwitchConn.on("FollowersPopulated", followers => {
	ControlConn.sendOne({ type: "FollowerList", followers: followers });
	OverlayConn.sendOne({ type: "FollowerList", followers: followers });
});
TwitchConn.on("StreamDetailsUpdated", () => {
	ControlConn.sendOne({ type: "TwitchDetails", game: TwitchConn.game, title: TwitchConn.title });
	OverlayConn.sendOne({ type: "TwitchDetails", game: TwitchConn.game, title: TwitchConn.title });
});
TwitchConn.on("TwitchDisplayName", streamer => {
    ControlConn.sendOne({ type: "StreamerName", name: streamer });
    OverlayConn.sendOne({ type: "StreamerName", name: streamer });
});

var StreamTipConn = new StreamTipConnector();
StreamTipConn.on("Status", state => {
	ControlConn.sendOne({ type: "Status(StreamTip)", status: state });
	updateStatus();
});
StreamTipConn.on("NeedAuth", authURL => {
	ControlConn.sendAuthRequest({ type: "NeedAuth", value: authURL });
});
StreamTipConn.on("newTip", tip => {
	ControlConn.send({ type: "NewTip", tip: tip.data });
	OverlayConn.send({ type: "NewTip", tip: tip.data });
});
StreamTipConn.on("GoalUpdated", () => {
	ControlConn.send({ type: "GoalUpdated", goal: StreamTipConn.goal });
	OverlayConn.send({ type: "GoalUpdated", goal: StreamTipConn.goal });
});

ControlConn.on("OpenConnections", count => {
    ControlConn.sendOne({ type: "ControlConnections", count: count });
    OverlayConn.sendOne({ type: "ControlConnections", count: count });
	updateStatus();
});
OverlayConn.on("OpenConnections", count => {
    ControlConn.sendOne({ type: "OverlayConnections", count: count });
    OverlayConn.sendOne({ type: "OverlayConnections", count: count });
	updateStatus();
});

function updateStatus() {
    var output;
    if (LegBotConn) {
        output = [
            "{bold}Twitch{/bold}: " + TwitchConn.status,
            "{bold}Leg_Bot{/bold}: " + LegBotConn.status,
            "{bold}StreamTip{/bold}: " + StreamTipConn.status,
            "{bold}Overlays{/bold}: " + OverlayConn.connections,
            "{bold}Controls{/bold}: " + ControlConn.connections
        ]
    } else {
        output = [
            "{bold}Twitch{/bold}: " + TwitchConn.status,
            "{bold}Leg_Bot{/bold}: Waiting for Username from Twitch",
            "{bold}StreamTip{/bold}: " + StreamTipConn.status,
            "{bold}Overlays{/bold}: " + OverlayConn.connections,
            "{bold}Controls{/bold}: " + ControlConn.connections
        ]
    }
	log.updateStatus(output);
}

StreamTipConn.connect();
TwitchConn.connect();
//LegBotConn.connect();
open("http://localhost:8000/OverlayControl.html");
