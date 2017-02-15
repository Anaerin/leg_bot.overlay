# OverlayCommunicator

**NOTE** This documentation is out of date, as of the shift to Electron. I'll get the information updated ASAP.

---------

This is a node.js server that connects to multiple services (Leg_Bot, Twitch and Streamtip), and exposes a HTTP server that serves static pages and provides two Websockets interfaces for overlay and control.

The Websockets servers are simple, just relaying whatever events are sent their way. They have replay functionality, so re-connections should re-establish state.

There are many objects and interfaces. I will attempt to document the objects and interfaces.

Before you start, however, you need to set up a secrets file. It should look something like this:

````Javascript
module.exports = {
    Streamer: "[StreamerName]",
    StreamTip: {
        clientID: '[Your Client ID]',
        clientSecret: '[Your Client Secret]',
        redirectURL: 'http://localhost:8000/code'
    },
    Twitch: {
        clientID: "[Your Client ID]",
        clientSecret: "[Your Client Secret]",
        redirectURL: "http://localhost:8000/code"
    }
}
````

## Websockets Servers

On a new connection, the "Replay" event is fired. This allows objects that hook the event to replay information the connection needs to know. For instance, the state of connections.

When a message is received, the "ReceivedJSON" event is fired, with the JSON received.

    .send(data)
This sends data to the connected clients, and adds it to the replay buffer, so it will be automatically be replayed on connection. The replay buffer will be trimmed to 100 entries, however.

    .sendOne(data)
This sends data, like send, but first it removes all other entries in the replay buffer with the same type.

    .sendByFunc(data, callback)
This sends data, like sendOne, but rather than filtering on type, it calls the callback with each option in the buffer, using the returned value to choose whether to keep or remove the entry.


### Overlay

This is a basic implementation of the server.

### Control

This implements everything that overlay does, with a few added functions to handle a queue of authorization requests.

    .sendAuthRequest(data)
Adds a request to the auth queue.

    .getAuthRequest()
Sends the current top authorization request to connected clients.

    .getNextAuthRequest()
Grabs the next request in the queue and sends it.

## Websocket Client handlers

These connect to various servers using websockets. They all emit the "Status" event to keep listeners up-to-date on what's happening.

### LegBotConn

This needs to be constructed with the name of the streamer you are interested in.

    .connect()
Attempts to connect to LegBot.

    .fetchValues()
This will grab the current game and statistics, using a HTTP Get request. When it completes, it will issue "GameChanged" and "StatChanged" events.

When a value is received through the websocket, the "GameChanged" or "StatChanged" events are emitted. If the data received is unknown, then a "MessageReceived" event will be emitted.

### TwitchConector

This needs to be constructed with the streamer name. It also relies on the correct object being in the secrets file.

When an oAuth request is required, using the oAuthHandler library, an "AuthNeeded" event will be emitted, with the argument being the URL to send the user to.

    .receivedCode(code)
Receives the auth code from the oAuth negotiation earlier to complete the auth process.

When authorization is complete, an "AuthComplete" event will be emitted, followed by an attempted connection to chat, and fetching the current follower list. Every minute, the first "page" of most recent followers is checked against the internal list, and if there is a new follower, the "NewFollower" event is emitted.

    .setStreamDetails(game, title)
Will attempt to set the stream game and title using the Twitch API. Game and Title are both optional, though one must be specified.

#### Events
````AuthNeeded(URL)````
Raised when authentication is required. The user should be sent to [URL], which will then return the user to the redirect URL specified, with the code in the querystring.

````AuthComplete()````
Raised when authentication is complete.

````NewFollower(Follower Name)````
Raised when a new follower is found.

````ChatMessage(Userstate, Message, Self)````
Raised when a message is received. Userstate is from Twitch, Message is the text of the message, and Self is a boolean of wether this message was sent by us or not.

````ChatWhisper(From, Userstate, Message, Self)````
Raised on a whisper.

````ChatClear()````
Raised when chat is cleared by a Moderator.

````ChatAction(Userstate, Message, Self)````
Raised when someone makes an action in the channel.

````ChatHosted(Username, Viewers)````
Raised when the channel is hosted. Username is the hoster, for Viewers viewers.

````ChatSubscription(Username)````
Raised when a user subscribes to the channel.

````ChatResubscription(Username, Months, Message)````
Raised when a user renews their subscription. Months is the length of subscription, Message is the message they have specified.

````ChatTimeout(Username, Reason, Duration)````
Raised when a user is timed out.

### StreamTipConnector

Like the TwitchConnector, this uses the oAuth system to authenticate.

#### Events

````NewTip(tip)````
Raised when a new tip is received. The tip object is passed directly from the StreamTip API.

````GoalUpdated()````
Raised when the goal is updated.