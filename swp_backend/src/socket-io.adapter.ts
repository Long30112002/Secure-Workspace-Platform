import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions } from 'socket.io';

export class SocketIOAdapter extends IoAdapter {
    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: 'http://localhost:5173',
                credentials: true,
                methods: ['GET', 'POST'],
                allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
            },
            transports: ['websocket', 'polling'],
            allowEIO3: true,
            // **THÊM CÁC OPTION QUAN TRỌNG**
            pingTimeout: 60000,
            pingInterval: 25000,
            cookie: {
                name: "io",
                path: "/",
                httpOnly: true,
                sameSite: "lax"
            }
        });

        return server;
    }
}