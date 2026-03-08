import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sabiright';

export const db = drizzle(DATABASE_URL, { schema });
