import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not defined');
    }
    
    try {
      const pool = new Pool({
        connectionString: databaseUrl,
        connectionTimeoutMillis: 10000,
      });
      
      const adapter = new PrismaPg(pool);
      
      super({
        adapter: adapter,
        log: ['error', 'warn', 'info'],
      });
      
    } catch (error) {
      throw error;
    }
  }
  
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      throw error;
    }
  }
  
  async onModuleDestroy() {
    await this.$disconnect();
  }
}