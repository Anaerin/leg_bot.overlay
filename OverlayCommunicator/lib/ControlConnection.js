const EventEmitter = require("events").EventEmitter;
const Connector = require("./WebsocketListener.js");
const BufferLength = 100;

class ControlConnection extends EventEmitter {
	constructor(Server) {
		// Make yourself a Connection object and get it set up.
		this.connection = new Connector(Server, "Overlay");
		this.replayBuffer = [];
		this.eventList = [];

		// Wire up an event handler to the "Replay" event, so we can
		// Replay messages that are in our buffer to try and maintain state.
		this.connection.on("Replay", (conn) => {
			this.replayBuffer.forEach((entry) => {
				conn.send(JSON.stringify(entry));
			});
		});
	}
	removeByType(type) {
		var removals = [];

		// For each item in the replay buffer (by index)
		for (var i = 0; i < this.replayBuffer.length; i++) {

			// Build a list of indexes to remove.
			if (this.replayBuffer[i].type && this.replayBuffer[i].type == type) {

				// Place each new entry at the beginning of the list (Essentially building the list backwards).
				// This could be a performance issue, but fortunately this list should never get particularly long.
				removals.unshift(i);
			}
		}

		// Then remove them (Last entry first), to ensure numbers don't change as we're removing them.
		removals.forEach((deadCode) => {
			this.replayBuffer.splice(deadCode, 1);
		});
	}
	send(data) {
		// Add new data to the end of the buffer.
		var len = this.replayBuffer.push(data);

		// If the buffer is longer than BufferLength lines (which we'll find out as .push returns the length of the newly modified array)
		if (len > BufferLength) {
			// Remove the first (Bufferlength - length) entries, which should reduce it to BufferLength entries.
			this.replayBuffer.splice(0, BufferLength - len);
		}
		this.connection.send(data);
	}
	sendOne(data) {
		// Remove the entries from the list...
		this.removeByType(data.type);
		// Then send the data, as normal.
		this.send(data);
	}
	
}