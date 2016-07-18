function htmlEscape(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
function formatUser(userState) {
	var output = "<div class=\"UserName Turbo ";
	if (userState.badges) {
		if (userState.badges.broadcaster == 1) output += "Broadcaster ";
		if (userState.badges.moderator == 1) output += "Moderator ";
		if (userState.badges.turbo == 1) output += "Turbo ";
		if (userState.badges.subscriber == 1) output += "Subscriber ";
	}
	output += "\"";
	if (userState.color) output += " style=\" color:" + userState.color + ";\"";
	output += ">" + userState['display-name'] + "</div > ";
	return output;
}
function formatChatMessage(message) {
	var newDiv = document.createElement("div");
	newDiv.className = "ChatLine";
	newDiv.innerHTML = formatUser(message.userstate) + formatEmotes(message.message, message.userstate.emotes);
	return newDiv;
}
function formatWhisperMessage(message) {
	var newDiv = document.createElement("div");
	newDiv.className = "WhisperLine";
	newDiv.innerHTML = formatUser(message.userstate) + formatEmotes(message.message, message.userstate.emotes);
	return newDiv;
}
function appendChatMessage(message) {
	var logObj = document.getElementById("MessageLog");
	while (logObj.children.length > 20) logObj.removeChild(logObj.lastChild);
	document.getElementById("MessageLog").insertBefore(formatChatMessage(message), document.getElementById("MessageLog").firstChild);
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