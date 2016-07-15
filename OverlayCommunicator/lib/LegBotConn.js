"use strict";
const EventEmitter = require("events").EventEmitter,
	WebSocket = require("websocket").client,
	HTTP = require("http");

module.exports = class LegBotConnector extends EventEmitter {
	constructor(streamer) {
        super();
        this.streamer = streamer;
		this.wsPath = "ws://ghostoflegbot.website/ws/" + this.streamer;
		this.websocket = new WebSocket();
		this.stats = {};
		this.game = {};
		this.websocket.on("connect", (connection) => {
			console.log("LegBotConn: Websocket Connected!");
			connection.on("message", (message) => {
				console.log("LegBotConn: It's alive! Received %s!", message.type);
				if (message.type == "utf8") {
					console.log("LegBotConn: It's UTF8, and it reads %s!", message.utf8Data);
					this.messageReceived(JSON.parse(message.utf8Data));
				} else {
					console.log("LegBotConnector: Received unknown datatype (%s)", message.type);
				}
			});
		});
		this.websocket.on("connectFailed", (errorDescription) => {
			console.log("LegBotConnector: Websocket ConnectFailed - %s", errorDescription);
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