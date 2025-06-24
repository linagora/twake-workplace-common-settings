import validator from 'validator';

/**
 * Check if the given phone number is in valid E.164 format.
 *
 * @param {string} phone - the phone number to check.
 * @returns {boolean} - true if the phone number is valid, false otherwise.
 */
export const isPhoneValid = (phone: string): boolean =>
	/^\+[1-9]\d{10,14}$/.test(phone) && validator.isMobilePhone(phone);
