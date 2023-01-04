/*!
 * JSTable v1.6.5
 */

const JSTableDefaultConfig = {
    perPage: 5,
    perPageSelect: [5, 10, 15, 20, 25],

    sortable: true,
    searchable: true,

    // Pagination
    nextPrev: true,
    firstLast: false,
    prevText: "&lsaquo;",
    nextText: "&rsaquo;",
    firstText: "&laquo;",
    lastText: "&raquo;",
    ellipsisText: "&hellip;",
    truncatePager: true,
    pagerDelta: 2,

    classes: {
        top: "dt-top",
        info: "dt-info",
        input: "dt-input",
        table: "dt-table",
        bottom: "dt-bottom",
        search: "dt-search",
        sorter: "dt-sorter",
        wrapper: "dt-wrapper",
        dropdown: "dt-dropdown",
        ellipsis: "dt-ellipsis",
        selector: "dt-selector",
        container: "dt-container",
        pagination: "dt-pagination",
        loading: "dt-loading",
        message: "dt-message"
    },

    // Customise the display text
    labels: {
        placeholder: "Search...",
        perPage: "{select} entries per page",
        noRows: "No entries found",
        info: "Showing {start} to {end} of {rows} entries",
        loading: "Loading...",
        infoFiltered: "Showing {start} to {end} of {rows} entries (filtered from {rowsTotal} entries)"
    },

    // Customise the layout
    layout: {
        top: "{select}{search}",
        bottom: "{info}{pager}"
    },

    // server side
    serverSide: false,
    // total count of elements
    deferLoading: null,
    // url for queries
    ajax: null,
    // additional params
    ajaxParams: {},
    // query params names
    queryParams: {
        page: 'page',
        search: 'search',
        sortColumn: 'sortColumn',
        sortDirection: 'sortDirection',
        perPage: 'perPage'
    },
    // append query params on events
    addQueryParams: true,

    rowAttributesCreator: null,

    searchDelay: null,

    // http method request, default is: GET
    method: 'GET'
};

class JSTable {

    constructor(element, config = {}) {

        let DOMElement = element;
        if (typeof element === "string") {
            DOMElement = document.querySelector(element);
        }
        if (DOMElement === null) {
            return;
        }

        this.config = this._merge(JSTableDefaultConfig, config);
        this.table = new JSTableElement(DOMElement);

        // reset values
        this.currentPage = 1;
        this.columnRenderers = [];
        this.columnsNotSearchable = [];
        this.searchQuery = null;
        this.sortColumn = null;
        this.sortDirection = "asc";
        this.isSearching = false;
        this.dataCount = null;
        this.filteredDataCount = null;
        this.searchTimeout = null;


        // init pager
        this.pager = new JSTablePager(this);

        // build wrapper and layout
        this._build();
        this._buildColumns();

        // update table content
        this.update(this.config.deferLoading === null);

        // bind events
        this._bindEvents();

        this._emit("init");

        this._parseQueryParams();

    }

    _build() {
        var that = this;
        let options = this.config;

        this.wrapper = document.createElement("div");
        this.wrapper.className = options.classes.wrapper;


        var inner = [
            "<div class='", options.classes.top, "'>", options.layout.top, "</div>",
            "<div class='", options.classes.container, "'>",
            "<div class='", options.classes.loading, " hidden'>", options.labels.loading, "</div>",
            "</div>",
            "<div class='", options.classes.bottom, "'>", options.layout.bottom, "</div>"
        ].join("");

        // Info placement
        inner = inner.replace(
            "{info}",
            "<div class='" + options.classes.info + "'></div>"
        );

        // Per Page Select
        if (options.perPageSelect) {
            var wrap = [
                "<div class='", options.classes.dropdown, "'>",
                "<label>", options.labels.perPage, "</label>",
                "</div>"
            ].join("");

            // Create the select
            var select = document.createElement("select");
            select.className = options.classes.selector;

            // Create the options
            options.perPageSelect.forEach(function (val) {
                var selected = val === options.perPage;
                var option = new Option(val, val, selected, selected);
                select.add(option);
            });

            // Custom label
            wrap = wrap.replace("{select}", select.outerHTML);

            // Selector placement
            inner = inner.replace(/\{select\}/g, wrap);
        } else {
            inner = inner.replace(/\{select\}/g, "");
        }

        // Searchable
        if (options.searchable) {
            var form = [
                "<div class='", options.classes.search, "'>",
                "<input class='", options.classes.input, "' placeholder='", options.labels.placeholder, "' type='text'>",
                "</div>"
            ].join("");

            // Search input placement
            inner = inner.replace(/\{search\}/g, form);
        } else {
            inner = inner.replace(/\{search\}/g, "");
        }

        // Add table class

        this.table.element.classList.add(options.classes.table);

        // Pager

        inner = inner.replace(
            "{pager}",
            "<div class='" + options.classes.pagination + "'></div>"
        );

        this.wrapper.innerHTML = inner;

        this.table.element.parentNode.replaceChild(this.wrapper, this.table.element);

        let container = this.wrapper.querySelector("." + options.classes.container);
        container.appendChild(this.table.element);

        this._updatePagination();
        this._updateInfo();

    }

