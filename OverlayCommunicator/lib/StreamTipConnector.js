"use strict";
const EventEmitter = require("events").EventEmitter,
    HTTPS = require("https"),
    URL = require("url"),
    QueryString = require("querystring"),
    WebSocket = require("websocket").client;

const oAuth = require("./oAuthHandler.js");
const StreamTipSecrets = require("../secrets.js").StreamTip;

module.exports = class StreamTipConnector extends EventEmitter {
	constructor() {
        super();
        this.oAuth = new oAuth(StreamTipSecrets.clientID, StreamTipSecrets.clientSecret, "https://streamtip.com/api/oauth2/token");
		this.oAuth.on("NeedAuth", () => {
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
        });
    }
    connect() {
        if (this.oAuth.accessToken) {
            this.streamTip = new WebSocket()
            this.streamTip.on("message", (message) => {
                var tip = JSON.parse(message.utf8Data);
                if (tip.goal) {
                    this._goal = tip.goal;
                }
                this.emit("newTip", tip);
            });
            this.streamTip.on("error", err => {
                console.log("StreamTipConnector: Error - %s", err.message);
            });
            this.streamTip.on("close", reason => {
                console.log("StreamTipConnector: Websocket closed - %s", err);
				this.connect();
            });
			this.streamTip.connect("wss://streamtip.com/ws?access_token=" + QueryString.escape(this.oAuth.accessToken));
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
                }
            });
            res.on("error", err => {
                console.log("StreamTip getActiveGoal res error: %s", err);
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
            this.connect();
        });
    }
}