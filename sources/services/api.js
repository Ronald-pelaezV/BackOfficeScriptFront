/**
 * @file api.js
 * @description Provides the HTTP client used to call the BackOffice API.
 */

/**
 * Base URL of the API.
 */
const BASE_URL = '/api';

/**
 * Sends a request to the API.
 *
 * @param {string} method - The HTTP method.
 * @param {string} path - The resource path.
 * @param {Object} [data] - The data to send in the body.
 * @returns {Promise<Object>} The parsed response.
 * @throws {Error} When the server responds with an error status.
 */
export async function request(method, path, data) {
    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    return response.json();
}
