const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

// App sozlamalari
const app = express();
const server = http.createServer(app);

// Socket.io uchun CORS (Xavfsizlik va Ulanishni yaxshilash)
const io = new Server(server, {
    cors: {
        origin: "*", // Barcha saytlardan kirishga ruxsat (Telegram va Render uchun)
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

// --- O'YIN SOZLAMALARI ---
const TOTAL_LEVELS = 3; // Jami levellar soni
let players = {};
let currentLevelIndex = 0;
let isChangingLevel = false; // Level almashayotganda pauza qilish uchun

// --- YORDAMCHI FUNKSIYALAR ---

// Tasodifiy yorqin rang generatori (Hex formatda)
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '0x';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return parseInt(color, 16); // Phaser tushunadigan formatga o'tkazamiz
}

// Yangi level tanlash
function pickRandomLevel() {
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * TOTAL_LEVELS);
    } while (newIndex === currentLevelIndex && TOTAL_LEVELS > 1);
    return newIndex;
}

// --- SOCKET MANTIQI ---

io.on('connection', (socket) => {
    console.log(`✅ O'yinchi ulandi: ${socket.id}`);

    // 1. Yangi o'yinchini yaratish
    players[socket.id] = {
        x: 50,
        y: 200,
        color: getRandomColor(), // Har kimga har xil rang
        playerId: socket.id,
        name: `Player ${Object.keys(players).length + 1}` // Kelajakda ism qo'shish uchun
    };

    // 2. Yangi o'yinchiga hozirgi dunyoni yuborish
    socket.emit('initGame', {
        players: players,
        levelIndex: currentLevelIndex
    });

    // 3. Boshqalarga yangi o'yinchi haqida xabar berish
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 4. Harakatlanish (Validation bilan)
    socket.on('playerMovement', (movementData) => {
        // Faqat haqiqiy o'yinchilarni tekshiramiz
        if (players[socket.id]) {
            // Xavfsizlik: Kelayotgan ma'lumot raqam ekanligini tekshiramiz
            if (typeof movementData.x === 'number' && typeof movementData.y === 'number') {
                players[socket.id].x = movementData.x;
                players[socket.id].y = movementData.y;
                
                // Optimallashtirish: Faqat kerakli ma'lumotni yuborish
                socket.broadcast.emit('playerMoved', {
                    playerId: socket.id,
                    x: players[socket.id].x,
                    y: players[socket.id].y
                });
            }
        }
    });

    // 5. Level Yutish (Spamdan himoya bilan)
    socket.on('levelWin', () => {
        if (!isChangingLevel) {
            isChangingLevel = true; // Qulfni yopamiz
            
            console.log(`🏆 Level yutildi! Yangi level tanlanmoqda...`);
            currentLevelIndex = pickRandomLevel();
            
            // Hammaga yangi levelni yuborish
            io.emit('changeLevel', currentLevelIndex);

            // 1 soniyadan keyin qulfni ochamiz (qayta yutish uchun)
            setTimeout(() => {
                isChangingLevel = false;
            }, 1000);
        }
    });

    // 6. Chiqib ketish
    socket.on('disconnect', () => {
        console.log(`❌ O'yinchi chiqdi: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// --- SERVERNI ISHGA TUSHIRISH ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server ${PORT}-portda muvaffaqiyatli ishga tushdi`);
});