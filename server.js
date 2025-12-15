const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static('public'));

let players = {};
// Hozirgi level indeksi (barcha o'yinchilar uchun bitta)
let currentLevelIndex = Math.floor(Math.random() * 3); // 3 ta level bor deb hisoblaymiz

io.on('connection', (socket) => {
  console.log('O\'yinchi ulandi:', socket.id);

  // Yangi o'yinchiga rang va joy beramiz
  players[socket.id] = {
    x: 50,
    y: 200,
    color: Math.random() > 0.5 ? 0xff0000 : 0x0000ff, // Qizil yoki Ko'k
    playerId: socket.id
  };

  // Yangi o'yinchiga hozirgi o'yin holatini yuborish
  socket.emit('initGame', {
    players: players,
    levelIndex: currentLevelIndex
  });

  // Boshqalarga yangi o'yinchi haqida xabar
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Harakatlanish
  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  // Kimdir levelni yutib qo'ysa, hammaga yangi level beramiz
  socket.on('levelWin', () => {
    // Yangi random level tanlash
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * 3); // Level soniga qarab o'zgartiring
    } while (newIndex === currentLevelIndex);
    
    currentLevelIndex = newIndex;
    
    // Hammaga yangi levelni yuborish
    io.emit('changeLevel', currentLevelIndex);
  });

  socket.on('disconnect', () => {
    console.log('Chiqib ketdi:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server ishga tushdi: ${PORT}`);
});