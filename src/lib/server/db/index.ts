import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

if (!env.DATABASE_URL && !building) {
	throw new Error('DATABASE_URL is not set');
}

const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });
