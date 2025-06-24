import { z } from 'zod';
import { validateNickName, isPhoneValid } from '$utils';

/**
 * the core user settings payload schema
 *
 * to be shared between settings operations
 */
export const userSettingsPayloadSchema = z.object({
	language: z.string().default('en'),
	timezone: z.string(),
	avatar: z.string().url(),
	last_name: z.string(),
	first_name: z.string(),
	email: z.string().email(),
	phone: z.string().refine(isPhoneValid),
	matrix_id: z.string().optional().nullable(),
	display_name: z.string()
});

/**
 * base schema for user settings operations
 */
const baseMessageSchema = z.object({
	source: z.string(),
	nickname: z.string().refine(validateNickName),
	request_id: z.string(),
	timestamp: z.number().positive(),
	version: z.number()
});

/**
 * the schema for validating user settings creation payload
 */
export const createUserSettingsSchema = baseMessageSchema
	.extend({
		payload: userSettingsPayloadSchema
	})
	.strict();

/**
 * the schema for validating user settings update payload
 */
export const updateUserSettingsSchema = baseMessageSchema
	.extend({
		payload: userSettingsPayloadSchema.partial().refine((obj) => Object.keys(obj).length > 0, {
			message: 'At least one setting must be provided'
		})
	})
	.strict();
