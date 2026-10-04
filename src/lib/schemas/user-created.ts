import { z } from 'zod';

export const userCreatedSchema = z.object({
	internalEmail: z.string().trim().email(),
	workplaceFqdn: z.string().trim().min(1)
});
