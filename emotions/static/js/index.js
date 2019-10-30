var audioSelect, videoSelect, facialCheck, multipleCheck;
var ctx, CNNctx, audioctx, canvas, CNNcanvas, canvasAudio;
var ctracker, trackerTask, videoElement;
var singleInterval;
var model;
var emotionBars, emojis, angerBar, disgustBar, fearBar, happinessBar, sadnessBar, surpriseBar, neutralBar;
var emotiones, colors;
var minx, miny, maxx, maxy;
var recordButton, downloadButton;
var recordedBlobs, mediaRecorder;
var segundosGrab, segundosInterval;
const mediaSource = new MediaSource();
var canvasStream;
var elegido = 7;
var text = [];
var primera = true;
var cambiandoCamara = true;
var opciones = true;

var analyser_node;
var sampleRate;
var ind = 0;
var recibido = true;
var audioPrediction = [];
var textPrediction = [];

var sliders = {"Peso": 0.6, "Margen": 0.2};

const ranks = [[6,5,1,0,2,3,4], [3,5,6,1,0,2,4], [4,2,0,1,6,5,3]];

function argMax(array) {
	return array.map((x, i) => [x, i]).reduce((r, a) => (a[0] > r[0] ? a : r))[1];
}

function hasGetUserMedia() {
	return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}


function startVideo(m) {
	document.title = 'Emotion Detector';

	videoElement = document.getElementById('inputVideo');
	canvas = document.getElementById('outputCanvas');
	canvasStream = canvas.captureStream();
	CNNcanvas = document.getElementById('CNNCanvas');
	audioSelect = document.getElementById('audioSource');
	videoSelect = document.getElementById('videoSource');
	facialCheck = document.getElementById('facialCheck');
	canvasAudio = document.getElementById('audioCanvas');
	
	$('#contractor').click(function(e) {  
		if(opciones){
			$('#optionsSection').hide();
			$('#contractor').text("▶");
		}
		else{
			$('#optionsSection').show();
			$('#contractor').text("◀");
		}
		opciones = !opciones;
	});
	$('#fullscreen').click(function(e) {  
		fullScreen();
	});
	$('#normalscreen').click(function(e) {  
		normalScreen();
	});

	emotionBars = [
		document.getElementById('angerBar'),
		document.getElementById('disgustBar'),
		document.getElementById('fearBar'),
		document.getElementById('happinessBar'),
		document.getElementById('sadnessBar'),
		document.getElementById('surpriseBar'),
		document.getElementById('neutralBar'),
	];
	emojis = [
		document.getElementById('angerEmoji'),
		document.getElementById('disgustEmoji'),
		document.getElementById('fearEmoji'),
		document.getElementById('happinessEmoji'),
		document.getElementById('sadnessEmoji'),
		document.getElementById('surpriseEmoji'),
		document.getElementById('neutralEmoji'),
	];
	emociones = ["Anger", "Disgust", "Fear", "Happiness", "Sadness", "Surprise", "Neutral"];
	colors = ["#791220", "#4c6315", "#503b6a", "#726400", "#09507c", "#884500", "#767676"];

	model = m;

	navigator.mediaDevices.enumerateDevices().then(gotDevices).then(getStream).catch(handleError);

	audioSelect.onchange = getStream;
	videoSelect.onchange = getStream;

	recordButton = document.getElementById('record');
	downloadButton = document.getElementById('download');
	recordButton.addEventListener('click', () => {
		if (recordButton.textContent === 'Record') {
			startRecording();
			$(recordButton).removeClass("grabar");
			$(recordButton).addClass("parar");
		} else {
			stopRecording();
			recordButton.textContent = 'Record';
			$(recordButton).addClass("grabar");
			$(recordButton).removeClass("parar");
		}
	});
	downloadButton.addEventListener('click', () => {
		const blob = new Blob(recordedBlobs, { type: 'video/webm' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.style.display = 'none';
		a.href = url;
		a.download = 'test.webm';
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		}, 100);
	});
}

function showVal(slider){
	var id = slider.id.substring(5);
	$("#ind"+id).text(slider.value);
	sliders[id] = parseFloat(slider.value);
}

