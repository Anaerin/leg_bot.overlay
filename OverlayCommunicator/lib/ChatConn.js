var tmi = require("tmi.js");

module.exports = function ConnectToChat(channel) {
	this.client = new tmi();
	
}