    async update(reloadData = true) {
        var that = this;

        // no overlap please
        if (this.currentPage > this.pager.getPages()) {
            this.currentPage = this.pager.getPages();
        }

        let loading = that.wrapper.querySelector(" ." + that.config.classes.loading);
        loading.classList.remove("hidden");

        // Create Header
        this.table.header.getCells().forEach(function (tableHeaderCell, columnIndex) {

            let th = that.table.head.rows[0].cells[columnIndex];
            th.innerHTML = tableHeaderCell.getInnerHTML();
            if (tableHeaderCell.classes.length > 0) {
                th.className = tableHeaderCell.classes.join(" ");
            }
            for (let attr in tableHeaderCell.attributes) {
                th.setAttribute(attr, tableHeaderCell.attributes[attr]);
            }
            th.setAttribute("data-sortable", tableHeaderCell.isSortable);
        });

        if (reloadData) {

            // Change Table Body
            return this.getPageData(this.currentPage).then(function (data) {

                that.table.element.classList.remove("hidden");
                that.table.body.innerHTML = "";

                data.forEach(function (row) {
                    that.table.body.appendChild(row.getFormatted(that.columnRenderers, that.config.rowAttributesCreator));
                });

                loading.classList.add("hidden");

            }).then(function () {

                // No Data
                if (that.getDataCount() <= 0) {
                    that.wrapper.classList.remove("search-results");
                    that.setMessage(that.config.labels.noRows);
                }

                that._emit("update");

            }).then(function () {
                that._updatePagination();
                that._updateInfo();
            });
        }
        // when there is a defer loading (server side) the initial data needs to be formatted
        else {
            that.table.element.classList.remove("hidden");
            that.table.body.innerHTML = "";

            // No Data
            if (this.getDataCount() <= 0) {
                that.wrapper.classList.remove("search-results");
                that.setMessage(that.config.labels.noRows);
            }

            this._getData().forEach(function (row) {
                that.table.body.appendChild(row.getFormatted(that.columnRenderers, that.config.rowAttributesCreator));
            });
            loading.classList.add("hidden");

        }
    }

    _updatePagination() {
        // change Pagination
        let pagination = this.wrapper.querySelector(" ." + this.config.classes.pagination);
        pagination.innerHTML = "";
        pagination.appendChild(this.pager.render(this.currentPage));


    }

    _updateInfo() {
        // change info
        let info = this.wrapper.querySelector(" ." + this.config.classes.info);

        let infoString = this.isSearching ? this.config.labels.infoFiltered : this.config.labels.info;
        if (info && infoString.length) {
            var string = infoString
                .replace("{start}", this.getDataCount() > 0 ? this._getPageStartIndex() + 1 : 0)
                .replace("{end}", this._getPageEndIndex() + 1)
                .replace("{page}", this.currentPage)
                .replace("{pages}", this.pager.getPages())
                .replace("{rows}", this.getDataCount())
                .replace("{rowsTotal}", this.getDataCountTotal());

            info.innerHTML = string;
        }
    }

    _getPageStartIndex() {
        return (this.currentPage - 1) * this.config.perPage;
    }
    _getPageEndIndex() {
        let end = this.currentPage * this.config.perPage - 1;
        return end > this.getDataCount() - 1 ? this.getDataCount() - 1 : end;
    }

    _getData() {
        this._emit("getData", this.table.dataRows);
        return this.table.dataRows.filter(function (row) {
            return row.visible;
        });
    }

