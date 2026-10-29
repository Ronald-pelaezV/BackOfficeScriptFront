/**
 * @file 07-missing-throws.js
 * @description Contains a function that throws without documenting it.
 */

// ERROR ESPERADO: la función lanza un error pero no tiene @throws.

/**
 * Validates the user identifier.
 *
 * @param {string} userId - The user identifier.
 * @returns {boolean} Whether the identifier is valid.
 */
export function validateUserId(userId) {
    if (!userId) {
        throw new Error('Missing user identifier');
    }

    return true;
}
