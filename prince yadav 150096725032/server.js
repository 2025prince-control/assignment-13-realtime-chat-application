/**
 * Real-Time Group Chat & Messaging Server Bootstrap
 * Student: Prince Yadav (150096725032)
 * Track: Backend & Real-Time Web | Assignment 13
 */

require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const registerUserHandlers = require('./sockets/userHandler');
const registerChatHandlers = require('./sockets/chatHandler');
const { getAllUsers, getAvailableRooms, getRoomHistory } = require('./utils/messageStore');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Server & Room Health API
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    engine: 'Socket.io 4.x & Express',
    student: 'Prince Yadav (150096725032)',
    stats: {
      connectedUsers: getAllUsers().length,
      availableRooms: getAvailableRooms()
    }
  });
});

// REST API to inspect room messages
app.get('/api/rooms/:room/messages', (req, res) => {
  const room = req.params.room.toLowerCase();
  const history = getRoomHistory(room);
  res.json({ room, count: history.length, messages: history });
});

// Setup Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Register socket event handlers per client connection
io.on('connection', (socket) => {
  console.log(`[SOCKET CONNECTED] Socket ID: ${socket.id}`);

  // Register modular socket event handlers
  registerUserHandlers(io, socket);
  registerChatHandlers(io, socket);
});

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5000;

function startServer(portToUse) {
  const onError = (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${portToUse} is in use (often macOS AirPlay on port 5000).`);
      const nextPort = portToUse === 5000 ? 5050 : portToUse + 1;
      console.log(`🔄 Retrying server startup on fallback port ${nextPort}...`);
      server.removeListener('listening', onListening);
      startServer(nextPort);
    } else {
      console.error('Server startup error:', err);
    }
  };

  const onListening = () => {
    server.removeListener('error', onError);
    const actualPort = server.address().port;
    console.log('====================================================');
    console.log(`🚀 Assignment 13 Real-Time Chat Engine running!`);
    console.log(`👤 Student: Prince Yadav (150096725032)`);
    console.log(`🌐 Local URL: http://localhost:${actualPort}`);
    console.log(`🩺 Health API: http://localhost:${actualPort}/health`);
    console.log('====================================================');
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(portToUse);
}

if (require.main === module || (module.parent && module.parent.filename.endsWith('server.js'))) {
  startServer(DEFAULT_PORT);
}

module.exports = { app, server, io, startServer };
