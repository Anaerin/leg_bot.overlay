"use strict";
const EventEmitter = require("events").EventEmitter,
	HTTPS = require("https").request,
	Request = require("request"),
	URL = require("url");
	//QueryString = require("querystring");

var log = require("./ConsoleLogging.js").log;

module.exports = class oAuthHandler extends EventEmitter {
	constructor(clientID, clientSecret, authPath) {
        super();
        this.clientID = clientID;
		this.clientSecret = clientSecret;
		this.authPath = authPath;
		this.AccessToken = false;
		this.AccessTokenExpires = false;
		this.RefreshToken = false;
        this.RefreshTokenExpires = false;
        this.waitingForToken = false;
		this.waitingCallbacks = [];
	}

	hasValidToken() {
        //log.debug("%s:Checking for valid token", this.authPath);
        var isValid = false;
		log.debug("%s:Checking values. AccessToken: %s, ExpiresIn: %s, RefreshToken: %s, RefreshTokenExpires: %s", this.authPath, this.AccessToken, this.AccessTokenExpires, this.RefreshToken, this.RefreshTokenExpires);
		if (this.AccessToken) {
			log.debug("%s:Have token", this.authPath);
			isValid = true;
		}
		if (this.AccessTokenExpires && this.AccessTokenExpires < new Date(Date.now()).getTime()) {
            log.debug("%s:Token has expiry, and has expired", this.authPath);
            isValid = false;
		}
		log.debug("%s:Checking values finished. Is Valid? %s", this.authPath, isValid);
		if (!isValid) {
            log.debug("%s:Token is not valid thus far...", this.authPath);
            if (this.RefreshToken && this.RefreshTokenExpires > new Date(Date.now()).getTime()) {
                log.debug("%s:Have valid refresh token, using it", this.authPath);
                return this.refreshTokenWithRefreshToken();
			}
            if (!this.waitingForToken) {
                log.debug("%s:Token is invalid, and we're not waiting for a token currently", this.authPath);
                this.waitingForToken = true;
                this.emit("NeedAuth");
            }
		}
		return isValid;
	}
	getToken(postData) {
		log.debug("oAuth: inside getToken");
		// Patched to use request, rather than https.request
		//var requestData = QueryString.stringify(postData);
		//var returnData = "";
		log.debug("oAuth: Parsing authPath",this.authPath);
		var requestOptions = {
			url: this.authPath,
			method: "POST",
			form: postData
		};
		/*
		requestOptions.headers = {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(requestData)
		};*/

		var complete = false;
		log.debug("oAuth: Posting token");
		var request = Request(requestOptions, (err, res, body) => {
			/*
			log.debug("%s: oAuthHandler Request set up", this.authPath);
			res.setEncoding('utf8');
			log.debug("%s: oAuthHandler Setting up events", this.authPath);
			res.on("error", err => {
				log.warn("%s: oAuthHandler response Error: %s", this.authPath, err);
			});
			res.on('data', chunk => {
				log.debug("oAuth: Got data", chunk);
				try {
					var result = JSON.parse(returnData + chunk);
				} catch (e) {
					// Data isn't complete, or didn't parse for some reason
					log.debug("oAuth: Data doesn't parse. Gimme more pls.");
					returnData += chunk
				} */
			log.debug("oAuth Token request has got... something...", body, res.statusCode, typeof(body));
			var data = body;
			if (typeof (data) === "string") data = JSON.parse(body);
			if (data) {
				log.debug("%s: Retrieved access token: %s (Type: %s)", this.authPath, data, typeof (data));
				this.AccessToken = data.access_token;
				log.debug("%s: Set access token. Have we crashed yet?", this.authPath);
				if (data.expires_in) {
					log.debug("%s:Have expiry time for token", this.authPath);
					this.AccessTokenExpires = new Date(Date.now()).getTime() + (data.expires_in * 1000);
				} else {
					log.debug("%s:No expiry time for token", this.authPath);
					this.AccessTokenExpires = false;
				}
				if (data.refresh_token) {
					log.debug("%s:Have refresh token", this.authPath);
					this.RefreshToken = data.refresh_token;
					this.RefreshTokenExpires = new Date(Date.now()).getTime() + 2592000000;
				} else {
					log.debug("%s:No refresh token", this.authPath);
					this.RefreshToken = false;
					this.RefreshTokenExpires = false;
				}
				//Here's hoping we don't get multi-chunk data. The try/catch should sort it out, hopefully...
				complete = true;
				log.debug("%s:Set values. AccessToken: %s, ExpiresIn: %s, RefreshToken: %s, RefreshTokenExpires: %s", this.authPath, this.AccessToken, this.AccessTokenExpires, this.RefreshToken, this.RefreshTokenExpires);
				this.emit("AuthComplete");
			} else {
					log.debug("%s: That's not a valid result. Er... Help? err: %s, res: %s", this.authPath, err, res);
				//} */
            }//);
        });
		/* request.write(requestData);
		request.end(); */
		return complete;
	}
	refreshTokenWithRefreshToken() {
		var tokenRefresher = {
			client_id: this.clientID,
			client_secret: this.clientSecret,
			grant_type: "refresh_token",
			redirect_uri: "http://localhost:8000/code",
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
        if (this.waitingForToken) {
			log.debug("oAuth: We're received a token, and we were waiting for one! Joy!");
			var tokenGetter = {
                client_id: this.clientID,
                client_secret: this.clientSecret,
                grant_type: "authorization_code",
                redirect_uri: "http://localhost:8000/code",
                code: value
            }
			log.debug("oAuth: Getting auth code");
			this.getToken(tokenGetter);
            this.waitingForToken = false;
        }
    }
}