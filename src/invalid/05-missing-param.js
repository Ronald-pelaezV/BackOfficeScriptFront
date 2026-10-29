/**
 * @file 05-missing-param.js
 * @description Contains functions with incomplete parameter documentation.
 */

// ERRORES ESPERADOS: falta @param, falta el tipo y falta la descripción del parámetro.

/**
 * Loads the user list.
 *
 * @param {string} userId - The user identifier.
 * @returns {void}
 */
export function loadUsers(userId, filters) {
    // ...
}

/**
 * Selects a user.
 *
 * @param userId - The user identifier.
 * @returns {void}
 */
export function selectUser(userId) {
    // ...
}

/**
 * Deletes a user.
 *
 * @param {string} userId
 * @returns {void}
 */
export function deleteUser(userId) {
    // ...
}
