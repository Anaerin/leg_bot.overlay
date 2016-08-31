"use strict";
const EventEmitter = require("events").EventEmitter,
	WebSocket = require("websocket").client,
	HTTP = require("http");
const log = require("./ConsoleLogging.js").log;

module.exports = class LegBotConnector extends EventEmitter {
	constructor(streamer) {
		super();
		this.streamer = streamer.toLowerCase();
		this.wsPath = "ws://ghostoflegbot.website/ws/" + this.streamer;
		this.websocket = new WebSocket();
		this.stats = {};
		this.game = {};
		this.status = "Disconnected";
		this.emit("Status", "Disconnected");
		this.websocket.on("connect", (connection) => {
			this.status = "Connected";
			this.emit("Status", "Connected");
			connection.on("message", message => {
				if (message.type == "utf8") {
					this.messageReceived(JSON.parse(message.utf8Data));
				} else {
					log.warn("LegBotConnector: Received unknown datatype (%s)", message.type);
				}
			});
			connection.on("close", () => {
				this.status = "Reconnecting";
				this.emit("Status", "Reconnecting");
				this.connect();
			});
			connection.on("error", err => {
				this.status = "Error";
				this.emit("Status", "Error: " + err.toString());
				this.connect();
			});
		});
		this.websocket.on("connectFailed", (errorDescription) => {
			this.status = "Error";
			this.emit("Status", "Error");
			log.warn("LegBotConnector: Websocket ConnectFailed - %s", errorDescription);
		});
		this.fetchValues();
	}
	fetchValues() {
		var request = HTTP.get({
			hostname: "ghostoflegbot.website",
			port: 80,
			path: "/api/channel/" + this.streamer
		}, (res) => {
			res.setEncoding("utf8");
			var returnData = "";
			res.on("data", (data) => {
				try {
					var result = JSON.parse(returnData + data);
				} catch (e) {
					returnData += data;
				} finally {
					if (result) {
						this.game = result.game;
						this.emit("GameChanged", this.game);
						result.statistics.forEach(stat => {
							this.stats[stat] = result.counts[stat];
							this.emit("StatChanged", stat, result.counts[stat]);
						});
					}
				}
			});
		});
	}
	connect() {
		this.status = "Connecting";
		this.emit("Status", "Connecting");
		this.websocket.connect(this.wsPath);
	}
	messageReceived(messageJSON) {
		switch (messageJSON.action) {
			case "GameChanged":
				this.game = messageJSON.game;
				this.emit("GameChanged", this.game);
				break;
			case "StatChanged":
				this.stats[messageJSON.stat] = messageJSON.value;
				this.emit("StatChanged", messageJSON.stat, messageJSON.value);
				break;
			default:
				this.emit("MessageReceived", messageJSON);
		}
	}

}