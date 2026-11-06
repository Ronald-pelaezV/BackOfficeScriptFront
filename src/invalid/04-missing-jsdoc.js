/**
 * @file 04-missing-jsdoc.js
 * @description Contains functions without documentation.
 */

// ERRORES ESPERADOS: clase, método y función sin bloque JSDoc.



export class ReportView {
    config() {
        return { rows: [] };
    }
}

export function loadReport(id) {
    return id;
}
