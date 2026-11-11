/**
 * @file tableInformeGerencial.js
 * @description Provides the management report (Informe Gerencial) table view.
 */
 
import {JetView} from "webix-jet"; // Importing JetView from webix-jet framework
import {allpayments} from "models/allpayments"; // Importing allpayments model
import {devConfig, profile} from "config/config"; // Importing configuration settings
 
/**
 * Management report table view.
 *
 * @description Displays the report grouped by partner and country, with bets, awards and GGR
 * per product (including predictive markets). In `ByProvider` mode each day is detailed by provider.
 *
 * @extends JetView
 */
export default class tableInformeGerencialView extends JetView {
 
    /**
     * Configures the view layout and components.
     *
     * @returns {Object} The configuration object for the view.
     */
    config() {
        const _ = this.app.getService("locale")._; // Localization service
        const dateFormat = webix.Date.dateToStr(this.app.config.dateFormat); // Date formatting function
 
        /**
         * Formats a percentage value.
         *
         * @param {number} value - The value to format.
         * @returns {string} The formatted percentage string.
         */
        function percentFormat(value) {
            return webix.i18n.numberFormat(value) + "%"; // Formatting value as percentage
        }
 
        // Extending the summTreeColumn filter to customize its behavior
        webix.ui.datafilter.summTreeColumn = webix.extend({
            /**
             * Refreshes the filter display with the calculated sum.
             *
             * @param {Object} master - The master data view.
             * @param {Object} node - The node to refresh.
             * @param {Object} value - The value object containing columnId.
             * @returns {void}
             */
            refresh: function (master, node, value) {
                var result = 0; // Variable to hold the sum result
                var resultFormat = 0; // Variable to hold the formatted result
 
                /**
                 * Adds the first level rows to the total.
                 *
                 * @param {Object} obj - The row data.
                 * @returns {void}
                 */
                master.data.each(function (obj) {
                    if (obj.$level == 1) result += obj[value.columnId]; // Summing values at level 1
                });
                // Formatting the result based on the columnId
                if (value.columnId === 'CantidadTickets') {
                    resultFormat = webix.i18n.intFormat(result);
                } else {
                    if (value.columnId === 'GgrPorc') {
                        resultFormat = webix.i18n.numberFormat(result) + "%";
                    } else {
                        resultFormat = webix.i18n.priceFormat(result);
                    }
                }
                node.firstChild.innerHTML = resultFormat; // Updating the node with the formatted result
            }
        }, webix.ui.datafilter.summColumn);
 
        return {
            rows: [{
                cols: [
                    {
                        view: "treetable", // Defining a tree table view
                        id: "treetable", // Unique identifier for the tree table
                        css: "webix_header_border webix_data_border webix_footer_border informeGerencial", // CSS classes for styling
                        scroll: "xy", // Enabling both horizontal and vertical scrolling
 
                        /**
                         * Expands all rows when the table is ready.
                         *
                         * @returns {void}
                         */
                        bready: function () {
                            this.openAll(); // Expanding all rows when ready
                        },
                        columns: [
                            {
                                id: "Fecha", // Column ID
                                header: _("Fecha"), // Column header with localization
                                width: 200, // Column width
 
                                /**
                                 * Renders the date cell, or the provider name in `ByProvider` mode.
                                 *
                                 * @param {Object} obj - The row data.
                                 * @param {Object} common - The common template helpers.
                                 * @returns {string} The cell HTML.
                                 */
                                template: (obj, common) => {
                                    if (obj.$group) return common.treetable(obj, common) + (obj.Fecha || obj.value); // Day groups show their date
                                    return this.mode === "ByProvider" ? common.treetable(obj, common) + obj.ProviderName : obj.Fecha; // Providers under each day
                                }
                            },
                            {
                                id: "CantidadTickets",
                                header: _("Cantidad Tickets"),
                                format: webix.i18n.intFormat, // Formatting function for integer values
                                width: 80
                            },
                            {
                                id: "Stake",
                                header: _("Apuesta"),
                                format: webix.i18n.priceFormat, // Formatting function for price values
                                width: 150
                            },
                            {
                                id: "LiveBets",
                                header: _("Apuestas LIVE"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "PrematchBets",
                                header: _("Apuestas PREMATCH"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "MixedBets",
                                header: _("Apuestas Mixtas"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "HorseRacingBets",
                                header: _("Apuestas HÍPICAS"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "VirtualBets",
                                header: _("Apuestas VIRTUALES"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "PredictionBets",
                                header: _("Apuestas PREDICTIVOS"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "StakePromedio",
                                header: _("Apuesta Promedio"),
                                format: webix.i18n.numberFormat,
                                width: 80
                            },
                            {
                                id: "TaxBet",
                                header: _("Impuesto Apuesta"),
                                format: webix.i18n.priceFormat,
                                width: 100,
                            },
                            {
                                id: "Tax",
                                header: _("Retenciones premios deportivas"),
                                width: 180,
                                sort: "int", // Sorting type for the column
                                format: webix.i18n.priceFormat,
                                exportType: "float" // Export type for the column
                            },
                            {
                                id: "Payout",
                                header: _("Premios"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "LiveAwards",
                                header: _("Premios LIVE"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "PrematchAwards",
                                header: _("Premios PREMATCH"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "MixedAwards",
                                header: _("Premios Mixtos"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "HorseRacingAwards",
                                header: _("Premios HÍPICAS"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "VirtualAwards",
                                header: _("Premios VIRTUALES"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "PredictionAwards",
                                header: _("Premios PREDICTIVOS"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "Bonos",
                                header: _("Bonos"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "BonosProveedor",
                                header: _("Bonos proveedor"),
                                format: webix.i18n.priceFormat,
                                width: 80
                            },
                            {
                                id: "Ggr",
                                header: _("GGR"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "ggrLive",
                                header: _("GGR LIVE"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "ggrPreMatch",
                                header: _("GGR PREMATCH"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "ggrMixed",
                                header: _("GGR Mixtos"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "ggrHorseRacing",
                                header: _("GGR HÍPICAS"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "ggrVirtual",
                                header: _("GGR VIRTUALES"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "GgrPrediction",
                                header: _("GGR PREDICTIVOS"),
                                format: webix.i18n.priceFormat,
                                width: 150
                            },
                            {
                                id: "GgrPorc",
                                header: _("GGR %"),
                                format: percentFormat, // Using the custom percentage format function
                                width: 100
                            },
                            {
                                id: "UsersRegistered",
                                header: _("Usuarios Registrados"),
                                format: webix.i18n.intFormat,
                                width: 90
                            },
                            {
                                id: "FirstDeposits",
                                header: _("Primeros Depósitos"),
                                format: webix.i18n.intFormat,
                                width: 100
                            },
                            {id: "Moneda", header: _("Moneda"), width: 75}, // Currency column
                            {id: "TotalJackpotPrizeSum", header: _("Suma Total Premio Jackpot"), width: 200}, // Total jackpot prize column
                        ],
                        on: {
                            /**
                             * Shows the loading overlay before loading data.
                             *
                             * @returns {void}
                             */
                            onBeforeLoad: function () {
                                this.showOverlay("<div id='contenedor'; class='container-preload'><div style='position: fixed; top: calc(50% - 57px);left: calc(50% - 60px);width: 120px;' class='progress'><div class='icon-preload girando'></div><div class='load-text'>Loading... </div></div></div>"); // Show loading overlay
                            },
 
                            /**
                             * Hides the loading overlay after data is loaded.
                             *
                             * @returns {void}
                             */
                            onAfterLoad: function () {
                                this.hideOverlay(); // Hide loading overlay
                            }
                        },
 
                        /**
                         * Shows the no data overlay when the grid is ready and empty.
                         *
                         * @returns {void}
                         */
                        ready: function () {
                            if (!this.count()) {
                                webix.extend(this, webix.OverlayBox); // Extending with overlay functionality
                                this.showOverlay("<div class='no-data' style='margin:75px; font-size:18px;'>" + _('No hay datos') + "</div>"); // Show no data overlay
                            }
                        },
                        autowidth: false, // Disable automatic width adjustment
                        math: true, // Enable mathematical operations
                        datafetch: 10, // Number of records to fetch at a time
                        pager: "pagerA" // Pager ID for pagination
                    }
                ]
            }]
        };
    }
 
    /**
     * Initializes the view and sets up event handlers.
     *
     * @param {Object} grid - The grid instance to initialize.
     * @returns {void}
     */
    init(grid) {
        grid = $$('treetable'); // Getting the tree table instance
        var url = devConfig.geturlApi() + "es/Financial/GetInformeGerencial"; // API endpoint for fetching data
 
        /**
         * Builds the partner group key.
         *
         * @param {Object} obj - The row data.
         * @returns {string} The partner icon HTML.
         */
        const partnerIcon = (obj) => "<i style='background-image:url(" + profile.Partners.filter((item) => {
            return item.id == obj.Partner
        })[0].image + ") !important;' class='partner " + obj.Partner + "'></i>"; // Partner grouping template
 
        /**
         * Builds the country group key.
         *
         * @param {Object} obj - The row data.
         * @returns {string} The country flag, name and partner icon HTML.
         */
        const countryKey = (obj) => "<i class='flags " + obj.CountryIcon + "'></i>" + obj.Pais + " " + partnerIcon(obj); // Country grouping template
 
        /**
         * Builds the group aggregations shared by every grouping level.
         *
         * @returns {Object} The group map (sums plus average stake and GGR %).
         */
        const buildGroupMap = () => {
            const map = {
                Partner: ["Partner"],
 
                /**
                 * Calculates the average stake of the group.
                 *
                 * @param {Object} prop - The property accessor.
                 * @param {Array<Object>} data - The grouped rows.
                 * @returns {number} The average stake.
                 */
                StakePromedio: ["StakePromedio", function (prop, data) { // Calculating average stake
                    if (!data.length) return 0;
                    var summ1 = 0; // Sum of stakes
                    var summ2 = 0; // Sum of ticket counts
                    for (var i = data.length - 1; i >= 0; i--) {
                        summ1 = summ1 + (Math.floor(data[i].Stake));
                        summ2 = summ2 + (Math.floor(data[i].CantidadTickets));
                    }
                    return (summ1 / summ2);
                }],
 
                /**
                 * Calculates the GGR percentage of the group.
                 *
                 * @param {Object} prop - The property accessor.
                 * @param {Array<Object>} data - The grouped rows.
                 * @returns {number} The GGR percentage.
                 */
                GgrPorc: ["GgrPorc", function (prop, data) { // Calculating GGR percentage
                    if (!data.length) return 0;
                    var summ1 = 0; // Sum of stakes
                    var summ2 = 0; // Sum of GGR
                    for (var i = data.length - 1; i >= 0; i--) {
                        summ1 = summ1 + (Math.floor(data[i].Stake));
                        summ2 = summ2 + (Math.floor(data[i].Ggr));
                    }
                    return (summ2 / summ1) * 100;
                }]
            };
            ["CantidadTickets", "TotalJackpotPrizeSum", "Stake", "LiveBets", "PrematchBets", "MixedBets", "HorseRacingBets",
                "VirtualBets", "PredictionBets", "TaxBet", "Tax", "Payout", "LiveAwards", "PrematchAwards", "MixedAwards",
                "HorseRacingAwards", "VirtualAwards", "PredictionAwards", "Bonos", "BonosProveedor", "Ggr", "ggrLive",
                "ggrPreMatch", "ggrMixed", "ggrHorseRacing", "ggrVirtual", "GgrPrediction", "UsersRegistered", "FirstDeposits"
            ].forEach((field) => map[field] = [field, "sum"]);
            return map;
        };
 
        /**
         * Groups the loaded data by partner and country, adding the day level in `ByProvider` mode.
         *
         * @returns {void}
         */
        grid.attachEvent("onAfterLoad", () => {
            const table = $$("treetable");
            const byProvider = this.mode === "ByProvider";
            if (byProvider) {
                table.data.group({ // Day total with its providers in the received order
 
                    /**
                     * Builds the day group key within the country.
                     *
                     * @param {Object} obj - The row data.
                     * @returns {string} The country key plus the date.
                     */
                    by: (obj) => countryKey(obj) + obj.Fecha,
                    map: Object.assign(buildGroupMap(), {
                        Fecha: ["Fecha"],
                        Pais: ["Pais"],
                        CountryIcon: ["CountryIcon"]
                    })
                });
            }
            table.data.group({ // Grouping by country
                by: countryKey,
                map: buildGroupMap()
            });
            table.data.group({ // Grouping by partner
                by: partnerIcon,
                map: buildGroupMap()
            });
        });
 
        /**
         * Handles the filter event: stores the view mode and reloads the grid.
         *
         * @param {Object} filterData - The filter criteria.
         * @returns {void}
         */
        this.on(this.app, "informeGerencial:filter", filterData => {
            this.mode = filterData.Mode; // Grouping applied on load
            var object = Object.entries(filterData); // Converting filter data to entries
            var string1 = ""; // Query string for API request
            for (var i = 0; i < object.length; i++) {
                if ((typeof object[i][1] !== "object") && (object[i][1] !== "")) {
                    if (object[i][0] == "Datepicker") {
                        var date = object[i][1].split(" - "); // Splitting date range
                        console.log(date);
                        string1 = string1 + '&dateFrom=' + date[0]; // Adding start date to query
                        string1 = string1 + '&dateTo=' + date[1]; // Adding end date to query
                    } else {
                        if (object[i][0] != "Sort" && object[i][0] != "Dir" && object[i][0] != "Date") {
                            string1 = string1 + '&' + object[i][0] + '=' + object[i][1]; // Adding other filters to query
                        } else {
                            if (object[i][0] == "Date") {
                                var date = object[i][1].replace(" 00:00:00", ""); // Formatting date
                                string1 = string1 + '&dateFrom=' + date; // Adding date to query
                                string1 = string1 + '&dateTo=' + date; // Adding date to query
                            }
                        }
                    }
                } else {
                    if ((typeof object[i][1] === "object")) {
                        var object2 = Object.entries(object[i][1]); // Converting nested filter data to entries
                        for (var j = 0; j < object2.length; j++) {
                            if (object2[j][1] !== null) {
                                if (object2[j][0] === "start") {
                                    var d = new Date(object2[j][1]); // Creating date object for start date
                                    var dateFrom = "dateFrom=" + ((d.getFullYear())) + ":" + ("00" + (d.getMonth() + 1)).slice(-2) + ":" + ("00" + d.getDate()).slice(-2) + " " + ("00" + d.getHours()).slice(-2) + ":" + ("00" + d.getMinutes()).slice(-2) + ":" + ("00" + d.getSeconds()).slice(-2); // Formatting start date
                                    string1 = string1 + '&' + dateFrom; // Adding start date to query
                                } else {
                                    if (object2[j][0] === "end") {
                                        var d = new Date(object2[j][1]); // Creating date object for end date
                                        var dateTo = "dateTo=" + ((d.getFullYear())) + ":" + ("00" + (d.getMonth() + 1)).slice(-2) + ":" + ("00" + d.getDate()).slice(-2) + " " + ("00" + d.getHours()).slice(-2) + ":" + ("00" + d.getMinutes()).slice(-2) + ":" + ("00" + d.getSeconds()).slice(-2); // Formatting end date
                                        string1 = string1 + '&' + dateTo; // Adding end date to query
                                    }
                                }
                            }
                        }
                    }
                }
            }
            grid.clearAll(); // Clearing the grid data
            $$("consultDesk").define("disabled", true); // Disabling the consult desk during loading
            grid.load(url + '?start=0&count=' + grid.data.$pagesize + string1).then((response) => {
                $$("consultDesk").define("disabled", false); // Enabling consult desk after loading
            }).catch((e) => {
                $$("consultDesk").define("disabled", false); // Enabling consult desk on error
            });
            $$("filterPopup").hide(); // Hiding the filter popup
        });
 
        /**
         * Handles the row click event and sends the user id.
         *
         * @param {Object} id - The identifier of the clicked row.
         * @param {Event} e - The click event.
         * @param {HTMLElement} node - The clicked cell node.
         * @returns {void}
         */
        grid.attachEvent("onItemClick", function (id, e, node) {
            var item = this.getItem(id); // Getting the clicked item
            this.$scope.app.callEvent("user:id", [item.Id]); // Triggering user ID event
        });
 
        /**
         * Handles the player selection event and reloads the grid for that player.
         *
         * @param {string} Id - The player identifier.
         * @returns {void}
         */
        this.on(this.app, "player:select", Id => {
            grid.load(grid.data.url + '?start=0&count=' + grid.data.$pagesize + '&PlayerId=' + Id); // Loading grid data based on selected player
        });
    }
}
