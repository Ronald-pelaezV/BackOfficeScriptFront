/**
 * @file 06-missing-returns.js
 * @description Contains functions with missing return documentation.
 */

// ERRORES ESPERADOS: falta @returns en funciones que retornan valor, y falta el tipo en @returns.

/**
 * Gets the user name.
 *@description Retrieves the name of the user from the user object.
 * 
 * @param {Object} user - The user data.
 * 
 * @returns {string} The user name.
 */
export function getUserName(user) {
    return user.name;
}

//comentt

/**
 * Gets the user email.
 * @description Retrieves the email of the user from the user object.
 * @param {Object} user - The user data 
 * @returns {string} The user email.
 */
export function getUserEmail(user) {
    return user.email;
}
