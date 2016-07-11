const EventEmitter = require("events").EventEmitter,
	HTTP = require("http").request,
	URL = require("url"),
	QueryString = require("querystring"),
	TMI = require("tmi.js");

const oAuth = require("./oAuthHandler.js");
const TwitchSecrets = require("../secrets.js").Twitch;

class TwitchConnector extends {
	constructor(streamer) {
		this.oAuth = new oAuth(TwitchSecrets.clientID, TwitchSecrets.clientSecret, "https://api.twitch.tv/kraken/oauth2/token");
		this.oAuth.on("NeedAuth", () => {
			this.emit("NeedAuth", "https://api.twitch.tv/kraken/oauth2/authorize" +
				"?response_type=" + "code" +
				"&client_id=" + this.clientID +
				"&redirect_uri=" + QueryString.escape("http://localhost:3000/code") +
				"&scope=" + [
					"channel_editor",
					"channel_commercial",
					"channel_subscribers",
					"chat_login"
				].join(" ") +
				"&state=" + "Twitch");
		});
		this.streamer = streamer;
		this.tmi = new TMI.client({
			connection: {
				reconnect: true,
				secure: true
			},
			identity: {
				username: streamer,
				password: "oauth" + this.oAuth.authToken()
			},
			channels: [ streamer ]
		});
		this.tmi.connect();
		
	}
}