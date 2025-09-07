# Game Lobby System

A clean, real-time lobby system for multiplayer games built with Node.js and Socket.IO.  
Perfect foundation for card games, board games, or any multiplayer experience!

## Features

- **Create & Join Lobbies** - Named lobbies with optional passwords
- **Real-time Updates** - See members join/leave instantly  
- **Host Controls** - Only lobby creator can start games
- **Smart Cleanup** - Inactive lobbies auto-remove after 30 minutes
- **Responsive UI** - Clean design that works on mobile
- **Game Ready** - Includes deck initialization for card games

## Quick Start

```bash
git clone https://github.com/poran-dip/game-lobby
cd game-lobby
npm install
npm start
```

Open `localhost:3000` and start creating lobbies!

## How It Works

1. **Create/Join** - Make a lobby or join by name
2. **Wait for Players** - See live member updates  
3. **Start Game** - Host clicks start (2+ players needed)
4. **Ready to Play** - Game initialization begins

## Adding Your Game

Extend the `startGame()` function in `server.js`:

```javascript
function startGame(roomId) {
  const room = rooms[roomId];
  // Add your game logic here!
  // Cards are already shuffled and dealt
}
```

## Perfect For

- Card games (Uno, Poker, Hearts)
- Board games (Chess, Connect Four) 
- Turn-based strategy games
- Trivia/quiz games
- And anything that needs a lobby system, really!

## License

MIT - Build something awesome! 🎮
