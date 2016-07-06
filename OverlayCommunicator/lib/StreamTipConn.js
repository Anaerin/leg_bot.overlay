module.exports = function streamTip(channel) {
	this.streamTipAPIKeys = require('../secrets.js').StreamTip;
	this.streamTipSocket;
	this.socketOpen = false;
	this.overlayBroadcast;
	this.HasValidAccessToken = function () {
		if (this.streamTipAPIKeys.AccessToken && this.streamTipAPIKeys.AccessTokenExpires < new Date(Date.now()).getTime()) return true;
		return false;
	}
	this.HasValidRefreshToken = function () {
		if (this.streamTipAPIKeys.RefreshToken && this.streamTipAPIKeys.RefreshTokenExpires < new Date(Date.now()).getTime()) return true;
		return false;
	}
	this.connectSocket = function () {
		this.streamTipSocket = new WebSocket('wss://streamtip.com/ws?access_token=' + this.AccessToken);
		this.streamTipSocket.caller = this;
		this.streamTipSocket.onopen = function (message) {
			this.caller.socketOpen = true;
			console.log("Streamtip Websocket open.");
		}
		this.streamTipSocket.onmessage = function (message) {
			var ref = this.caller;
			console.log("Got Streamtip websocket message: " + message.data);
			var event = JSON.parse(message.data);
			if (event.name == "newTip") {
				ref.donations.push(event.data);
				console.log("Pushing alert");
				ref.alertHandler.addToQueue({ message: event.data.username + " just donated " + event.data.currencySymbol + event.data.amount + "!", type: "donation" });
				ref.updateDonationList();
				if (event.data.goal) {
					console.log("Goal included, updating");
					ref.updateGoal(ref, event.data.goal);
				} else {
					ref.noGoal();
				}
			}
		}
		this.streamTipSocket.onerror = function (err) {
			console.log("Streamtip Socket Error " + JSON.stringify(err));
		}
		this.streamTipSocket.onclose = function (err) {
			this.caller.socketOpen = false;
			if (err.code === 4010) {
				console.log("Streamtip Auth failed");
				this.caller.connect();
			} else if (err.code === 4290) {
				console.log("Streamtip rate limited - reconnecting in 10 seconds...");
				setTimeout(this.caller.connect(), 100000);
			} else if (err.code === 4000) {
				console.log("Streamtip bad request");
			} else {
				console.log("Connection closed, error code " + err.code + ", " + err.reason);
				this.caller.connect();
			}
		}
	}
	this.connect = function () {
		if (this.HasValidAccessToken()) {
			this.connectSocket();
		} else if (this.HasValidRefreshToken()) {
			this.refreshToken();
		} else {
			this.requestNewToken();
		}
	}
	this.processUpdate = function (res) {
		res.setEncoding('utf8');
		var returnData = "";
		res.on('data', function (chunk) {
			try {
				var result = JSON.parse(returnData + chunk);
			} catch (e) {
				// Data isn't complete, or didn't parse for some reason
				returnData += chunk
			}
			if (result) {
				console.log('Got Auth Token.', result.access_token, "sending...");
				var now = new Date(Date.now());
				this.caller.streamTipAPIKeys.AccessToken = result.access_token;
				this.caller.streamTipAPIKeys.RefreshToken = result.refresh_token;
				this.caller.streamTipAPIKeys.AccessTokenExpires = now.getTime() + (result.expires_in * 1000);
				this.caller.streamTipAPIKeys.RefreshTokenExpires = now.getTime() + 2592000000;
				this.caller.connect();
				//Here's hoping we don't get multi-chunk data that's valid JSON part-way through. The try/catch should sort it out, hopefully...
			};
		});
	}
	this.requestToken = function (requestData) {
		requestData = querystring.stringify(requestData);
		var returnData = "";
		var requestOptions = {
			method: 'post',
			hostname: 'streamtip.com',
			port: 443,
			path: '/api/oauth2/token',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(requestData)
			}
		}
		var request = https.request(requestOptions, this.processUpdate);
		request.caller = this;
		request.write(requestData);
		request.end();
		request.on('error', function (err) { console.error(err); });

	}
	this.requestNewToken = function () {
		if (this.overlayBroadcast) {
			this.overlayBroadcast({ name: "AuthKeyRequest", clientID: this.streamTipAPIKeys.clientID, redirectURL: this.streamTipAPIKeys.redirectURL});
		} else {
			console.log("No overlay broadcast function found... can't get auth code");
	}
	this.requestNewTokenWithAuthCode = function (authorizationCode) {
		var requestData = {
			"client_id": this.streamTipAPIKeys.clientID,
			"client_secret": this.streamTipAPIKeys.clientSecret,
			"redirect_url": this.streamTipAPIKeys.redirectURL,
			"grant_type": 'authorization_code',
			"code": authorizationCode
		}
		this.requestToken(requestData);
	}
	this.refreshToken = function () {
		var requestData = {
			"client_id": this.streamTipAPIKeys.clientID,
			"client_secret": this.streamTipAPIKeys.clientSecret,
			"redirect_url": this.streamTipAPIKeys.redirectURL,
			"grant_type": 'refresh_token',
			"refresh_token": this.streamTipAPIKeys.RefreshToken
		}
		this.requestToken(requestData);
	}
}