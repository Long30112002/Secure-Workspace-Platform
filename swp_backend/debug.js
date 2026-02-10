// debug.js - Simple debug script
const fs = require('fs');
const path = require('path');

console.log('🔍 DEBUG WEBSOCKET GATEWAY STATUS\n');

// Check 1: Gateway file exists?
const gatewayPath = path.join(__dirname, 'src/workspace/gateways/workspace.gateway.ts');
console.log('1. Checking gateway file:', gatewayPath);

if (fs.existsSync(gatewayPath)) {
    console.log('✅ Gateway file EXISTS');
    const content = fs.readFileSync(gatewayPath, 'utf8');

    // Check for required decorators
    const checks = [
        { name: '@WebSocketGateway', found: content.includes('@WebSocketGateway') },
        { name: '@Injectable()', found: content.includes('@Injectable()') },
        { name: 'class WorkspaceGateway', found: content.includes('class WorkspaceGateway') },
        { name: 'constructor()', found: content.includes('constructor(') },
    ];

    checks.forEach(check => {
        console.log(`   ${check.found ? '✅' : '❌'} ${check.name}`);
    });

    // Check for console.log in constructor
    if (content.includes('console.log') && content.includes('constructor')) {
        console.log('✅ Has console.log in constructor');
    } else {
        console.log('❌ No console.log in constructor - adding...');

        // Add console.log to constructor
        let newContent = content;
        const constructorMatch = content.match(/constructor\s*\([^)]*\)\s*{/);
        if (constructorMatch) {
            const constructorLine = constructorMatch[0];
            newContent = content.replace(constructorLine, constructorLine + '\n        console.log("🚀 WORKSPACE GATEWAY CONSTRUCTOR CALLED!");');
            fs.writeFileSync(gatewayPath, newContent);
            console.log('✅ Added console.log to constructor');
        }
    }
} else {
    console.log('❌ Gateway file NOT FOUND');
    console.log('\n💡 Creating gateway file...');

    const gatewayDir = path.dirname(gatewayPath);
    if (!fs.existsSync(gatewayDir)) {
        fs.mkdirSync(gatewayDir, { recursive: true });
    }

    const gatewayContent = `import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from 'src/database/database.service';

@WebSocketGateway({
    namespace: '/workspace',
    cors: {
        origin: 'http://localhost:5173',
        credentials: true,
    },
    transports: ['websocket', 'polling'],
})
@Injectable()
export class WorkspaceGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(WorkspaceGateway.name);

    constructor(
        private jwtService: JwtService,
        private prisma: DatabaseService,
    ) {
        console.log('🚀 WORKSPACE GATEWAY CONSTRUCTOR CALLED!');
        this.logger.log('✅ WorkspaceGateway constructor called');
    }

    afterInit(server: Server) {
        console.log('🎯 WebSocket Gateway Initialized!');
        this.logger.log('🚀 WebSocket Gateway Initialized!');
        this.logger.log('🔌 Namespace: /workspace');
    }

    async handleConnection(client: Socket) {
        console.log('🎉 NEW WebSocket Connection!');
        this.logger.log('Client connected: ' + client.id);
        
        client.emit('welcome', {
            message: 'Connected to Workspace WebSocket!',
            clientId: client.id,
            timestamp: new Date().toISOString()
        });
    }

    handleDisconnect(client: Socket) {
        console.log('🔌 Client disconnected');
        this.logger.log('Client disconnected: ' + client.id);
    }

    @SubscribeMessage('ping')
    handlePing(client: Socket) {
        client.emit('pong', {
            message: 'pong from server!',
            timestamp: new Date().toISOString()
        });
    }
}`;

    fs.writeFileSync(gatewayPath, gatewayContent);
    console.log('✅ Created gateway file');
}

// Check 2: Workspace module imports gateway?
const modulePath = path.join(__dirname, 'src/workspace/workspace.module.ts');
console.log('\n2. Checking workspace module:', modulePath);

if (fs.existsSync(modulePath)) {
    const content = fs.readFileSync(modulePath, 'utf8');

    if (content.includes('WorkspaceGateway')) {
        console.log('✅ WorkspaceGateway imported in module');

        // Check if in providers array
        const lines = content.split('\n');
        let inProviders = false;
        let foundInProviders = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('providers:')) {
                inProviders = true;
            }
            if (inProviders && line.includes('WorkspaceGateway')) {
                foundInProviders = true;
                console.log(`✅ Found in providers at line ${i + 1}: ${line.trim()}`);
            }
            if (inProviders && line.includes(']')) {
                inProviders = false;
            }
        }

        if (!foundInProviders) {
            console.log('❌ WorkspaceGateway NOT in providers array');
            console.log('💡 Adding to providers...');

            // Find providers array and add WorkspaceGateway
            let newContent = content;
            const providersMatch = content.match(/providers:\s*\[/);
            if (providersMatch) {
                const insertPoint = content.indexOf(providersMatch[0]) + providersMatch[0].length;
                newContent = content.slice(0, insertPoint) + '\n    WorkspaceGateway,' + content.slice(insertPoint);
                fs.writeFileSync(modulePath, newContent);
                console.log('✅ Added WorkspaceGateway to providers');
            }
        }
    } else {
        console.log('❌ WorkspaceGateway NOT imported in module');
        console.log('💡 Adding import...');

        // Add import and to providers
        let newContent = content;

        // Add import at top
        if (newContent.includes('import')) {
            const lastImportIndex = newContent.lastIndexOf('import');
            const importEndIndex = newContent.indexOf('\n', newContent.indexOf(';', lastImportIndex));
            newContent = newContent.slice(0, importEndIndex) +
                '\nimport { WorkspaceGateway } from \'./gateways/workspace.gateway\';' +
                newContent.slice(importEndIndex);
        }

        // Add to providers
        const providersMatch = newContent.match(/providers:\s*\[/);
        if (providersMatch) {
            const insertPoint = newContent.indexOf(providersMatch[0]) + providersMatch[0].length;
            newContent = newContent.slice(0, insertPoint) + '\n    WorkspaceGateway,' + newContent.slice(insertPoint);
        }

        fs.writeFileSync(modulePath, newContent);
        console.log('✅ Added WorkspaceGateway import and to providers');
    }
} else {
    console.log('❌ Workspace module not found!');
}

// Check 3: App module imports workspace module?
const appModulePath = path.join(__dirname, 'src/app.module.ts');
console.log('\n3. Checking app module:', appModulePath);

if (fs.existsSync(appModulePath)) {
    const content = fs.readFileSync(appModulePath, 'utf8');

    if (content.includes('WorkspaceModule')) {
        console.log('✅ WorkspaceModule imported in AppModule');
    } else {
        console.log('❌ WorkspaceModule NOT imported in AppModule');

        // Show current imports
        console.log('Current imports in AppModule:');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
            if (line.includes('import') && line.includes('Module')) {
                console.log(`   Line ${i + 1}: ${line.trim()}`);
            }
        });
    }
}

console.log('\n🎯 NEXT STEPS:');
console.log('1. Restart server: npm run start:dev');
console.log('2. Look for: "🚀 WORKSPACE GATEWAY CONSTRUCTOR CALLED!"');
console.log('3. If not found, check server logs above');
console.log('4. Test with: node test-socket.js (see below)');

// Create simple test script
const testScript = `
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
`;

fs.writeFileSync(path.join(__dirname, 'test-socket.js'), testScript);
console.log('\n📁 Created test-socket.js for testing');
console.log('Run: node test-socket.js');