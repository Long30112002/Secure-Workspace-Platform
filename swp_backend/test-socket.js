
// test-socket.js - Simple Socket.IO test
const io = require('socket.io-client');

console.log('🔌 Testing Socket.IO connection...');

const socket = io('http://localhost:3000/workspace', {
    transports: ['polling'],
    reconnection: false
});

socket.on('connect', () => {
    console.log('✅ Connected! Socket ID:', socket.id);
    socket.emit('ping');
});

socket.on('welcome', (data) => {
    console.log('👋 Welcome:', data);
});

socket.on('pong', (data) => {
    console.log('🏓 Pong:', data);
    socket.disconnect();
    process.exit(0);
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection error:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('⏰ Timeout - server not responding');
    process.exit(1);
}, 5000);
