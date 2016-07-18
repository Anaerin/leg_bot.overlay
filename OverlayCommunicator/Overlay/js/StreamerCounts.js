function AlertHandler() {
    this.queue = [];
    this.playing = false;
	this.alertObject;
	this.cssClassObj;
    this.alertTypes = {};
    this.showAlert = function () {
		var obj = this.cssClassObj?this.cssClassObj:this.alertObject;
		obj.classList.add("visible");
    }
    
    this.hideAlert = function (callback) {
		var obj = this.cssClassObj?this.cssClassObj:this.alertObject;
		obj.classList.remove("visible");
    }
    this.checkQueue = function () {
        if (!this.queue.length || this.playing) return;
        this.displayAlert(this.queue.shift());
    }
    this.timer = false;
    this.displayAlert = function (message) {
        this.playing = true;
        this.alertObject.innerHTML = message.message;
		this.alertObject.className = message.type;
		var alertType = this.alertTypes[message.type];
        if (alertType && alertType.soundObj) {
            console.log("Got an alert sound - " + alertType.soundObj.currentTime);
            if (alertType.soundObj.currentTime == 0) {
                console.log("Got event, found thing. Calling it.");
				alertType.soundObj.caller = this;
				alertType.soundObj.fadeOut = alertType.fadeOut;
				alertType.soundObj.onended = function (e) {
                    console.log("Sound ended. Resetting");
                    ref = this.caller;
                    console.log("Seeking to 0");
                    if (e.currentTarget.fastSeek) {
                        e.currentTarget.fastSeek(0);
                        console.log("Fast seeking to 0");
                    }
                    e.currentTarget.currentTime = 0;
                    e.currentTarget.load();
                    console.log("I am now at 0. Honest. Look: " + e.currentTarget.currentTime);
                    ref.hideAlert();
                    ref.timer = setTimeout(function (ref) {
                        ref.playing = false;
                        ref.checkQueue();
                    }, this.fadeOut, ref);
                }
				alertType.soundObj.play();
                this.showAlert();
            } else {
                // We shouldn't get here. If we do, someone's being very proactive and trying to play while we're playing.
                // Put ourselves back at the top of the list.
                this.queue.unshift(message);
            }
        } else {
            this.showAlert();
            this.timer = setTimeout(function (ref) {
                ref.caller.hideAlert();
                ref.caller.timer = setTimeout(function (ref) {
                    ref.playing = false;
                    ref.checkQueue();
                }, ref.alertType.fadeOut, ref.caller);
            }, alertType.duration, { caller: this, alertType: alertType });
        }
    }
    this.addToQueue = function (data) {
        this.queue.push(data);
        this.checkQueue();
    }
}


