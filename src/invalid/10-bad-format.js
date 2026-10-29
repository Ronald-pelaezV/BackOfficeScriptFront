/**
 * @file 10-bad-format.js
 * @description Contains JSDoc blocks with formatting problems.
 */

// ERRORES ESPERADOS: líneas sin asterisco, tag desconocido y alineación incorrecta.

/**
 Loads the user list.

 @returns {void}
 */
export function loadUsers() {
    // ...
}

/**
 * Selects a user.
 *
 * @unknowntag something
 * @param {string} userId - The user identifier.
 * @returns {void}
 */
export function selectUser(userId) {
    // ...
}

/**
   * Deletes a user.
 *
 * @param {string} userId - The user identifier.
 * @returns {void}
 */
export function deleteUser(userId) {
    // ...
}
