# OverlayCommunicator
This is a series of objects to make HTML overlay creation and control a lot easier.

So, in source code order, they are:

## AlertHandler
This takes an event and displays it in an alert on-screen.

### Initialization
    var alertHandler = new AlertHandler();
    alertHandler.alertObject = document.getElementById("alert");

The object can be styled in any manner you like, and will be given a class of "visible" when it is to be shown.

### Usage
    alertHandler.addToQueue({ message: "foo", type: "bar" }); 

This will display an alert, with the message "foo", and the css class "bar" added, to distinguish it from other alerts.

Used internally by FollowerOverlay and DonationUpdater later in this file.

## StreamCounters
Updates counters to show statistics on the currently playing game.

### Initialization
    var streamer = new StreamCounters("streamer");
	streamer.countDownItem = document.getElementById("countDown");
	streamer.gameNameItem = document.getElementById("gameName");

The object MUST be initialized with the name of the streamer it is to retrieve values for.

The countDownItem and gameNameItem are optional, and will (if present) be updated with the number of seconds to the next refresh, and the current game name (respectively). It is currently set to update every 60 seconds.

### Usage

The StreamCounters object will begin updating as soon as it is initialized. When updating, the StreamCounters object searches the document for <counter\> objects, and updates their contents with the data they request using the "data-name" attribute. For example:

    <counter data-name="death">0</counter>

will be updated with the current "death" value.

For debugging, there are two additional values that will be searched for: totalFailures and totalRefreshes. These will be updated with the total number of times the request to ghost\_of\_leg\_bot has failed, and the total number of times the script has attempted to update.

## FollowerOverlay
This displays the current list of followers, and uses the AlertHandler to display an alert (with type of "follow") when a new follower or followers are detected.

### Initialization
		var followers = new FollowerOverlay("streamer");
        followers.followerListObj = document.getElementById("followerList");
		followers.alertHandler = alertHandler;

Like StreamCounters, this object MUST be initialized with the name of the streamer it is to retrieve followers for.

followerListObj is optional, and if specified, will be set to the current follower list, in comma-separated format.

## SocketCommunication
This creates a simple websockets tunnel back to an echo app, that allows you to control the overlay using a second browser window.

### Initialization
    var socketCommunication = new SocketCommunication();

It's pretty simple, really. Doesn't need anything special to initialize. It will attempt to connect to a websockets server on localhost, running on port 8000. Where it gets complicated is the...

### Usage
    socketCommunication.bindCommand("Foo", function (value) {
		//Do something
	});
This will bind the sent command "Foo" to execute the function specified. *value* is passed in as the JSON-decoded(if applicable) version of the sent data. For example, if you sent:

    { name: "Foo", data: { bar: "baz", beep: "bloop" }}
 
The above command would fire, and value would be an object that looks like: ````{ bar: "baz", beep: "bloop" }````. If you sent:

    { name: "Foo", data: "spot" }

Then the command would fire and value would be the string literal "spot". And if you sent:

    { name: "Bar", data: "blah" }

The command would NOT fire (because the name didn't match).  

## DonationUpdater
***Currently Broken***

This communicates with streamtip.com to retrieve a realtime display of donators.

### Initialization
	var donators = new DonationUpdater(streamtipClientID, streamtipClientSecret, streamtipRedirectURL);
	donators.alertHandler = alertHandler;
	donators.socketCommunication = socketCommunication;
	donators.connect();

The streamtipClientID, streamtipClientSecret and streamtipRedirectURL *MUST* all match that specified in streamtip for your account, and for this app in particular.

The object will connect a websocket to StreamTip's interface and listen for donations. It will so do some OAuth2 magic (which is currently broken) to authenticate itself. 

## DisplayWebcam

This sorts out the hassle of getUserMedia, and displays your webcam in the passed-in video object.

### Initialization
    var webcam = new DisplayWebcam(document.getElementById("webcam"));

Note: the object MUST be a HTML5 *video* element.

### Usage

That's it, really. That's all there is to it. It'll set that video element to your webcam and (try to) set it to play, though having "autoplay" on the element helps too.