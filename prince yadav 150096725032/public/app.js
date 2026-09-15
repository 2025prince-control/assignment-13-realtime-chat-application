/**
 * Real-Time Group Chat & Direct Messaging Client
 * Student: Prince Yadav (150096725032)
 * Assignment 13: Real-Time WebSockets Engine
 */

// Avatar emoji dictionary for clean rendering
const AVATAR_MAP = {
  'avatar1.png': '👨‍💻',
  'avatar2.png': '👩‍💻',
  'avatar3.png': '🚀',
  'avatar4.png': '⚡',
  'avatar5.png': '🦊',
  'avatar6.png': '🔮'
};

// Client Application State
const state = {
  socket: null,
  currentUser: null,
  currentRoom: 'developers',
  availableRooms: ['general', 'developers', 'random', 'gaming', 'tech'],
  roomUsers: [],
  allOnlineUsers: [],
  selectedAvatar: 'avatar1.png',
  isTyping: false,
  typingTimer: null,
  typingDebounceDelay: 1500, // Debounce timeout in ms
  activeDmRecipient: null, // { socketId, username, avatar }
  dmHistory: {} // socketId -> [ { from, to, message, timestamp, self } ]
};

// DOM Element References
const elements = {
  loginModal: document.getElementById('login-modal'),
  loginForm: document.getElementById('login-form'),
  usernameInput: document.getElementById('username-input'),
  avatarPicker: document.getElementById('avatar-picker'),
  appShell: document.getElementById('app-shell'),
  
  // Left Sidebar
  myAvatarDisplay: document.getElementById('my-avatar-display'),
  myUsernameDisplay: document.getElementById('my-username-display'),
  roomsList: document.getElementById('rooms-list'),
  dmConversationsList: document.getElementById('dm-conversations-list'),
  btnAddRoom: document.getElementById('btn-add-room'),
  btnLeaveRoom: document.getElementById('btn-leave-room'),

  // Center Chat
  currentRoomTitle: document.getElementById('current-room-title'),
  currentRoomTopic: document.getElementById('current-room-topic'),
  messagesContainer: document.getElementById('messages-container'),
  typingIndicator: document.getElementById('typing-indicator'),
  typingText: document.getElementById('typing-text'),
  chatForm: document.getElementById('chat-form'),
  messageInput: document.getElementById('message-input'),
  btnEmojiQuick: document.getElementById('btn-emoji-quick'),
  btnToggleRoster: document.getElementById('btn-toggle-roster'),
  rosterCountBadge: document.getElementById('roster-count-badge'),

  // Right Sidebar
  sidebarRoster: document.getElementById('sidebar-roster'),
  roomUsersCount: document.getElementById('room-users-count'),
  rosterList: document.getElementById('roster-list'),
  allUsersCount: document.getElementById('all-users-count'),
  allOnlineList: document.getElementById('all-online-list'),

  // DM Modal
  dmModal: document.getElementById('dm-modal'),
  dmTargetAvatar: document.getElementById('dm-target-avatar'),
  dmTargetUsername: document.getElementById('dm-target-username'),
  dmMessagesContainer: document.getElementById('dm-messages-container'),
  dmForm: document.getElementById('dm-form'),
  dmInput: document.getElementById('dm-input'),
  btnCloseDm: document.getElementById('btn-close-dm'),

  // Create Room Modal
  createRoomModal: document.getElementById('create-room-modal'),
  createRoomForm: document.getElementById('create-room-form'),
  newRoomInput: document.getElementById('new-room-input'),
  btnCancelCreateRoom: document.getElementById('btn-cancel-create-room'),

  toastContainer: document.getElementById('toast-container')
};

// ===================================================================
// INITIALIZATION & EVENT LISTENERS
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupAvatarPicker();
  setupEventListeners();
});

function setupAvatarPicker() {
  const options = elements.avatarPicker.querySelectorAll('.avatar-option');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      state.selectedAvatar = opt.dataset.avatar;
    });
  });
}

