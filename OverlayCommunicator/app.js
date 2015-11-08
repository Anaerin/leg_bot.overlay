﻿var WebSocketServer = require('websocket').server,
	http = require('http'),
	https = require('https'),
	querystring = require('querystring'),
	url = require("url"),
	path = require("path"),
	fs = require("fs"),
	clients = [];
var contentTypesByExtension = {
	'.html': "text/html",
	'.css': "text/css",
	'.js': "text/javascript"
};
var server = http.createServer(function (request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
	var uri = url.parse(request.url).pathname, filename = path.join(process.cwd(),"Overlay",uri);
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

function originIsAllowed(origin) {
    // put logic here to detect whether the specified origin is allowed.
    return true;
}

function PostAuthToken(ClientID, ClientSecret, AuthorizationCode) {
	var requestData = querystring.stringify({
		'client_id': ClientID,
		'client_secret': ClientSecret,
		'grant_type': 'authorization_code',
		'redirect_url': 'http://localhost:8000/OverlayControl.html',
		'code': AuthorizationCode
	});
	var request = https.request({
		method: 'post',
		hostname: 'streamtip.com',
		port: 443,
		path: '/api/oauth2/token',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(requestData)
		}
	}, function (res) {
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			//Here's hoping we don't get multi-chunk data.
		})
	}
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
				if (data.name == "CORSDefeater") {
					PostAuthToken(data.data.ClientID, data.data.ClientSecret, data.data.AuthorizationCode);
				}
			}
			clients.forEach(function (client) {
                //Send it back to everyone.
				console.log('Sending to client.');
				client.sendUTF(message.utf8Data);
            });
            //connection.sendUTF(message.utf8Data);
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