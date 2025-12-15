const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');

// ===============================
// APP SOZLAMALARI
// ===============================
const app = express();
const server = http.createServer(app);

// XAVFSIZLIK: Helmet bilan HTTP headerlarni himoyalash
app.use(helmet({
    contentSecurityPolicy: false, // Static fayllar uchun
    crossOriginEmbedderPolicy: false
}));

// OPTIMALLASHTIRISH: Response'larni siqish
app.use(compression());

// RATE LIMITING: DDoS hujumlardan himoya
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 daqiqa
    max: 100, // Har bir IP uchun maksimal 100 ta request
    message: '⚠️ Juda ko\'p so\'rov yuborildi. Iltimos, keyinroq urinib ko\'ring.'
});
app.use(limiter);

// Static fayllar
app.use(express.static('public'));

// JSON parsing
app.use(express.json({ limit: '10kb' })); // Katta payload'larni rad etish

// ===============================
// SOCKET.IO SOZLAMALARI
// ===============================
const io = new Server(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 60000, // 60 soniya
    pingInterval: 25000, // 25 soniya
    maxHttpBufferSize: 1e6, // 1MB maksimal xabar hajmi
    transports: ['websocket', 'polling'] // WebSocket birinchi, keyin polling
});

// ===============================
// O'YIN SOZLAMALARI
// ===============================
const CONFIG = {
    TOTAL_LEVELS: 3,
    MAX_PLAYERS: 50, // Maksimal o'yinchilar soni
    PLAYER_TIMEOUT: 30000, // 30 soniya faolsiz bo'lsa o'chirish
    LEVEL_CHANGE_COOLDOWN: 1000, // Level o'zgarishi uchun kutish vaqti
    VALID_X_RANGE: { min: 0, max: 2000 }, // X koordinata chegarasi
    VALID_Y_RANGE: { min: 0, max: 800 }, // Y koordinata chegarasi
    HEARTBEAT_INTERVAL: 5000 // Ping-pong intervali
};

let players = {};
let currentLevelIndex = 0;
let isChangingLevel = false;
let playerCount = 0;

// ===============================
// YORDAMCHI FUNKSIYALAR
// ===============================

// Tasodifiy yorqin rang (Neon ranglar)
function getRandomColor() {
    const neonColors = [
        0xFF006E, 0x8338EC, 0x3A86FF, 0xFB5607,
        0xFFBE0B, 0x06FFA5, 0x00F5FF, 0xFF10F0
    ];
    return neonColors[Math.floor(Math.random() * neonColors.length)];
}

// Level tanlash
function pickRandomLevel() {
    if (CONFIG.TOTAL_LEVELS <= 1) return 0;
    
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * CONFIG.TOTAL_LEVELS);
    } while (newIndex === currentLevelIndex);
    return newIndex;
}

// Koordinatalarni validatsiya qilish
function validateCoordinates(x, y) {
    return (
        typeof x === 'number' &&
        typeof y === 'number' &&
        !isNaN(x) && !isNaN(y) &&
        x >= CONFIG.VALID_X_RANGE.min && x <= CONFIG.VALID_X_RANGE.max &&
        y >= CONFIG.VALID_Y_RANGE.min && y <= CONFIG.VALID_Y_RANGE.max
    );
}

// Faolsiz o'yinchilarni tozalash
function cleanupInactivePlayers() {
    const now = Date.now();
    Object.keys(players).forEach(id => {
        if (now - players[id].lastActivity > CONFIG.PLAYER_TIMEOUT) {
            console.log(`🧹 Faolsiz o'yinchi o'chirildi: ${id}`);
            delete players[id];
            playerCount--;
            io.emit('playerDisconnected', id);
        }
    });
}

// Har 30 soniyada faolsiz o'yinchilarni tozalash
setInterval(cleanupInactivePlayers, CONFIG.PLAYER_TIMEOUT);

// Server statistikasini ko'rsatish
setInterval(() => {
    console.log(`📊 Statistika: ${playerCount} ta o'yinchi | Level: ${currentLevelIndex + 1}`);
}, 60000); // Har 1 daqiqa

// ===============================
// SOCKET MANTIQ
// ===============================

