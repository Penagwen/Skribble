const canvas = document.querySelector('canvas'); 
const ctx = canvas.getContext('2d'); 

const socket = io();

canvas.width = window.innerHeight*0.8;
canvas.height = window.innerHeight*0.8;

let currentColor = "black";
let currentSize = "medium";
let tool = "pencil";
let wordToDraw = "";
let drawer = false;
let username = "";
let host = false;

let body = Math.floor(Math.random() * 26);
let eyes = Math.floor(Math.random() * 56);
let mouth = Math.floor(Math.random() * 50);

let roundStarted = false;
let roundStartTime = 0;
let timer = 80000; // 80 sec

let coord = {x:0 , y:0};  
let paint = false; 

// fill timout
let lastFill = Date.now();
let fillCooldown = 100;

let players = {};

const getSize = (size) => ((size === "small") ? 3 : (size === "medium") ? 5 : (size === "large") ? 10 : (size === "extraLarge") ? 20 : 0);

function swapColor(color){
	currentColor = color;
	// switch the currentColor element in the tools div
	document.querySelector('.currentColor').style.backgroundColor = currentColor;
}
function setSize(size){
	currentSize = size;
}
function swapTool(t){
	tool = t;
}
function rgbToHex(r, g, b) {
  return "0xFF" + (1 << 24 | b << 16 | g << 8 | r).toString(16).slice(1);
}

function getPosition(event){ 
	coord.x = (event.clientX ?? event.touches[0].clientX) - canvas.offsetLeft; 
	coord.y = (event.clientY ?? event.touches[0].clientY) - canvas.offsetTop; 
} 
function startPainting(event){ 
	getPosition(event);
	if(tool == "pencil" && drawer){
		paint = true; 
	}else if(tool == "bucket" && roundStarted && drawer && (Date.now() - lastFill > fillCooldown) && (event.clientX != undefined)){
		if(coord.x > 0 && coord.x < canvas.width && coord.y > 0 && coord.y < canvas.height){
			lastFill = Date.now();
			let color = currentColor.replace("rgb(", "").replace(")", "").split(",");
			
			floodFill(ctx, coord.x, coord.y, rgbToHex(color[0], color[1], color[2]));

			socket.emit("floodfill", coord.x, coord.y, rgbToHex(color[0], color[1], color[2]));
		}
	}
} 
function stopPainting(){ 
	paint = false; 
} 
function sketch(event){ 
	if (!paint || !drawer || !roundStarted) return; 
	ctx.beginPath(); 
	
	ctx.lineWidth = getSize(currentSize); 
	
	// Sets the end of the lines drawn 
	// to a round shape. 
	ctx.lineCap = 'round'; 
	
	ctx.strokeStyle = currentColor; 
	
	// The cursor to start drawing 
	// moves to this coordinate 
	const initPos = { x: coord.x, y: coord.y };
	ctx.moveTo(coord.x, coord.y); 
	
	// The position of the cursor 
	// gets updated as we move the 
	// mouse around. 
	getPosition(event); 
	
	// A line is traced from start 
	// coordinate to this coordinate 
	ctx.lineTo(coord.x , coord.y); 
	
	// Draws the line. 
	ctx.stroke();
	socket.emit("updateCanvas", { start: initPos, end: coord, color: currentColor, size: getSize(currentSize) })
}

function getPixel(pixelData, x, y) {
	if (x < 0 || y < 0 || x >= pixelData.width || y >= pixelData.height) {
		return -1;  // impossible color
	} else {
		return pixelData.data[y * pixelData.width + x];
	}
}

