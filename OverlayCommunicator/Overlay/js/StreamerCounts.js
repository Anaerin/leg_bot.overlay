function StreamCounters(streamerName) {
	this.numUpdates = 0;
	this.failedTimes = 0;
	this.updateTime = 0;
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
		var countdownItem = document.getElementById("CountDown");
		if (countdownItem) {
			countdownItem.innerHTML = ref.updateTime;
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
		xHR.onreadystatechange = ref.onStateChange;
		xHR.open("GET", url, true);
		xHR.send();
	}
	this.populateCounters = function (result) {
		this.numUpdates++;
		if (result.hasOwnProperty("game") && result.game != "") {
			if (document.getElementById("gameName")) {
				document.getElementById("gameName").innerHTML = result.game;
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
	this.alerter = alertHandler;
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
								ref.alerter.addToQueue({ message: follower.user.name + " just followed!", type: "follow" });
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

var SocketCommunication = function () {
	this.webSocket = new WebSocket("ws://localhost:8000", "overlay");
	this._commands = {};
	this.webSocket.addEventListener("open", function (event) {

	});
	var my = this;
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
			my._commands[result.name](result.data);
		}
	});
	
	this.webSocket.addEventListener("close", function (event) {
		my.webSocket = new WebSocket("ws://localhost:8000");
	});

	this.bindCommand = function (command, callback) {
		my._commands[command] = callback;
	}

	this.send = function (data) {
		my.webSocket.send(JSON.stringify(data));
	}
}

var DonationUpdater = function (streamtipAPIKey) {
	this.APIKey = streamtipAPIKey;
	this.donations = [];
	this.donationList = "";
	this.donationListObj;
	this.alerter = alertHandler;
	this.streamTipSocket = new WebSocket('wss://streamtip.com/ws?access_token=' + this.APIKey);
	this.streamTipSocket.onmessage = function (message) {
		var event = JSON.parse(message.data);
		this.donations.push(event);
		this.alerter.addToQueue({ message: event.username + " just donated " + event.currencySymbol + event.amount + "!", type: "donation" });
		this.updateDonationList();
	}
	this.updateDonationList = function () {
		var donationTempList = [];
		this.donations.forEach(function (donation) {
			donationTempList.push(donation.username + ": " + donation.currencySymbol + donation.amount);
		});
		this.donationList = donationTempList.join(", ");
		if (this.donationListObj) this.donationListObj.innerHTML = this.donationList;
	}

	this.streamTipSocket.onclose = function (err) {
		if (err.code === 4010) {
			console.log("Streamtip Auth failed");
		} else if (err.code === 4290) {
			console.log("Streamtip rate limited");
		} else if (err.code === 4000) {
			console.log("Streamtip bad request");
		}
	}
}

var webcam;
var webcamConstraints = { audio: false, video: { width: { min: 320, ideal: 1280 }, height: { min: 240, ideal: 720 } } };
var webcamCallback = function (mediastream) {
	console.log("Got media stream");
	var video = document.querySelector('video');
	video.src = window.URL.createObjectURL(mediastream);
	video.onloadedmetadata = function (e) {
		video.play();
	};
}
var navigator = window.navigator;
navigator.getMedia = (navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia ||
                         navigator.msGetUserMedia);
if (navigator.mediaDevices) {
	console.log("Got mediaDevices, attempting to open with promise");
	webcam = navigator.mediaDevices.getUserMedia(webcamConstraints).then(webcamCallback, function (err) {
		console.log("Permissions Error", err);
	});
} else if (navigator.getMedia) {
	console.log("Attempting to open webcam...");
	webcam = navigator.getMedia(webcamConstraints, webcamCallback, function (err) {
		console.log("Legacy permissions error", err);
	});
} else {
	console.log("Unable to get webcam - no getUserMedia function");
}

var AlertHandler = function () {
	this.queue = [];
	this.playing = false;
	this.showAlert = function () {
		document.getElementById("alert").classList.add("visible");
	}
	
	this.hideAlert = function (callback) {
		document.getElementById("alert").classList.remove("visible");
	}
	this.checkQueue = function () {
		if (!this.queue.length || this.playing) return;
		this.displayAlert(this.queue.shift());
	}
	this.timer = false;
	this.displayAlert = function (message) {
		this.playing = true;
		document.getElementById("alert").innerHTML = message.message;
		document.getElementById("alert").className = message.type;
		this.showAlert();
		this.timer = setTimeout(function (ref) {
			ref.hideAlert();
			ref.timer = setTimeout(function (ref) {
				ref.playing = false;
				ref.checkQueue();
			}, 2100, ref);
		}, 10000, this);
	}
	this.addToQueue = function(data) {
		this.queue.push(data);
		this.checkQueue();
	}
}

var alertHandler = new AlertHandler();

var socketCommunication = new SocketCommunication();

socketCommunication.bindCommand("TestDonation", function (value) {
	alertHandler.addToQueue({ message: value.username + " just donated " + value.currencySymbol + value.amount + "!", type: "donation" });
});

socketCommunication.bindCommand("TestFollow", function (value) {
	alertHandler.addToQueue({ message: value.username + " just followed!", type: "follow" });
});

socketCommunication.bindCommand("ShowWebcam", function (value) {
	document.getElementById("webcamWindow").classList.remove("noWebcam");
});

socketCommunication.bindCommand("HideWebcam", function (value) {
	document.getElementById("webcamWindow").classList.add("noWebcam");
});

socketCommunication.bindCommand("UpdateComment", function (value) {
	document.getElementById("Game").innerHTML = value;
})

socketCommunication.bindCommand("SwitchToAFK", function (value) {
	document.getElementById("gameWindow").classList.remove("Active");
	document.getElementById("webcamWindow").classList.remove("Active");
	document.getElementById("webcamWindow").classList.remove("Booth");
	document.getElementById("afkWindow").classList.add("Active");
	document.getElementById("afkWindow").classList.remove("Hidden");
});

socketCommunication.bindCommand("SwitchToGame", function (value) {
	document.getElementById("afkWindow").classList.remove("Active");
	document.getElementById("afkWindow").classList.add("Hidden");
	document.getElementById("webcamWindow").classList.remove("Active");
	document.getElementById("webcamWindow").classList.remove("Booth");
	document.getElementById("gameWindow").classList.add("Active");
	
});

socketCommunication.bindCommand("SwitchToBooth", function (value) {
	document.getElementById("gameWindow").classList.remove("Active");
	document.getElementById("afkWindow").classList.remove("Active");
	document.getElementById("afkWindow").classList.add("Hidden");
	document.getElementById("webcamWindow").classList.add("Active");
	document.getElementById("webcamWindow").classList.add("Booth");
});
