const EventEmitter = require("events").EventEmitter;

// Make us a controller for all the websockets we're going to be getting.
class WebsocketListener extends EventEmitter {
	constructor(Server, ConnectionType) {

		// Set up some basic containers.
		this.Server = Server;
		this.Type = ConnectionType;
		this.Connections = [];
		this.Callbacks = {};

		// Hook our event.
		this.Server.on("request", (request) => {

			// Is this a connection of the type we're interested in?
			if (request.origin == this.Type) {

				// Accept the connection.
				var connection = request.accept(this.Type, request.origin);
				connection.parent = this;
				// Hook the message event, so we get something when we get a message.
				connection.on("message", (message) => {

					// Is this message text?
					if (message.type === 'utf8') {
						//console.log('WSController(%s): Received Message: %s', this.Type, message.utf8Data);

						// Try and parse it.
						try {
							var data = JSON.parse(message.utf8Data);
						} catch (e) {

							// For some reason we couldn't parse the incoming JSON. This is a problem.
							console.log("WSController(%s): Message not valid JSON: %s", this.Type, message.utf8Data);
							return;
						} finally {

							// Emit event for the type (if it has one)
							if (data.type) {
								this.emit("ReceivedJSON:" + data.type.toString().toLowerCase(), data);
							}

							// Emit event that we've received data, in case someone wants to hook everything.
							this.emit("ReceivedJSON", data);
						}
					} else {
						// We shouldn't get here, as we're using JSON for everything. So error.
						console.log("WSController(%s): Received websocket message with binary type!", this.Type);
					}
				});

				// When the connection closes, clean up after ourselves.
				connection.on("close", function (reasonCode, description) {
					console.log("WSController(%s): Connection Closed (%s): %s", this.parent.Type, reasonCode, description);
					this.parent.Connections.splice(parent.Connections.indexOf(this), 1);
				});

				// Add this connection to our collection, for later correction.
				this.Connections.push(connection);

				// Ask anyone who is connected to replay events to this connection.
				this.emit("Replay", connection);
			} else {

				//Nope, we don't care about this. Bail out as fast as possible.
				return;
			}
		});
	}

	// Send to each established connection. Return false if we don't have any connections.
	send(JSONMessage) {
		if (this.Connections.length > 0) {
			this.Connections.forEach((connection) => {
				connection.send(JSON.stringify(JSONMessage));
			});
			return true;
		} else {
			return false;
		}
	}
}