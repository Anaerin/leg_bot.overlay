"use strict";
const EventEmitter = require("events").EventEmitter,
	HTTP = require("http").request,
	URL = require("url"),
	QueryString = require("querystring"),
	TMI = require("tmi.js");

const oAuth = require("./oAuthHandler.js");
const TwitchSecrets = require("../secrets.js").Twitch;

module.exports = class TwitchConnector extends EventEmitter {
	constructor(streamer) {
        super();
        this.streamer = streamer;
        this.oAuth = new oAuth(TwitchSecrets.clientID, TwitchSecrets.clientSecret, "https://api.twitch.tv/kraken/oauth2/token");
		this.oAuth.on("NeedAuth", () => {
			this.emit("NeedAuth", "https://api.twitch.tv/kraken/oauth2/authorize" +
				"?response_type=" + "code" +
                "&client_id=" + TwitchSecrets.clientID +
				"&redirect_uri=" + QueryString.escape("http://localhost:8000/code") +
				"&scope=" + [
					"channel_editor",
					"channel_commercial",
					"channel_subscriptions",
					"chat_login"
				].join(" ") +
				"&state=" + "Twitch");
        });
        this.oAuth.on("AuthComplete", () => {
            this.emit("AuthComplete");
            if (!this.tmi) {
                this.connect();
            }
        });
    }

    connect() {
        if (this.oAuth.accessToken) {
            this.tmi = new TMI.client({
                connection: {
                    reconnect: true,
                    secure: true
                },
                identity: {
                    username: this.streamer,
                    password: "oauth" + this.oAuth.accessToken
                },
                channels: [this.streamer]
            });
            this.tmi.connect();
            this.tmi.on("message", message => {
                this.emit("ChatMessage", message);
            });
        }
    }

    receivedCode(code) {
        this.oAuth.accessToken = code;
    }
}