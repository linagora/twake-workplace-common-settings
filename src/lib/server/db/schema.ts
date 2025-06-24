import { pgTable, integer, text, jsonb, index } from 'drizzle-orm/pg-core';
import type { UserSettings, Nullable } from '$types';

/**
 * the settings table schema.
 *
 * this is used to store user settings in PG
 */
export const userSettingsTable = pgTable(
	'user_settings',
	{
		nickname: text().notNull().unique().primaryKey(),
		settings: jsonb('settings').notNull().$type<Partial<Nullable<UserSettings>>>(),
		version: integer('version').default(1).notNull()
	},
	(table) => [index('nickname_idx').on(table.nickname)]
);