function floodFill(ctx, x, y, fillColor) {
  // read the pixels in the canvas
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);

  // make a Uint32Array view on the pixels so we can manipulate pixels
  // one 32bit value at a time instead of as 4 bytes per pixel
  const pixelData = {
	width: imageData.width,
	height: imageData.height,
	data: new Uint32Array(imageData.data.buffer),
  };

  // get the color we're filling
  const targetColor = getPixel(pixelData, x, y);

  // check we are actually filling a different color
  if (targetColor !== fillColor) {
	const spansToCheck = [];

	function addSpan(left, right, y, direction) {
	  spansToCheck.push({left, right, y, direction});
	}

	function checkSpan(left, right, y, direction) {
	  let inSpan = false;
	  let start;
	  let x;
	  for (x = left; x < right; ++x) {
		const color = getPixel(pixelData, x, y);
		if (color === targetColor) {
		  if (!inSpan) {
			inSpan = true;
			start = x;
		  }
		} else {
		  if (inSpan) {
			inSpan = false;
			addSpan(start, x - 1, y, direction);
		  }
		}
	  }
	  if (inSpan) {
		inSpan = false;
		addSpan(start, x - 1, y, direction);
	  }
	}

	addSpan(x, x, y, 0);

	  let LIMIT = canvas.width*canvas.height;
	  let counter = 0;
	while (spansToCheck.length > 0 && counter++ < LIMIT) {
	  const {left, right, y, direction} = spansToCheck.pop();

	  // do left until we hit something, while we do this check above and below and add
	  let l = left;
	  for (;;) {
		--l;
		const color = getPixel(pixelData, l, y);
		if (color !== targetColor) {
		  break;
		}
	  }
	  ++l

	  let r = right;
	  for (;;) {
		++r;
		const color = getPixel(pixelData, r, y);
		if (color !== targetColor) {
		  break;
		}
	  }

	  const lineOffset = y * pixelData.width;
	  pixelData.data.fill(fillColor, lineOffset + l, lineOffset + r);

	  if (direction <= 0) {
		checkSpan(l, r, y - 1, -1);
	  } else {
		checkSpan(l, left, y - 1, -1);
		checkSpan(right, r, y - 1, -1);
	  }

	  if (direction >= 0) {
		checkSpan(l, r, y + 1, +1);
	  } else {
		checkSpan(l, left, y + 1, +1);
		checkSpan(right, r, y + 1, +1);
	  }     
	}
	// put the data back
	ctx.putImageData(imageData, 0, 0);
  }
}

function swapBody(){
	// convert body into a 2x2 pos
	const x = body%10, y = Math.floor(body/10);

	const bodyDis = document.querySelector(".body");
	// alert(x +" "+ y);
	bodyDis.style.clip = `rect(${y*8 + 0.1}vw, ${(x+1)*8}vw, ${(y+1)*8}vw, ${x*8}vw)`;
	bodyDis.style.transform = `translate(-${x*8}vw, -${y*8}vw)`;
}
function swapEyes(){
	// convert eyes into a 2x2 pos
	const x = eyes%10, y = Math.floor(eyes/10);

	const eyesDis = document.querySelector(".eyes");
	// alert(x +" "+ y);
	eyesDis.style.clip = `rect(${y*8 + 0.1}vw, ${(x+1)*8}vw, ${(y+1)*8}vw, ${x*8}vw)`;
	eyesDis.style.transform = `translate(-${x*8}vw, -${y*8}vw)`;
}
function swapMouth(){
	// convert eyes into a 2x2 pos
	const x = mouth%10, y = Math.floor(mouth/10);

	const mouthDis = document.querySelector(".mouth");
	// alert(x +" "+ y);
	mouthDis.style.clip = `rect(${y*8 + 0.1}vw, ${(x+1)*8}vw, ${(y+1)*8}vw, ${x*8}vw)`;
	mouthDis.style.transform = `translate(-${x*8}vw, -${y*8}vw)`;
}



function chat(username, message, type, id){
	if(type == "correct" && roundStarted){
		document.getElementById(id).className += " correct";
	}
	
	const messages = document.querySelector('.messages');
	messages.innerHTML += `<div class="message" id="${type}"><span class="user">${(username != "") ? username +" : " : ""}</span><span class="text">${message}</span></div>`;
	messages.scrollTop = messages.scrollHeight;
}
function sendMessage(message){
	if(drawer) return;
	// check if message is word
	socket.emit('message', username, message);
}

function addPlayer(username, thisPlayer, id, host, points, body, eyes, mouth){
	const players = document.querySelector(".players");
	// convert body, eyes, mouth to x and y vals
	const bodyX = body%10, bodyY = Math.floor(body/10);
	const eyesX = eyes%10, eyesY = Math.floor(eyes/10);
	const mouthX = mouth%10, mouthY = Math.floor(mouth/10);

	// I need to learn react
	players.innerHTML += `<div class="player" id="${id}">
							<div class="player-name ${(thisPlayer) ? 'user' : ''}">${username} ${(thisPlayer) ? '(You)' : ''}</div>
							<div class="player-score">${points} points</div>
							<div class="character">
							
								<img class="body" style="
									clip: rect(${bodyY*48}px, ${(bodyX+1)*48}px, ${(bodyY+1)*48}px, ${bodyX*48}px);
									transform: translate(calc(-${bodyX*48}px + 10%), calc(-${bodyY*48}px - 8.5%));
								" src="./img/color_atlas.gif">
								
								<img class="eyes" style="
									clip: rect(${eyesY*48}px, ${(eyesX+1)*48}px, ${(eyesY+1)*48}px, ${eyesX*48}px);
									transform: translate(calc(-${eyesX*48}px + 10%), calc(-${eyesY*48}px - 8.5%));
								" src="./img/eyes_atlas.gif">
								
								<img class="mouth" style="
									clip: rect(${mouthY*48}px, ${(mouthX+1)*48}px, ${(mouthY+1)*48}px, ${mouthX*48}px);
									transform: translate(calc(-${mouthX*48}px + 10%), calc(-${mouthY*48}px - 8.5%));
								" src="./img/mouth_atlas.gif">
							</div>
							${(host) ? '<img class="crown" src="./img/crown.gif">' : ''}
						</div>`;
}
function removePlayer(id){
	document.getElementById(id).remove();
}

