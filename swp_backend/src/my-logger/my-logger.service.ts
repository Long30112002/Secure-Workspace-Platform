import { ConsoleLogger, Injectable, Optional } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as zlib from 'zlib';

const gzip = promisify(zlib.gzip);

export interface LogEntry {
    timestamp: string;
    level: 'log' | 'error' | 'warn' | 'debug' | 'verbose';
    message: any;
    context?: string;
    stack?: string;
    metadata?: Record<string, any>;
}

@Injectable()
export class MyLoggerService extends ConsoleLogger {
    private logDir = path.join(process.cwd(), 'logs');
    private logQueue: LogEntry[] = [];
    private isWriting = false;
    private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
    private readonly MAX_LOG_FILES = 10;

    constructor(@Optional() context?: string) {
        super(context || 'Aplication');
        this.ensureLogDirectory();
        this.startLogProcessor();
    }
    private async ensureLogDirectory() {
        try {
            await fs.access(this.logDir);
        } catch {
            try {
                await fs.mkdir(this.logDir, { recursive: true });
            } catch (error) {
                console.error('Cannot create log dỉrectory', error);
            }
        }
    }

    private getLogFileName(): string {
        const date = new Date().toISOString().split('T')[0];
        return `${date}.log`;
    }

    private async rotateLogs(filePath: string) {
        try {
            const stats = await fs.stat(filePath).catch(() => null);

            if (stats && stats.size > this.MAX_FILE_SIZE) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const oldPath = `${filePath}.${timestamp}.gz`;

                //Compress old log
                const content = await fs.readFile(filePath);
                const compressed = await gzip(content);
                await fs.writeFile(oldPath, compressed);

                //Clear current log
                await fs.writeFile(filePath, '');

                //Clean up old logs
                await this.cleanupOldLogs();
            }
        } catch (error) {
            console.log('Log rotation failed: ', error);
        }
    }

    private async cleanupOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const logFiles = files
                .filter(f => f.endsWith('.gz'))
                .sort()
                .reverse();

            if (logFiles.length > this.MAX_LOG_FILES) {
                const toDelete = logFiles.slice(this.MAX_LOG_FILES);
                for (const file of toDelete) {
                    await fs.unlink(path.join(this.logDir, file));
                }
            }
        } catch (error) {
            console.error('Log cleanup failed: ', error);
        }
    }

    private maskSensitiveData(data: any): any {
        if (typeof data !== 'object' || data === null) return data;

        const masked = { ...data };

        //Mask email
        if (masked.email && typeof masked.email === 'string') {
            const [local, domain] = masked.email.split('@');
            masked.email = `${local.substring(0, 3)}***@${domain}`;
        }

        //Removed password
        if (masked.password) masked.password = '***';

        //
        Object.keys(masked).forEach(key => {
            if (typeof masked[key] === 'object') {
                masked[key] = this.maskSensitiveData(masked[key]);
            }
        });
        return masked;
    }

    async writeToFile(entry: LogEntry) {
        try {
            const fileName = this.getLogFileName();
            const filePath = path.join(this.logDir, fileName);

            const safeEntry = {
                ...entry,
                message: this.maskSensitiveData(entry.message),
                timestamp: new Date().toISOString(),
            };

            const formattedEntry = JSON.stringify(safeEntry) + '\n';

            //Queue-based writing để tránh blocking
            this.logQueue.push(safeEntry);

            //Rotate nếu cần
            await this.rotateLogs(filePath);

            //Append to file (non-blocking với queue)
            await fs.appendFile(filePath, formattedEntry);

        } catch (error) {
            console.error('Failed to write log to file', error);
            console.log('Log entry that failed:', JSON.stringify(entry));
        }
    }

    // Batch processing để tăng performance
    private async startLogProcessor() {
        setInterval(async () => {
            if (this.logQueue.length === 0 || this.isWriting) return;

            this.isWriting = true;
            const batch = [...this.logQueue];
            this.logQueue = [];

            try {
                const fileName = this.getLogFileName();
                const filePath = path.join(this.logDir, fileName);


                const logEntries = batch.map(entry =>
                    JSON.stringify(entry) + '\n'
                ).join('');

                await fs.appendFile(filePath, logEntries);

            } catch (error) {
                console.error('Batch log write failed: ', error);
                this.logQueue.unshift(...batch);
            } finally {
                this.isWriting = false;
            }
        }, 1000)
    }

    log(message: any, metadataOrContext?: Record<string, any> | string, context?: string) {
        let metadata: Record<string, any> | undefined;
        let actualContext = context;

        if (typeof metadataOrContext === 'string') {
            actualContext = metadataOrContext;
        } else if (typeof metadataOrContext === 'object') {
            metadata = metadataOrContext;
        }

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'log',
            message: typeof message === 'object' ? JSON.stringify(message) : String(message),
            context: context || this.context,
            metadata,
        }

        // Non-blocking write
        this.writeToFile(entry).catch(() => { });
        const consoleMessage = metadata
            ? `${metadata} | ${JSON.stringify(metadata)}`
            : message;
        super.log(consoleMessage, actualContext);
    }

    error(message: any, metadataOrStack?: Record<string, any> | string, stackOrContext?: string) {
        let metadata: Record<string, any> | undefined;
        let stack: string | undefined;
        let context: string | undefined;

        if (typeof metadataOrStack === 'string') {
            if (metadataOrStack.includes('\n')) {
                stack = metadataOrStack;
            } else {
                context = metadataOrStack;
            }
        } else if (typeof metadataOrStack === 'object') {
            metadata = metadataOrStack;
        }

        if (typeof stackOrContext === 'string') {
            if (stackOrContext.includes('\n')) {
                stack = stackOrContext;
            } else {
                context = stackOrContext;
            }
        }

        const isError = message instanceof Error;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: isError ? message.message : String(message),
            context: context || this.context,
            stack: isError ? message.stack : stack,
            metadata,
        };

        this.writeToFile(entry).catch(() => { });

        const consoleMessage = metadata
            ? `${message} | ${JSON.stringify(metadata)}`
            : message;
        const consoleStack = isError ? message.stack : stack;

        if (consoleStack) {
            super.error(consoleMessage, consoleStack);
        } else {
            super.error(consoleMessage, context);
        }
    }

    warn(message: any, metadataOrContext?: Record<string, any> | string, context?: string) {
        let metadata: Record<string, any> | undefined;
        let actualContext = context;

        if (typeof metadataOrContext === 'string') {
            actualContext = metadataOrContext;
        } else if (typeof metadataOrContext === 'object') {
            metadata = metadataOrContext;
        }

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'warn',
            message: typeof message === 'object' ? JSON.stringify(message) : String(message),
            context: context || this.context,
            metadata,
        };

        this.writeToFile(entry).catch(() => { });

        const consoleMessage = metadata
            ? `${message} | ${JSON.stringify(metadata)}`
            : message;
        super.warn(consoleMessage, actualContext);
    }

    debug(message: any, context?: string) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'debug',
            message,
            context: context || this.context,
        };
        this.writeToFile(entry).catch(() => { });
        super.debug(message, context);
    }

    verbose(message: any, context?: string) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'verbose',
            message,
            context: context || this.context,
        };
        this.writeToFile(entry).catch(() => { });
        super.debug(message, context);
    }
}
