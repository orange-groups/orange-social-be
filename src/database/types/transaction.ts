import type { DrizzleService } from '../drizzle.service';

/** Internal persistence contract; never expose in HTTP DTOs. */
export type DatabaseTransaction = Parameters<
  Parameters<DrizzleService['db']['transaction']>[0]
>[0];