function setupEventListeners() {
  // Login form submit
  elements.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = elements.usernameInput.value.trim();
    if (!username) return;
    initiateSocketSession(username, state.selectedAvatar);
  });

  // Chat message send
  elements.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  // Debounced typing detection
  elements.messageInput.addEventListener('input', handleTypingInput);

  // Quick Emoji Button
  elements.btnEmojiQuick.addEventListener('click', () => {
    const emojis = ['👍', '🔥', '🚀', '💻', '🎉', '❤️', '💯', '✨'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    elements.messageInput.value += ` ${randomEmoji} `;
    elements.messageInput.focus();
  });

  // Channel Creation Modal
  elements.btnAddRoom.addEventListener('click', () => {
    elements.createRoomModal.classList.remove('hidden');
    elements.newRoomInput.focus();
  });

  elements.btnCancelCreateRoom.addEventListener('click', () => {
    elements.createRoomModal.classList.add('hidden');
    elements.newRoomInput.value = '';
  });

  elements.createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const roomName = elements.newRoomInput.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (roomName) {
      joinRoom(roomName);
      elements.createRoomModal.classList.add('hidden');
      elements.newRoomInput.value = '';
    }
  });

  // Leave room button
  elements.btnLeaveRoom.addEventListener('click', () => {
    if (confirm(`Leave #${state.currentRoom}?`)) {
      state.socket.emit('room:leave', { room: state.currentRoom });
      joinRoom('general');
    }
  });

  // Toggle Roster on Mobile
  elements.btnToggleRoster.addEventListener('click', () => {
    elements.sidebarRoster.classList.toggle('mobile-open');
  });

  // DM Modal actions
  elements.btnCloseDm.addEventListener('click', () => {
    elements.dmModal.classList.add('hidden');
    state.activeDmRecipient = null;
  });

  elements.dmForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendDirectMessage();
  });
}

