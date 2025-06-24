import auth from '$services/auth';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		IDENTITY_PROVIDER_URL: 'https://idp.example.com/'
	}
}));

vi.mock('$services/logger', () => ({
	default: {
		getSubLogger: () => ({
			info: vi.fn(),
			error: vi.fn()
		})
	}
}));

describe('the auth service', () => {
	describe('the resolveOidcUser method', () => {
		it('should call the IDP userinfo endpoint with provided access token', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				json: () => Promise.resolve({ sub: '123' }),
				ok: true
			});

			await auth.resolveOidcUser('access_token');

			expect(global.fetch).toHaveBeenCalledWith('https://idp.example.com/oauth2/userinfo', {
				headers: {
					Accept: 'application/json',
					Authorization: 'Bearer access_token'
				}
			});
		});

		it('should return null if the IDP did not respond with ok', async () => {
			global.fetch = vi.fn().mockResolvedValue({});

			await expect(auth.resolveOidcUser('access_token')).resolves.toBeNull();
		});

		it('should return null if the response was not json', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				json: () => Promise.reject(),
				ok: true
			});

			await expect(auth.resolveOidcUser('access_token')).resolves.toBeNull();
		});

		it('should return null if the userinfo response did not contain a sub claim', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				json: () => Promise.resolve({ name: 'user', email: 'user@example.com' }),
				ok: true
			});

			await expect(auth.resolveOidcUser('access_token')).resolves.toBeNull();
		});

    it('should return the sub claim from the userinfo response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ sub: '123' }),
        ok: true
      });

      await expect(auth.resolveOidcUser('access_token')).resolves.toEqual('123');
    })
	});
});
