import { error, json, type RequestHandler } from '@sveltejs/kit';
import loggerService, { type GenericLogger } from '$services/logger';
import locatorService from '$lib/services/locator';
import { locatorLookupEmailSchema } from '$lib/schemas/locator';

const logger: GenericLogger = loggerService.getSubLogger({
	name: 'API',
	prefix: ['locator']
});

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		const parsed = locatorLookupEmailSchema.safeParse(params.email);

		if (!parsed.success) {
			throw error(400, 'Invalid email');
		}

		const workplaceFqdn = await locatorService.getWorkplaceFqdn(parsed.data);

		if (!workplaceFqdn) {
			throw error(404, 'Workplace address not found');
		}

		return json({ workplaceFqdn });
	} catch (err) {
		logger.error('Failed to look up workplace address', err);

		throw err;
	}
};
