"use strict";
const EventEmitter = require("events").EventEmitter;
const Connector = require("./WebsocketListener.js");
const log = require("./ConsoleLogging.js").log;
const BufferLength = 100;

module.exports = class ControlConnection extends EventEmitter {
	constructor(Server) {
		super();
		// Make yourself a Connection object and get it set up.
		this.connection = new Connector(Server, "Control");
		this.replayBuffer = [];
		this.AuthNeeded = [];
		this.connections = 0;
		// Wire up an event handler to the "Replay" event, so we can
		// Replay messages that are in our buffer to try and maintain state.
		this.connection.on("Replay", (conn) => {
			this.getAuthRequest();
			this.replayBuffer.forEach((entry) => {
				conn.send(JSON.stringify(entry));
			});
		});
		this.connection.on("ReceivedJSON", message => {
			this.emit("ReceivedJSON", message);
        });
        this.connection.on("OpenConnections", connections => {
			this.connections = connections;
            this.emit("OpenConnections", connections);
        });
		this.getAuthRequest();
	}
	removeByType(type) {
		var removals = [];

		// For each item in the replay buffer (by index)
		for (var i = 0; i < this.replayBuffer.length; i++) {

			// Build a list of indexes to remove.
			if (this.replayBuffer[i].type && this.replayBuffer[i].type == type) removals.unshift(i);
		}

		// Then remove them (Last entry first), to ensure numbers don't change as we're removing them.
		removals.forEach((deadCode) => {
			this.replayBuffer.splice(deadCode, 1);
		});
	}
	sendAuthRequest(data) {
		this.AuthNeeded.push(data);
	}
	getAuthRequest() {
		if (this.AuthNeeded.length > 0) {
			this.connection.send(this.AuthNeeded[0]);
		}
	}
	getNextAuthRequest() {
		this.AuthNeeded.shift();
		return this.getAuthRequest();
	}
	send(data) {
		// Add new data to the end of the buffer.
		var len = this.replayBuffer.push(data);

		// If the buffer is longer than BufferLength lines (which we'll find out as .push returns the length of the newly modified array)
		if (len > BufferLength) {
			// Remove the first (Bufferlength - length) entries, which should reduce it to BufferLength entries.
			this.replayBuffer.splice(0, BufferLength - len);
		}
        //log.debug("Sending", data);
        this.connection.send(data);
	}
	sendOne(data) {
		// Remove the entries from the list...
		this.removeByType(data.type);
		// Then send the data, as normal.
		this.send(data);
	}
	removeByCallback(callback) {
		var removals = [];
		for (var i = 0; i < this.replayBuffer.length; i++) {
			if (callback(this.replayBuffer[i])) removals.unshift(i);
		}
		removals.forEach((deadIndex) => {
			this.replayBuffer.splice(deadIndex, 1);
		});
	}
	sendByFunc(data, callback) {
		this.removeByCallback(callback);
		this.send(data);
	}
}