import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import NodeID3 from "node-id3";

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

// ===== CLEANUP AU DEMARRAGE =====
const uploadDir = path.join(__dirname, '../uploads');
if (fs.existsSync(uploadDir)) {
    console.log("[Server] Nettoyage du dossier uploads...");
    const files = fs.readdirSync(uploadDir);
    for (const file of files) {
        fs.unlinkSync(path.join(uploadDir, file));
    }
} else {
    fs.mkdirSync(uploadDir);
}

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

// Structure basique pour stocker l'état des rooms
interface Room {
    id: string;
    hostId: string | null;
    listeners: string[];
    currentAudioFile: string | null; // Chemin du fichier courant
    metadata: {
        title?: string;
        artist?: string;
        coverBase64?: string;
    } | null;
    currentTrackState: {
        isPlaying: boolean;
        positionMillis: number;
        updatedAt: number;
    } | null;
    // Serveurs Timeouts pour le nettoyage automatique
    inactiveTimeoutId?: NodeJS.Timeout;
    emptyTimeoutId?: NodeJS.Timeout;
}

const rooms: Record<string, Room> = {};

// Constantes des chronomètres (en millisecondes)
const INACTIVE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes sans activité
const EMPTY_TIMEOUT_MS = 5 * 60 * 1000;     // 5 minutes vide (0 host et 0 listeners)

// ===== LOGIQUE DE NETTOYAGE =====

// Supprime définitivement une room et vide le fichier MP3 associé
function destroyRoom(roomId: string, reason: string) {
    const room = rooms[roomId];
    if (!room) return;

    console.log(`[Auto-Clean] Destruction de la Room ${roomId} (${reason})`);

    // Nettoyage Physique (MP3)
    if (room.currentAudioFile && fs.existsSync(room.currentAudioFile)) {
        try {
            fs.unlinkSync(room.currentAudioFile);
            console.log(`[Auto-Clean] Fichier supprimé : ${room.currentAudioFile}`);
        } catch (e) { console.error("Erreur suppression de fichier :", e); }
    }

    // Nettoyage Mémoire (Timeouts)
    if (room.inactiveTimeoutId) clearTimeout(room.inactiveTimeoutId);
    if (room.emptyTimeoutId) clearTimeout(room.emptyTimeoutId);

    // Notification globale optionnelle avant de fermer
    io.to(roomId).emit("roomClosed", reason);
    io.in(roomId).socketsLeave(roomId);

    delete rooms[roomId];
}

// Relance ou annule les chronomètres de suppression pour une room
function checkAndResetTimeouts(roomId: string) {
    const room = rooms[roomId];
    if (!room) return;

    // 1 - Nettoyage Timeouts existants
    if (room.inactiveTimeoutId) clearTimeout(room.inactiveTimeoutId);
    if (room.emptyTimeoutId) clearTimeout(room.emptyTimeoutId);

    // 2 - Evaluation "Room Vide"
    // On considère la room vide si plus personne n'y est connecté (ni host ni auditeurs)
    // Mais même s'il n'y a que des auditeurs sans l'Hôte, la room périclitera via inactivité
    const isEmpty = (room.hostId === null && room.listeners.length === 0);

    if (isEmpty) {
        room.emptyTimeoutId = setTimeout(() => {
            destroyRoom(roomId, "Inutilisée pendant 5 minutes (Vide)");
        }, EMPTY_TIMEOUT_MS);
    } else if (!room.currentTrackState?.isPlaying) {
        // 3 - Evaluation "Room Inactive" (Quelqu'un est là, et la musique est en pause/stoppée)
        room.inactiveTimeoutId = setTimeout(() => {
            destroyRoom(roomId, "Musique en pause et aucune interaction depuis 10 minutes");
        }, INACTIVE_TIMEOUT_MS);
    }
}

// ===== HTTP ENDPOINTS =====

