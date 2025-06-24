import { error, type RequestHandler } from '@sveltejs/kit';
import loggerService, { type GenericLogger } from '$services/logger';
import settingsService from '$services/settings';
import { createUserSettingsSchema } from '$lib/schemas/user-settings';
import type { SettingsMessage } from '$types';

/**
 * User settings API logger
 *
 * @type {GenericLogger}
 */
const logger: GenericLogger = loggerService.getSubLogger({
	name: 'API',
	prefix: ['settings', 'provision']
});

export const POST: RequestHandler = async ({ locals, request }) => {
	try {
		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		if (!request.body) {
			logger.error('Missing body');

			throw error(400, 'Missing body');
		}

		let body: SettingsMessage;

		try {
			body = (await request.json()) as SettingsMessage;
		} catch (err) {
			logger.error('Invalid body', { error: err });

			throw error(400, 'Invalid JSON body');
		}

		const parsed = await createUserSettingsSchema.safeParseAsync(body);

		if (!parsed.success) {
			logger.error('Invalid data', { error: parsed.error.errors });

			throw error(400, 'Invalid data');
		}

		await settingsService.createUserSettings(body.nickname, body.payload, body.version);
		await settingsService.sendSettingsUpdateNotification(body.nickname);

		return new Response('ok', { status: 200 });
	} catch (err) {
    logger.error('Failed to create user settings', err);

		throw err;
	}
};