// ===================================================================
// SOCKET CONNECTION & EVENT PROTOCOL
// ===================================================================
function initiateSocketSession(username, avatar) {
  state.socket = io();

  state.socket.on('connect', () => {
    console.log('[SOCKET] Connected with ID:', state.socket.id);

    // 1. user:login - Client -> Server
    // Payload: { "username": "Aarav", "avatar": "avatar1.png" }
    state.socket.emit('user:login', { username, avatar });
  });

  // Login success confirmation
  state.socket.on('user:login:success', ({ user, availableRooms, onlineUsers }) => {
    state.currentUser = user;
    if (availableRooms) state.availableRooms = availableRooms;
    if (onlineUsers) state.allOnlineUsers = onlineUsers;

    // Transition UI from Login Modal to App Shell
    elements.loginModal.classList.add('hidden');
    elements.appShell.classList.remove('hidden');

    // Update Profile Bar
    elements.myAvatarDisplay.textContent = AVATAR_MAP[user.avatar] || '👨‍💻';
    elements.myUsernameDisplay.textContent = user.username;

    renderRoomsList();
    renderAllOnlineList();

    // 2. room:join - Client -> Server
    // Join initial default room: "developers"
    joinRoom('developers');
  });

  // 3. room:history - Server -> Client
  // Payload: { "room": "developers", "messages": [...] }
  state.socket.on('room:history', ({ room, messages }) => {
    if (room.toLowerCase() === state.currentRoom.toLowerCase()) {
      elements.messagesContainer.innerHTML = '';
      if (messages && messages.length > 0) {
        messages.forEach(msg => appendChatMessage(msg));
      } else {
        appendSystemNotice(`Welcome to #${room}! Start the conversation.`);
      }
      scrollToBottom();
    }
  });

  // 4. room:userlist - Server -> Room
  // Payload: { "room": "developers", "users": ["Aarav", "Priya"], "members": [...] }
  state.socket.on('room:userlist', ({ room, users, members }) => {
    if (room.toLowerCase() === state.currentRoom.toLowerCase()) {
      state.roomUsers = members || users.map(u => ({ username: u, avatar: 'avatar1.png' }));
      renderRoomRoster(users, members);
    }
  });

  // 5. chat:receive - Server -> Room
  // Payload: { "id": "msg_123", "sender": "Aarav", "message": "Hey everyone!", "timestamp": "14:32" }
  state.socket.on('chat:receive', (msgObj) => {
    if (!msgObj.room || msgObj.room.toLowerCase() === state.currentRoom.toLowerCase()) {
      appendChatMessage(msgObj);
      scrollToBottom();
    }
  });

  // 6. typing:update - Server -> Room (broadcast.to)
  // Payload: { "username": "Aarav", "isTyping": true, "room": "developers" }
  state.socket.on('typing:update', ({ username, isTyping, room }) => {
    if (room && room.toLowerCase() !== state.currentRoom.toLowerCase()) return;
    if (username === state.currentUser.username) return;

    if (isTyping) {
      elements.typingText.textContent = `${username} is typing...`;
      elements.typingIndicator.classList.remove('hidden');
    } else {
      elements.typingIndicator.classList.add('hidden');
    }
  });

  // 7. direct:receive - Server -> Client
  // Payload: { "from": "Aarav", "fromId": "...", "message": "Secret DM", "timestamp": "14:35" }
  state.socket.on('direct:receive', (dm) => {
    const senderId = dm.fromId;
    if (!state.dmHistory[senderId]) {
      state.dmHistory[senderId] = [];
    }
    state.dmHistory[senderId].push(dm);

    // If DM modal is currently open with this sender, render immediately
    if (state.activeDmRecipient && state.activeDmRecipient.socketId === senderId) {
      appendDmMessage(dm, false);
      scrollDmToBottom();
    } else {
      showToast(`💬 Private message from ${dm.from}: "${dm.message}"`, () => {
        openDmModal({ socketId: senderId, username: dm.from, avatar: dm.avatar || 'avatar1.png' });
      });
    }

    updateDmConversationsList();
  });

  // direct:sent - Confirmation to sender for direct message
  state.socket.on('direct:sent', (dm) => {
    const recipientId = dm.recipientId;
    if (!state.dmHistory[recipientId]) {
      state.dmHistory[recipientId] = [];
    }
    state.dmHistory[recipientId].push(dm);

    if (state.activeDmRecipient && state.activeDmRecipient.socketId === recipientId) {
      appendDmMessage(dm, true);
      scrollDmToBottom();
    }
  });

  // Error notifications
  state.socket.on('direct:error', (err) => {
    showToast(`⚠️ ${err.message || 'Error sending direct message'}`);
  });

  // Room list updates
  state.socket.on('room:list', ({ rooms }) => {
    if (rooms) {
      state.availableRooms = rooms;
      renderRoomsList();
    }
  });

  // Global online users list update
  state.socket.on('users:online', ({ users }) => {
    if (users) {
      state.allOnlineUsers = users;
      renderAllOnlineList();
    }
  });

  // Connection lost / reconnected
  state.socket.on('disconnect', () => {
    console.log('[SOCKET] Disconnected from server');
    appendSystemNotice('Disconnected from chat engine. Reconnecting...');
  });
}

// ===================================================================
// ROOM SWITCHING & TYPING HANDLING
// ===================================================================
function joinRoom(roomName) {
  const normalized = roomName.trim().toLowerCase();
  state.currentRoom = normalized;

  // Update Header
  elements.currentRoomTitle.textContent = normalized;
  elements.currentRoomTopic.textContent = `Active channel #${normalized} • Real-time WebSocket sync`;
  elements.messageInput.placeholder = `Message #${normalized}...`;

  // Stop any active typing timers
  stopTypingState();

  // Highlight active item in sidebar
  renderRoomsList();

  // Clear messages while hydrating
  elements.messagesContainer.innerHTML = '';
  appendSystemNotice(`Loading #${normalized} message history...`);

  // Emit room:join event
  state.socket.emit('room:join', { room: normalized });
}

function handleTypingInput() {
  const text = elements.messageInput.value.trim();

  // If user has text and not already typing, trigger typing:start
  if (text.length > 0) {
    if (!state.isTyping) {
      state.isTyping = true;
      // typing:start - Client -> Server: { "room": "developers" }
      state.socket.emit('typing:start', { room: state.currentRoom });
    }

    // Reset debounce timer
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => {
      stopTypingState();
    }, state.typingDebounceDelay);
  } else {
    stopTypingState();
  }
}

