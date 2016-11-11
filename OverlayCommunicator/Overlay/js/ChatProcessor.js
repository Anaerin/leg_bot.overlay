var isAdminPage = false;
function htmlEscape(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
function formatUser(userState, bAction) {
	if (bAction) {
		var userDiv = document.createElement("span");
	} else {
		var userDiv = document.createElement("div");
	}
	userDiv.classList.add("UserName");
	if (userState.badges) {
		if (userState.badges.broadcaster == 1) userDiv.classList.add("Broadcaster");
		if (userState.badges.moderator == 1) userDiv.classList.add("Moderator");
		if (userState.badges.turbo == 1) userDiv.classList.add("Turbo");
		if (userState.badges.subscriber == 1) userDiv.classList.add("Subscriber");
	}
	if (userState.color) userDiv.style.color = userState.color;
    userDiv.innerHTML = userState['display-name'];
    if (isAdminPage) {
        var purgeButton = document.createElement("a");
        purgeButton.innerHTML = "P";
        purgeButton.className = "UserButton";
        purgeButton.userName = userState['username'];
        purgeButton.addEventListener("click", evt => {
            sendChat(".timeout " + evt.target.userName + " 0");
            evt.stopPropagation;
            evt.cancelBubble;
            evt.returnValue = false;
            return false;
        });
        userDiv.appendChild(purgeButton);
        var timeoutButton = document.createElement("a");
        timeoutButton.innerHTML = "T";
        timeoutButton.className = "UserButton";
        timeoutButton.userName = userState['username'];
        timeoutButton.addEventListener("click", evt => {
            var TOlength = prompt("Timeout Length (seconds)", "0");
            var TOreason = prompt("Timeout reason");
            if (TOlength) sendChat(".timeout " + evt.target.userName + " " + TOlength + " " + TOreason);
            evt.stopPropagation;
            evt.cancelBubble;
            evt.returnValue = false;
            return false;
        });
        userDiv.appendChild(timeoutButton);
        var banHammer = document.createElement("a");
        banHammer.innerHTML = "B";
        banHammer.className = "UserButton";
        banHammer.userName = userState['username'];
        banHammer.addEventListener("click", evt => {
            var BanReason = prompt("Ban Reason");
            if (BanReason) sendChat(".ban " + evt.target.userName + " " + BanReason);
            evt.stopPropagation;
            evt.cancelBubble;
            evt.returnValue = false;
            return false;
        });
        userDiv.appendChild(banHammer);
    }
	return userDiv;
}

function formatChatMessage(message) {
	var newDiv = document.createElement("div");
	var range = document.createRange();
	newDiv.className = "ChatLine";
	newDiv.appendChild(formatUser(message.userstate));
	newDiv.appendChild(range.createContextualFragment(formatEmotes(message.message, message.userstate.emotes)));
	return newDiv;
}

function formatWhisperMessage(message) {
	var newDiv = document.createElement("div");
	var range = document.createRange();
	newDiv.className = "WhisperLine";
	newDiv.appendChild(formatUser(message.userstate));
	newDiv.appendChild(range.createContextualFragment(formatEmotes(message.message, message.userstate.emotes)));
	return newDiv;
}

function formatActionMessage(message) {
	var newDiv = document.createElement("div");
	var range = document.createRange();
	newDiv.className = "ActionLine";
	newDiv.appendChild(range.createContextualFragment("<div class=\"UserName\">*</div>"));
	newDiv.appendChild(formatUser(message.userstate, true));
	newDiv.appendChild(range.createContextualFragment(formatEmotes(message.message, message.userstate.emotes)));
	newDiv.username = message.userstate.username;
	return newDiv;
}

function appendChatMessage(message, numMessages, callback) {
	var logObj = document.getElementById("MessageLog");
	if (numMessages) {
		while (logObj.children.length > numMessages) logObj.removeChild(logObj.lastChild);
	}
	document.getElementById("MessageLog").insertBefore(callback(message), document.getElementById("MessageLog").firstChild);
}

function formatEmotes(text, emotes) {
	var splitText = text.split('');
	for (var i in emotes) {
		var e = emotes[i];
		for (var j in e) {
			var mote = e[j];
			if (typeof mote == 'string') {
				mote = mote.split('-');
				mote = [parseInt(mote[0]), parseInt(mote[1])];
				var length = mote[1] - mote[0],
					empty = Array.apply(null, new Array(length + 1)).map(function () { return '' });
				splitText = splitText.slice(0, mote[0]).concat(empty).concat(splitText.slice(mote[1] + 1, splitText.length));
				splitText.splice(mote[0], 1, '<img class="emoticon" src="http://static-cdn.jtvnw.net/emoticons/v1/' + i + '/3.0">');
			}
		}
	}
	return splitText.join('');
}