    _fetchData() {
        var that = this;

        let params = {
            "searchQuery": this.searchQuery,
            "sortColumn": this.sortColumn,
            "sortDirection": this.sortDirection,
            "start": this._getPageStartIndex(),
            "length": this.config.perPage,
            "datatable": 1
        };

        params = Object.assign({}, this.config.ajaxParams, params);

        let query = this.config.ajax + '?' + this._queryParams(params);

        return fetch(query, {
            method: this.config.method,
            credentials: "same-origin",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }).then(function (response) {
            return response.json();
        }).then(function (json) {
            that._emit("fetchData", json);
            that.dataCount = json.recordsTotal;
            that.filteredDataCount = json.recordsFiltered;
            return json.data;
        }).then(function (data) {
            let rows = [];
            // Create Table
            data.forEach(function (dataRow) {
                rows.push(JSTableRow.createFromData(dataRow));
            });
            return rows;
        }).catch(function (error) {
            console.error(error);
        });
    }

    _queryParams(params) {
        return Object.keys(params)
            .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
            .join('&');
    }

    getDataCount() {
        if (this.isSearching) {
            return this.getDataCountFiltered();
        }
        return this.getDataCountTotal();
    }

    getDataCountFiltered() {
        if (this.config.serverSide) {
            return this.filteredDataCount;
        }
        return this._getData().length;
    }

    getDataCountTotal() {
        if (this.config.serverSide) {
            return this.config.deferLoading !== null ? this.config.deferLoading : this.dataCount;
        }
        return this.table.dataRows.length;
    }

    getPageData() {
        // return the ajax data with a promise
        if (this.config.serverSide) {
            return this._fetchData();
        }


        // filter the table data and return a promise
        let start_idx = this._getPageStartIndex();
        var end_idx = this._getPageEndIndex();
        return Promise.resolve(this._getData()).then(function (data) {
            return data.filter(function (row, idx) {
                return idx >= start_idx && idx <= end_idx;
            });
        });
    }

    async search(query) {
        var that = this;

        // do nothing if the query has not changed since last search
        if (this.searchQuery === query.toLowerCase()) {
            return false;
        }

        this.searchQuery = query.toLowerCase();

        // do not perform another search before enough time has passed since the last
        if (this.config.searchDelay) {
            if (this.searchTimeout) {
                return false;
            } else {
                // trigger search again after the given delay
                this.searchTimeout = setTimeout(
                    function () {
                        that.searchTimeout = null;
                    },
                    this.config.searchDelay
                );
            }
        }

        // reset parameters
        this.currentPage = 1;
        this.isSearching = true;

        // reset search
        if (!this.searchQuery.length) {
            // reset data to all table data
            this.table.dataRows.forEach(function (row) {
                row.visible = true;
            });
            this.isSearching = false;
            that.wrapper.classList.remove("search-results");
            that.update();
            return false;
        }

        // search in all the data
        if (!this.config.serverSide) {
            this.table.dataRows.forEach(function (row) {
                row.visible = false;

                var match = that.searchQuery.split(" ").reduce(function (bool, word) {
                    var hasMatch = false;

                    let cells = row.getCells();

                    // only use searchable cells
                    cells = cells.filter(function (cell, idx) {
                        if (that.columnsNotSearchable.indexOf(idx) < 0) {
                            return true;
                        }
                    });

                    hasMatch = cells.some(function (cell, idx) {
                        if (cell.getTextContent().toLowerCase().indexOf(word) >= 0) {
                            return true;
                        }
                    });

                    return bool && hasMatch;
                }, true);

                if (match) {
                    row.visible = true;
                }
            });
        }
        this.wrapper.classList.add("search-results");

        return this.update().then(function () {
            that._emit("search", query);
        });

    }

