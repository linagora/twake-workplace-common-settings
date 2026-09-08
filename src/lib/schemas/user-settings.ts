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
	phone: z.string().refine(isPhoneValid).optional(),
	matrix_id: z.string().optional().nullable(),
	display_name: z.string()
});

const hasSetting = (payload: object): boolean => Object.keys(payload).length > 0;

const hasSettingError = { message: 'At least one setting must be provided' };

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
		payload: userSettingsPayloadSchema.strict()
	})
	.strict();

/**
 * the schema for validating user settings update messages off the queue
 *
 * Non strict: a producer has no caller to hand a validation error back to, so
 * rejecting an unknown key would dead letter the message and lose the update.
 */
export const updateUserSettingsSchema = baseMessageSchema
	.extend({
		payload: userSettingsPayloadSchema.partial().refine(hasSetting, hasSettingError)
	})
	.strict();

/**
 * the schema for validating user settings update requests on the admin API
 *
 * Strict, unlike the queue schema: an unknown key here is a caller mistake worth a 400.
 */
export const adminUpdateUserSettingsSchema = baseMessageSchema
	.extend({
		payload: userSettingsPayloadSchema.strict().partial().refine(hasSetting, hasSettingError)
	})
	.strict();
