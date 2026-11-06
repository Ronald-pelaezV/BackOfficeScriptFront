/**
 * @file tesreal.js
 * @description Provides the transactions report view for the BackOffice.
 */

import { JetView } from 'webix-jet';

/**
 * Maximum number of rows per page.
 */
const PAGE_SIZE = 50;

/**
 * Formats an amount as currency.
 *
 * @param {number} amount - The amount to format.
 * @param {string} currency - The ISO currency code.
 * @returns {string} The formatted amount.
 */
export function formatAmount(amount, currency) {
    return `${currency} ${amount.toFixed(2)}`;
}

/**
 * Validates the date range of the filter.
 *
 * @param {Date} from - The start date.
 * @param {Date} to - The end date.
 * @returns {boolean} True when the range is valid.
 * @throws {Error} When the start date is after the end date.
 */
function validateRange(from, to) {
    if (from > to) {
        throw new Error('Invalid range');
    }
    return true;
}

/**
 * Builds the query string for the report request.
 *
 * @param {Object} filters - The filter values.
 * @returns {string} The encoded query string.
 */
const buildQuery = (filters) => new URLSearchParams(filters).toString();

/**
 * Normalizes a row received from the server.
 *
 * @param {Object} row - The raw row.
 * @returns {Object} The normalized row.
 */
const normalizeRow = function (row) {
    return { ...row, amount: Number(row.amount) };
};

/**
 * Transactions report view.
 *
 * @description Displays the transactions list and handles the filters.
 *
 * @extends JetView
 */
export default class TransactionsView extends JetView {

    /**
     * Configures the UI components of the view.
     *
     * @returns {Object} The configuration object for the view.
     */
    config() {
        const grid = {
            view: 'datatable',
            id: 'transactionsGrid',

            /**
             * Handles the row selection event.
             *
             * @param {Object} id - The identifier of the selected row.
             * @returns {void}
             */
            onItemClick: (id) => {
                this.showDetail(id.row);
            },

            /**
             * Formats the amount column.
             *
             * @param {Object} obj - The row data.
             * @returns {string} The formatted amount.
             */
            template: function (obj) {
                return formatAmount(obj.amount, obj.currency);
            },
        };

        return { rows: [grid] };
    }

    /**
     * Loads the transactions into the datatable.
     *
     * @param {Object} filters - The filter criteria.
     * @returns {Promise<void>} Resolves when the data is loaded.
     * @throws {Error} When the date range is invalid.
     */
    async loadTransactions(filters) {
        validateRange(filters.from, filters.to);
        const data = await webix.ajax(`/api/transactions?${buildQuery(filters)}&size=${PAGE_SIZE}`);
        this.$$('transactionsGrid').parse(data.json().map(normalizeRow));
    }

    /**
     * Shows the detail of a transaction.
     *
     * @param {string} rowId - The transaction identifier.
     * @returns {void}
     */
    showDetail(rowId) {
        this.app.show(`/top/transaction.detail?id=${rowId}`);
    }
}