function stopTypingState() {
  if (state.isTyping) {
    state.isTyping = false;
    clearTimeout(state.typingTimer);
    // typing:stop - Client -> Server: { "room": "developers" }
    if (state.socket && state.currentRoom) {
      state.socket.emit('typing:stop', { room: state.currentRoom });
    }
  }
}

function sendMessage() {
  const text = elements.messageInput.value.trim();
  if (!text) return;

  // Stop typing indicator immediately upon sending
  stopTypingState();

  // chat:send - Client -> Server
  // Payload: { "room": "developers", "message": "Hey everyone!" }
  state.socket.emit('chat:send', {
    room: state.currentRoom,
    message: text
  });

  elements.messageInput.value = '';
  elements.messageInput.focus();
}

// ===================================================================
// DIRECT MESSAGING (DM)
// ===================================================================
function openDmModal(targetUser) {
  if (!targetUser || !targetUser.socketId) return;
  if (state.currentUser && targetUser.socketId === state.socket.id) {
    showToast("ℹ️ That's your own profile!");
    return;
  }

  state.activeDmRecipient = targetUser;
  elements.dmTargetAvatar.textContent = AVATAR_MAP[targetUser.avatar] || '👨‍💻';
  elements.dmTargetUsername.textContent = targetUser.username;

  // Hydrate previous DM messages if existing
  elements.dmMessagesContainer.innerHTML = '';
  const history = state.dmHistory[targetUser.socketId] || [];
  history.forEach(dm => {
    appendDmMessage(dm, dm.self || (dm.from === state.currentUser.username));
  });

  elements.dmModal.classList.remove('hidden');
  elements.dmInput.focus();
  scrollDmToBottom();
}

function sendDirectMessage() {
  const text = elements.dmInput.value.trim();
  if (!text || !state.activeDmRecipient) return;

  // direct:send - Client -> Server
  // Payload: { "recipientId": "socket_id_xyz", "message": "Secret DM" }
  state.socket.emit('direct:send', {
    recipientId: state.activeDmRecipient.socketId,
    message: text
  });

  elements.dmInput.value = '';
}

function appendDmMessage(dm, isMine) {
  const row = document.createElement('div');
  row.className = `dm-bubble-row ${isMine ? 'mine' : 'theirs'}`;
  row.innerHTML = `
    <div class="dm-bubble">${escapeHtml(dm.message)}</div>
    <span class="dm-time">${dm.timestamp || ''}</span>
  `;
  elements.dmMessagesContainer.appendChild(row);
}

function scrollDmToBottom() {
  elements.dmMessagesContainer.scrollTop = elements.dmMessagesContainer.scrollHeight;
}

function updateDmConversationsList() {
  elements.dmConversationsList.innerHTML = '';
  const recipientIds = Object.keys(state.dmHistory);

  if (recipientIds.length === 0) {
    elements.dmConversationsList.innerHTML = `
      <li class="empty-dm-hint">Click "DM" next to any user on the right to start a private chat</li>
    `;
    return;
  }

  recipientIds.forEach(sockId => {
    const user = state.allOnlineUsers.find(u => u.socketId === sockId) || {
      socketId: sockId,
      username: 'Direct Chat',
      avatar: 'avatar1.png'
    };

    const li = document.createElement('li');
    li.className = 'dm-item';
    li.innerHTML = `
      <div class="room-name-wrapper">
        <span>${AVATAR_MAP[user.avatar] || '👤'}</span>
        <span>${escapeHtml(user.username)}</span>
      </div>
      <span class="badge-count">${state.dmHistory[sockId].length}</span>
    `;
    li.addEventListener('click', () => openDmModal(user));
    elements.dmConversationsList.appendChild(li);
  });
}

