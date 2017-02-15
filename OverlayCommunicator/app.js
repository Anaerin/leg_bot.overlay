"use strict";
//const ControlConnection = require("./lib/ControlConnection.js");
const OverlayConnection = require("./lib/OverlayConnection.js");
const LegBotConnector = require("./lib/LegBotConn.js");
const TwitchConnector = require("./lib/TwitchConnector.js");
const StreamTipConnector = require("./lib/StreamTipConnector.js");
const ServeStatic = require("./lib/ServeStatic.js");
const log = require("./lib/ConsoleLogging.js");
let LegBotConn;
const WebSocketServer = require('websocket').server,
	http = require('http'),
	url = require("url");

const electron = require("electron");
const ipcMain = electron.ipcMain;
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const windowStateKeeper = require("electron-window-state");
let mainWindow;
let amReady = false;
let outgoing = [];
function createWindow() {
	let mainWindowState = windowStateKeeper({ defaultWidth: 1000, defaultHeight: 800 });
	mainWindow = new BrowserWindow({ "x": mainWindowState.x, "y": mainWindowState.y, "width": mainWindowState.width, "height": mainWindowState.height, autoHideMenuBar:true });
	mainWindow.loadURL("http://localhost:8000/OverlayControl.html");
	//mainWindow.webContents.openDevTools();
	mainWindow.on("closed", () => {
		mainWindow = null;
	});
	mainWindowState.manage(mainWindow);
}

app.on("ready", createWindow);
app.on("window-all-closed", () => {
	app.quit();
});

process.on("beforeExit", (exitCode) => {
	log.log.error("beforeExit called - No more events?", exitCode);
});
process.on("uncaughtException", (err) => {
	log.log.error("Process error", err);
});
process.on("unhandledRejection", (reason, p) => {
	log.log.error("Unhandled Rejection of promise", reason, p);
});
var server = http.createServer(function (request, response) {
	log.log.info('Received request for ' + request.url);
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
		//ControlConn.getNextAuthRequest();
		//response.writeHead(302, "Moved temporarily", { location: "/OverlayControl.html" });
		response.write("<script>window.close()</script>");
		response.end();
	} else {
		ServeStatic(uri, request, response);
	}
});

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

//var ControlConn = new ControlConnection(wsServer);

function receiveControlMessage(evt, message) {
	if (typeof message === "string") message = JSON.parse(message);
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
		case "Ready":
			amReady = true;
			outgoing.forEach((message) => {
				sendControlMessage(message, true);
			});
			break;
		case "AuthRequest":
			log.log.info("Got AuthRequest - full message", message);
			doAuthPopup(message.uri);
			break;
		//case "VideoStream":
		//	log.log.info("Got VideoStream from control");
		//	OverlayConn.sendOnce(message.message);
		default:
			OverlayConn.sendOnce(message);
	}
}
ipcMain.on("message", receiveControlMessage);
function sendControlMessage(message, isReplay) {
	if (!isReplay) outgoing.push(message);
	if (amReady) {
		mainWindow.webContents.send("message", message);
	}
}

var OverlayConn = new OverlayConnection(wsServer);
OverlayConn.on("ReceivedJSON", message => {
	switch (message.type) {
		case "VideoStream":
			sendControlMessage(message, true)
			break;
	}
});
var TwitchConn = new TwitchConnector();
TwitchConn.on("ValidatedToken", streamer => {
    LegBotConn = new LegBotConnector(streamer);
    LegBotConn.on("Status", state => {
        sendControlMessage({ type: "Status(LegBot)", status: state });
        updateStatus();
    });
    LegBotConn.on("GameChanged", (game, stat) => {
        log.log.info("Got GameChanged from LegBotConn. Sending it on");
        sendControlMessage({ type: "GameChanged", value: game, stat: stat });
        OverlayConn.sendOne({ type: "GameChanged", value: game, stat: stat });
    });
    LegBotConn.on("StatChanged", stat => {
        log.log.info("Got StatChanged event", stat, LegBotConn.stats[stat]);
        sendControlMessage({ type: "StatChanged", stat: stat, value: LegBotConn.stats[stat] });
        OverlayConn.sendByFunc({ type: "StatChanged", stat: stat, value: LegBotConn.stats[stat] }, function (test) { return test.stat == stat; });
    });
    LegBotConn.connect();
});
TwitchConn.on("Status", state => {
	sendControlMessage({ type: "Status(Twitch)", status: state });
	updateStatus();
});
function handleAuthCallback(location, target) {
	var decoded = url.parse(location, true);
	//var raw_code = /code=([^&]*)/.exec(url) || null;
	//var code = (raw_code || raw_code.length > 1) ? raw_code[1] : null;
	//var error = /\?error=(.+)$/.exec(url);
	if (decoded.query.code || decoded.query.error ) {
		BrowserWindow.fromWebContents(target).close();
	}
	if (decoded.query.code) {
		switch (decoded.query.state) {
			case "Twitch":
				TwitchConn.receivedCode(decoded.query.code);
				break;
			case "StreamTip":
				StreamTipConn.receivedCode(decoded.query.code);
				break;
		}
	} else if (decoded.query.error) {
		log.log.error("oAuth error", decoded.query.error);
	}
}
function doAuthPopup(url) {
	if (amReady) {
		console.log("We're ready, let's do the auth popup");
		var authWindow = new BrowserWindow({ parent: mainWindow, webPreferences: { nodeIntegration: false }, autoHideMenuBar: true, center: true });
		authWindow.loadURL(url);
		authWindow.show();
		/*
		authWindow.webContents.on("will-navigate", (event, url) => {
			log.log.info("Got event", this);
			handleAuthCallback(url, this);
		});
		authWindow.webContents.on("did-get-redirect-request", function(event, oldURL, newURL) {
			log.log.info("Got event", this);
			handleAuthCallback(newURL, this);
		});
		*/
		authWindow.on("closed", function(e) {
			var children = mainWindow.getChildWindows();
			children.forEach((child) => {
				child.destroy();
				child = null;
			});
			//this = null;
			//BrowserWindow.fromWebContents(this).destroy();
			//authWindow.destroy();
			//authWindow = null;
		}, false);
	} else {
		console.log("Not ready yet, wait another second for the auth popup");
		setTimeout(doAuthPopup, 1000, url);
	}
}
TwitchConn.on("NeedAuth", authURL => {
	//sendControlMessageAuthRequest({ type: "NeedAuth", value: authURL });
	sendControlMessage({ type: "NeedAuth", service: "Twitch", uri: authURL });
	//doAuthPopup(authURL);
});

