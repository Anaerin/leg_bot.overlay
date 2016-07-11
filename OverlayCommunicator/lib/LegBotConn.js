const EventEmitter = require("events").EventEmitter,
	WebSocket = require("websocket").client,
	HTTP = require("http");

module.exports = class LegBotConnector extends EventEmitter {
	constructor(streamer) {
		this.streamer = streamer;
		this.wsPath = "ws://ghostoflegbot.website/ws/" + this.streamer;
		this.websocket = new WebSocket();
		this.stats = {};
		this.game = {};
		this.websocket.on("connect", (connection) => {
			this.wsConn = connection;
			this.wsConn.on("message", (message) => {
				if (message.type == "utf8") {
					this.messageReceived(JSON.parse(message.utf8Data));
				} else {
					console.log("LegBotConnector: Received unknown datatype (%s)", message.type);
				}
			});
		});
		this.websocket.on("connectFailed", (errorDescription) => {
			console.log("LegBotConnector: Error connecting - %s", errorDescription);
		});
		this.fetchValues();
	}
	fetchValues() {
		var request = HTTP.request({
			method: "get",
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
						this.statistics.forEach((stat) => {
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