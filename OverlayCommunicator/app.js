var secrets = require('./secrets.js');

var WebSocketServer = require('websocket').server,
	http = require('http'),
	https = require('https'),
	querystring = require('querystring'),
	url = require("url"),
	path = require("path"),
	fs = require("fs"),
    clients = [],
    open = require("open");

var contentTypesByExtension = {
	'.html': "text/html",
	'.css': "text/css",
	'.js': "text/javascript"
};



var streamTipAPIKeys = {};

var server = http.createServer(function (request, response) {
	console.log((new Date()) + ' Received request for ' + request.url);
	var uri = url.parse(request.url).pathname, filename = path.join(process.cwd(), "Overlay", uri);
	fs.exists(filename, function (exists) {
		if (!exists) {
			response.writeHead(404, { "Content-Type": "text/plain" });
			response.write("404 Not Found\n");
			response.end();
			return;
		}
		
		if (fs.statSync(filename).isDirectory()) filename += '/index.html';
		
		fs.readFile(filename, "binary", function (err, file) {
			if (err) {
				response.writeHead(500, { "Content-Type": "text/plain" });
				response.write(err + "\n");
				response.end();
				return;
			}
			var headers = {};
			var contentType = contentTypesByExtension[path.extname(filename)];
			if (contentType) headers["Content-Type"] = contentType;
			response.writeHead(200, headers);
			response.write(file, "binary");
			response.end();
		});
	});
});

server.listen(8000, function () {
	console.log((new Date()) + ' Server is listening on port 8000');
});

wsServer = new WebSocketServer({
	httpServer: server,
	// You should not use autoAcceptConnections for production
	// applications, as it defeats all standard cross-origin protection
	// facilities built into the protocol and the browser.  You should
	// *always* verify the connection's origin and decide whether or not
	// to accept it.
	autoAcceptConnections: false
});

open("http://localhost:8000/OverlayControl.html");

function originIsAllowed(origin) {
	// put logic here to detect whether the specified origin is allowed.
	return true;
}

function PostAuthToken(AuthorizationCode, Refresh) {
	var requestData = {
		"client_id": secrets.streamtipClientID, 
		"client_secret": secrets.streamtipClientSecret, 
		"redirect_url": secrets.streamtipRedirectURL, 
	};
	if (Refresh) {
		requestData['grant_type'] = 'refresh_token';
		requestData['refresh_token'] = AuthorizationCode;
	} else {
		requestData['grant_type'] = 'authorization_code';
		requestData['code'] = AuthorizationCode;
	}
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
	var responseFunction = function (res) {
		res.setEncoding('utf8');
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
				streamTipAPIKeys.AccessToken = result.access_token;
				streamTipAPIKeys.RefreshToken = result.refresh_token;
				streamTipAPIKeys.AccessTokenExpires = now.getTime() + (result.expires_in * 1000);
				streamTipAPIKeys.RefreshTokenExpires = now.getTime() + 2592000000;
				send({ name: "AuthToken", data: { APIKey: streamTipAPIKeys.AccessToken } });
				//Here's hoping we don't get multi-chunk data. The try/catch should sort it out, hopefully...
			};
		});
	}
	var request = https.request(requestOptions, responseFunction);
	request.write(requestData);
	request.end();
	request.on('error', function (err) { console.error(err); });
}

wsServer.on('request', function (request) {
	if (!originIsAllowed(request.origin)) {
		// Make sure we only accept requests from an allowed origin
		request.reject();
		console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
		return;
	}
	
	var connection = request.accept('overlay', request.origin);
	var clientIndex = clients.push(connection) - 1;
	console.log((new Date()) + ' Connection accepted.');
	connection.on('message', function (message) {
		if (message.type === 'utf8') {
			console.log('Received Message: ' + message.utf8Data);
			try {
				var data = JSON.parse(message.utf8Data);
			} catch (e) {
				//do nothing
			}
			if (data) {
                if (data.name == "Auth") {
                    //We've been asked for an auth key. Let's see what we can do about that...
                    if (!streamTipAPIKeys.AccessToken && !streamTipAPIKeys.RefreshToken) {
                        //No API keys, start from scratch.
                        send({ name: "AuthKeyRequest", clientID: secrets.streamtipClientID, redirectURL: secrets.streamtipRedirectURL });
                    } else if (streamTipAPIKeys.RefreshTokenExpires < Date.now()) {
                        //The refresh token has expired (It's been 30 days since last time? Yikes!), start from scratch.
                        send({ name: "AuthKeyRequest", clientID: secrets.streamtipClientID, redirectURL: secrets.streamtipRedirectURL });
                    } else if (streamTipAPIKeys.AccessTokenExpires < Date.now()) {
                        //Access key has expired. Use the refresh key to get a new one.
                        PostAuthToken(streamTipAPIKeys.RefreshToken, true);
                    } else if (streamTipAPIKeys.RefreshTokenExpires > Date.now() && streamTipAPIKeys.AccessTokenExpires > Date.now()) {
                        //We have a valid and in-date access key. Give it back.
                        send({ name: "AuthToken", data: { APIKey: streamTipAPIKeys.AccessToken } });
                    } else {
                        //We should never get here.
                        console.warn("Something happened with the access token system... No idea what.");
                        console.warn("Here's what we know: streamTipAPIKeys is ", streamTipAPIKeys);
                    }
                } else if (data.name == "AuthCode") {
                    PostAuthToken(data.data, false);
                } else {
					send(message.utf8Data);
				}
			} else {
				sned(message.utf8Data);
			}
		}
	});
	connection.on('close', function (reasonCode, description) {
		console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
		var index = 0;
		for (var i = 0; i < clients.length; i++) {
			if (clients[i] === connection) {
				index = i;
				break;
			}
		}
		clients.splice(index, 1);
	});
});

function send(message) {
	if (typeof message === 'string') {
		clients.forEach(function (client) {
			//Send it back to everyone.
			client.sendUTF(message);
		});
	} else {
		clients.forEach(function (client) {
			//Send it back to everyone.
			client.sendUTF(JSON.stringify(message));
		});
	}
}