// L'hôte upload une piste dans la room
app.post("/room/:roomId/upload", upload.single("audio"), (req: express.Request, res: express.Response) => {
    const roomIdParam = req.params.roomId;
    const roomId = Array.isArray(roomIdParam) ? roomIdParam[0] : roomIdParam;

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

        // Extraction des métadonnées
        try {
            const tags = NodeID3.read(req.file.path);
            let coverBase64: string | undefined;

            if (tags.image && typeof tags.image !== 'string' && tags.image.imageBuffer) {
                coverBase64 = tags.image.imageBuffer.toString('base64');
            }

            room.metadata = {
                title: tags.title,
                artist: tags.artist,
                coverBase64: coverBase64
            };
        } catch (error) {
            console.error("Erreur lecture ID3:", error);
            room.metadata = null;
        }

        // Notifier les auditeurs qu'un nouveau morceau est dispo, avec les métadonnées
        io.to(roomId).emit("newTrack", `/room/${roomId}/stream`, room.metadata);

        // Reset l'inactivité vu que l'hôte a fait une action
        checkAndResetTimeouts(roomId);

        return res.json({
            message: "Upload réussi",
            streamUrl: `/room/${roomId}/stream`,
            metadata: room.metadata
        });
    }

    return res.status(400).json({ error: "Aucun fichier reçu" });
});

// Streamer le fichier audio en cours pour cette room
app.get("/room/:roomId/stream", (req: express.Request, res: express.Response) => {
    const roomIdParam = req.params.roomId;
    const roomId = Array.isArray(roomIdParam) ? roomIdParam[0] : roomIdParam;

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
    const range = req.headers.range || "";

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
    } else {
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

    socket.on("createRoom", (roomId: string, callback: (success: boolean) => void) => {
        if (rooms[roomId]) {
            // Permettre la reconnexion d'un hôte si la room est orpheline
            if (rooms[roomId].hostId === null) {
                rooms[roomId].hostId = socket.id;
                socket.join(roomId);
                console.log(`L'Hôte ${socket.id} (re)prend le contrôle de la Room ${roomId}`);
                checkAndResetTimeouts(roomId);
                callback(true);
                return;
            }
            callback(false); // Room existe déjà et a un hôte
            return;
        }
        rooms[roomId] = {
            id: roomId,
            hostId: socket.id,
            listeners: [],
            currentAudioFile: null,
            metadata: null,
            currentTrackState: null
        };
        socket.join(roomId);
        console.log(`Room ${roomId} créée par l'Hôte ${socket.id}`);

        // Démarre le chrono d'inactivité à la création
        checkAndResetTimeouts(roomId);

        callback(true);
    });

    socket.on("joinRoom", (roomId: string, callback: (success: boolean, isHost: boolean) => void) => {
        const room = rooms[roomId];
        if (!room) {
            callback(false, false);
            return;
        }
        room.listeners.push(socket.id);
        socket.join(roomId);
        console.log(`Client ${socket.id} a rejoint la Room ${roomId}`);

        // Notifier l'hôte qu'un auditeur a rejoint (optionnel mais utile)
        io.to(room.hostId!).emit("listenerJoined", socket.id);

        if (room.currentAudioFile) {
            // Dire à l'auditeur que de la musique est prête à être écoutée
            socket.emit("newTrack", `/room/${roomId}/stream`, room.metadata);
        }

        // On renvoie le statut actuel de la musique si dispo
        if (room.currentTrackState) {
            socket.emit("syncState", room.currentTrackState);
        }

        // Un utilisateur rejoint : on rafraîchit les timers d'inactivité ou d'abandon
        checkAndResetTimeouts(roomId);
        callback(true, false);
    });

    socket.on("updateState", (roomId: string, state: { isPlaying: boolean, positionMillis: number }) => {
        const room = rooms[roomId];
        if (room && room.hostId === socket.id) {
            room.currentTrackState = {
                ...state,
                updatedAt: Date.now()
            };
            // Relayer l'état à tous les autres membres (auditeurs)
            socket.to(roomId).emit("syncState", room.currentTrackState);

            // Interaction de l'hôte => On relance l'inactivité à zéro (10min)
            checkAndResetTimeouts(roomId);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client déconnecté :", socket.id);

        // Retrouver la(les) room(s) à laquelle/auxquelles il appartenait
        for (const rId in rooms) {
            const room = rooms[rId];
            let changed = false;

            // Était-il le host ?
            if (room.hostId === socket.id) {
                room.hostId = null;
                changed = true;
                console.log(`L'hôte de la room ${rId} s'est déconnecté.`);
                io.to(rId).emit("hostLeft"); // Prévenir les auditeurs s'ils veulent partir
            }

            // Était-il auditeur ?
            const listenerIndex = room.listeners.indexOf(socket.id);
            if (listenerIndex !== -1) {
                room.listeners.splice(listenerIndex, 1);
                changed = true;
            }

            if (changed) {
                checkAndResetTimeouts(room.id);
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`[Server] JudeBox relais démarré sur le port ${PORT}`);
});
