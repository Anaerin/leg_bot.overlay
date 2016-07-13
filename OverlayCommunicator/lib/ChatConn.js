"use strict";
const EventEmitter = require("events").EventEmitter;
const tmi = require("tmi.js");


module.exports = class ChatConnector extends EventEmitter {
    constructor(streamer) {
        super();
    }
}