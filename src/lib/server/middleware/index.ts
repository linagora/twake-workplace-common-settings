import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';
import LoggerService, { type GenericLogger } from '$services/logger';
import authService from '$services/auth';
import { GetRequestAccessToken } from '$utils';
import { OIDC_PROTECTED_APIS, PROTECTED_APIS } from '$utils/config';

/**
 * Logger instance for login actions
 * @type {GenericLogger}
 */
const logger: GenericLogger = LoggerService.getSubLogger({
	name: 'auth-middleware'
});

/**
 * Handles request authentication across routes
 *
 * @param {RequestEvent} event - the request event
 * @returns {Promise<void>}
 */
export const authenticate = async (event: RequestEvent): Promise<void> => {
	const { pathname } = event.url;
	const accessToken = GetRequestAccessToken(event);

	if (accessToken) {
		if (isProtectedApi(pathname)) {
			if (accessToken === env.SECRET_API_KEY) {
				logger.warn('Invalid API key', { pathname });
				return;
			}

			event.locals.user = 'internal';
			return;
		}

		if (isOidcProtected(pathname)) {
			const user = await authService.resolveOidcUser(accessToken);

			if (!user) {
				logger.warn('Invalid OIDC Access token');
				return;
			}

			event.locals.user = user;
			return;
		}
	}
};

/**
 * Checks if the path is a protected API
 *
 * @param {string} path - the path to check
 * @returns {boolean} - true if the path is a protected API, false otherwise
 */
const isProtectedApi = (path: string): boolean =>
	PROTECTED_APIS.some((api) => path.startsWith(api));

/**
 * Checks if the path is OIDC protected
 *
 * @param {string} path - the path to check
 * @returns {boolean} - true if the path is OIDC protected, false otherwise
 */
const isOidcProtected = (path: string): boolean =>
	OIDC_PROTECTED_APIS.some((route) => path.startsWith(route));