function StreamCounters(streamerName) {
    this.numUpdates = 0;
    this.failedTimes = 0;
    this.updateTime = 0;
    this.countDownItem;
    this.gameNameItem;
    this.prependDashToGame = false;
	this.ws;
	this.updateCounter = function (name, value) {
		var counter = document.querySelectorAll("counter[data-name=" + name + "]")[0];
		if (counter.innerHTML != value) {
			counter.innerHTML = value;
			counter.parentElement.classList.add("Updated");
			if (counter.timeout) {
				window.clearTimeout(counter.timeout);
			}
			counter.timeout = window.setTimeout(function () {
				counter.parentElement.classList.remove("Updated");
			}, 7000);
		}
	}
	this.onMessage = function(message) {
		var data = JSON.parse(message.data);
		switch (data.action) {
			case "StatChanged":
				var statHolders = document.querySelectorAll("counter[data-name=" + data.stat + "]");
				me.updateCounter(data.stat, data.value);
				break;
			case "GameChanged":
				if (me.gameNameItem) {
					if (data.game != "" && me.prependDashToGame) {
						me.gameNameItem.innerHTML = " - " + data.game;
					} else {
						me.gameNameItem.innerHTML = data.game;
					}
				}
				break;
			default:
				console.log("Erm... I don't know what to do with this", data);
				break;
		}
	}
	this.bindWebSocket = function () {
        var me = this;
        this.ws = new WebSocket("ws://ghostoflegbot.website/ws/" + streamerName);
        //this.ws = new WebSocket("ws://localhost:3000/ws/" + streamerName);
        this.ws.addEventListener('close', function (err) {
            me.bindWebSocket();
        });
        this.ws.addEventListener('message', this.onMessage);
    }
    this.bindWebSocket();
    this.onStateChange = function () {
        xHR = this;
        me = this.parent;
        if (xHR.readyState == 4) {
            if (xHR.status == 200) {
                try {
                    var result = JSON.parse(xHR.responseText);
                } catch (e) {
                    //Got invalid JSON for some reason.
                    if (me.failedTimes < 10) {
                        //If it's the first few times, retry immediately.
                        me.failedTimes++;
                        me.refreshTimeout = setTimeout(me.refreshCounters, 1, me);
                        return;
                    } else {
                        //We've failed more than 10 times in quick succession - replace the values with "?" and wait a minute, so we don't hammer the server too badly.
                        me.failedTimes = 0;
                        result = {};
                        result['counts'] = {};
                    }
                    return;
                }
                me.failedTimes = 0;
            } else {
                //An error occured.
                if (me.failedTimes < 10) {
                    //If it's the first few times, retry immediately.
                    me.failedTimes++;
                    me.refresh = setTimeout(me.refreshCounters, 1, me);
                    return;
                } else {
                    //We've failed more than 10 times in quick succession - replace the values with "?" and wait a minute, so we don't hammer the server too badly.
                    me.failedTimes = 0;
                    result = {};
                    result['counts'] = {};
                }
            }
            result.counts['totalFailures'] = me.failedTimes;
            result.counts['totalRefreshes'] = me.numUpdates;
            me.populateCounters(result);
        }
    }
    this.doUpdate = function (caller) {
        if (caller) {
            ref = caller;
        } else {
            ref = this;
        }
        ref.updateTime--;
        if (ref.countDownItem) {
            ref.countDownItem.innerHTML = ref.updateTime;
        }
        if (ref.updateTime < 1) {
            ref.updateTime = 60;
            ref.refreshCounters(ref);
        } else {
            ref.refresh = setTimeout(ref.doUpdate, 1000, ref);
        }
    }
    this.refreshCounters = function (caller) {
        if (caller) {
            ref = caller;
        } else {
            ref = this;
        }
        xHR = null;
        xHR = new XMLHttpRequest();
        xHR.parent = ref;
        var url = "http://ghostoflegbot.website/api/channel/" + streamerName;
        //var url = "http://localhost:3000/api/channel/" + streamerName;
        xHR.onreadystatechange = ref.onStateChange;
        xHR.open("GET", url, true);
        xHR.send();
    }
    this.populateCounters = function (result) {
        this.numUpdates++;
        if (result.hasOwnProperty("game")) {
            if (result.game != "") {
                if (this.gameNameItem) {
                    this.gameNameItem.innerHTML = " - " + result.game;
                }
            } else {
                if (this.gameNameItem) {
                    this.gameNameItem.innerHTML = "";
                }
            }
        }
        counters = document.getElementsByTagName("counter");
        if (result.hasOwnProperty('counts')) {
            for (i = 0; i < counters.length; i++) {
                var counter = counters[i];
                if (result.counts.hasOwnProperty(counter.getAttribute("data-name"))) {
					this.updateCounter(counter.getAttribute("data-name"), result.counts[counter.getAttribute("data-name")]);
                } else {
					this.updateCounter(counter.getAttribute("data-name"), "?");
                }
            }
        }
        this.refresh = setTimeout(this.doUpdate, 1000, this);
    }
    this.refreshCounters();
}

function FollowerOverlay(streamer) {
    this.streamer = streamer;
    this.alertHandler;
    this.logging = true;
    this.followers = {};
	this.followerListObj;
	this.followerCountObj;
    this.doUpdate = function (caller) {
        caller.getFollowers(false, 0, caller);
    }
    this.getFollowers = function (fetchAll, fetchOffset, caller) {
        if (!fetchAll) fetchAll = false;
        if (!fetchOffset) fetchOffset = 0;
        var ref = caller || this;
        if (fetchOffset > 1000) return;
        var xHR = new XMLHttpRequest();
        xHR.parent = ref;
        xHR.fetchOffset = fetchOffset;
        xHR.fetchAll = fetchAll;
        var d = new Date();
        var url = "https://api.twitch.tv/kraken/channels/" + encodeURIComponent(streamer) + "/follows?direction=desc&limit=100&offset=" + fetchOffset + "&nocache=" + d.getTime();
        xHR.onreadystatechange = ref.readyStateChange;
        xHR.open("GET", url, true);
        xHR.send();
    }
    this.readyStateChange = function () {
        xHR = this;
        ref = this.parent;
        if (xHR.readyState == 4) {
            if (xHR.status == 200) {
                //Successful fetch.
                var result = JSON.parse(xHR.responseText);
                if (result.follows && result.follows.length > 0) {
                    //We have followers!
                    result.follows.forEach(function (follower) {
                        if (!xHR.fetchAll) {
                            if (!ref.followers.hasOwnProperty(follower.user.name)) {
								if (ref.followerCountObj) {
									if (ref.followerCountObj.updateTimer) {
										window.clearTimeout(ref.followerCountObj.updateTimer);
									}
									ref.followerCountObj.updateTimer = window.setTimeout(function () {
										this.parentElement.classList.remove("Updated");
									}, 5000);
									ref.followerCountObj.parentElement.classList.add("Updated");
									
								}
								ref.alertHandler.addToQueue({ message: follower.user.name + "", type: "follow" });
                            }
                        }
						ref.followers[follower.user.name] = true;
					});
					ref.followerCountObj.innerHTML = Object.keys(ref.followers).length;
                    if (xHR.fetchAll) {
                        ref.getFollowers(true, xHR.fetchOffset + 100, ref);
                    }
                    if (ref.followerListObj) {
                        if (ref.followerListObj.innerHTML != Object.keys(ref.followers).join(', ')) ref.followerListObj.innerHTML = Object.keys(ref.followers).join(', ');
                    }
                }
            } else {
				//There was an error. Give up this time.
            }
        }
    }
    this.getFollowers(true, 0, this);
    this.interval = setInterval(this.doUpdate, 60000, this);
}

