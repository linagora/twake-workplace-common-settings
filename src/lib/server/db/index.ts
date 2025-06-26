import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { DEFAULT_DB_TIMEOUT } from '$utils';

if (!env.DATABASE_URL && !building) {
	throw new Error('DATABASE_URL is not set');
}

const client = postgres(env.DATABASE_URL, { connect_timeout: DEFAULT_DB_TIMEOUT });

export const db = drizzle(client, { schema });