    sort(column, direction, initial = false) {
        var that = this;
        this.sortColumn = column || 0;
        this.sortDirection = direction;

        if (this.sortColumn < 0 || this.sortColumn > this.table.getColumnCount() - 1) {
            return false;
        }

        var node = this.table.header.getCell(this.sortColumn);
        var rows = this.table.dataRows;


        //Remove class from previus columns
        let tableHeaderCells = this.table.header.getCells();
        tableHeaderCells.forEach(function (tableHeaderCell) {
            tableHeaderCell.removeClass("asc");
            tableHeaderCell.removeClass("desc");
        });

        node.addClass(this.sortDirection);

        if (!this.config.serverSide) {
            rows = rows.sort(function (a, b) {
                var ca = a.getCellTextContent(that.sortColumn).toLowerCase();
                var cb = b.getCellTextContent(that.sortColumn).toLowerCase();

                // replace $, coma, whitespace and %
                ca = ca.replace(/(\$|\,|\s|%)/g, "");
                cb = cb.replace(/(\$|\,|\s|%)/g, "");

                ca = !isNaN(ca) && ca !== '' ? parseFloat(ca) : ca;
                cb = !isNaN(cb) && cb !== '' ? parseFloat(cb) : cb;

                // Sort empty cells or cells with different content types (numeric/not numeric) to top
                if ((ca === '' && cb !== '') || (!isNaN(ca) && isNaN(cb))) {
                    return that.sortDirection === "asc" ? 1 : -1;
                }
                if ((ca !== '' && cb === '') || (isNaN(ca) && !isNaN(cb))) {
                    return that.sortDirection === "asc" ? -1 : 1;
                }

                // Otherwise
                if (that.sortDirection === "asc") {
                    return ca === cb ? 0 : ca > cb ? 1 : -1;
                }
                return ca === cb ? 0 : ca < cb ? 1 : -1;

            });

            // replace dataRows with sorted rows
            this.table.dataRows = rows;

        }

        // initial sorting with serverSide on is not needed
        if (!this.config.serverSide || !initial) {
            this.update();
        }

        this._emit("sort", this.sortColumn, this.sortDirection);

    }

    async paginate(new_page) {
        var that = this;

        this.currentPage = new_page;
        return this.update().then(function () {
            that._emit("paginate", that.currentPage, new_page);
        });
    }

    _setQueryParam(key, value) {
      if (!this.config.addQueryParams) return;

      const url = new URL(window.location.href);
      url.searchParams.set(this.config.queryParams[key], value);
      window.history.replaceState(null, null, url);
    }

    _bindEvents() {
        var that = this;


        this.wrapper.addEventListener("click", function (event) {
            var node = event.target;

            if (node.hasAttribute("data-page")) {
                event.preventDefault();
                let new_page = parseInt(node.getAttribute("data-page"), 10);
                that.paginate(new_page);

                that._setQueryParam('page', new_page)
            }

            if (node.nodeName === "TH" && node.hasAttribute("data-sortable")) {

                if (node.getAttribute("data-sortable") === "false")
                    return false;

                event.preventDefault();
                let sortDirection = node.classList.contains("asc") ? "desc" : "asc";
                that.sort(node.cellIndex, sortDirection);

                that._setQueryParam('sortColumn', node.cellIndex)
                that._setQueryParam('sortDirection', sortDirection)
            }
        });

        if (this.config.perPageSelect) {
            this.wrapper.addEventListener("change", function (e) {
                var node = e.target;
                if (node.nodeName === "SELECT" && node.classList.contains(that.config.classes.selector)) {
                    e.preventDefault();
                    let value = parseInt(node.value, 10);
                    that._emit("perPageChange", that.config.perPage, value);
                    that.config.perPage = value;
                    that.update();

                    that._setQueryParam('perPage', value)
                }
            });
        }

        if (this.config.searchable) {
            this.wrapper.addEventListener("keyup", function (e) {
                if (e.target.nodeName === "INPUT" && e.target.classList.contains(that.config.classes.input)) {
                    e.preventDefault();
                    that.search(e.target.value);

                    that._setQueryParam('search', e.target.value)
                }
            });
        }
    }

    on(event, callback) {
        this.events = this.events || {};
        this.events[event] = this.events[event] || [];
        this.events[event].push(callback);
    }

    off(event, callback) {
        this.events = this.events || {};
        if (event in this.events === false)
            return;
        this.events[event].splice(this.events[event].indexOf(callback), 1);
    }

    _emit(event) {
        this.events = this.events || {};
        if (event in this.events === false)
            return;
        for (var i = 0; i < this.events[event].length; i++) {
            this.events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
        }
    }

    setMessage(message) {
        var colspan = this.table.getColumnCount();

        var node = document.createElement("tr");
        node.innerHTML = '<td class="' + this.config.classes.message + '" colspan="' +
            colspan +
            '">' +
            message +
            "</td>";

        this.table.body.innerHTML = "";

        this.table.body.appendChild(node);
    }