function startRecording() {
	recordedBlobs = [];
	let options = { mimeType: 'video/webm' };
	if (!MediaRecorder.isTypeSupported(options.mimeType)) {
		console.error(`${options.mimeType} is not Supported`);
		errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
		options = { mimeType: 'video/webm;codecs=vp8' };
		if (!MediaRecorder.isTypeSupported(options.mimeType)) {
			console.error(`${options.mimeType} is not Supported`);
			errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
			options = { mimeType: 'video/webm' };
			if (!MediaRecorder.isTypeSupported(options.mimeType)) {
				console.error(`${options.mimeType} is not Supported`);
				errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
				options = { mimeType: '' };
			}
		}
	}

	try {
		mediaRecorder = new MediaRecorder(canvasStream, options);
	} catch (e) {
		console.error('Exception while creating MediaRecorder:', e);
		errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
		return;
	}

	console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
	recordButton.textContent = 'Stop';
	downloadButton.disabled = true;
	$(downloadButton).addClass("deshabilitado");
	$(downloadButton).removeClass("descargar");
	mediaRecorder.onstop = (event) => {
		console.log('Recorder stopped: ', event);
	};
	mediaRecorder.ondataavailable = handleDataAvailable;
	mediaRecorder.start(10); // collect 10ms of data
	console.log('MediaRecorder started', mediaRecorder);

	segundosGrab = 0;
	$("#recText").removeClass("hidden");
	$("#textSegs").text("00:00");
	segundosInterval = setInterval(aumentarSegundero, 1000);
}

function aumentarSegundero() {
	segundosGrab++;
	var mins = Math.floor(segundosGrab / 60);
	var segs = Math.floor(segundosGrab % 60);
	if (segs < 10) segs = "0" + segs;
	if (mins < 10) mins = "0" + mins;
	$("#textSegs").text(mins + ":" + segs);
}

function stopRecording() {
	$(downloadButton).removeClass("deshabilitado");
	$(downloadButton).addClass("descargar");
	downloadButton.disabled = false;

	$("#recText").addClass("hidden");
	clearInterval(segundosInterval);

	mediaRecorder.stop();
	console.log('Recorded Blobs: ', recordedBlobs);
}

function handleDataAvailable(event) {
	if (event.data && event.data.size > 0) {
		recordedBlobs.push(event.data);
	}
}

function gotDevices(deviceInfos) {
	for (let i = 0; i !== deviceInfos.length; ++i) {
		const deviceInfo = deviceInfos[i];
		const option = document.createElement('option');
		option.value = deviceInfo.deviceId;
		if (deviceInfo.kind === 'audioinput') {
			option.text = deviceInfo.label || 'microphone ' + (audioSelect.length + 1);
			audioSelect.appendChild(option);
		} else if (deviceInfo.kind === 'videoinput') {
			option.text = deviceInfo.label || 'camera ' + (videoSelect.length + 1);
			videoSelect.appendChild(option);
		} else {
			console.log('Found another kind of device: ', deviceInfo);
		}
	}
}

function getStream() {
	cambiandoCamara = true;
	if (window.stream) {
		window.stream.getTracks().forEach(function (track) {
			track.stop();
		});
	}

	const constraints = {
		audio: {
			deviceId: { exact: audioSelect.value }
		},
		video: {
			deviceId: { exact: videoSelect.value }
		}
	};

	navigator.mediaDevices.getUserMedia(constraints).then(gotStream).catch(handleError);
}

function gotStream(stream) {
	window.stream = stream; // make stream available to console
	start_microphone(stream);
	
	if (primera && recordButton.textContent !== 'Record') {
		stopRecording();
		recordButton.textContent = 'Record';
		$(recordButton).addClass("grabar");
		$(recordButton).removeClass("parar");
	}
	else{
		recordButton.disabled = false;
		$(recordButton).addClass("grabar");
		$(recordButton).removeClass("deshabilitado");
	}

	videoElement.srcObject = stream;

	videoElement.oncanplay = function() {
		if(primera){
			ctx = canvas.getContext('2d');
			CNNctx = CNNcanvas.getContext('2d');
			$(".lds-jfl-alm-jfo-dual-ring").remove();
			singleInterval = setInterval(positionLoop, 500);
			requestAnimationFrame(paintCanvas);
			primera = false;
		}
		else{
			ctracker.stop();
		}
		ctracker = new clm.tracker();
		ctracker.init();
		ctracker.start(videoElement);
		cambiandoCamara = false;
	};
}