function SocketCommunication() {
    this.webSocket = new WebSocket("ws://localhost:8000", "overlay");
    this._commands = {};
    this.queue = [];
    var my = this;
    this.webSocket.addEventListener("open", function (event) {
        //Drain queue.
        console.log("Connected, I guess.");
        if (my.queue.length > 0) {
            console.log("Got a backlog, sending");
            my.queue.forEach(function (item) {
                console.log("Sending", item);
                this.webSocket.send(item);
            }, my);
        }
    });
    
    this.webSocket.addEventListener("message", function (event) {
        if (event.data == "beat") return;
        try {
            var result = JSON.parse(event.data);
        } catch (e) {
            console.log("Nope, no idea what that is.");
            return;
        }
        if (Array.isArray(result.data)) {
            result.data.forEach(function (command) {
                if (my._commands[command.name]) {
                    my._commands[command.name](command.data);
                }
            });
        } else {
            if (my._commands[result.name]) {
                my._commands[result.name](result.data);
            }
        }
    });
    
    this.webSocket.addEventListener("close", function (event) {
        //Connection died... Re-open it.
        my.webSocket = new WebSocket("ws://localhost:8000", "overlay");
    });
    
    this.bindCommand = function (command, callback) {
        my._commands[command] = callback;
    }
    
    this.send = function (data) {
        var dataStore = data;
        console.log("Sending...", data);
        if (this.webSocket) {
            if (this.webSocket.readyState == 1) {
                console.log("Sending now...");
                this.webSocket.send(JSON.stringify(dataStore));
            } else {
                console.log("Socket isn't connected. Sending later...");
                this.queue.push(JSON.stringify(dataStore));
            }
        } else {
            console.log("Socket doesn't exist. Sending later.");
            this.queue.push(JSON.stringify(dataStore));
        }
    }
}

function DonationUpdater() {
    this.donations = [];
    this.donationList = "";
    this.donationListObj;
    this.progressObj;
    this.progressLabel;
    this.alertHandler;
    this.socketCommunication;
    this.connected = false;
    var my = this;
    this.connect = function () {
        if (!this.connected) {
            this.donations = [];
            console.log("Opening Connection...");
            this.socketCommunication.bindCommand("AuthToken", function (value) {
                console.log("Got API Key", value.APIKey);
                my.APIKey = value.APIKey;
                my.connect();
            });
            this.socketCommunication.bindCommand("GoalData", function (value) {
                console.log("Got goal data");
                my.updateGoal(my, value.goal);
            });
            if (this.APIKey) {
                console.log("We have an API Key, opening websocket...");
                this.streamTipSocket = new WebSocket('wss://streamtip.com/ws?access_token=' + this.APIKey);
                this.streamTipSocket.caller = this;
                this.streamTipSocket.onopen = function (message) {
                    my.connected = true;
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
                    my.connected = false;
                    if (err.code === 4010) {
                        console.log("Streamtip Auth failed");
                        my.askForAuth();
                    } else if (err.code === 4290) {
                        console.log("Streamtip rate limited - reconnecting in 10 seconds...");
                        setTimeout(my.connect, 100000);
                    } else if (err.code === 4000) {
                        console.log("Streamtip bad request");
                    } else {
                        console.log("Connection closed, error code " + err.code + ", " + err.reason);
                        my.connect();
                    }
                }
            } else {
                console.log("No APIKey found, asking for one.");
                this.askForAuth();
            }
        }
    }
    this.updateGoal = function (ref, goal) {
        if (ref.progressLabel && ref.progressObj) {
            if (goal) {
                ref.progressLabel.style.display = "";
                ref.progressObj.style.display = "";
                ref.progressLabel.innerHTML = "Donation goal: " + goal.title + " - " + goal.progress.percentage + "% (" + goal.progress.currencySymbol + goal.progress.amount + "/" + goal.progress.currencySymbol + goal.amount + ")";
                ref.progressObj.max = goal.amount;
                ref.progressObj.value = goal.progress.amount;
            } else {
                ref.noGoal();
            }
        }
    }
    this.noGoal = function () {
        if (this.progressLabel && this.progressObj) {
            this.progressLabel.style.display = "none";
            this.progressObj.style.display = "none";
        }
    }
    
    this.updateDonationList = function () {
        var donationTempList = [];
        this.donations.forEach(function (donation) {
            donationTempList.push(donation.username + ": " + donation.currencySymbol + donation.amount);
        });
        this.donationList = donationTempList.join(", ");
        if (this.donationListObj) this.donationListObj.innerHTML = this.donationList;
    }
    this.askForAuth = function () {
        this.socketCommunication.send({ name: "Auth", data: "" });
    }
}