    _buildColumns() {
        var that = this;

        /**
         * change sortable attribute of columns:
         * - a global definition of the sortable attribute of the table can be overwritten 
         *   by a "data-sortable" attribute on the table header or 
         *   by a custom column definitions attribute "sortable"
         * - a custom column definitions attribute "sortable" can be overwritten
         *   by a "data-sortable" attribute on the table header
         * - a "data-sortable" attribute on the table header cannot be overwritten    
         * 
         * the initial sort column/direction can be defined on the table header (data-sort) or
         * on the custom column definitions (attribute "sort") with possible values "asc"/"desc"
         * - a custom column definitions attribute is overwritten by a "data-sort" attribute
         * - since sorting is only supported for 1 column at the same time the last defined column is used 
         */

        let initialSortColumn = null;
        let initialSortDirection = null;

        /**
         * Process custom column definitions
         */
        if (this.config.columns) {

            this.config.columns.forEach(function (columnsDefinition) {

                // convert single column selection to array
                if (!isNaN(columnsDefinition.select)) {
                    columnsDefinition.select = [columnsDefinition.select];
                }

                // Add the data attributes to the th elements
                columnsDefinition.select.forEach(function (column) {
                    var tableHeaderCell = that.table.header.getCell(column);

                    // Skip missing
                    if (tableHeaderCell === undefined) {
                        return;
                    }

                    /**
                     * Rendering
                     */
                    if (columnsDefinition.hasOwnProperty("render") && typeof columnsDefinition.render === "function") {
                        that.columnRenderers[column] = columnsDefinition.render;
                    }

                    /**
                     * Sortable
                     */
                    if (columnsDefinition.hasOwnProperty("sortable")) {

                        let sortable = false;
                        if (tableHeaderCell.hasSortable) {
                            sortable = tableHeaderCell.isSortable;
                        } else {
                            sortable = columnsDefinition.sortable;
                            tableHeaderCell.setSortable(sortable);
                        }


                        if (sortable) {

                            tableHeaderCell.addClass(that.config.classes.sorter);

                            // save sortable column/direction
                            // when there is one selected column in columns definition
                            // and this column should be sortable
                            if (columnsDefinition.hasOwnProperty("sort") && columnsDefinition.select.length === 1) {
                                initialSortColumn = columnsDefinition.select[0];
                                initialSortDirection = columnsDefinition.sort;
                            }
                        }
                    }

                    /**
                     * Searchable (not serverside)
                     */
                    if (columnsDefinition.hasOwnProperty("searchable")) {
                        tableHeaderCell.addAttribute("data-searchable", columnsDefinition.searchable);

                        if (columnsDefinition.searchable === false) {
                            that.columnsNotSearchable.push(column);
                        }
                    }

                });
            });
        }

        /**
         * Process data-attributes 
         */
        this.table.header.getCells().forEach(function (tableHeaderCell, columnIndex) {

            if (tableHeaderCell.isSortable === null) {
                tableHeaderCell.setSortable(that.config.sortable);
            }

            if (tableHeaderCell.isSortable) {
                tableHeaderCell.addClass(that.config.classes.sorter);

                if (tableHeaderCell.hasSort) {
                    initialSortColumn = columnIndex;
                    initialSortDirection = tableHeaderCell.sortDirection;
                }
            }
        });


        // sort the table by the last column which is marked to be sorted
        if (initialSortColumn !== null) {
            that.sort(initialSortColumn, initialSortDirection, true);
        }

    }

    // deep merge two objects
    _merge(current, update) {
        var that = this;
        Object.keys(current).forEach(function (key) {
            if (update.hasOwnProperty(key) && typeof update[key] === "object" && !(update[key] instanceof Array) && update[key] !== null) {
                that._merge(current[key], update[key]);
            } else if (!update.hasOwnProperty(key)) {
                update[key] = current[key];
            }
        });
        return update;
    }

