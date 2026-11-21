"use strict";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 30 * 1024 * 1024,
  cors: { origin: true }
});

const PORT = process.env.PORT || 3000;
const MAX_ROOMS = 1000;
const MAX_TEXT = 5000;
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

// Deliberately in-memory only. No database, disk uploads, or chat logs.
const rooms = new Map();

app.disable("x-powered-by");
app.use(express.static("public", { etag: false, maxAge: 0 }));
app.get("/health", (_req, res) => res.status(200).send("ok"));

function cleanRoomCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function publicMessage(msg) {
  return {
    id: msg.id,
    sender: msg.sender,
    text: msg.text,
    media: msg.media,
    time: msg.time
  };
}

io.on("connection", (socket) => {
  socket.on("join-room", ({ code, name } = {}, reply = () => {}) => {
    const roomCode = cleanRoomCode(code);
    const displayName = String(name || "Guest").trim().slice(0, 24) || "Guest";

    if (roomCode.length < 4) return reply({ ok: false, error: "Room codes must be at least 4 characters." });

    let room = rooms.get(roomCode);
    if (!room) {
      if (rooms.size >= MAX_ROOMS) return reply({ ok: false, error: "The server is busy. Try again later." });
      room = { members: new Map(), messages: [] };
      rooms.set(roomCode, room);
    }

    if (room.members.size >= 2 && !room.members.has(socket.id)) {
      return reply({ ok: false, error: "This room already has two people." });
    }

    // A socket may only belong to one room at a time.
    if (socket.data.roomCode) leaveRoom(socket);

    room.members.set(socket.id, displayName);
    socket.data.roomCode = roomCode;
    socket.join(roomCode);

    reply({
      ok: true,
      code: roomCode,
      name: displayName,
      history: room.messages.map(publicMessage),
      people: room.members.size
    });
    io.to(roomCode).emit("presence", { people: room.members.size });
    socket.to(roomCode).emit("system-message", `${displayName} joined the chat.`);
  });

  socket.on("chat-message", (payload = {}, reply = () => {}) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room || !room.members.has(socket.id)) return reply({ ok: false, error: "Join a room first." });

    const text = String(payload.text || "").trim().slice(0, MAX_TEXT);
    const media = payload.media || null;

    if (!text && !media) return reply({ ok: false, error: "Write a message or attach a file." });

    let safeMedia = null;
    if (media) {
      const mime = String(media.mime || "").toLowerCase();
      const allowed = mime.startsWith("image/") || mime.startsWith("video/");
      if (!allowed) return reply({ ok: false, error: "Only images, GIFs and videos are supported." });

      const data = String(media.data || "");
      const match = data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
      if (!match || match[1].toLowerCase() !== mime) return reply({ ok: false, error: "That media file could not be read." });

      const bytes = Buffer.from(match[2], "base64").length;
      if (bytes > MAX_MEDIA_BYTES) return reply({ ok: false, error: "Media files must be 20 MB or smaller." });

      safeMedia = {
        name: String(media.name || "attachment").slice(0, 120),
        mime,
        data
      };
    }

    const message = {
      id: crypto.randomUUID(),
      sender: room.members.get(socket.id),
      text,
      media: safeMedia,
      time: Date.now()
    };

    // Keep the live room in RAM only; cap history to limit memory use.
    room.messages.push(message);
    if (room.messages.length > 100) room.messages.shift();

    io.to(roomCode).emit("new-message", publicMessage(message));
    reply({ ok: true });
  });

  socket.on("leave-room", () => leaveRoom(socket));
  socket.on("disconnect", () => leaveRoom(socket));
});

function leaveRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  socket.leave(roomCode);
  delete socket.data.roomCode;

  if (!room) return;
  const oldName = room.members.get(socket.id);
  room.members.delete(socket.id);

  if (room.members.size === 0) {
    // Last person left: discard all messages and media immediately.
    room.messages.length = 0;
    rooms.delete(roomCode);
  } else {
    io.to(roomCode).emit("presence", { people: room.members.size });
    if (oldName) io.to(roomCode).emit("system-message", `${oldName} left the chat.`);
  }
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Ephemeral Chat listening on port ${PORT}`);
});