io.on('connection', (socket) => {
    // Maksimal o'yinchilar sonini tekshirish
    if (playerCount >= CONFIG.MAX_PLAYERS) {
        socket.emit('serverFull', { message: '❌ Server to\'lgan. Keyinroq urinib ko\'ring.' });
        socket.disconnect(true);
        console.log(`⚠️ Server to'lgan. Ulanish rad etildi: ${socket.id}`);
        return;
    }

    console.log(`✅ O'yinchi ulandi: ${socket.id} | Jami: ${playerCount + 1}`);

    // Yangi o'yinchi yaratish
    players[socket.id] = {
        x: 50,
        y: 200,
        velocityX: 0,
        velocityY: 0,
        color: getRandomColor(),
        playerId: socket.id,
        name: `Player_${socket.id.slice(0, 4)}`,
        lastActivity: Date.now(),
        score: 0,
        deaths: 0
    };
    playerCount++;

    // Yangi o'yinchiga dunyoni yuborish
    socket.emit('initGame', {
        players: players,
        levelIndex: currentLevelIndex,
        yourId: socket.id,
        config: {
            totalLevels: CONFIG.TOTAL_LEVELS
        }
    });

    // Boshqalarga xabar berish
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // ===========================
    // HARAKATLANISH (Optimizatsiya bilan)
    // ===========================
    let lastMoveTime = 0;
    const MOVE_THROTTLE = 16; // ~60 FPS (16ms)

    socket.on('playerMovement', (data) => {
        const now = Date.now();
        
        // Throttling: Juda tez harakatlarni cheklash
        if (now - lastMoveTime < MOVE_THROTTLE) return;
        lastMoveTime = now;

        if (players[socket.id]) {
            // Validatsiya
            if (validateCoordinates(data.x, data.y)) {
                players[socket.id].x = data.x;
                players[socket.id].y = data.y;
                players[socket.id].velocityX = data.velocityX || 0;
                players[socket.id].velocityY = data.velocityY || 0;
                players[socket.id].lastActivity = now;

                // Faqat kerakli ma'lumotni broadcast qilish
                socket.broadcast.emit('playerMoved', {
                    playerId: socket.id,
                    x: data.x,
                    y: data.y,
                    velocityX: data.velocityX,
                    velocityY: data.velocityY
                });
            } else {
                console.warn(`⚠️ Noto'g'ri koordinatalar: ${socket.id}`);
            }
        }
    });

    // ===========================
    // LEVEL YUTISH (Anti-spam)
    // ===========================
    let lastWinTime = 0;
    const WIN_COOLDOWN = 2000; // 2 soniya

    socket.on('levelWin', () => {
        const now = Date.now();

        // O'yinchi mavjudligini tekshirish
        if (!players[socket.id]) return;

        // Cooldown tekshirish
        if (now - lastWinTime < WIN_COOLDOWN) {
            socket.emit('error', { message: 'Juda tez! Biroz kuting.' });
            return;
        }

        if (!isChangingLevel) {
            isChangingLevel = true;
            lastWinTime = now;

            // Scorelarni yangilash
            players[socket.id].score++;
            console.log(`🏆 ${players[socket.id].name} level yutdi! Score: ${players[socket.id].score}`);

            // Yangi level
            currentLevelIndex = pickRandomLevel();
            io.emit('changeLevel', {
                levelIndex: currentLevelIndex,
                winner: players[socket.id].name,
                winnerId: socket.id
            });

            // Qulfni ochish
            setTimeout(() => {
                isChangingLevel = false;
            }, CONFIG.LEVEL_CHANGE_COOLDOWN);
        }
    });

    // ===========================
    // O'YINCHI O'LISHI
    // ===========================
    socket.on('playerDied', () => {
        if (players[socket.id]) {
            players[socket.id].deaths++;
            io.emit('playerDeath', {
                playerId: socket.id,
                x: players[socket.id].x,
                y: players[socket.id].y
            });
        }
    });

    // ===========================
    // PING-PONG (Connection health)
    // ===========================
    socket.on('ping', () => {
        if (players[socket.id]) {
            players[socket.id].lastActivity = Date.now();
            socket.emit('pong', { timestamp: Date.now() });
        }
    });

    // ===========================
    // CHAT (Opsional)
    // ===========================
    socket.on('chatMessage', (data) => {
        if (players[socket.id] && typeof data.message === 'string') {
            const cleanMessage = data.message.slice(0, 200); // 200 belgi limit
            io.emit('chatMessage', {
                playerId: socket.id,
                name: players[socket.id].name,
                message: cleanMessage,
                timestamp: Date.now()
            });
        }
    });

    // ===========================
    // CHIQISH
    // ===========================
    socket.on('disconnect', (reason) => {
        console.log(`❌ O'yinchi chiqdi: ${socket.id} | Sabab: ${reason}`);
        
        if (players[socket.id]) {
            delete players[socket.id];
            playerCount--;
            io.emit('playerDisconnected', socket.id);
        }
    });

    // Error handling
    socket.on('error', (error) => {
        console.error(`❗ Socket xatosi [${socket.id}]:`, error);
    });
});

// ===============================
// HTTP ENDPOINTS (Monitoring uchun)
// ===============================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        players: playerCount,
        level: currentLevelIndex + 1,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Statistics
app.get('/stats', (req, res) => {
    const playerList = Object.values(players).map(p => ({
        name: p.name,
        score: p.score,
        deaths: p.deaths
    }));

    res.json({
        totalPlayers: playerCount,
        currentLevel: currentLevelIndex + 1,
        players: playerList
    });
});

// ===============================
// XATO BOSHQARUVI
// ===============================

// Uncaught Exception
process.on('uncaughtException', (err) => {
    console.error('❗❗❗ UNCAUGHT EXCEPTION:', err);
    // Production'da bu yerda loggerga yoziladi
});

// Unhandled Promise Rejection
process.on('unhandledRejection', (reason, promise) => {
    console.error('❗❗❗ UNHANDLED REJECTION:', reason);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM signal qabul qilindi. Server to\'xtatilmoqda...');
    server.close(() => {
        console.log('✅ Server to\'xtatildi');
        process.exit(0);
    });
});

// ===============================
// SERVERNI ISHGA TUSHIRISH
// ===============================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log(`║  🚀 Server muvaffaqiyatli ishga tushdi  ║`);
    console.log(`║  📡 Port: ${PORT.toString().padEnd(28)} ║`);
    console.log(`║  🌍 Host: ${HOST.padEnd(28)} ║`);
    console.log(`║  🎮 Tayyor: ${CONFIG.MAX_PLAYERS} ta o'yinchi uchun${' '.repeat(11)}║`);
    console.log('╚════════════════════════════════════════╝');
});