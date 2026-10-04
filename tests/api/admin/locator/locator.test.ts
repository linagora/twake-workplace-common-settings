import { describe, it, expect, beforeEach, vi } from 'vitest';

import { GET } from '$src/routes/api/admin/locator/[email]/+server';

const { mockGetWorkplaceFqdn } = vi.hoisted(() => ({
	mockGetWorkplaceFqdn: vi.fn()
}));

vi.mock('$lib/services/locator', () => ({
	default: {
		getWorkplaceFqdn: mockGetWorkplaceFqdn
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

function makeRequestEvent({ user, email }: { user?: string; email?: string }) {
	const locals: any = {};
	if (user !== undefined) {
		locals.user = user;
	}

	const params: any = {};
	if (email !== undefined) {
		params.email = email;
	}

	return { locals, params };
}

describe('GET /api/admin/locator/:email', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return 401 if unauthorized', async () => {
		const event: any = makeRequestEvent({ email: 'alice@example.com' });

		await expect(GET(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 401));
		expect(mockGetWorkplaceFqdn).not.toHaveBeenCalled();
	});

	it('should return 400 if the email is invalid', async () => {
		const event: any = makeRequestEvent({ user: 'internal', email: 'not-an-email' });

		await expect(GET(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 400));
		expect(mockGetWorkplaceFqdn).not.toHaveBeenCalled();
	});

	it('should return 404 if the email is unknown', async () => {
		mockGetWorkplaceFqdn.mockResolvedValue(null);
		const event: any = makeRequestEvent({ user: 'internal', email: 'alice@example.com' });

		await expect(GET(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 404));
	});

	it('should return the workplace address', async () => {
		mockGetWorkplaceFqdn.mockResolvedValue('alice.twake.app');
		const event: any = makeRequestEvent({ user: 'internal', email: 'alice@example.com' });

		const response = await GET(event);

		expect(mockGetWorkplaceFqdn).toHaveBeenCalledWith('alice@example.com');
		expect(await (response as Response).json()).toEqual({ workplaceFqdn: 'alice.twake.app' });
	});
});
