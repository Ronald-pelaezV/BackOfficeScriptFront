/**
 * @file users.js
 * @description Provides the data access functions for the users.
 */

import { request } from '../services/api';

/**
 * Gets the list of users.
 *
 * @returns {Promise<Array>} The list of users.
 */
export function getUsers() {
    return request('GET', '/users');
}

/**
 * Deletes a user.
 *
 * @param {string} userId - The user identifier.
 * @returns {Promise<Object>} The server response.
 * @throws {Error} When the user identifier is empty.
 */
export function deleteUser(userId) {
    if (!userId) {
        throw new Error('The user identifier is required');
    }
    return request('DELETE', `/users/${userId}`);
}
