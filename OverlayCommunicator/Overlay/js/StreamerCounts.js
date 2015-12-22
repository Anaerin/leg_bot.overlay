function AlertHandler() {
	this.queue = [];
	this.playing = false;
	this.alertObject;
	this.showAlert = function () {
		this.alertObject.classList.add("visible");
	}
	
	this.hideAlert = function (callback) {
		this.alertObject.classList.remove("visible");
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
		this.showAlert();
		this.timer = setTimeout(function (ref) {
			ref.hideAlert();
			ref.timer = setTimeout(function (ref) {
				ref.playing = false;
				ref.checkQueue();
			}, 2100, ref);
		}, 10000, this);
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
    this.bindWebSocket = function () {
        var me = this;
        this.ws = new WebSocket("ws://ghostoflegbot.website/ws/" + streamerName);
        //this.ws = new WebSocket("ws://localhost:3000/ws/" + streamerName);
        this.ws.addEventListener('close', function (err) {
            me.bindWebSocket();
        });
        this.ws.addEventListener('message', function (message) {
            var data = JSON.parse(message.data);
            switch (data.action) {
                case "StatChanged":
                    var statHolders = document.querySelectorAll("counter[data-name=" + data.stat + "]");
                    for (var i = 0; i < statHolders.length; i++) {
                        statHolders[i].innerHTML = data.value;
                    }
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
        });
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
                    this.gameNameItem.innerHTML = result.game;
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
					counter.innerHTML = result.counts[counter.getAttribute("data-name")];
				} else {
					counter.innerHTML = "?";
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
								ref.alertHandler.addToQueue({ message: follower.user.name + " just followed!", type: "follow" });
							}
						}
						ref.followers[follower.user.name] = true;
					});
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
	this.alertHandler;
	this.socketCommunication;
	var my = this;
	this.connect = function () {
		console.log("Opening Connection...");
		this.socketCommunication.bindCommand("AuthToken", function (value) {
			console.log("Got API Key", value.APIKey);
			my.APIKey = value.APIKey;
			my.connect();
		});
		if (this.APIKey) {
			console.log("We have an API Key, opening websocket...");
			this.streamTipSocket = new WebSocket('wss://streamtip.com/ws?access_token=' + this.APIKey);
			this.streamTipSocket.onmessage = function (message) {
				var event = JSON.parse(message.data);
				this.donations.push(event);
				this.alertHandler.addToQueue({ message: event.username + " just donated " + event.currencySymbol + event.amount + "!", type: "donation" });
				this.updateDonationList();
			}
			this.streamTipSocket.onclose = function (err) {
				if (err.code === 4010) {
					console.log("Streamtip Auth failed");
					my.askForAuth();
				} else if (err.code === 4290) {
					console.log("Streamtip rate limited");
				} else if (err.code === 4000) {
					console.log("Streamtip bad request");
				}
			}
		} else {
			console.log("No APIKey found, asking for one.");
			this.askForAuth();
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
		this.socketCommunication.send({ name: "Auth", data: ""});
	}
	
	this.onStateChange = function (xHR) {
		console.log("Loaded auth...");
		my = this.parent;
		if (xHR.status == 200) {
			try {
				var result = JSON.parse(xHR.responseText);
			} catch (e) {
				//Got invalid JSON for some reason.
				my.alertHandler.addToQueue({ message: "Error parsing StreamTip's Auth JSON response", type: "error" })
				console.log("Couldn't parse response");
				return;
			}
		} else {
			//An error occured.
			my.alertHandler.addToQueue({ message: "Error from StreamTip Auth: " + xHR.status, type: "error" })
			console.log("StreamTip Auth Error:", xHR.status);
			return;
		}
		if (result.access_token) {
			console.log("Got the token", result.access_token);
			my.APIKey = result.access_token;
		} else {
			console.log("StreamTip won't give me a token!");
			my.alertHandler.addToQueue({ message: "StreamTip did not return an access token", type: "error" });
		}
		my.connect();
	}
}

function DisplayWebcam(webcamObject) {
	this.webcamObject = webcamObject;
	this.webcam;
	this.webcamConstraints = { audio: false, video: { width: { min: 320, ideal: 1280 }, height: { min: 240, ideal: 720 } } };
	var my = this;
	this.webcamCallback = function (mediastream) {
		console.log("Got media stream");
		my.webcamObject.src = window.URL.createObjectURL(mediastream);
		my.webcamObject.onloadedmetadata = function (e) {
			this.play();
		};
	}
	var navigator = window.navigator;
	navigator.getMedia = (navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia ||
                         navigator.msGetUserMedia);
	if (navigator.mediaDevices) {
		console.log("Got mediaDevices, attempting to open with promise");
		this.webcam = navigator.mediaDevices.getUserMedia(this.webcamConstraints).then(this.webcamCallback, function (err) {
			console.log("Permissions Error", err);
		});
	} else if (navigator.getMedia) {
		console.log("Attempting to open webcam...");
		this.webcam = navigator.getMedia(this.webcamConstraints, this.webcamCallback, function (err) {
			console.log("Legacy permissions error", err);
		});
	} else {
		console.log("Unable to get webcam - no getUserMedia function");
	}
}




