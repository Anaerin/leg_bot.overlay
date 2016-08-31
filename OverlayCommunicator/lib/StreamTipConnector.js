"use strict";
const EventEmitter = require("events").EventEmitter,
	HTTPS = require("https"),
	URL = require("url"),
	QueryString = require("querystring"),
	WebSocket = require("websocket").client;

const oAuth = require("./oAuthHandler.js");
const StreamTipSecrets = require("../secrets.js").StreamTip;
var log = require("./ConsoleLogging.js").log;

module.exports = class StreamTipConnector extends EventEmitter {
	constructor() {
		super();
		this.oAuth = new oAuth(StreamTipSecrets.clientID, StreamTipSecrets.clientSecret, "https://streamtip.com/api/oauth2/token");
		this.status = "Disconnected";
		this.oAuth.on("NeedAuth", () => {
			this.status = "Need Auth";
			this.emit("Status", "Need Auth");
			this.emit("NeedAuth", "https://streamtip.com/api/oauth2/authorize" +
				"?response_type=" + "code" +
				"&client_id=" + StreamTipSecrets.clientID +
				"&redirect_uri=" + QueryString.escape("http://localhost:8000/code") +
				"&state=StreamTip");
		});
		this.oAuth.on("AuthComplete", () => {
			this.emit("AuthComplete");
			if (!this.streamTip) {
                this.connect();
				this._goal = this.getActiveGoal();
			}
			this.status = "Auth Complete";
			this.emit("Status", "Auth Complete");
		});
	}
	connect() {
        log.debug("StreamTipConnector: Connecting");
        if (this.oAuth.accessToken && !this.streamTip) {
            log.debug("StreamTipConnector: Creating Websocket");
            this.streamTip = new WebSocket()
            this.streamTip.on("connect", connection => {
				this.status = "Connected";
                this.emit("Status", "Connected");
                connection.on("message", message => {
                    var tip = JSON.parse(message.utf8Data);
                    if (tip.goal) {
                        this._goal = tip.goal;
                        this.emit("GoalUpdated");
                    }
                    this.emit("newTip", tip);
                });
                connection.on("error", err => {
					this.status = "Error";
                    this.emit("Status", "Error");
                    log.warn("StreamTipConnector: Error - %s", err.message);
                });
                connection.on("close", reason => {
					this.status = "Reconnecting";
                    this.emit("Status", "Reconnecting");
                    log.debug("StreamTipConnector: Websocket closed - %s", reason);
                    this.streamTip = false;
                    setTimeout(this.connect.bind(this), 1000);
                });
            });
            this.streamTip.connect("wss://streamtip.com/ws?access_token=" + QueryString.escape(this.oAuth.accessToken));
        } else if (!this.streamTip) {
            // We got here because we don't have an access token - We should be authorizing by now.
            log.debug("StreamTipConnector: No access token. Authorizing...");
			this.status = "Authorizing";
            this.emit("Status", "Authorizing");
        } else {
            log.debug("StreamTipConnector: connect called with streamtip object and access token. Streamtip object is %s", typeof this.streamTip);
        }
	}
	getActiveGoal() {
		var url = URL.parse("https://streamtip.com/api/goals/active");
		url['headers'] = {
			"Authorization": "Bearer " + this.oAuth.accessToken
		};
		var request = HTTPS.get(url, res => {
			res.setEncoding("utf-8");
			var receivedData = "";
			res.on("data", chunk => {
				try {
					var result = JSON.parse(receivedData + chunk);
				} catch (e) {
					// Data isn't complete, or didn't parse for some reason
					receivedData += chunk
				}
				if (result) {
					this._goal = result.goal;
					this.emit("GoalUpdated");
				}
			});
			res.on("error", err => {
				log.warn("StreamTip getActiveGoal res error: %s", err);
			});
		});
	}
	get goal() {
		if (this._goal) return this._goal;
		this.getActiveGoal();
		return this._goal;
	}
	receivedCode(code) {
		this.oAuth.accessToken = code;
		this.oAuth.on("AuthComplete", () => {
			this.status = "Connecting";
            this.emit("Status", "Connecting");
            this.connect();
		});
	}
}