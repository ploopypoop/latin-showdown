const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {}; // Keeps track of game rooms

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("createRoom", (code) => {
    if (!rooms[code]) {
      rooms[code] = {
        players: [socket],
        teams: {}
      };
      socket.join(code);
      socket.emit("roomCreated", code);
      console.log(`Room ${code} created by ${socket.id}`);
    }
  });

  socket.on("joinRoom", (code) => {
    const room = rooms[code];
    if (room && room.players.length === 1) {
      room.players.push(socket);
      socket.join(code);
      console.log(`${socket.id} joined room ${code}`);
      io.to(code).emit("roomJoined");
    } else {
      socket.emit("error", "Room is full or does not exist.");
    }
  });

  socket.on("submitTeam", ({ roomCode, team }) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.teams[socket.id] = team;

    if (Object.keys(room.teams).length === 2) {
      const [p1, p2] = room.players;
      io.to(p1.id).emit("gameStart", {
        self: room.teams[p1.id],
        opponent: room.teams[p2.id]
      });
      io.to(p2.id).emit("gameStart", {
        self: room.teams[p2.id],
        opponent: room.teams[p1.id]
      });
    }
  });

  socket.on("playerMove", ({ roomCode, moveName }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const opponent = room.players.find(p => p.id !== socket.id);
    if (opponent) {
      opponent.emit("opponentMove", moveName);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (const [code, room] of Object.entries(rooms)) {
      if (room.players.find(p => p.id === socket.id)) {
        io.to(code).emit("error", "Opponent disconnected.");
        delete rooms[code];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