TwitchConn.on("ChatMessage", (userstate, message, self) => {
	OverlayConn.send({ type: "ChatMessage", userstate: userstate, message: message, self: self });
	sendControlMessage({ type: "ChatMessage", userstate: userstate, message: message, self: self });
});
TwitchConn.on("NewFollower", follower => {
	OverlayConn.send({ type: "NewFollower", value: follower, isTest: false });
	sendControlMessage({ type: "NewFollower", value: follower, isTest: false });
});
TwitchConn.on("ChatHosted", (username, viewers) => {
	OverlayConn.send({ type: "ChatHosted", username: username, viewers: viewers });
	sendControlMessage({ type: "ChatHosted", username: username, viewers: viewers });
});
TwitchConn.on("ChatSubscription", username => {
	OverlayConn.send({ type: "ChatSubscription", username: username });
	sendControlMessage({ type: "ChatSubscription", username: username });
});
TwitchConn.on("ChatResubscription", (username, months, message) => {
	OverlayConn.send({ type: "ChatResubscription", username: username, months: months, message: message });
	sendControlMessage({ type: "ChatResubscription", username: username, months: months, message: message });
});
TwitchConn.on("ChatAction", (userstate, message, self) => {
	OverlayConn.send({ type: "ChatAction", userstate: userstate, message: message, self: self });
	sendControlMessage({ type: "ChatAction", userstate: userstate, message: message, self: self });
});
TwitchConn.on("ChatWhisper", (from, userstate, message, self) => {
	sendControlMessage({ type: "ChatWhisper", from: from, userstate: userstate, message: message, self: self });
});
TwitchConn.on("ChatTimeout", (username, reason, duration) => {
	OverlayConn.send({ type: "ChatTimeout", username: username, reason: reason, duration: duration });
	sendControlMessage({ type: "ChatTimeout", username: username, reason: reason, duration: duration });
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
	sendControlMessage({ type: "FollowerList", followers: followers });
	OverlayConn.sendOne({ type: "FollowerList", followers: followers });
});
TwitchConn.on("StreamDetailsUpdated", () => {
	sendControlMessage({ type: "TwitchDetails", game: TwitchConn.game, title: TwitchConn.title });
	OverlayConn.sendOne({ type: "TwitchDetails", game: TwitchConn.game, title: TwitchConn.title });
});
TwitchConn.on("TwitchDisplayName", streamer => {
    sendControlMessage({ type: "StreamerName", name: streamer });
    OverlayConn.sendOne({ type: "StreamerName", name: streamer });
});

var StreamTipConn = new StreamTipConnector();
StreamTipConn.on("Status", state => {
	sendControlMessage({ type: "Status(StreamTip)", status: state });
	updateStatus();
});
StreamTipConn.on("NeedAuth", authURL => {
	//ControlConn.sendAuthRequest({ type: "NeedAuth", value: authURL });
	sendControlMessage({ type: "NeedAuth", service: "StreamTip", uri: authURL });
	//doAuthPopup(authURL);
});
StreamTipConn.on("newTip", tip => {
	sendControlMessage({ type: "NewTip", tip: tip.data });
	OverlayConn.send({ type: "NewTip", tip: tip.data });
});
StreamTipConn.on("GoalUpdated", () => {
	sendControlMessage({ type: "GoalUpdated", goal: StreamTipConn.goal });
	OverlayConn.send({ type: "GoalUpdated", goal: StreamTipConn.goal });
});

OverlayConn.on("OpenConnections", count => {
    sendControlMessage({ type: "OverlayConnections", count: count });
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
            "{bold}Overlays{/bold}: " + OverlayConn.connections
        ]
    } else {
        output = [
            "{bold}Twitch{/bold}: " + TwitchConn.status,
            "{bold}Leg_Bot{/bold}: Waiting for Username from Twitch",
            "{bold}StreamTip{/bold}: " + StreamTipConn.status,
            "{bold}Overlays{/bold}: " + OverlayConn.connections
        ]
    }
	log.updateStatus(output);
}

StreamTipConn.connect();
TwitchConn.connect();
//LegBotConn.connect();
process.on("beforeExit", (exitCode) => {
	console.log("BeforeExit called, exit code", exitCode);
	log.log.error("BeforeExit called, exit code", exitCode);
});
process.on("exit", (code) => {
	console.log("Exit called, code", code);
	log.log.error("Exit called, code", code);
	process.exit();
});
process.on("warning", (warning) => {
	console.log("Warning called", warning.name, warning.message, warning.stack);
	log.log.warn("Warning called", warning.name, warning.message, warning.stack);
});
process.on("SIGHUP", () => {
	console.log("SigHUP!");
	log.log.warn("SigHUP!");
});
process.on("SIGTERM", () => {
	console.log("SigTERM");
	log.log.warn("SigTERM");
});
	