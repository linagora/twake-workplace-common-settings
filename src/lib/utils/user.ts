/**
 * Checks if a nickname is valid.
 *
 * a valid username must be:
 *  - 3–30 characters long.
 *  - can contain letters (a-z), numbers (0-9), and periods (.).
 *  - username cannot contain two periods in a row.
 *  - username cannot end or start with a period.
 *
 * @param {string} nickName - the username to check.
 * @returns {boolean} - true if the username is valid, false otherwise.
 */
export const validateNickName = (nickName: string): boolean => {
	if (/^(?!.*\.{2,})[a-zA-Z0-9](?:[a-zA-Z0-9.]{1,28})[a-zA-Z0-9]$/g.test(nickName) === false) {
		return false;
	}

	if (/^\d+$/.test(nickName)) {
		return false;
	}

	return true;
};