// ===================================================================
// UI RENDERING HELPERS
// ===================================================================
function renderRoomsList() {
  elements.roomsList.innerHTML = '';
  state.availableRooms.forEach(room => {
    const li = document.createElement('li');
    const isActive = room.toLowerCase() === state.currentRoom.toLowerCase();
    li.className = `room-item ${isActive ? 'active' : ''}`;
    li.innerHTML = `
      <div class="room-name-wrapper">
        <span class="channel-hash">#</span>
        <span>${escapeHtml(room)}</span>
      </div>
    `;
    li.addEventListener('click', () => {
      if (room.toLowerCase() !== state.currentRoom.toLowerCase()) {
        joinRoom(room);
      }
    });
    elements.roomsList.appendChild(li);
  });
}

function renderRoomRoster(users, members) {
  elements.rosterList.innerHTML = '';
  const count = users ? users.length : 0;
  elements.roomUsersCount.textContent = count;
  elements.rosterCountBadge.textContent = count;

  const memberList = members || (users || []).map(u => ({ username: u, avatar: 'avatar1.png', socketId: null }));

  memberList.forEach(user => {
    const isMe = state.currentUser && user.username === state.currentUser.username;
    const li = document.createElement('li');
    li.className = 'roster-user-card';
    li.innerHTML = `
      <div class="roster-user-left">
        <span class="roster-avatar">${AVATAR_MAP[user.avatar] || '👤'}</span>
        <span class="roster-user-name">${escapeHtml(user.username)}${isMe ? ' (You)' : ''}</span>
      </div>
      ${!isMe && user.socketId ? `<button class="btn-dm-action" title="Direct Message">DM</button>` : ''}
    `;

    if (!isMe && user.socketId) {
      const dmBtn = li.querySelector('.btn-dm-action');
      dmBtn.addEventListener('click', () => openDmModal(user));
    }

    elements.rosterList.appendChild(li);
  });
}

function renderAllOnlineList() {
  elements.allOnlineList.innerHTML = '';
  const users = state.allOnlineUsers || [];
  elements.allUsersCount.textContent = users.length;

  users.forEach(user => {
    const isMe = state.currentUser && user.username === state.currentUser.username;
    const li = document.createElement('li');
    li.className = 'roster-user-card';
    li.innerHTML = `
      <div class="roster-user-left">
        <span class="roster-avatar">${AVATAR_MAP[user.avatar] || '👤'}</span>
        <span class="roster-user-name">${escapeHtml(user.username)}${isMe ? ' (You)' : ''}</span>
      </div>
      ${!isMe ? `<button class="btn-dm-action">DM</button>` : ''}
    `;

    if (!isMe) {
      const dmBtn = li.querySelector('.btn-dm-action');
      dmBtn.addEventListener('click', () => openDmModal(user));
    }

    elements.allOnlineList.appendChild(li);
  });
}

function appendChatMessage(msg) {
  const isMine = state.currentUser && msg.sender === state.currentUser.username;
  const row = document.createElement('div');

  if (msg.system) {
    row.className = 'chat-row system-msg';
    row.innerHTML = `
      <div class="system-bubble">
        <span>⚡</span>
        <span>${escapeHtml(msg.message)}</span>
        <span class="time">${msg.timestamp || ''}</span>
      </div>
    `;
  } else {
    row.className = `chat-row ${isMine ? 'mine' : ''}`;
    row.innerHTML = `
      <div class="msg-avatar">${AVATAR_MAP[msg.avatar] || '👤'}</div>
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-sender">${escapeHtml(msg.sender)}</span>
          <span class="msg-time">${msg.timestamp || ''}</span>
        </div>
        <div class="msg-bubble">${escapeHtml(msg.message)}</div>
      </div>
    `;
  }

  elements.messagesContainer.appendChild(row);
}

function appendSystemNotice(text) {
  const row = document.createElement('div');
  row.className = 'chat-row system-msg';
  row.innerHTML = `
    <div class="system-bubble">
      <span>ℹ️</span>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
  elements.messagesContainer.appendChild(row);
}

function scrollToBottom() {
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function showToast(text, onClick) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  if (onClick) {
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => {
      onClick();
      toast.remove();
    });
  }
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
