"use strict";
const EventEmitter = require("events").EventEmitter,
	HTTPS = require("https").request,
	URL = require("url"),
	QueryString = require("querystring"),
	StreamTip = require("streamtip");

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
            }
        });
		//this.goal = this.getActiveGoal();
    }
    connect() {
        if (this.oAuth.accessToken) {
            this.streamTip = new StreamTip({
                clientID: StreamTipSecrets.clientID,
                accessToken: this.oAuth.accessToken
            });
            this.streamTip.on("newTip", (tip) => {
                if (tip.goal) {
                    this.goal = tip.goal;
                }
                this.emit("newTip", tip);
            });
        }
    }
	getActiveGoal() {
        if (this.streamTip) {
            var goals = this.streamTip.API.getAllGoals();
            goals.forEach(goal => {
                if (goal.active) {
                    this.goal = goal;
                }
            });
        }
    }
    receivedCode(code) {
        this.oAuth.accessToken = code;
    }
}