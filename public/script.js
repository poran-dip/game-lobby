const socket = io();
let currentLobby = null;
let playerName = '';

const membersList = document.getElementById('members-list');
const lobbyInfo = document.getElementById('lobby-info');

function createLobby() {
  const lobbyName = document.getElementById('lobby-name').value.trim();
  const lobbyPass = document.getElementById('lobby-pass').value;
  playerName = document.getElementById('username-create').value.trim();

  if (!lobbyName || !playerName) {
    showError('Please enter a lobby name and username');
    return;
  }

  if (lobbyName.length < 3) {
    showError('Lobby name must be at least 3 characters');
    return;
  }

  if (playerName.length < 2) {
    showError('Username must be at least 2 characters');
    return;
  }

  setCookie('playerName', playerName, 24 * 3600);

  socket.emit('createLobby', {
    name: lobbyName,
    password: lobbyPass,
    creator: playerName
  });
}

function joinLobby() {
  const lobbyName = document.getElementById('join-name').value.trim();
  const lobbyPass = document.getElementById('join-pass').value;
  playerName = document.getElementById('username-join').value.trim();

  if (!lobbyName || !playerName) {
    showError('Please enter a lobby name and username');
    return;
  }

  if (playerName.length < 2) {
    showError('Username must be at least 2 characters');
    return;
  }

  setCookie('playerName', playerName, 24 * 3600);

  socket.emit('joinLobby', {
    name: lobbyName,
    password: lobbyPass,
    player: playerName
  });
}

socket.on('lobbyCreated', function(lobbyData) {
  console.log('Lobby created:', lobbyData);
  currentLobby = lobbyData;
  displayLobbyInfo();
  hideMainForms();
});

socket.on('joinedLobby', function(lobbyData) {
  console.log('Joined lobby:', lobbyData);
  currentLobby = lobbyData;
  displayLobbyInfo();
  hideMainForms();
});

socket.on('lobbyError', function(error) {
  showError(error.message);
});

socket.on('memberUpdate', function(members) {
  updateMembersList(members);
  if (currentLobby) {
    currentLobby.members = members;

    updateHostButtons();
  }
});

socket.on('gameStart', function(gameData) {
  console.log('Game starting:', gameData);
  showError('Game started! (Game interface not implemented yet)');

});

socket.on('lobbyTimeout', function() {
  showError('Lobby has been closed due to inactivity');
  leaveLobby();
});

socket.on('gameStarted', function(gameData) {
  console.log('Game started with data:', gameData);
  showError('Game has started! (Game interface would load here)');
});

function displayLobbyInfo() {
  hideMainForms();

  lobbyInfo.innerHTML = `
    <div class="lobby-info">
      <h2>🏠 ${currentLobby.name}</h2>
      <div class="lobby-id">Lobby ID: ${currentLobby.id}</div>
      <div class="button-group">
        <button onclick="startGame()" id="start-button" class="start-btn" ${currentLobby.creator !== playerName ? 'disabled' : ''}>
          🚀 Start Game
        </button>
        <button onclick="leaveLobby()" class="leave-btn">
          🚪 Leave Lobby
        </button>
      </div>
    </div>
  `;

  lobbyInfo.classList.remove('hidden');
  updateMembersList(currentLobby.members);
}

function updateMembersList(members) {
  if (!members || members.length === 0) {
    membersList.innerHTML = '<li style="color: #999; font-style: italic;">No active lobby</li>';
    return;
  }

  membersList.innerHTML = '';
  members.forEach(member => {
    const li = document.createElement('li');
    const isHost = member === currentLobby.creator;
    li.textContent = member + (isHost ? ' 👑 (Host)' : '');
    if (isHost) {
      li.classList.add('host');
    }
    membersList.appendChild(li);
  });
}

function hideMainForms() {
  document.getElementById('create-lobby').classList.add('hidden');
  document.getElementById('join-lobby').classList.add('hidden');

  const mainButtons = document.querySelector('.main-buttons');
  mainButtons.style.display = 'none';
}

function showMainForms() {
  document.getElementById('create-lobby').classList.add('hidden');
  document.getElementById('join-lobby').classList.add('hidden');

  const mainButtons = document.querySelector('.main-buttons');
  mainButtons.style.display = 'flex';
}

function updateHostButtons() {
  const startButton = document.getElementById('start-button');
  if (startButton && currentLobby) {
    startButton.disabled = currentLobby.creator !== playerName;
  }
}

function startGame() {
  if (currentLobby && currentLobby.creator === playerName) {
    if (currentLobby.members.length < 2) {
      showError('Need at least 2 players to start the game');
      return;
    }
    socket.emit('startGame', currentLobby.id);
  }
}

function leaveLobby() {
  if (currentLobby) {
    socket.emit('leaveLobby', {
      lobbyId: currentLobby.id,
      player: playerName
    });
  }

  lobbyInfo.classList.add('hidden');
  lobbyInfo.innerHTML = '';
  showMainForms();
  membersList.innerHTML = '<li style="color: #999; font-style: italic;">No active lobby</li>';
  currentLobby = null;

  document.getElementById('lobby-name').value = '';
  document.getElementById('lobby-pass').value = '';
  document.getElementById('join-name').value = '';
  document.getElementById('join-pass').value = '';
}

function setCookie(name, value, seconds) {
  let date = new Date();
  date.setTime(date.getTime() + (seconds * 1000));
  let expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
  name += "=";
  let cookies = document.cookie.split(';');
  for(let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1);
    }
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length, cookie.length);
    }
  }
  return null;
}

socket.on('connect', () => {
  console.log('Connected to server');

  const existingError = document.querySelector('.error');
  if (existingError && existingError.textContent.includes('connection')) {
    existingError.remove();
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  showError('Connection to server lost. Please refresh the page.');
});

socket.on('connect_error', (error) => {
  console.log('Connection error:', error);
  showError('Unable to connect to server. Please check your connection.');
});

window.onload = function() {
  const savedName = getCookie('playerName');
  if (savedName) {
    document.getElementById('username-create').value = savedName;
    document.getElementById('username-join').value = savedName;
  }

  document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      const createForm = document.getElementById('create-lobby');
      const joinForm = document.getElementById('join-lobby');

      if (!createForm.classList.contains('hidden')) {
        createLobby();
      } else if (!joinForm.classList.contains('hidden')) {
        joinLobby();
      }
    }
  });
};
