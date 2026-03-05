# 🎧 JudeBox

**JudeBox** est une application mobile de partage d'écoute musicale en temps réel, construite avec **React Native (Expo)** et propulsée par un serveur centralisé sous **Node.js, Express et Socket.IO**.

Elle permet à un utilisateur (l'Hôte) de diffuser la musique stockée localement sur son téléphone vers d'autres utilisateurs (les Auditeurs) qui ont rejoint son salon virtuel. JudeBox synchronise automatiquement l'état de lecture, la musique en cours et la position pour que tout le monde écoute exactement la même chose, au même moment.

---

## ✨ Fonctionnalités Principales

- 👑 **Système de Rôles :** Distingue clairement les permissions entre l'Hôte (qui choisit et contrôle la musique) et les Auditeurs (qui profitent de la musique).
- 🔗 **Synchronisation en Temps Réel :** Les actions de lecture/mise en pause et la position temporelle de la musique sont synchronisées via **WebSockets**.
- 🎵 **Bibliothèque Musicale Intégrée :** Récupération automatique et affichage des musiques locales présentes sur le téléphone (triées de la plus récente à la plus ancienne, hors sonneries et alarmes).
- 🔄 **Lecture Automatique (Auto-Play) :** L'hôte peut activer l'auto-play pour enchaîner automatiquement la file d'attente.
- 🖼️ **Extraction des Métadonnées :** Le serveur extrait à la volée les tags ID3 des fichiers MP3 pour afficher le titre de la chanson, l'artiste et la jaquette (Cover Art) sur tous les appareils !
- 💿 **UI Dynamique :** Interface esthétique "Dark Mode" (Slate Theme) avec des animations réagissant en temps réel (disque vinyle qui tourne, panneau latéral coulissant).
- 🧹 **Serveur Auto-nettoyant :** Le backend conserve l'espace disque en ne stockant temporairement qu'un seul fichier musical par Room. Il inclut des fonctionnalités de nettoyage au démarrage et d'auto-destruction des Rooms inactives.

---

## 🛠️ Stack Technique

### Application Mobile (Frontend)
- **React Native** (Framework UI)
- **Expo** (Toolchain et déploiement)
- **Expo AV** (Gestion de l'audio et de la lecture)
- **Expo Media Library & Document Picker** (Accès aux fichiers du téléphone)
- **Socket.IO Client** (Connexion persistante en WebSockets)
- **Lucide React Native** (Icônes)

### Serveur (Backend)
- **Node.js & Express** (API Web et Streaming HTTP avec *Range Requests*)
- **Socket.IO** (Logique métier de room en temps réel)
- **Multer** (Gestion des uploads de fichiers MP3)
- **Node-ID3** (Pour l'extraction des métadonnées des musiques)

---

## 🚀 Installation & Lancement

Prérequis : `Node.js`, `bun` (ou `npm`), et le CLI `Expo`.

### 1. Démarrer le Serveur Backend

Le serveur gère les salons (Rooms), l'upload temporaire des musiques, le streaming et les Websockets.

```bash
cd server
npm install
npm run dev
```

*Le serveur démarre par défaut sur le port 3000.*

### 2. Démarrer l'Application Expo

Ouvrez un nouveau terminal et démarrez l'application mobile :

```bash
cd app
bun install     # ou npm install
bun start       # ou npx expo start
```

*Assurez-vous que l'adresse IP renseignée dans le fichier `app/App.tsx` (constante `SERVER_URL`) correspond bien à l'adresse IP locale de la machine qui fait tourner le backend (ex: `http://192.168.1.XX:3000`).*

---

## 📱 Utilisation

1. **Créer un salon :** Saisissez un code (ex: `PARTY`) et cliquez sur `Créer un salon (Hôte)`.
2. **Rejoindre un salon :** Sur un autre téléphone, tapez le même code et cliquez sur `Rejoindre (Auditeur)`.
3. **Diffuser :** L'hôte peut ouvrir le tiroir latéral `Bibliothèque` (en bas à gauche), sélectionner une musique de son choix, et gérer la lecture/pause !
4. L'auditeur verra la pochette se mettre à jour et entendra la musique de manière synchronisée.

---

## 📝 Licence

Projet personnel créé pour l'écoute partagée. Librement inspiré et pensé pour une utilisation locale.
