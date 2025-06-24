import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { concatUrl, getUrl } from '$utils/url';
import LoggerService, { type GenericLogger } from '$services/logger';
import { OIDC_USERINFO_PATH } from '$utils/config';

class AuthService {
	private logger: GenericLogger;
	private readonly DEFAULT_HEADERS = {
		Accept: 'application/json'
	};
	private oidcUserInfoUrl = '';

	constructor() {
		this.logger = LoggerService.getSubLogger({
			name: 'auth'
		});

		if (!env.IDENTITY_PROVIDER_URL) {
			this.logger.error('Missing identity provider url');

			if (!building) {
				throw new Error('Missing identity provider url');
			}
		}

    const url = getUrl(env.IDENTITY_PROVIDER_URL);

		this.oidcUserInfoUrl = concatUrl(url, OIDC_USERINFO_PATH);
	}

	/**
	 * Resolve the OIDC user from the access token
	 *
	 * @param {string} accessToken - the access token
	 * @returns {Promise<string | null>} - the user id
	 */
	resolveOidcUser = async (accessToken: string): Promise<string | null> => {
		try {
			const response = await fetch(this.oidcUserInfoUrl, {
				headers: {
					...this.DEFAULT_HEADERS,
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (!response.ok) {
				this.logger.error('Failed to resolve OIDC user', {
					status: response.status,
					statusText: response.statusText
				});

				return null;
			}

			const { sub } = await response.json();

			if (!sub) {
				this.logger.error('Missing sub in OIDC userinfo response', {
					status: response.status,
					statusText: response.statusText
				});

				return null;
			}

			return sub;
		} catch (error) {
			this.logger.error('Failed to resolve OIDC user', { error });

			return null;
		}
	};
}

export default new AuthService();
