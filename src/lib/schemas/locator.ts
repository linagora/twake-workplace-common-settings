import { z } from 'zod';

export const locatorLookupEmailSchema = z.string().trim().email();