function joinGame(user){
	if(user.length > 0) username = user;
	else username = "Player";

	// set up the sockets to connect to the game
	sockets();
	
	document.querySelector('.join-screen').style.display = "none";
	document.querySelector('.game').style.display = "flex";


	// tell server
	socket.emit('player-joined', username, body, eyes, mouth);
	
	document.querySelector(".tools").style.visibility = "hidden";
}

let gameFrame;
function gameUpdate(){
	gameFrame = requestAnimationFrame(gameUpdate);

	// render the clock
	const clock = document.querySelector('.clock');
	const timeLeft = Math.floor((timer - (Date.now() - roundStartTime)) / 1000);

	clock.innerHTML = Math.max(0, timeLeft);

	if(timeLeft <= 0){
		stopRound();
	}

	
}

function startRound(word, id){
	drawer = (socket.id == id);
	wordToDraw = word[0];

	// reset from the last round
	document.querySelectorAll(".player").forEach(node => {
		// remove the correct class from the players
		node.className = node.className.replace("correct", "");
	});
	document.querySelector(".header .word").innerHTML = "";
	
	
	// hide the game settings
	const settings = document.querySelector('.game-settings');
	settings.style.visibility = "hidden";

	// hid the words
	const wordDisplay = document.querySelector(".word-choices");
	wordDisplay.style.visibility = "hidden";

	// hide restart screen
	const restart = document.querySelector(".results");
	restart.style.visibility = "hidden";
	
	// show tools if drawer
	if(drawer) document.querySelector(".tools").style.visibility = "visible";
	else document.querySelector(".tools").style.visibility = "hidden";
	
	if(drawer){
		// dsiplay word
		document.querySelector(".description").innerHTML = "DRAW THIS";
		document.querySelector(".word").innerHTML = wordToDraw;
	}else{
		// dont display word
		document.querySelector(".description").innerHTML = "GUESS THIS";
		const wordDisplay = document.querySelector(".word");
		for(let i = 0; i < word[0].length; i++){
			if(word[0][i] == " "){
				wordDisplay.innerHTML += `<span class="hint"> </span>`;
			}else{
				wordDisplay.innerHTML += `<span class="hint">_</span>`;
			}
		}
	}
	
	timer = 80000;
	roundStartTime = Date.now();
	roundStarted = true;
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	gameUpdate();
}
function stopRound(){
	cancelAnimationFrame(gameFrame);

	document.querySelector(".header .word").innerHTML = wordToDraw;

	if(host){
		socket.emit('start-round');
	}
}

let timerFrame;
let chosenWord = "";
let wordsToChoose = [];
function pickWord(){
	timerFrame = requestAnimationFrame(pickWord);

	// render the clock
	const clock = document.querySelector('.clock');
	const timeLeft = Math.floor((timer - (Date.now() - roundStartTime)) / 1000);

	clock.innerHTML = Math.max(0, timeLeft);

	
	if(timeLeft <= 0){
		cancelAnimationFrame(timerFrame);
		// pick random word from words
		chosenWord = wordsToChoose[Math.floor(Math.random() * wordsToChoose.length)];
		socket.emit("picked-word", chosenWord, socket.id);
	}
}

function hideWord(){
	if(!drawer) return;

	const wordDis = document.querySelector(".header .word");

	if(wordDis.innerHTML[0] == "_"){
		wordDis.innerHTML = wordToDraw;
	}else{
		for(let i = 0; i < wordToDraw.length; i++){
			if(wordToDraw[i] == " "){
				wordDisplay.innerHTML += " ";
			}else{
				wordDisplay.innerHTML += "_";
			}
		}
	}
}

