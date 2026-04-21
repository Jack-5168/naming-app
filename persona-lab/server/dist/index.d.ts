/**
 * Persona Lab Server
 * Main entry point
 */
import winston from 'winston';
import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
declare const logger: winston.Logger;
declare const app: import("express-serve-static-core").Express;
export { app, prisma, logger };
//# sourceMappingURL=index.d.ts.map