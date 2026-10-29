/**
 * @file 09-inline-callbacks.js
 * @description Contains Webix callbacks declared inline without documentation.
 */

// ERRORES ESPERADOS: callbacks dentro del objeto de configuración sin JSDoc.

/**
 * Builds the grid configuration.
 *
 * @returns {Object} The grid configuration.
 */
export function buildGrid() {
    return {
        view: 'datatable',
        onItemClick: (id) => {
            console.log(id);
        },
        on: {
            onAfterLoad: function () {
                console.log('loaded');
            }
        }
    };
}