function start_microphone(stream){
	audioctx = canvasAudio.getContext('2d');
	var audioContext = new AudioContext();
	sampleRate = audioContext.sampleRate;
	var microphone_stream = audioContext.createMediaStreamSource(stream);
	analyser_node = audioContext.createAnalyser();
	microphone_stream.connect(analyser_node);
	full_array = new Float32Array(500000);
	const scriptProcessor = audioContext.createScriptProcessor(4096,1,1);
	analyser_node.connect(scriptProcessor);
	scriptProcessor.connect(audioContext.destination);
	const processInput = audioProcessingEvent => {
		var data = audioProcessingEvent.inputBuffer.getChannelData(0);
		if(data.reduce((a, b) => a + b, 0)==0) return;
		for(var i = 0; i < data.length && i + ind < full_array.length; i++){
			full_array[ind + i] = data[i];
		}
		ind = Math.min(ind + data.length, full_array.length);
		if(ind >= full_array.length && !recibido)
			ind = 0;
		else if(ind >= full_array.length / 2 && recibido){
			audioctx.clearRect(0, 0, canvasAudio.width, canvasAudio.height);
			var curx = 0
			var ys = [];
			for(var i = 0; i < ind; i++){
				var x = Math.round(i * canvasAudio.width / ind);
				if(x != curx){
					var maxy = Math.max(...ys) + 1;
					var miny = Math.min(...ys) + 1;
					audioctx.fillRect(curx,miny*canvasAudio.height/2,1,Math.max(1,(maxy-miny)*canvasAudio.height/2));
					ys = [];
					curx = x;
				}
				ys.push(full_array[i]);
			}

			if(recibido){
				recibido = false;
				var str_array = full_array.subarray(0, ind).join(",");
				$.ajax({
					url: 'ajax/analyze_audio/',
					method: "POST",
					data: {'audio': str_array},
					error: function (data) {
						recibido = true;
						console.log("Error con el audio");
						audioPrediction = [];
						textPrediction = [];
					},
					success: function (data) {
						recibido = true;
						audioPrediction = data["audio"].split(",").map(parseFloat);
						textPrediction = data["texto"].split(",").map(parseFloat);
						if(audioPrediction.length < 7) audioPrediction = [];
						if(textPrediction.length < 4) textPrediction = [];
					}
				});
			}
			ind = 0;
		}
	}
	scriptProcessor.onaudioprocess = processInput;
}

function fullScreen(){
	$("#noCara, #inputVideo, #outputCanvas").height($("body").height());
	$("#noCara, #inputVideo, #outputCanvas").width($("body").height() * 4. / 3.);
	$("#contentSection").css({"padding": 0, "background-color": "#000000"});
	$("#mainTable").addClass("center");
	$("#optionsSection, .inputContainer, #contractor, #resultsContainer").hide();
	$('#normalscreen').removeClass("hidden");
	$('#fullscreen').addClass("hidden");
}

function normalScreen(){
	$("#noCara, #inputVideo, #outputCanvas").height(450);
	$("#noCara, #inputVideo, #outputCanvas").width(600);
	$("#contentSection").css({"padding": "", "background-color": ""});
	$("#mainTable").removeClass("center");
	$("#optionsSection, .inputContainer, #contractor, #resultsContainer").show();
	$('#normalscreen').addClass("hidden");
	$('#fullscreen').removeClass("hidden");

	$('#contractor').text("◀");
	opciones = true;
}

