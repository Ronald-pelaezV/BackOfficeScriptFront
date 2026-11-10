/**
 * @file format.js
 * @description Provides helper functions to format values in the views.
 */

/**
 * Formats a date as day/month/year.
 *
 * @param {Date|string} value - The date to format.
 * @returns {string} The formatted date.
 */
export const formatDate = (value) => webix.Date.dateToStr('%d/%m/%Y')(new Date(value));

/**
 * Formats an amount as currency.
 *
 * @param {number} amount - The amount to format.
 * @param {string} currency - The ISO currency code.
 * @returns {string} The formatted amount.
 */
export const formatAmount = function (amount, currency) {
    return `${currency} ${amount.toFixed(2)}`;
};
