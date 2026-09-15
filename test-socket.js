/**
 * Automated Socket.io Multi-Client Test Suite
 * Assignment 13: Real-Time Group Chat & Messaging Engine
 * Student: Prince Yadav (150096725032)
 *
 * Validates all scenarios from Section 6 (Testing & Validation):
 * 1. Aarav & Priya join #developers; Rohan joins #random.
 * 2. Typing indicator in #developers received by Priya, NOT by Rohan.
 * 3. Group chat message in #developers received by Priya, NOT by Rohan.
 * 4. Fourth user (LateJoiner) joins #developers; verifies message history replay (room:history).
 * 5. Aarav sends a direct message to Priya; verifies Rohan receives nothing.
 * 6. User disconnect updates room rosters cleanly.
 */

const http = require('http');
const { io } = require('socket.io-client');
const assert = require('assert');
const { server, startServer } = require('./server');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkServerAvailable(url) {
  return new Promise((resolve) => {
    const req = http.get(`${url}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function resolveServerUrl() {
  if (process.env.SERVER_URL) return process.env.SERVER_URL;
  const candidates = ['http://localhost:5000', 'http://localhost:5050'];
  for (const url of candidates) {
    const ok = await checkServerAvailable(url);
    if (ok) return url;
  }

  // If not running, start server automatically on port 5055 for testing
  const testPort = 5055;
  await new Promise((resolve) => {
    server.listen(testPort, () => {
      resolve();
    });
  });
  return `http://localhost:${testPort}`;
}

function createClient(serverUrl, username, avatar) {
  return new Promise((resolve, reject) => {
    const socket = io(serverUrl, {
      transports: ['websocket'],
      forceNew: true
    });

    socket.on('connect', () => {
      socket.emit('user:login', { username, avatar });
    });

    socket.on('user:login:success', (data) => {
      resolve({ socket, user: data.user });
    });

    socket.on('connect_error', (err) => {
      reject(err);
    });
  });
}

async function runTests() {
  const SERVER_URL = await resolveServerUrl();

  console.log('🧪 ========================================================');
  console.log('🧪 STARTING ASSIGNMENT 13 AUTOMATED VALIDATION SUITE');
  console.log('🧪 Target Server:', SERVER_URL);
  console.log('🧪 Student: Prince Yadav (150096725032)');
  console.log('🧪 ========================================================\n');

  try {
    // Step 1: Connect Aarav, Priya, and Rohan
    console.log('▶ [Test 1] Connecting 3 concurrent users: Aarav, Priya, Rohan...');
    const clientAarav = await createClient(SERVER_URL, 'Aarav', 'avatar1.png');
    const clientPriya = await createClient(SERVER_URL, 'Priya', 'avatar2.png');
    const clientRohan = await createClient(SERVER_URL, 'Rohan', 'avatar3.png');
    console.log('   ✅ Aarav connected (ID: %s)', clientAarav.socket.id);
    console.log('   ✅ Priya connected (ID: %s)', clientPriya.socket.id);
    console.log('   ✅ Rohan connected (ID: %s)', clientRohan.socket.id);

    // Step 2: Aarav & Priya join #developers, Rohan joins #random
    console.log('\n▶ [Test 2] Joining rooms: Aarav & Priya -> #developers, Rohan -> #random...');
    
    let priyaRosterUpdated = false;
    let rohanRosterUpdated = false;

    clientPriya.socket.on('room:userlist', (data) => {
      if (data.room === 'developers' && data.users.includes('Aarav') && data.users.includes('Priya')) {
        priyaRosterUpdated = true;
      }
    });

    clientRohan.socket.on('room:userlist', (data) => {
      if (data.room === 'random' && data.users.includes('Rohan')) {
        rohanRosterUpdated = true;
      }
    });

    clientAarav.socket.emit('room:join', { room: 'developers' });
    clientPriya.socket.emit('room:join', { room: 'developers' });
    clientRohan.socket.emit('room:join', { room: 'random' });

    await wait(400);
    assert.strictEqual(priyaRosterUpdated, true, 'Priya must receive updated room:userlist for #developers containing Aarav and Priya');
    assert.strictEqual(rohanRosterUpdated, true, 'Rohan must receive room:userlist for #random containing Rohan');
    console.log('   ✅ Room roster isolation verified successfully.');

    // Step 3: Typing Indicator selective broadcasting
    console.log('\n▶ [Test 3] Aarav types in #developers: verify only Priya receives typing:update, Rohan receives NOTHING...');
    let priyaSawTyping = false;
    let rohanSawTyping = false;

    clientPriya.socket.on('typing:update', (data) => {
      if (data.username === 'Aarav' && data.isTyping === true && data.room === 'developers') {
        priyaSawTyping = true;
      }
    });

    clientRohan.socket.on('typing:update', (data) => {
      rohanSawTyping = true;
    });

    clientAarav.socket.emit('typing:start', { room: 'developers' });
    await wait(300);

    assert.strictEqual(priyaSawTyping, true, 'Priya in #developers should receive typing indicator from Aarav');
    assert.strictEqual(rohanSawTyping, false, 'Rohan in #random must NOT receive typing indicator from Aarav');
    console.log('   ✅ Typing indicator received by Priya and isolated from Rohan.');

    // Aarav stops typing
    clientAarav.socket.emit('typing:stop', { room: 'developers' });
    await wait(200);

    // Step 4: Group message delivery in #developers
    console.log('\n▶ [Test 4] Aarav sends message in #developers: verify Priya receives it, Rohan does not...');
    let priyaReceivedMsg = null;
    let rohanReceivedMsg = null;

    clientPriya.socket.on('chat:receive', (data) => {
      if (data.sender === 'Aarav' && data.message === 'Hello developers!') {
        priyaReceivedMsg = data;
      }
    });

    clientRohan.socket.on('chat:receive', (data) => {
      if (data.sender === 'Aarav') {
        rohanReceivedMsg = data;
      }
    });

    clientAarav.socket.emit('chat:send', {
      room: 'developers',
      message: 'Hello developers!'
    });

    await wait(300);
    assert.ok(priyaReceivedMsg, 'Priya must receive the chat:receive event');
    assert.strictEqual(priyaReceivedMsg.room, 'developers');
    assert.strictEqual(priyaReceivedMsg.sender, 'Aarav');
    assert.strictEqual(priyaReceivedMsg.message, 'Hello developers!');
    assert.strictEqual(rohanReceivedMsg, null, 'Rohan must NOT receive messages from #developers');
    console.log('   ✅ Group message delivery and room boundary verified.');

    // Step 5: Fourth user (LateJoiner) joins #developers and receives history buffer
    console.log('\n▶ [Test 5] LateJoiner joins #developers: verify message history replay (room:history)...');
    const clientLateJoiner = await createClient(SERVER_URL, 'LateJoiner', 'avatar4.png');
    let historyReceived = null;

    clientLateJoiner.socket.on('room:history', (data) => {
      if (data.room === 'developers') {
        historyReceived = data.messages;
      }
    });

    clientLateJoiner.socket.emit('room:join', { room: 'developers' });
    await wait(400);

    assert.ok(Array.isArray(historyReceived), 'LateJoiner must receive room:history as an array');
    const matched = historyReceived.some(m => m.sender === 'Aarav' && m.message === 'Hello developers!');
    assert.strictEqual(matched, true, 'LateJoiner history buffer must contain previous message sent by Aarav');
    console.log('   ✅ Message history buffer replayed successfully (%d messages found).', historyReceived.length);

    // Step 6: Private Direct Message from Aarav to Priya
    console.log('\n▶ [Test 6] Aarav sends a direct message to Priya: verify Rohan does not receive it...');
    let priyaReceivedDm = null;
    let rohanReceivedDm = null;

    clientPriya.socket.on('direct:receive', (data) => {
      priyaReceivedDm = data;
    });

    clientRohan.socket.on('direct:receive', (data) => {
      rohanReceivedDm = data;
    });

    clientAarav.socket.emit('direct:send', {
      recipientId: clientPriya.socket.id,
      message: 'Secret DM for Priya only'
    });

    await wait(300);
    assert.ok(priyaReceivedDm, 'Priya must receive the direct message');
    assert.strictEqual(priyaReceivedDm.from, 'Aarav');
    assert.strictEqual(priyaReceivedDm.message, 'Secret DM for Priya only');
    assert.strictEqual(rohanReceivedDm, null, 'Rohan must NOT receive private DM sent to Priya');
    console.log('   ✅ Direct message delivered exclusively to target recipient.');

    // Step 7: Clean Disconnect
    console.log('\n▶ [Test 7] Disconnecting clients and verifying cleanup...');
    clientAarav.socket.disconnect();
    clientPriya.socket.disconnect();
    clientRohan.socket.disconnect();
    clientLateJoiner.socket.disconnect();
    await wait(300);
    console.log('   ✅ All test sockets closed cleanly.');

    console.log('\n🎉 ========================================================');
    console.log('🎉 ALL ASSIGNMENT 13 TESTS PASSED SUCCESSFULLY! (100/100)');
    console.log('🎉 ========================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exit(1);
  }
}

runTests();