function sockets(){
	//set up sockets
	socket.on("player-joined", (serverPlayers) => {
		for(const id in serverPlayers){
			const serverPlayer = serverPlayers[id];

			if(!players[id]){ // player dosent exsit in our players object
				addPlayer(
					serverPlayer.username, 
					(id == socket.id), 
					id, 
					serverPlayer.host, 
					serverPlayer.points,
					serverPlayer.body,
					serverPlayer.eyes,
					serverPlayer.mouth,
				);
			}

			if(id == socket.id && serverPlayer.host && !roundStarted){
				host = true;
				const settings = document.querySelector('.game-settings');
				settings.style.visibility = "visible";
			}
		}
		
		// update the players list
		players = serverPlayers;
	});	

	socket.on("player-left", (serverPlayers) => {
		for(const id in players){			
			if(!serverPlayers[id]){ // player is in our list but not servers
				removePlayer(id);
			}
		}

		// update the players list
		players = serverPlayers;
	});	

	socket.on("transfer-host", (id) => {
		host = true;
		document.querySelector(`.players #${id}`).innerHTML += '<img class="crown" src="./img/crown.gif">';
	});

	socket.on("message", (username, message, type, id) => {
		chat(username, message, type, id);
	});

	socket.on("start-round", (word, id) => {
		startRound(word, id);
	});

	socket.on("pick-word", (words, id) => {
		// hide the game settings
		const settings = document.querySelector('.game-settings');
		settings.style.visibility = "hidden";
		// hide restart screen
		const restart = document.querySelector(".results");
		restart.style.visibility = "hidden";
		// if the pick word screen is up hide it
		document.querySelector(".word-choices").style.visibility = "hidden";

		roundStarted = true;		
		if(id == socket.id){
			roundStartTime = Date.now();
			timer = 15000;
			chosenWord = "";
			wordsToChoose = words;
			// show word choices
			const wordDisplay = document.querySelector(".word-choices");
			wordDisplay.style.visibility = "visible";

			document.querySelectorAll(".word-choices button").forEach((btn, i) => {
				btn.innerHTML = words[i][0];

				btn.addEventListener("click", (e) => {
					if(chosenWord == ""){
						chosenWord = [btn.innerHTML];
						cancelAnimationFrame(timerFrame);

						socket.emit("picked-word", [btn.innerHTML], socket.id);
					}
				});
			});
			
			pickWord(words);
		}
	});

	socket.on("updateCanvas", (drawData) => {
		ctx.beginPath();
		ctx.lineWidth = drawData.size;
		ctx.strokeStyle = drawData.color;
		ctx.lineCap = "round";
		ctx.moveTo(drawData.start.x, drawData.start.y);
		ctx.lineTo(drawData.end.x, drawData.end.y);
		ctx.stroke();
	});

	socket.on("stop-round", () => {
		stopRound();
	});

	socket.on("end-game", () => {
		cancelAnimationFrame(timerFrame);
		cancelAnimationFrame(gameFrame);
		roundStarted = false;
		// hide the words
		const wordDisplay = document.querySelector(".word-choices");
		wordDisplay.style.visibility = "hidden";
		
		// show results
		const results = document.querySelector(".results");
		results.style.visibility = "visible";

		// covert the object into an array and sort them based on their score but add keep the id somewhere
		const playersScores = [];
		// sort the player into the playerscores based on their 
		for(const id in players){
			const player = players[id];			
			playersScores.push({
				id: id, 
				points: player.points,
				username: player.username,
			});
		}
			
		// sort the player based on their scores
		playersScores.sort((a, b) => b.points - a.points);	

		
		// add a empy player incase there is only two players
		playersScores.push({ username: "", points: 0 });
		playersScores.push({ username: "", points: 0 });

		document.querySelector(".results .winner").innerHTML = "1# - " + playersScores[0].username;
		document.querySelector(".results .second").innerHTML = "2# - " + playersScores[1].username;
		document.querySelector(".results .third").innerHTML = "3# - " + playersScores[2].username;

		
		if(host){
			// show restart button
			const restart = document.querySelector(".restart");
			restart.style.visibility = "visible";
		}
	});

	socket.on("updatePoints", (serverPlayers) => {
		for(const id in serverPlayers){
			players[id].points = serverPlayers[id].points;
			document.getElementById(id).children[1].innerHTML = serverPlayers[id].points + " points";
			// document.querySelector(`.players #${id} .player-score`).innerHTML = serverPlayers[id].points + " points";
		}
	});

	socket.on("floodfill", (x, y, color) => {
		floodFill(ctx, x, y, color);
	});
}

