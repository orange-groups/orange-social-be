import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private readonly client: postgres.Sql;
  public readonly db: PostgresJsDatabase<typeof schema>;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    this.client = postgres(databaseUrl, { prepare: false });
    this.db = drizzle(this.client, { schema });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this
        .client`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refresh_token_hash" text`;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown database error';
      this.logger.warn(
        `Could not auto-verify refresh_token_hash column on startup: ${message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.end();
  }
}
