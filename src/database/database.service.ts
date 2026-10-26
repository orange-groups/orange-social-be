
import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly client;
  readonly db;

  constructor(config: ConfigService) {
    const databaseUrl =
      config.getOrThrow<string>('DATABASE_URL');

    this.client = postgres(databaseUrl, {
      max: 5,
    });

    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy() {
    await this.client.end();
  }
}
