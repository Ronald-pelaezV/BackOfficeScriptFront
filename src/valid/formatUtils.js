/**
 * @file formatUtils.js
 * @description Provides helper functions to format values shown in the BackOffice.
 */

/**
 * Formats an amount as currency.
 *
 * @description Converts a number into a string with two decimals.
 *
 * @param {number} amount - The amount to format.
 * @param {string} currency - The currency code.
 * @returns {string} The formatted amount.
 * @throws {Error} When the amount is not a number.
 */
export function formatCurrency(amount, currency) {
    if (typeof amount !== 'number') {
        throw new Error('Invalid amount');
    }

    return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Builds the full name of a user.
 *
 * @param {string} firstName - The first name of the user.
 * @param {string} lastName - The last name of the user.
 * @returns {string} The full name.
 */
const buildFullName = (firstName, lastName) => {
    return `${firstName} ${lastName}`.trim();
};

/**
 * Clears the active filters.
 *
 * @returns {void}
 */
function clearFilters() {
    // ...
}

export { buildFullName, clearFilters };
