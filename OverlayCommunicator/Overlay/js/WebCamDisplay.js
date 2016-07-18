function DisplayWebcam(webcamObject) {
    this.webcamObject = webcamObject;
    this.webcam;
    this.webcams = [];
    this.webcamID;
    var my = this;
    this.webcamCallback = mediastream => {
        console.log("Got media stream");
        this.webcamObject.src = window.URL.createObjectURL(mediastream);
        this.webcamObject.onloadedmetadata = e => {
            this.webcamObject.play();
        };
    }
    var navigator = window.navigator;
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        console.log("Can enumerate, getting list")
        navigator.mediaDevices.enumerateDevices().then(devices => {
            devices.forEach(device => {
                if (device.kind == "videoinput") {
                    this.webcams.push({ label: device.label, id: device.deviceId });
                }
            });
        });
        if (navigator.mediaDevices.ondevicechange) {
            navigator.mediaDevices.ondevicechange = () => {
                this.webcams = [];
                navigator.mediaDevices.enumerateDevices().then(devices => {
                    devices.forEach(device => {
                        if (device.kind == "videoinput") {
                            this.webcams.push(device);
                        }
                    });
                });
            }
        }
    }
    this.connectWebcam = function () {
        navigator.getMedia = (navigator.getUserMedia ||
			navigator.webkitGetUserMedia ||
			navigator.mozGetUserMedia ||
			navigator.msGetUserMedia);
        var constraints = { video: { width: { min: 320, ideal: 1280, max: 1920 }, height: { min: 240, ideal: 720, max: 1080 } } };
        //var constraints = { audio: false, video: {} };
        if (this.webcamID) {
            constraints.video['deviceId'] = { 'exact': this.webcamID };
            //constraints = { video: { optional: [{ sourceId: this.webcamID }] } };
            console.log("Set constraints to:" + JSON.stringify(constraints));
        }
        if (navigator.mediaDevices) {
            console.log("Got mediaDevices, attempting to open with promise");
            this.webcam = navigator.mediaDevices.getUserMedia(constraints).then(this.webcamCallback, err => {
                console.log("Permissions Error: " + err);
            });
        } else if (navigator.getMedia) {
            console.log("Attempting to open webcam...");
            this.webcam = navigator.getMedia(constraints, this.webcamCallback, err => {
                console.log("Legacy permissions error: " + err);
            });
        } else {
            console.log("Unable to get webcam - no getUserMedia function");
        }
    }
    this.connectWebcam();

}