    async _parseQueryParams() {
        const urlParams = new URLSearchParams(window.location.search);

        let perPage = urlParams.get(this.config.queryParams.perPage);
        if (perPage) {
          perPage = parseInt(perPage)
          this.config.perPage = perPage;
          let selectors = this.wrapper.querySelectorAll('.' + this.config.classes.selector);
          selectors.forEach(function (selector) {
            selector.querySelectorAll('option').forEach(opt => opt.removeAttribute('selected'))
            selector.value = perPage;
            selector.querySelector(`option[value='${perPage}']`).setAttribute('selected', '')
          });
          this.update()
        }

        // parse search param and populate search
        let search = urlParams.get(this.config.queryParams.search);
        if (search) {
            let searchfields = this.wrapper.querySelectorAll('.' + this.config.classes.input);
            searchfields.forEach(function (searchfield) {
                searchfield.value = search;
            });
            await this.search(search);
        }

        // parse page param and navigate to page
        let page = urlParams.get(this.config.queryParams.page);
        if (page) {
            await this.paginate(parseInt(page));
        }

        let sortColumn = urlParams.get(this.config.queryParams.sortColumn);
        if (sortColumn) {
          sortColumn = parseInt(sortColumn)
          let sortDirection = urlParams.get(this.config.queryParams.sortDirection);
          sortDirection = (sortDirection == undefined) ? "asc" : sortDirection;
          this.sort(sortColumn, sortDirection);
        }
    }
}

class JSTableElement {

    constructor(element) {
        this.element = element;

        this.body = this.element.tBodies[0];
        this.head = this.element.tHead;

        // we are modifying the data of the underlying element so first 
        // make a copy for row extraction
        //let table = this.element.cloneNode(true);

        // Process table rows 
        this.rows = Array.from(this.element.rows).map(function (row, rowID) {
            return new JSTableRow(row, row.parentNode.nodeName, rowID);
        });

        this.dataRows = this._getBodyRows();
        this.header = this._getHeaderRow();

    }

    _getBodyRows() {
        return this.rows.filter(function (row) {
            return !row.isHeader && !row.isFooter;
        });
    }

    _getHeaderRow() {
        return this.rows.find(function (row) {
            return row.isHeader;
        });
    }

    getColumnCount() {
        return this.header.getColumnCount();
    }

    getFooterRow() {
        return this.rows.find(function (row) {
            return row.isFooter;
        });
    }

}

class JSTableRow {

    constructor(element, parentName = "", rowID = null) {
        // Process row cells 
        this.cells = Array.from(element.cells).map(function (cell) {
            return new JSTableCell(cell);
        });

        this.d = this.cells.length;

        //this.element = element;
        this.isHeader = parentName === "THEAD";
        this.isFooter = parentName === "TFOOT";
        this.visible = true;
        this.rowID = rowID;

        var that = this;
        // parse attributes
        this.attributes = {};
        [...element.attributes].forEach(function (attr) {
            that.attributes[attr.name] = attr.value;
        });
    }

    getCells() {
        return Array.from(this.cells);
    }

    getColumnCount() {
        return this.cells.length;
    }

    getCell(cell) {
        return this.cells[cell];
    }

    // for sorting
    getCellTextContent(cell) {
        return this.getCell(cell).getTextContent();
    }

    static createFromData(data) {
        let tr = document.createElement("tr");

        if(data.hasOwnProperty("data")){
            if(data.hasOwnProperty("attributes")){
                for (const attrName in data["attributes"]) {
                    tr.setAttribute(attrName, data["attributes"][attrName])
                }
            }
            data = data["data"];
        }

        data.forEach(function (cellData) {
            let td = document.createElement("td");
            td.innerHTML = !!cellData && cellData.hasOwnProperty("data") ? cellData["data"]: cellData;

            if(!!cellData && cellData.hasOwnProperty("attributes")){
                for (const attrName in cellData["attributes"]) {
                    td.setAttribute(attrName, cellData["attributes"][attrName])
                }
            }
            tr.appendChild(td);
        });
        return new JSTableRow(tr);
    }

    getFormatted(columnRenderers, rowAttributesCreator = null) {
        let tr = document.createElement("tr");
        var that = this;

        for (let attr in this.attributes) {
            tr.setAttribute(attr, this.attributes[attr]);
        }
        
        let rowAttributes = !!rowAttributesCreator ? rowAttributesCreator.call(this, this.getCells()): {};
        for (const attrName in rowAttributes) {
            tr.setAttribute(attrName, rowAttributes[attrName])
        }

        this.getCells().forEach(function (cell, idx) {
            var td = document.createElement('td');
            td.innerHTML = cell.getInnerHTML();
            if (columnRenderers.hasOwnProperty(idx)) {
                td.innerHTML = columnRenderers[idx].call(that, cell.getElement(), idx);
            }
            if (cell.classes.length > 0) {
                td.className = cell.classes.join(" ");
            }
            for (let attr in cell.attributes) {
                td.setAttribute(attr, cell.attributes[attr]);
            }
            tr.appendChild(td);
        });
        return tr;

    }

