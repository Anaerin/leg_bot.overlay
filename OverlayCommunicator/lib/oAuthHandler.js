"use strict";
const EventEmitter = require("events").EventEmitter,
	HTTPS = require("https").request,
	URL = require("url"),
	QueryString = require("querystring");

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
        //console.log("%s:Checking for valid token", this.authPath);
        var isValid = false;
        if (this.AccessToken) {
            //console.log("%s:Have token", this.authPath);
            isValid = true;
		}
		if (this.AccessTokenExpires && this.AccessTokenExpires < new Date(Date.now()).getTime()) {
            //console.log("%s:Token has expiry, and has expired", this.authPath);
            isValid = false;
		}
        if (!isValid) {
            //console.log("%s:Token is not valid thus far...", this.authPath);
            if (this.RefreshToken && this.RefreshTokenExpires > new Date(Date.now()).getTime()) {
                //console.log("%s:Have valid refresh token, using it", this.authPath);
                return this.refreshTokenWithRefreshToken();
			}
            if (!this.waitingForToken) {
                //console.log("%s:Token is invalid, and we're not waiting for a token currently", this.authPath);
                this.waitingForToken = true;
                this.emit("NeedAuth");
            }
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
		var request = HTTPS(requestOptions, res => {
			res.setEncoding('utf8');
			res.on('data', chunk => {
				try {
					var result = JSON.parse(returnData + chunk);
				} catch (e) {
					// Data isn't complete, or didn't parse for some reason
					returnData += chunk
				}
				if (result) {
                    //console.log("%s:Retrieved access token: ", this.authPath, result);
                    this.AccessToken = result.access_token;
                    if (result.expires_in) {
                        //console.log("%s:Have expiry time for token", this.authPath);
                        this.AccessTokenExpires = new Date(Date.now()).getTime() + (result.expires_in * 1000);
                    } else {
                        //console.log("%s:No expiry time for token", this.authPath);
                        this.AccessTokenExpires = false;
                    }
                    if (result.refresh_token) {
                        //console.log("%s:Have refresh token", this.authPath);
                        this.RefreshToken = result.refresh_token;
                        this.RefreshTokenExpires = new Date(Date.now()).getTime() + 2592000000;
                    } else {
                        //console.log("%s:No refresh token", this.authPath);
                        this.RefreshToken = false;
                        this.RefreshTokenExpires = false;
                    }
					//Here's hoping we don't get multi-chunk data. The try/catch should sort it out, hopefully...
                    complete = true;
                    this.emit("AuthComplete");
				};
            });
            res.on("error", err => {
                console.log("%s: oAuthHandler response Error: %s", this.authPath, err);
            });
        });
        request.on("error", error => {
            console.log("%s: Got HTTP error: %s", this.authPath, error);
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
            var tokenGetter = {
                client_id: this.clientID,
                client_secret: this.clientSecret,
                grant_type: "authorization_code",
                redirect_uri: "http://localhost:8000/code",
                code: value
            }
            this.getToken(tokenGetter);
            this.waitingForToken = false;
        }
    }
}