/**
 * @file list.js
 * @description Provides the user list view.
 */

import { JetView } from 'webix-jet';
import { getUsers, deleteUser } from '../../models/users';
import { formatDate } from '../../utils/format';

/**
 * User list view.
 *
 * @description Displays the users in a datatable and handles the delete action.
 *
 * @extends JetView
 */
export default class UserListView extends JetView {

    /**
     * Configures the UI components of the view.
     *
     * @returns {Object} The configuration object for the view.
     */
    config() {
        return {
            view: 'datatable',
            localId: 'grid',
            columns: [
                { id: 'name', header: 'Name', fillspace: true },
                {
                    id: 'createdAt',
                    header: 'Created',

                    /**
                     * Formats the creation date column.
                     *
                     * @param {Object} obj - The row data.
                     * @returns {string} The formatted date.
                     */
                    template: function (obj) {
                        return formatDate(obj.createdAt);
                    },
                },
            ],
            onClick: {

                /**
                 * Deletes the user of the clicked row.
                 *
                 * @param {Event} ev - The click event.
                 * @param {Object} id - The identifier of the clicked cell.
                 * @returns {boolean} False to stop the default behavior.
                 */
                'wxi-trash': (ev, id) => {
                    this.removeUser(id.row);
                    return false;
                },
            },
        };
    }

    /**
     * Loads the users when the view is initialized.
     *
     * @returns {Promise<void>} Resolves when the users are loaded.
     */
    async init() {
        this.$$('grid').parse(await getUsers());
    }

    /**
     * Removes a user from the server and from the datatable.
     *
     * @param {string} userId - The user identifier.
     * @returns {Promise<void>} Resolves when the user is removed.
     */
    async removeUser(userId) {
        await deleteUser(userId);
        this.$$('grid').remove(userId);
    }
}