function handleError(error) {
	console.error('Error: ', error);
}
var caraEncontrada = false;
var oportunidad = false;
function paintCanvas() {
	if(cambiandoCamara){
		requestAnimationFrame(paintCanvas);
		return;
	}
	var propx = videoElement.videoWidth / canvas.width;
	var propy = videoElement.videoHeight / canvas.height;
	ctx.drawImage(videoElement, 0, 0, videoElement.videoWidth, videoElement.videoHeight, 0, 0, canvas.width, canvas.height);

	if(caraEncontrada) {
		ctx.strokeStyle = colors[elegido];
		ctx.strokeRect(minx, miny, maxx - minx, maxy - miny);

		if (facialCheck.checked)
			ctracker.draw(canvas);

		posx = Math.min(maxx, 440);

		ctx.fillStyle = colors[elegido];
		ctx.globalAlpha = 0.7;
		ctx.fillRect(posx, miny, 160, 150);
		ctx.globalAlpha = 1.0;

		ctx.fillStyle = "white";
		for (var i = 0; i < text.length; i++) {
			ctx.font = (elegido == i ? "bold 18px" : "16px") + " Arial";
			ctx.fillText(text[i], posx + 5, miny + 20 * (i + 1));
		}
	}

	var positions = ctracker.getCurrentPosition();
	if (positions) {
		caraEncontrada = true;
		oportunidad = true;
		$("#noCara").addClass("hidden");
		minx = Infinity;
		maxx = -Infinity;
		miny = Infinity;
		maxy = -Infinity;
		for (var i = 0; i < positions.length; i++) {
			var position = positions[i];
			minx = Math.min(position[0], minx);
			maxx = Math.max(position[0], maxx);
			miny = Math.min(position[1], miny);
			maxy = Math.max(position[1], maxy);
		}
	}
	else if(oportunidad)
		oportunidad = false;
	else {
		caraEncontrada = false;
		$("#noCara").removeClass("hidden");
		CNNctx.clearRect(0, 0, CNNcanvas.width, CNNcanvas.height);
	}
	requestAnimationFrame(paintCanvas);
}

async function positionLoop() {
	if(cambiandoCamara || !caraEncontrada){
		if(!caraEncontrada) showPrediction([]);
		return;
	}
	
	var centerx = (maxx + minx) / 2
	var centery = (maxy + miny) / 2
	var radius = Math.max(maxx - minx, maxy - miny) / 2

	fmaxx = Math.ceil(Math.min(centerx + radius, canvas.width))
	fminx = Math.floor(Math.max(centerx - radius, 0))
	fmaxy = Math.ceil(Math.min(centery + radius, canvas.height))
	fminy = Math.floor(Math.max(centery - radius, 0))
	if(isNaN(fmaxx) || isNaN(fminx) || isNaN(fmaxy) || isNaN(fminy)) return;
	
	ctx.drawImage(videoElement, 0, 0, videoElement.videoWidth, videoElement.videoHeight, 0, 0, canvas.width, canvas.height);
	var data = ctx.getImageData(fminx, fminy, fmaxx - fminx, fmaxy - fminy);

	var grayimg = tf.browser.fromPixels(data, 1);
	var grayresimg = tf.image.resizeBilinear(grayimg, [48, 48]);
	var tensor = tf.div(tf.reshape(grayresimg, [1, 48, 48, 1]), 255.0);

	CNNctx.clearRect(0, 0, CNNcanvas.width, CNNcanvas.height);
	tf.browser.toPixels(grayresimg, CNNcanvas);

	var prediction = model.predict(tensor);
	prediction.data().then(showPrediction);
}

function showPrediction(prediction) {
	text = [];
	prediction = Array.from(prediction);
	if(audioPrediction.length == 7){
		if(prediction.length==0){
			prediction = audioPrediction.slice();
		}
		else{
			for (var i = 0; i < 7; i++){
				prediction[i] = prediction[i] * sliders["Peso"] + audioPrediction[i] * (1 - sliders["Peso"]);
			}
		}
	}
	if(prediction.length + audioPrediction.length < 7) elegido = -1;
	else elegido = argMax(prediction);
	if(textPrediction.length == 4 && elegido > -1){
		var dudas = [elegido]
		for (var i = 0; i < 7; i++){
			if(i != elegido && prediction[elegido] - prediction[i] < sliders["Margen"]){
				dudas.push(i);
			}
		}
		if(dudas.length > 1){
			var polaridad = argMax(textPrediction);
			if(polaridad > 0){
				var rank = ranks[polaridad-1];
				for(var i = 0; i < 7; i++){
					if(dudas.indexOf(rank[i]) > 0){
						prediction[rank[i]] = prediction[elegido];
						elegido = rank[i];
						break;
					}
				}
			}
		}
	}
	for (var i = 0; i < 7; i++) {
		$(emotionBars[i]).stop(true, true);
		$(emotionBars[i]).animate({ height: elegido == -1 ? 0 : 200 * prediction[i] }, 250);
		emotionBars[i].style.opacity = elegido == i ? 1 : 0.5;
		emojis[i].style.opacity = elegido == i ? 1 : 0.5;

		var t = emociones[i] + " " + Math.round(prediction[i] * 10000) / 100 + "%";
		text.push(t);
	}
}