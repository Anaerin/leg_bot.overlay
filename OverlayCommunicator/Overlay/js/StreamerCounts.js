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
    this.queue = [];
    this.playing = false;
    this.logging = true;
    this.followers = {};
    this.doUpdate = function (caller) {
        caller.getFollowers(false, 0, caller);
    }
    this.getFollowers = function (fetchAll, fetchOffset, caller) {
        console.log("Fetching followers");
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
                                console.log("Got new follower", follower.user.name);
                                ref.queue.push(follower.user.name);
                                ref.checkQueue();
                            }
                        }
                        ref.followers[follower.user.name] = true;
                    });
                    if (xHR.fetchAll) {
                        ref.getFollowers(true, xHR.fetchOffset + 100, ref);
                    }
                }
            } else {
                //There was an error. Give up this time.
            }
        }
    }

    this.checkQueue = function () {
        if (!this.queue.length || this.playing) return;
        this.newFollower(this.queue.shift());
    }

    this.showAlert = function () {
        document.getElementById("follower-alert").className = "visible";
    }

    this.hideAlert = function (callback) {
        document.getElementById("follower-alert").className = "";

    }

    this.timer = false;
    this.newFollower = function (user) {
        this.playing = true;
        document.getElementById("new-follower").innerHTML = user;
        this.showAlert();
        this.timer = setTimeout(function (ref) {
            ref.hideAlert();
            ref.timer = setTimeout(function (ref) {
                ref.playing = false;
                ref.checkQueue();
            }, 2100, ref);
        }, 10000, this);
    }
    this.getFollowers(true, 0, this);
    this.interval = setInterval(this.doUpdate, 60000, this);
}

var webSocket = new WebSocket("ws://localhost:8000", "overlay-control");
webSocket.addEventListener("open", function (event) {

});

webSocket.addEventListener("message", function (event) {
    try {
        var result = JSON.parse(event.data);
    } catch (e) {
        console.log("Nope, no idea what that is.");
        return;
    }
    switch (result.action) {
        case 'HideWebcam':
            document.body.className = "noWebcam";
            break;
        case 'ShowWebcam':
            document.body.className = "";
            break;
    }
});

webSocket.addEventListener("close", function (event) {

});
