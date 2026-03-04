import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // En dev depuis un mobile, l'IP locale change
        methods: ["GET", "POST"]
    }
});
app.use(cors());
app.use(express.json());
// Configuration Multer : conserver les fichiers dans /uploads de façon temporaire
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${req.params.roomId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });
const rooms = {};
// ===== HTTP ENDPOINTS =====
// L'hôte upload une piste dans la room
app.post("/room/:roomId/upload", upload.single("audio"), (req, res) => {
    const roomId = req.params.roomId;
    if (!roomId) {
        res.status(400).json({ error: "Room ID manquant" });
        return;
    }
    const room = rooms[roomId];
    if (!room) {
        return res.status(404).json({ error: "Room non trouvée" });
    }
    // Nettoyage ancien fichier si présent (Optionnel pour le MVP)
    if (room.currentAudioFile && fs.existsSync(room.currentAudioFile)) {
        fs.unlinkSync(room.currentAudioFile);
    }
    if (req.file) {
        room.currentAudioFile = req.file.path;
        // Notifier les auditeurs qu'un nouveau morceau est dispo
        io.to(roomId).emit("newTrack", `/room/${roomId}/stream`);
        return res.json({ message: "Upload réussi", streamUrl: `/room/${roomId}/stream` });
    }
    return res.status(400).json({ error: "Aucun fichier reçu" });
});
// Streamer le fichier audio en cours pour cette room
app.get("/room/:roomId/stream", (req, res) => {
    const roomId = req.params.roomId;
    if (!roomId) {
        res.status(400).send("Room ID manquant");
        return;
    }
    const room = rooms[roomId];
    if (!room || !room.currentAudioFile) {
        return res.status(404).send("Aucun fichier en cours");
    }
    const filePath = room.currentAudioFile;
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg',
        };
        res.writeHead(206, head);
        file.pipe(res);
    }
    else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});
// ===== WEBSOCKET =====
io.on("connection", (socket) => {
    console.log("Un client s'est connecté :", socket.id);
    socket.on("createRoom", (roomId, callback) => {
        if (rooms[roomId]) {
            callback(false); // Room existe déjà
            return;
        }
        rooms[roomId] = {
            id: roomId,
            hostId: socket.id,
            listeners: [],
            currentAudioFile: null,
            currentTrackState: null
        };
        socket.join(roomId);
        console.log(`Room ${roomId} créée par l'Hôte ${socket.id}`);
        callback(true);
    });
    socket.on("joinRoom", (roomId, callback) => {
        const room = rooms[roomId];
        if (!room) {
            callback(false, false);
            return;
        }
        room.listeners.push(socket.id);
        socket.join(roomId);
        console.log(`Client ${socket.id} a rejoint la Room ${roomId}`);
        // Notifier l'hôte qu'un auditeur a rejoint (optionnel mais utile)
        io.to(room.hostId).emit("listenerJoined", socket.id);
        if (room.currentAudioFile) {
            // Dire à l'auditeur que de la musique est prête à être écoutée
            socket.emit("newTrack", `/room/${roomId}/stream`);
        }
        // On renvoie le statut actuel de la musique si dispo
        if (room.currentTrackState) {
            socket.emit("syncState", room.currentTrackState);
        }
        callback(true, false);
    });
    socket.on("updateState", (roomId, state) => {
        const room = rooms[roomId];
        if (room && room.hostId === socket.id) {
            room.currentTrackState = {
                ...state,
                updatedAt: Date.now()
            };
            // Relayer l'état à tous les autres membres (auditeurs)
            socket.to(roomId).emit("syncState", room.currentTrackState);
        }
    });
    socket.on("disconnect", () => {
        console.log("Client déconnecté :", socket.id);
        // TODO: Cleanup des rooms si l'hôte part
    });
});
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`[Server] JudeBox relais démarré sur le port ${PORT}`);
});
//# sourceMappingURL=index.js.map