function init(){	
	document.addEventListener('mousedown', startPainting); 
	document.addEventListener('mouseup', stopPainting); 
	document.addEventListener('mousemove', sketch); 

	// touch screen
	document.addEventListener("touchstart", startPainting);
	document.addEventListener("touchend", stopPainting);
	document.addEventListener("touchmove", sketch);

	// render the player on the join screen
	swapBody();
	swapEyes();
	swapMouth();
	
	// add a onlclick effect to each color button
	const colorButtons = document.querySelectorAll('.colors button');
	colorButtons.forEach(button => {
		button.addEventListener('click', () => {
			// get the background from css variable
			const color = getComputedStyle(button).backgroundColor;
			swapColor(color);
		});
	});

	// add a onlclick effect to each size button
	const sizeButtons = document.querySelectorAll('.sizes button');
	sizeButtons.forEach(button => {
		button.addEventListener('click', () => {
			// get the background from css variable
			const size = button.className;
			setSize(size);

			// add selected class to the button remove selected from every other button
			sizeButtons.forEach(button => { button.classList.remove('selected');});
			button.classList.add('selected');
		});
	});
	

	// add a onlclick effect to each drawing option button
	const drawingOptions = document.querySelectorAll('.drawingOptions button');
	drawingOptions.forEach(button => {
		button.addEventListener('click', () => {
			
			swapTool(button.classList[0]);
			
			// add selected class to the button remove selected from every other button
			drawingOptions.forEach(button => { button.classList.remove('selected');});
			button.classList.add('selected');
		});		
	});
	
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// add a on key down for enter on chat input
	const chatInput = document.querySelector('.chat input');
	chatInput.addEventListener('keydown', (event) => {
		if(event.key == "Enter"){
			const message = chatInput.value;
			if(message.length > 0){
				sendMessage(message);
				chatInput.value = "";
			}
		}
	});


	// add a on click to the join button
	const joinButton = document.querySelector('.join-screen .startBtn');
	const userInput = document.querySelector('.join-screen input');

	joinButton.addEventListener('click', () => {
		const username = document.querySelector('.join-screen input').value;
		joinGame(username);
	});

	// when the user presses enter when the join screen is visible join the game
	userInput.addEventListener('keydown', (event) => {
		if(event.key == "Enter"){
			const username = document.querySelector('.join-screen input').value;
			joinGame(username);
		}
	});

	// add a on click to the start button
	const startButton = document.querySelector('.game-settings button');
	startButton.addEventListener('click', () => {
		if(Object.keys(players).length > 1){
			// reset from the last round
			document.querySelectorAll(".player").forEach(node => {
				// remove the correct class from the players
				node.className = node.className.replace("correct", "");
			});
			document.querySelector(".header .word").innerHTML = "";
			
			// hide restart button
			const restart = document.querySelector(".restart");
			restart.style.visibility = "hidden";

			socket.emit("resetScores");
			socket.emit('start-round');
		}
	});

	// add a on click to the restart button
	const restartButton = document.querySelector('.results button');
	restartButton.addEventListener('click', () => {
		if(Object.keys(players).length > 1){
			// hide restart button
			const restart = document.querySelector(".restart");
			restart.style.visibility = "hidden";

			// reset from the last round
			document.querySelectorAll(".player").forEach(node => {
				// remove the correct class from the players
				node.className = node.className.replace("correct", "");
			});
			document.querySelector(".header .word").innerHTML = "";
			
			socket.emit("resetScores");
			socket.emit('start-round');
		}
	});


	// add one to the body when switchBodyRight is clicked
	const switchBodyRight = document.querySelector('.switchBodyRight');
	switchBodyRight.addEventListener('click', () => {
		body ++;
		if(body == 26) body = 30;
		if(body > 30) body = 0;

		swapBody();
	});

	// add onclick to the switchEyesRight
	const switchEyesRight = document.querySelector('.switchEyesRight');
	switchEyesRight.addEventListener('click', () => {
		eyes ++;
		if(eyes > 56) eyes = 0;

		swapEyes();
	});

	// add onclick to the switchMouthRight
	const switchMouthRight = document.querySelector('.switchMouthRight');
	switchMouthRight.addEventListener('click', () => {
		mouth ++;
		if(mouth > 50) mouth = 0;

		swapMouth();
	});
}

window.addEventListener('load', ()=>{ 
	init();
}); 