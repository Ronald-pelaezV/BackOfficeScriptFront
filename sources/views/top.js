/**
 * @file top.js
 * @description Provides the main layout with the side menu.
 */

import { JetView } from 'webix-jet';

/**
 * Main layout view.
 *
 * @description Displays the side menu and the area where the sub views are shown.
 *
 * @extends JetView
 */
export default class TopView extends JetView {

    /**
     * Configures the UI components of the layout.
     *
     * @returns {Object} The configuration object for the view.
     */
    config() {
        const menu = {
            view: 'sidebar',
            data: [{ id: 'users.list', value: 'Users', icon: 'wxi-user' }],

            /**
             * Navigates to the selected menu option.
             *
             * @param {string} id - The identifier of the selected option.
             * @returns {void}
             */
            onAfterSelect: (id) => {
                this.show(id);
            },
        };

        return { cols: [menu, { $subview: true }] };
    }
}
