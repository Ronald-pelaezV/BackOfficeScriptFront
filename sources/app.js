/**
 * @file app.js
 * @description Entry point of the BackOffice application.
 */

import { JetApp } from 'webix-jet';

/**
 * BackOffice application.
 *
 * @description Configures the routes and starts the Webix Jet application.
 *
 * @extends JetApp
 */
export default class BackOfficeApp extends JetApp {

    /**
     * Creates the application with the default configuration.
     *
     * @param {Object} config - Additional configuration values.
     */
    constructor(config) {
        super({ id: 'backoffice', start: '/top/users.list', ...config });
    }

    /**
     * Starts the application when the page is ready.
     *
     * @returns {void}
     */
    start() {
        webix.ready(() => this.render());
    }
}
