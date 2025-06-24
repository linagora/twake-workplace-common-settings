import { error, json, type RequestHandler } from '@sveltejs/kit';
import loggerService, { type GenericLogger } from '$services/logger';
import settingsService from '$lib/services/settings';
import { validateNickName } from '$utils/user';
import { updateUserSettingsSchema } from '$lib/schemas/user-settings';

/**
 * User settings logger
 *
 * @type {GenericLogger}
 */
const logger: GenericLogger = loggerService.getSubLogger({
	name: 'API',
	prefix: ['settings']
});

/**
 * Fetches user settings
 *
 * @type {RequestHandler} - the request handler
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		const { username } = params;

		if (!username || !validateNickName(username)) {
			throw error(400, 'Invalid username');
		}

		const settings = await settingsService.getUserSettings(username);

		if (!settings) {
			throw error(404, 'Settings not found');
		}

		return json(settings);
	} catch (err) {
		logger.error('Failed to get user settings', err);

		throw err;
	}
};

/**
 * Updates user settings
 *
 * @type {RequestHandler} - the request handler
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	try {
		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		const { username } = params;

		if (!username) {
			throw error(400, 'Missing username');
		}

		if (!validateNickName(username)) {
			throw error(400, 'Invalid username');
		}

		const body = await request.json();
		const parsed = await updateUserSettingsSchema.safeParseAsync(body);

		if (!parsed.success) {
			logger.error('Invalid data', { error: parsed.error.errors });

			throw error(400, 'Invalid data');
		}

		await settingsService.updateUserSettings(username, body);
		await settingsService.sendSettingsUpdateNotification(username);

		return new Response('ok', { status: 200 });
	} catch (err) {
		logger.error('Failed to update user settings', err);

		throw err;
	}
};
