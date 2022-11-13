const { desktopCapturer, remote } = require('electron');

const { writeFile } = require('fs');

const { dialog, Menu } = remote;

// Global state
let mediaRecorder; // MediaRecorder instance to capture footage
const recordedChunks = [];
let camStream;
let displayStream;
let timer;

// Buttons
const videoElement = document.querySelector('video');

const startBtn = document.getElementById('startBtn');
startBtn.onclick = e => {
  mediaRecorder.start();
  startBtn.classList.add('is-danger');
  // startBtn.innerText = 'Recording';
  timer = setInterval(setTime, 1000);
};

const stopBtn = document.getElementById('stopBtn');

stopBtn.onclick = e => {
  if (mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    startBtn.classList.remove('is-danger');
    startBtn.innerText = 'Start';
    clearInterval(timer);
  }
};

const videoSelectBtn = document.getElementById('videoSelectBtn');
videoSelectBtn.onclick = getVideoSources;

// Get the available video sources
async function getVideoSources() {
  const inputSources = await desktopCapturer.getSources({
    types: ['window', 'screen']
  });

  const videoOptionsMenu = Menu.buildFromTemplate(
    inputSources.map(source => {
      return {
        label: source.name,
        click: () => selectSource(source)
      };
    })
  );


  videoOptionsMenu.popup();
}

// Change the videoSource window to record
async function selectSource(source) {

  videoSelectBtn.innerText = source.name;

  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id
      }
    }
  };

  // Create a Stream - display stream
  displayStream = await navigator.mediaDevices
    .getUserMedia(constraints);

  const camConstraints = {
    video: true
  };

  // Create a Stream - webcam stream
  camStream = await navigator.mediaDevices
    .getUserMedia(camConstraints);

  mediaRecording();
}

async function overlayedVideoStreams() {
  const vid1 = document.createElement("video");
  const vid2 = document.createElement("video");
  vid1.muted = vid2.muted = true;
  vid1.srcObject = displayStream;
  vid2.srcObject = camStream;
  await Promise.all([
    vid1.play(),
    vid2.play()
  ]);
  // create the renderer
  const canvas = document.createElement("canvas");
  let w = canvas.width = vid1.videoWidth;
  let h = canvas.height = vid1.videoHeight;
  const ctx = canvas.getContext("2d");
  // MediaStreams can change size while streaming, so we need to handle it
  vid1.onresize = (evt) => {
    w = canvas.width = vid1.videoWidth;
    h = canvas.height = vid1.videoHeight;
  };
  // start the animation loop
  anim();

  return canvas.captureStream();

  function anim() {
    // draw bg video
    ctx.drawImage(vid1, 0, 0);
    // caculate size and position of small corner-vid (you may change it as you like)
    const cam_w = vid2.videoWidth;
    const cam_h = vid2.videoHeight;
    const cam_ratio = cam_w / cam_h;
    const out_h = h / 3;
    const out_w = out_h * cam_ratio;
    ctx.drawImage(vid2, w - out_w, h - out_h, out_w, out_h);
    // do the same thing again at next screen paint
    requestAnimationFrame(anim);
  }
}

async function mediaRecording() {
  const mixed_stream = await overlayedVideoStreams();

  // Preview the source in a video element
  videoElement.srcObject = mixed_stream;
  videoElement.play();

  // Create the Media Recorder
  const options = { mimeType: 'video/webm; codecs=vp9' };
  mediaRecorder = new MediaRecorder(mixed_stream, options);

  // Register Event Handlers
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.onstop = handleStop;

}

// Captures all recorded chunks
function handleDataAvailable(e) {
  console.log('video data available');
  recordedChunks.push(e.data);
}

// Saves the video file on stop
async function handleStop(e) {
  const blob = new Blob(recordedChunks, {
    type: 'video/webm; codecs=vp9'
  });

  const buffer = Buffer.from(await blob.arrayBuffer());

  const { filePath } = await dialog.showSaveDialog({
    buttonLabel: 'Save video',
    defaultPath: `vid-${Date.now()}.webm`
  });

  if (filePath) {
    writeFile(filePath, buffer, () => console.log('video saved successfully!'));
  }

}

// For timer
let totalSeconds = 0;

function setTime() {
  ++totalSeconds;
  let secs = pad(totalSeconds % 60);
  let mins = pad(parseInt(totalSeconds / 60));
  startBtn.innerText = `${mins}:${secs}`
}

function pad(val) {
  let valString = val + "";
  if (valString.length < 2) {
    return "0" + valString;
  } else {
    return valString;
  }
}
