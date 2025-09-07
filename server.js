import express from 'express';
import { createServer } from 'http';
import { Server } from "socket.io"

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = 3000;

app.use(express.static('public'));

const lobbies = {};
const rooms = {};
const LOBBY_TIMEOUT = 30 * 60 * 1000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    handleDisconnect(socket);
  });

  socket.on('createLobby', (lobbyData) => createLobby(socket, lobbyData));
  socket.on('joinLobby', (joinData) => joinLobby(socket, joinData));
  socket.on('leaveLobby', (leaveData) => leaveLobby(socket, leaveData));
  socket.on('startGame', (lobbyId) => startGameFromLobby(socket, lobbyId));
});

app.get('/', (_req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

function createLobby(socket, { name, password, creator }) {

  const lobbyId = 'lobby_' + Date.now();

  lobbies[lobbyId] = {
    id: lobbyId,
    name: name,
    password: password,
    creator: creator,
    members: [creator],
    socketIds: [socket.id],
    created: Date.now(),
    lastActivity: Date.now()
  };

  socket.join(lobbyId);
  socket.lobbyId = lobbyId;

  socket.emit('lobbyCreated', {
    id: lobbyId,
    name: name,
    creator: creator,
    members: [creator]
  });

  console.log(`Lobby created: ${name} (${lobbyId}) by ${creator}`);
}

function joinLobby(socket, { name, password, player }) {

  let targetLobby = null;
  let targetLobbyId = null;

  for (const id in lobbies) {
    if (lobbies[id].name === name) {
      targetLobby = lobbies[id];
      targetLobbyId = id;
      break;
    }
  }

  if (!targetLobby) {
    socket.emit('lobbyError', { message: 'Lobby not found' });
    return;
  }

  if (targetLobby.password && targetLobby.password !== password) {
    socket.emit('lobbyError', { message: 'Incorrect password' });
    return;
  }

  if (targetLobby.members.includes(player)) {
    socket.emit('lobbyError', { message: 'Player name already in use' });
    return;
  }

  targetLobby.members.push(player);
  targetLobby.socketIds.push(socket.id);
  targetLobby.lastActivity = Date.now();

  socket.join(targetLobbyId);
  socket.lobbyId = targetLobbyId;

  socket.emit('joinedLobby', {
    id: targetLobbyId,
    name: targetLobby.name,
    creator: targetLobby.creator,
    members: targetLobby.members
  });

  io.to(targetLobbyId).emit('memberUpdate', targetLobby.members);

  console.log(`Player ${player} joined lobby: ${name} (${targetLobbyId})`);
}

function leaveLobby(socket, { lobbyId, player }) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;

  const playerIndex = lobby.members.indexOf(player);
  const socketIndex = lobby.socketIds.indexOf(socket.id);

  if (playerIndex !== -1) {

    lobby.members.splice(playerIndex, 1);
    lobby.socketIds.splice(socketIndex, 1);
    lobby.lastActivity = Date.now();

    socket.leave(lobbyId);
    socket.lobbyId = null;

    if (player === lobby.creator) {
      if (lobby.members.length > 0) {
        lobby.creator = lobby.members[0];
      } else {

        delete lobbies[lobbyId];
        return;
      }
    }

    io.to(lobbyId).emit('memberUpdate', lobby.members);

    console.log(`Player ${player} left lobby: ${lobby.name} (${lobbyId})`);
  }
}

function startGameFromLobby(socket, lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;

  const playerIndex = lobby.socketIds.indexOf(socket.id);
  if (playerIndex === -1 || lobby.members[playerIndex] !== lobby.creator) {
    socket.emit('lobbyError', { message: 'Only the host can start the game' });
    return;
  }

  if (lobby.members.length < 2) {
    socket.emit('lobbyError', { message: 'Need at least 2 players to start' });
    return;
  }

  rooms[lobbyId] = {
    players: [],
    spectators: [],
    deck: [],
    discardPile: [],
    currentPlayer: 0,
    currentColor: null,
    playDirection: 1,
    skipNextPlayer: false,
    nextPlayerDrawCards: 0,
    requireColorChoice: false,
    gameStarted: false,
    lastActivity: Date.now()
  };

  for (let i = 0; i < lobby.members.length; i++) {
    const playerSocket = io.sockets.sockets.get(lobby.socketIds[i]);
    if (playerSocket) {
      rooms[lobbyId].players.push({
        id: lobby.socketIds[i],
        name: lobby.members[i],
        socket: playerSocket,
        hand: [],
        score: 0
      });
    }
  }

  io.to(lobbyId).emit('gameStart', { room: lobbyId });

  startGame(lobbyId);

  console.log(`Game started from lobby: ${lobby.name} (${lobbyId})`);
}

function startGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const colors = ['red', 'blue', 'green', 'yellow'];
  const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', '+2'];

  room.deck = [];
  colors.forEach(color => {
    values.forEach(value => {
      room.deck.push({ color, value });
      if (value !== '0') room.deck.push({ color, value });
    });
  });

  for (let i = 0; i < 4; i++) {
    room.deck.push({ color: 'wild', value: 'wild' });
    room.deck.push({ color: 'wild', value: '+4' });
  }

  for (let i = room.deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]];
  }

  room.players.forEach(player => {
    player.hand = room.deck.splice(0, 7);
  });

  room.discardPile = [room.deck.pop()];
  room.currentColor = room.discardPile[0].color;
  room.gameStarted = true;

  io.to(roomId).emit('gameStarted', {
    players: room.players.map(p => ({ id: p.id, name: p.name, handSize: p.hand.length })),
    currentCard: room.discardPile[0],
    currentColor: room.currentColor,
    currentPlayer: room.currentPlayer
  });
}

function handleDisconnect(socket) {

  if (socket.lobbyId) {
    const lobby = lobbies[socket.lobbyId];
    if (lobby) {
      const socketIndex = lobby.socketIds.indexOf(socket.id);
      if (socketIndex !== -1) {
        const player = lobby.members[socketIndex];
        leaveLobby(socket, { lobbyId: socket.lobbyId, player: player });
      }
    }
  }

  for (const roomId in rooms) {
    const room = rooms[roomId];
    const playerIndex = room.players.findIndex(p => p.id === socket.id);

    if (playerIndex !== -1) {
      const player = room.players[playerIndex];

      if (room.gameStarted) {

        room.spectators.push({
          id: player.id,
          name: player.name,
          disconnected: true
        });
        room.players.splice(playerIndex, 1);

        io.to(roomId).emit('playerDisconnected', {
          playerName: player.name,
          remainingPlayers: room.players.length
        });

        if (room.players.length < 2) {
          io.to(roomId).emit('gameEnded', { reason: 'Not enough players' });
          delete rooms[roomId];
        }
      } else {

        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
      }
      break;
    }
  }
}

setInterval(() => {
  const now = Date.now();

  for (const lobbyId in lobbies) {
    const lobby = lobbies[lobbyId];
    if (now - lobby.lastActivity > LOBBY_TIMEOUT) {

      io.to(lobbyId).emit('lobbyTimeout');

      delete lobbies[lobbyId];
    }
  }

  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (now - room.lastActivity > LOBBY_TIMEOUT) {
      io.to(roomId).emit('gameTimeout');
      delete rooms[roomId];
    }
  }
}, 5 * 60 * 1000);
