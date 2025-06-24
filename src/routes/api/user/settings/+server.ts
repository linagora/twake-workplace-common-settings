import { error, json, type RequestHandler } from '@sveltejs/kit';
import loggerService, { type GenericLogger } from '$services/logger';
import settingsService from '$services/settings';

/**
 * User settings logger
 *
 * @type {GenericLogger}
 */
const logger: GenericLogger = loggerService.getSubLogger({
	name: 'API',
	prefix: ['user', 'settings']
});

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		const settings = await settingsService.getUserSettings(locals.user);

		if (!settings) {
			throw error(404, 'Settings not found');
		}

		return json(settings);
	} catch (err) {
		logger.error('Failed to get user settings', err);

		throw err;
	}
};
