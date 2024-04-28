const express = require("express");
const path = require("path");
const { Socket } = require("socket.io");

const app = express();
const server = require("http").createServer(app);

const io  = require("socket.io")(server);

// words
const fs = require('fs');
const readline = require('readline');

// Create a readable stream from the file
const fileStream = fs.createReadStream('Skribbl-words.txt');

// Create a readline interface
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity // To recognize all instances of \r, \n, or \r\n as line breaks
});

const words = [];

// Listen for the 'line' event, which occurs when a new line is read
rl.on('line', (line) => {
  // Split each line by commas
  const wordArray = line.split(',');
  words.push(wordArray);
});



app.use(express.static(path.join(__dirname+"/public")));

const players = {};
let playersCorrect = 0;
let playersThatAreCorrect = [];
let round = 0;
const maxRounds = 5;
let roundStarted = false;
let pickingWord = false;
let drawers = [];
let randomWord = "";
let startTime = 0;

io.on("connection", (socket) => {	
	socket.on('player-joined', (username, body, eyes, mouth) => {

		players[socket.id] = {
			username: username,
			points: 0,
			host: (Object.keys(players).length == 0),
			body: body,
			eyes: eyes,
			mouth: mouth,
		};
		// tell other user that a new play had joined
		io.emit("player-joined", players);
	});

	socket.on("disconnect", (reason) => {
		if(!!players[socket.id]){
		
			// if the player that left was the host tranfer host
			if(players[socket.id].host && Object.keys(players).length > 1){
				// pick the first player that isnt the host
				const playerId = Object.keys(players)[1];
				
				players[playerId].host = true;	

				
				socket.broadcast.emit("transfer-host", playerId);
			} 

			io.emit("message", players[socket.id].username, " has left.", "left", socket.id);
			delete players[socket.id];

			if(Object.keys(players).length <= 1){
				endGame();
			}			
		}
		socket.broadcast.emit("player-left", players);
	});

	socket.on("message", (username, message) => {
		// check if the message is the word
		if(!!randomWord && message.toLowerCase() == randomWord[0].toLowerCase() && !playersThatAreCorrect.includes(socket.id)){
			io.emit("message", username, "guessed the word!", "correct", socket.id);
			playersCorrect ++;
			playersThatAreCorrect.push(socket.id);

			
			// give points to player
			const points = calculatePoints(Math.floor((Date.now() - startTime) / 1000), randomWord.length);
					
			players[socket.id].points += points;
			// give the drawer 50% of the points
			if(!!players[drawers[drawers.length - 1]]){
				players[drawers[drawers.length - 1]].points += Math.floor(points / 2);
			}

			
			
			io.emit("updatePoints", players);	
		}else if(!playersThatAreCorrect.includes(socket.id)){
			io.emit("message", username, message, "normal", socket.id);
		}

		if(playersCorrect >= (Object.keys(players).length - 1) && roundStarted && !pickingWord){
			io.emit("stop-round");
			roundStarted = false;
		}
	});

	socket.on("start-round", () => {
		if(round >= maxRounds){
			endGame();
		}else{
			startRound();	
		}
	});

	socket.on("picked-word", (word, id) => {
		pickingWord = false;
		randomWord = word;
		round ++;
		playersThatAreCorrect = [];
		const currRound = round;
		setTimeout(() => {
			if(currRound == round){
				io.emit("stop-round");
			}
		}, 80000);
		playersCorrect = 0;
		io.emit("message", "", "round " + round, "round", 0);
		roundStarted = true;
		startTime = Date.now();
		io.emit("start-round", randomWord, id);
	})

	socket.on("updateCanvas", (data) => {
		socket.broadcast.emit("updateCanvas", data );
	});

	socket.on("resetScores", () => {
		// reset the score of players
		for(const player in players) {
			players[player].points = 0;
		}
		io.emit("updatePoints", players);
	});

	socket.on("floodfill", (x, y, color) => {
		socket.broadcast.emit("floodfill", x, y, color );
	})
});

function startRound(){
	if(pickingWord) return;
	
	roundStarted = false;
	pickingWord = true;
	// pick 3 random words from words
	const randomWords = [];
	for(let i = 0; i < 3; i++){
		const randomIndex = Math.floor(Math.random() * words.length);
		randomWords.push(words[randomIndex]);
	}

	if(drawers.length >= Object.keys(players).length){
		drawers = [];
	}

	// add players from players that arent in the drawes array
	const newDrawers = Object.keys(players).filter((player) => !drawers.includes(player))

	// pick a random player from the newDrawers array
	const randomDrawer = newDrawers[Math.floor(Math.random() * newDrawers.length)];

	drawers.push(randomDrawer);

	console.log("Started Round " + randomDrawer);
	io.emit("pick-word", randomWords, randomDrawer);
}

function endGame(){
	// end the game
	roundStarted = false;
	playersCorrect = 0;
	round = 0;
	drawers = [];
	randomWord = "";

	io.emit("end-game");
}

function calculatePoints(timeLeft, wordLength){
	const basePoints = 100;
	const speedBounusPerSecond = 1;
	const lengthBonusPerLetter = 10;

	const speedBonus = (80 - timeLeft) * speedBounusPerSecond > 0 ? (80 - timeLeft) * speedBounusPerSecond : 0;
	const lengthBonus = wordLength * lengthBonusPerLetter;
	const totalPoints = basePoints + speedBonus + lengthBonus;

	return totalPoints;
}

const port = 4856;
server.listen(port, '0.0.0.0');
console.log("Server running on port " + port);
