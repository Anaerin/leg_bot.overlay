const EventEmitter = require("events").EventEmitter,
	HTTPS = require("https").request,
	URL = require("url"),
	QueryString = require("querystring");

module.exports = class oAuthHandler extends EventEmitter {
	constructor(clientID, clientSecret, authPath) {
		this.clientID = clientID;
		this.clientSecret = clientSecret;
		this.authPath = authPath;
		this.AccessToken = false;
		this.AccessTokenExpires = false;
		this.RefreshToken = false;
		this.RefreshTokenExpires = false;
		this.waitingCallbacks = [];
	}

	hasValidToken() {
		var isValid = false;
		if (this.AccessToken) {
			isValid = true;
		}
		if (this.AccessTokenExpires && this.AccessTokenExpires < Date.now().getTime()) {
			isValid = false;
		}
		if (!isValid) {
			if (this.RefreshToken && this.RefreshTokenExpires > Date.now().getTime()) {
				return this.refreshTokenWithRefreshToken();
			}
			this.emit("NeedAuth");
		}
		return isValid;
	}
	getToken(postData) {
		var requestData = QueryString.stringify(postData);
		var returnData = "";
		var requestOptions = URL.parse(this.authPath);
		requestOptions.method = "post";
		requestOptions.headers = {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(requestData)
		};
		var complete = false;
		var request = HTTPS.request(requestOptions, res => {
			res.setEncoding('utf8');
			res.on('data', chunk => {
				try {
					var result = JSON.parse(returnData + chunk);
				} catch (e) {
					// Data isn't complete, or didn't parse for some reason
					returnData += chunk
				}
				if (result) {
					this.AccessToken = result.access_token;
					this.AccessTokenExpires = Date.now().getTime() + (result.expires_in * 1000);
					if (result.refresh_token) {
						this.RefreshToken = result.refresh_token;
						this.RefreshTokenExpires = Date.now().getTime() + 2592000000;
					}
					//Here's hoping we don't get multi-chunk data. The try/catch should sort it out, hopefully...
					complete = true;
				};
			});
		});
		request.write(requestData);
		request.end();
		return complete;
	}
	refreshTokenWithRefreshToken() {
		var tokenRefresher = {
			client_id: this.clientID,
			client_secret: this.clientSecret,
			grant_type: "refresh_token",
			redirect_uri: "http://localhost:3000/code",
			refresh_token: this.RefreshToken
		}
		return this.getToken(tokenRefresher);
	}
	get accessToken() {
		if (this.hasValidToken()) {
			return this.AccessToken;
		} else {
			return false;
		}
	}
	set accessToken(value) {
		var tokenGetter = {
			client_id: this.clientID,
			client_secret: this.clientSecret,
			grant_type: "authorization_code",
			redirect_uri: "http://localhost:3000/code",
			code: value
		}
		this.getToken(tokenGetter);
}