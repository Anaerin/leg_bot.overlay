"use strict";
const EventEmitter = require("events").EventEmitter,
	URL = require("url"),
	QueryString = require("querystring"),
	TMI = require("tmi.js");

const oAuth = require("./oAuthHandler.js");
const TwitchSecrets = require("../secrets.js").Twitch;

module.exports = class TwitchConnector extends EventEmitter {
	constructor(streamer) {
		super();
		this.streamer = streamer;
		this.followers = [];
		this.followerCount = 0;
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
	setStreamDetails(game, title) {
		var streamDetails = {};
		if (game) streamDetails["game"] = game;
		if (title) streamDetails["title"] = title;
		putAPIValue("https://api.twitch.tv/kraken/channels/" + this.streamer, streamDetails, (err, res, body) {
			this.emit("GameUpdated");
		});
	}
	putAPIValue(url, data, callback) {
		var requestObj = {
			url: url,
			headers: {
				Accept: "application/vnd.twitchtv.v3+json",
				'Client-ID': this.oAuth.clientID,
				Authorization: "OAuth " + this.oAuth.accessToken
			},
			body: data,
			method: "put",
			json: true
		}
		var request = this.tmi.api(requestObj, callback);
	}
	getAPIValue(url, callback) {
		var requestObj = {
			url: url,
			headers: {
				Accept: "application/vnd.twitchtv.v3+json",
				'Client-ID': this.oAuth.clientID,
				Authorization: "OAuth " + this.oAuth.accessToken
			}
		}		
		var returnVal;
		var request = this.tmi.api(requestObj, callback);
	}
	updateFollowers() {
		this.getAPIValue("https://api.twitch.tv/kraken/channels/" + this.streamer + "/follows?limit=100", (err, res, body) => {
			body.follows.forEach(follower => {
				if (this.followers.contains(follower.user.display_name)) {
					this.emit("NewFollower", follower.user.display_name);
					this.followers.push(follower.user.display_name);
				}
			});
		});
	}
	getFollowers(fetchLink) {
		if (!fetchLink) fetchLink = "https://api.twitch.tv/kraken/channels/" + this.streamer + "/follows?limit=100";
		this.getAPIValue(fetchLink, (err, res, body) => {
			this.followerCount = body._total;
			body.follows.forEach(follower => {
				this.followers.push(follower.user.display_name);
			});
			if (body._cursor) {
				this.getFollowers(body._links.next);
			} else {
				this.emit("FollowersPopulated", this.followers);
				this.followerUpdate = setInterval(() => {
					this.updateFollowers();
				}, 60000);
			}
		});
	}
	connect() {
		if (this.oAuth.accessToken) {
			if (!this.tmi) {
				this.tmi = new TMI.client({
					connection: {
						reconnect: true,
						secure: true
					},
					identity: {
						username: this.streamer,
						password: "oauth:" + this.oAuth.accessToken
					},
					channels: [this.streamer]
				});
				this.tmi.on("chat", (channel, userstate, message, self) => {
					//console.log("DEBUG: TwitchConnector: Message received: %s", message);
					this.emit("ChatMessage", userstate, message, self);
				});
				this.tmi.on("whisper", (from, userstate, message, self) => {
					this.emit("ChatWhisper", from, userstate, message, self);
				});
				this.tmi.on("clearchat", channel => {
					this.emit("ChatClear");
				});
				this.tmi.on("action", (channel, userstate, message, self) => {
					this.emit("ChatAction", userstate.username, userstate, message, self);
				});
				this.tmi.on("hosted", (channel, username, viewers) => {
					this.emit("ChatHosted", username, viewers);
				});
				this.tmi.on("subscription", username => {
					this.emit("ChatSubscription", username);
				});
				this.tmi.on("resub", (channel, username, months, message) => {
					this.emit("ChatResubscription", username, months, message );
				});
				this.tmi.on("timeout", (channel, username, reason, duration) => {
					this.emit("ChatTimeout", username, reason, duration );
				});
				this.tmi.on("disconnected", reason => {
					console.log("TwitchConnector: Disconnected - %s", reason);
				});
				this.tmi.on("connecting", (address, port) => {
					console.log("TwitchConnector: Connecting to %s:%s", address, port);
				});
				this.tmi.on("connected", (address, port) => {
					console.log("TwitchConnector: Connected to %s:%s", address, port);
				});
				this.tmi.on("error", error => {
					console.log("TwitchConnector: Error: %s", error);
				});
				this.tmi.connect();
				this.getFollowers();
			}
		}
	}

	sendChat(message) {
		if (this.tmi) {
			this.tmi.say(this.streamer, message);
		}
	}

	receivedCode(code) {
		this.oAuth.accessToken = code;
	}
}