    setCellClass(cell, className) {
        this.cells[cell].addClass(className);
    }
}

class JSTableCell {

    constructor(element) {
        this.textContent = element.textContent;
        this.innerHTML = element.innerHTML;
        this.className = "";
        this.element = element;

        this.hasSortable = element.hasAttribute("data-sortable");
        this.isSortable = this.hasSortable ? element.getAttribute("data-sortable") === "true" : null;

        this.hasSort = element.hasAttribute("data-sort");
        this.sortDirection = element.getAttribute("data-sort");

        this.classes = [];

        var that = this;
        // parse attributes
        this.attributes = {};
        [...element.attributes].forEach(function (attr) {
            that.attributes[attr.name] = attr.value;
        });
    }

    getElement() {
        return this.element;
    }

    // for sorting
    getTextContent() {
        return this.textContent;
    }

    // for rendering
    getInnerHTML() {
        return this.innerHTML;
    }

    setClass(className) {
        this.className = className;
    }

    setSortable(value) {
        this.isSortable = value;
        //tableHeaderCell.setAttribute("data-sortable", sortable);
    }

    addClass(value) {
        this.classes.push(value);
    }

    removeClass(value) {
        if (this.classes.indexOf(value) >= 0) {
            this.classes.splice(this.classes.indexOf(value), 1);
        }
    }

    addAttribute(key, value) {
        this.attributes[key] = value;
    }
}

class JSTablePager {

    constructor(instance) {
        this.instance = instance;
    }

    getPages() {
        let pages = Math.ceil(this.instance.getDataCount() / this.instance.config.perPage);
        return pages === 0 ? 1 : pages;
    }

    render() {
        var options = this.instance.config;
        let pages = this.getPages();

        let ul = document.createElement("ul");
        if (pages > 1) {

            let prev = this.instance.currentPage === 1 ? 1 : this.instance.currentPage - 1,
                next = this.instance.currentPage === pages ? pages : this.instance.currentPage + 1;

            // first button
            if (options.firstLast) {
                ul.appendChild(this.createItem("pager", 1, options.firstText));
            }

            // prev button
            if (options.nextPrev) {
                ul.appendChild(this.createItem("pager", prev, options.prevText));
            }

            var pager = this.truncate();
            // append the links
            pager.forEach(function (btn) {
                ul.appendChild(btn);
            });

            // next button
            if (options.nextPrev) {
                ul.appendChild(this.createItem("pager", next, options.nextText));
            }

            // first button
            if (options.firstLast) {
                ul.appendChild(this.createItem("pager", pages, options.lastText));
            }


        }
        return ul;

    }

    createItem(className, pageNum, content, ellipsis) {
        let item = document.createElement("li");
        item.className = className;
        item.innerHTML = !ellipsis ? '<a href="#" data-page="' + pageNum + '">' + content + "</a>" : '<span>' + content + "</span>";
        return item;
    }

    isValidPage(page) {
        return page > 0 && page <= this.getPages();
    }

    truncate() {
        var that = this,
            options = that.instance.config,
            delta = options.pagerDelta * 2,
            currentPage = that.instance.currentPage,
            left = currentPage - options.pagerDelta,
            right = currentPage + options.pagerDelta,
            totalPages = this.getPages(),
            range = [],
            pager = [],
            lastIndex;

        if (!this.instance.config.truncatePager) {
            for (let i = 1; i <= this.getPages(); i++) {
                pager.push(this.createItem(i === currentPage ? "active" : "", i, i));
            }

        } else {
            if (currentPage < 4 - options.pagerDelta + delta) {
                right = 3 + delta;
            } else if (currentPage > this.getPages() - (3 - options.pagerDelta + delta)) {
                left = this.getPages() - (2 + delta);
            }

            // Get the links that will be visible
            for (var i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= left && i <= right)) {
                    range.push(i);
                }
            }

            range.forEach(function (index) {
                if (lastIndex) {
                    if (index - lastIndex == 2) {
                        pager.push(that.createItem("", lastIndex + 1, lastIndex + 1));
                    } else if (index - lastIndex != 1) {
                        // Create ellipsis node
                        pager.push(that.createItem(options.classes.ellipsis, 0, options.ellipsisText, true));
                    }
                }

                pager.push(that.createItem(index == currentPage ? "active" : "", index, index));
                lastIndex = index;
            });
        }

        return pager;
    }

}

window.JSTable = JSTable;
