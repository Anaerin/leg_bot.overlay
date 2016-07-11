const EventEmitter = require("events").EventEmitter,
	HTTPS = require("https").request,
	URL = require("url"),
	QueryString = require("querystring"),
	StreamTip = require("streamtip");

const oAuth = require("./oAuthHandler.js");
const StreamTipSecrets = require("../secrets.js").StreamTip;

class StreamTipConnector extends EventEmitter {
	constructor() {
		this.oAuth = new oAuth(StreamTipSecrets.clientID, StreamTipSecrets.clientSecret, "https://streamtip.com/api/oauth2/token");
		this.oAuth.on("NeedAuth", () => {
			this.emit("NeedAuth", "https://streamtip.com/api/oauth2/authorize" +
				"?response_type=" + "code" +
				"&client_id=" + this.clientID +
				"&redirect_uri=" + QueryString.escape("http://localhost:3000/code"));
		});
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
		this.goal = this.getActiveGoal();
	}
	getActiveGoal() {
		var goals = this.streamTip.API.getAllGoals();
		goals.forEach(goal => {
			if (goal.active) {
				this.goal = goal;
			}
		});
	}
}