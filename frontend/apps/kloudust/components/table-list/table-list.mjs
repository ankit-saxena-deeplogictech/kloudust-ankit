/**
 * Interprets and runs table list files. Renders the
 * UI for the tables. This component is a table UI generator
 * basically.
 *
 * tabledef attribute contains the table as a Base64 JSON. It can
 * have second level mustache using {{{mustache_start}}} and {{{mustache_end}}}
 * to wrap the second level templates.
 *
 * Each tabledef should either contain a static table as a table object or
 * have its load_javascript return such a table. The structure of this object is
 * { keys: [list of keys whose value will be combined with the i18nPrefix to generate header titles],
 *   table: [array of objects in {key (same as keys above): value} pairs] }
 *
 * Declarative rendering keys (all optional, no CSS allowed in tabledefs):
 *  - columns: [{key, type: "main"|"mono"|"muted"|"badge", badgemap: {value: variant, "*": fallback},
 *              priority: 2|3, sub: "<key>", subtype: "mono", sortable: true,
 *              sorttype: "num"|"date"|"text", sortkey: "<key>"}]
 *              type/priority give the cell its look and responsive rank;
 *              sub renders a second, quieter line inside the same cell
 *              (.cell-sub) so two related fields share one column;
 *              sortable makes the header a client-side sort toggle, sorting on
 *              sortkey (default: key) with sorttype deciding the comparison —
 *              use sortkey to sort a formatted column by its raw field.
 *  - searchbar: true — client-side text filter across the row.
 *  - filterkey: "<column>" — chips built from that column's distinct values.
 *  - pagesize: <n> — client-side pagination.
 *  - selectable: true — checkbox column, select-all and the bulk action bar.
 *  - bulkactions: [{label, command, args: [{key|const}], danger, confirm}] —
 *              runs command once per selected row via cmdmanager.runCloudCommand.
 *              Destructive ones require a typed acknowledgement first.
 *  - emptystate: {title, message}
 *  - popupform: {rolelist} — row actions as a native menu on row click.
 *  - rowactions: true — moves that same menu onto a trailing kebab column
 *              (.col-actions) instead of the row click, which frees the row
 *              click for clickrow_command. Requires popupform. Without it the
 *              legacy click-the-row-for-actions behaviour is unchanged.
 *  - clickrow_command: "<id>" — row click opens that command (detail pages).
 *  - embedded: true — skip the page heading (rendering inside a tab).
 *
 * clickrow_javascript runs on every row click in all modes. Raw HTML/CSS
 * injection (onclickrow_html, bottom_bar_html, style) is not supported —
 * tabledefs are data only.
 *
 * (C) 2023 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

const COMPONENT_PATH = $$.libutil.getModulePath(import.meta), PAGER_MAX_BUTTONS = 7,
    SKELETON_ROWS = 5, SKELETON_DEFAULT_COLUMNS = 5;

const i18n = {
    "en": {ClickToCopy: "Shift+click to copy", Copied: "Copied", TLNoDataTitle: "Nothing here yet",
        TLNoDataMessage: "No records were found for this view.", TLAll: "All", TLSelected: "selected",
        TLClear: "Clear", TLShowing: "Showing", TLOf: "of", TLPrev: "Previous", TLNext: "Next",
        TLConfirmTitle: "Run this on the selected rows?", TLConfirmAck: "I understand this cannot be undone",
        TLConfirmGo: "Run it", TLCancel: "Cancel", TLNoMatch: "No rows match the current filters.",
        TLRowActions: "Row actions", TLRefresh: "Refresh"},
    "hi": {ClickToCopy: "Shift+click to copy", Copied: "Copied", TLNoDataTitle: "Nothing here yet",
        TLNoDataMessage: "No records were found for this view.", TLAll: "All", TLSelected: "selected",
        TLClear: "Clear", TLShowing: "Showing", TLOf: "of", TLPrev: "Previous", TLNext: "Next",
        TLConfirmTitle: "Run this on the selected rows?", TLConfirmAck: "I understand this cannot be undone",
        TLConfirmGo: "Run it", TLCancel: "Cancel", TLNoMatch: "No rows match the current filters.",
        TLRowActions: "Row actions", TLRefresh: "Refresh"},
    "ja": {ClickToCopy: "Shift+click to copy", Copied: "Copied", TLNoDataTitle: "Nothing here yet",
        TLNoDataMessage: "No records were found for this view.", TLAll: "All", TLSelected: "selected",
        TLClear: "Clear", TLShowing: "Showing", TLOf: "of", TLPrev: "Previous", TLNext: "Next",
        TLConfirmTitle: "Run this on the selected rows?", TLConfirmAck: "I understand this cannot be undone",
        TLConfirmGo: "Run it", TLCancel: "Cancel", TLNoMatch: "No rows match the current filters.",
        TLRowActions: "Row actions", TLRefresh: "Refresh"},
    "zh": {ClickToCopy: "Shift+click to copy", Copied: "Copied", TLNoDataTitle: "Nothing here yet",
        TLNoDataMessage: "No records were found for this view.", TLAll: "All", TLSelected: "selected",
        TLClear: "Clear", TLShowing: "Showing", TLOf: "of", TLPrev: "Previous", TLNext: "Next",
        TLConfirmTitle: "Run this on the selected rows?", TLConfirmAck: "I understand this cannot be undone",
        TLConfirmGo: "Run it", TLCancel: "Cancel", TLNoMatch: "No rows match the current filters.",
        TLRowActions: "Row actions", TLRefresh: "Refresh"}
}

async function elementConnected(host) {
    for (const lang of Object.keys(i18n)) await $$.libi18n.setI18NObject(lang, i18n[lang]);
    const tableDefinition = $$.libutil.base64ToString(host.dataset.tabledef);
    const expandedData = await $$.librouter.expandPageData(tableDefinition, undefined, {mustache_start: "{{{", mustache_end: "}}}"});
    let tableObject = JSON.parse(expandedData);
    tableObject.emptystate = {
        title: tableObject.emptystate?.title || await $$.libi18n.get("TLNoDataTitle"),
        message: tableObject.emptystate?.message || await $$.libi18n.get("TLNoDataMessage")};
    tableObject.i18nlabels = {
        all: await $$.libi18n.get("TLAll"), selected: await $$.libi18n.get("TLSelected"),
        clear: await $$.libi18n.get("TLClear"), showing: await $$.libi18n.get("TLShowing"),
        of: await $$.libi18n.get("TLOf"), prev: await $$.libi18n.get("TLPrev"), next: await $$.libi18n.get("TLNext"),
        confirmtitle: await $$.libi18n.get("TLConfirmTitle"), confirmack: await $$.libi18n.get("TLConfirmAck"),
        confirmgo: await $$.libi18n.get("TLConfirmGo"), cancel: await $$.libi18n.get("TLCancel"),
        nomatch: await $$.libi18n.get("TLNoMatch"), rowactions: await $$.libi18n.get("TLRowActions"),
        refresh: await $$.libi18n.get("TLRefresh")};
    if (tableObject.bulkactions) tableObject.bulkactions.forEach((action, index) => action.index = index);
    tableObject._view = {search: "", filter: "*", page: 1, sort: null};

    // First paint is a skeleton. load_javascript then runs from elementRendered
    // and the real rows are diff-patched in, so a slow lookup shows the shape of
    // the table instead of an empty screen.
    tableObject.loading = true;
    tableObject.skeletonrows = _skeletonRows(tableObject);
    table_list.setDataByHost(host, tableObject);
}

async function elementRendered(host) {
    const data = table_list.getDataByHost(host);

    if (data.loading) {
        const tableData = await _runOnLoadJavascript(data);
        table_list.setDataByHost(host, {...data, loading: false, skeletonrows: undefined, ...tableData});
        await host.render(false);   // non-initial render diffs against the skeleton
        return;                     // elementRendered fires again, with data
    }

    _applyView(table_list.getShadowRootByHost(host));
}

/** Placeholder rows matching the declared column count, so the skeleton has the
 *  same shape as the table that replaces it. */
function _skeletonRows(tabledef) {
    const columnCount = (tabledef.columns?.length || SKELETON_DEFAULT_COLUMNS)
        + (tabledef.selectable ? 1 : 0) + (tabledef.rowactions ? 1 : 0);
    return Array.from({length: SKELETON_ROWS},
        _ => ({cells: Array.from({length: columnCount}, _ => ({}))}));
}

async function close(element) {
    const onclose = await table_list.getAttrValue(table_list.getHostElement(element), "onclose");
    if (onclose && onclose.trim() != "") new Function(onclose)();
}

async function hidePopup(event) {
    const shadowRoot = table_list.getShadowRootByContainedElement(event.target);
    const divOnclick = shadowRoot.querySelector("div#onclick_html"), divHider = shadowRoot.querySelector("div#hider");
    divOnclick.classList.remove("visible"); divHider.classList.remove("visible");
    divOnclick.classList.remove("rowmenu-holder"); divOnclick.style.left = ""; divOnclick.style.top = "";
}

/* ------------------------------------------------------- view: search/filter/page */

function searchTable(event) {
    const host = table_list.getHostElement(event.target), data = table_list.getDataByHost(host);
    data._view.search = event.target.value.trim().toLowerCase(); data._view.page = 1;
    _applyView(table_list.getShadowRootByContainedElement(event.target));
}

function filterTable(element, value) {
    const host = table_list.getHostElement(element), data = table_list.getDataByHost(host);
    data._view.filter = value; data._view.page = 1;
    const shadowRoot = table_list.getShadowRootByHost(host);
    for (const chip of shadowRoot.querySelectorAll("div#tablefilters button.chip"))
        chip.setAttribute("aria-pressed", String(chip.dataset.value == value));
    _applyView(shadowRoot);
}

function gotoPage(element, page) {
    const host = table_list.getHostElement(element), data = table_list.getDataByHost(host);
    data._view.page = page; _applyView(table_list.getShadowRootByHost(host));
}

/** Toggles the sort on a sortable header: first click ascending, next descending,
 *  third clears it and restores the order the load javascript returned. */
function sortTable(element, columnIndex) {
    const host = table_list.getHostElement(element), shadowRoot = table_list.getShadowRootByHost(host);
    const data = table_list.getDataByHost(host);
    const header = (data.headers||[])[columnIndex]; if (!header?.sortable) return;

    const current = data._view.sort;
    if (!current || current.index != columnIndex) data._view.sort =
        {index: columnIndex, key: header.sortkey, type: header.sorttype, descending: false};
    else if (!current.descending) current.descending = true;
    else data._view.sort = null;
    data._view.page = 1;

    for (const th of shadowRoot.querySelectorAll("thead th.sortable")) th.setAttribute("aria-sort", "none");
    if (data._view.sort) element.setAttribute("aria-sort", data._view.sort.descending ? "descending" : "ascending");
    _applyView(shadowRoot);
}

/** Reorders the actual row elements, so selection state and every other view
 *  stage keep working on the same nodes. */
function _sortRows(shadowRoot, data) {
    const tbody = shadowRoot.querySelector("tbody"); if (!tbody) return;
    const current = [...tbody.querySelectorAll("tr")], rows = [...current], sort = data._view.sort;

    if (!sort) rows.sort((rowA, rowB) => parseInt(rowA.dataset.roworder) - parseInt(rowB.dataset.roworder));
    else {
        const valueOf = row => {
            try {return JSON.parse($$.libutil.base64ToString(row.dataset.rowdata))[sort.key];} catch (err) {return undefined;}
        };
        const direction = sort.descending ? -1 : 1;
        rows.sort((rowA, rowB) => _compareValues(valueOf(rowA), valueOf(rowB), sort.type, direction)
            || parseInt(rowA.dataset.roworder) - parseInt(rowB.dataset.roworder));
    }
    // _applyView runs on every keystroke; only touch the DOM if the order moved.
    if (rows.every((row, index) => row == current[index])) return;
    for (const row of rows) tbody.appendChild(row);
}

/** Returns the already-signed comparison. Direction is applied here rather than
 *  by the caller so blanks sink to the bottom whichever way the column is
 *  sorted — an empty cell is missing data, not the smallest value. */
function _compareValues(valueA, valueB, type, direction) {
    const isBlank = value => value === undefined || value === null || String(value).trim() == "";
    if (isBlank(valueA)) return isBlank(valueB) ? 0 : 1;
    if (isBlank(valueB)) return -1;

    if (type == "num") {
        const numberA = parseFloat(valueA), numberB = parseFloat(valueB);
        if (!isNaN(numberA) && !isNaN(numberB)) return (numberA - numberB) * direction;
    }
    if (type == "date") {
        const dateA = Date.parse(valueA), dateB = Date.parse(valueB);
        if (!isNaN(dateA) && !isNaN(dateB)) return (dateA - dateB) * direction;
    }
    return String(valueA).localeCompare(String(valueB), undefined, {numeric: true, sensitivity: "base"}) * direction;
}

/** Single source of truth for what is on screen: sort, then text search, then
 *  chip filter, then pagination over whatever survived. */
function _applyView(shadowRoot) {
    if (!shadowRoot) return;
    const host = shadowRoot.host, data = table_list.getDataByHost(host); if (!data?._view) return;
    const {search, filter} = data._view, pagesize = parseInt(data.pagesize)||0;
    _sortRows(shadowRoot, data);
    const allRows = [...shadowRoot.querySelectorAll("tbody tr")];

    const matching = allRows.filter(row => {
        const matchesSearch = !search || row.textContent.toLowerCase().includes(search);
        const matchesFilter = filter == "*" || (row.dataset.filter||"") == filter;
        return matchesSearch && matchesFilter;
    });

    const pages = pagesize ? Math.max(Math.ceil(matching.length/pagesize), 1) : 1;
    if (data._view.page > pages) data._view.page = pages;
    const page = data._view.page, from = pagesize ? (page-1)*pagesize : 0,
        to = pagesize ? from+pagesize : matching.length;

    for (const row of allRows) row.classList.add("hide");
    for (const row of matching.slice(from, to)) row.classList.remove("hide");

    const noMatch = shadowRoot.querySelector("div#tablenomatch");
    if (noMatch) noMatch.classList.toggle("hide", matching.length > 0 || allRows.length == 0);

    _renderPager(shadowRoot, data, matching.length, page, pages, from, to);
    _refreshSelectionState(shadowRoot);
}

function _renderPager(shadowRoot, data, total, page, pages, from, to) {
    const foot = shadowRoot.querySelector("div#tablefoot"); if (!foot) return;
    if (!parseInt(data.pagesize) || total == 0) {foot.classList.add("hide"); return;}
    foot.classList.remove("hide");

    const labels = data.i18nlabels;
    shadowRoot.querySelector("span#tablecount").textContent =
        `${labels.showing} ${Math.min(from+1, total)}–${Math.min(to, total)} ${labels.of} ${total}`;

    let start = 1, end = pages;
    if (pages > PAGER_MAX_BUTTONS) {
        start = Math.max(1, page - Math.floor(PAGER_MAX_BUTTONS/2));
        end = Math.min(pages, start + PAGER_MAX_BUTTONS - 1);
        start = Math.max(1, end - PAGER_MAX_BUTTONS + 1);
    }
    let html = `<button ${page<=1?"disabled":""} aria-label="${labels.prev}"
        onclick="monkshu_env.components['table-list'].gotoPage(this, ${page-1})">‹</button>`;
    for (let index = start; index <= end; index++) html += `<button ${index==page?'aria-current="true"':""}
        onclick="monkshu_env.components['table-list'].gotoPage(this, ${index})">${index}</button>`;
    html += `<button ${page>=pages?"disabled":""} aria-label="${labels.next}"
        onclick="monkshu_env.components['table-list'].gotoPage(this, ${page+1})">›</button>`;
    shadowRoot.querySelector("div#tablepager").innerHTML = html;
}

/* ------------------------------------------------------------------ selection */

function rowSelected(element) {_refreshSelectionState(table_list.getShadowRootByContainedElement(element));}

function selectAll(element) {
    const shadowRoot = table_list.getShadowRootByContainedElement(element);
    // Select-all applies to what is actually on screen, never to hidden rows.
    for (const row of shadowRoot.querySelectorAll("tbody tr:not(.hide)")) {
        const box = row.querySelector("input[data-select-row]"); if (box) box.checked = element.checked;
    }
    _refreshSelectionState(shadowRoot);
}

function clearSelection(element) {
    const shadowRoot = table_list.getShadowRootByContainedElement(element);
    for (const box of shadowRoot.querySelectorAll("input[data-select-row]")) box.checked = false;
    const selectAllBox = shadowRoot.querySelector("input#tableselectall"); if (selectAllBox) selectAllBox.checked = false;
    _refreshSelectionState(shadowRoot);
}

function _refreshSelectionState(shadowRoot) {
    const bulkbar = shadowRoot.querySelector("div#tablebulkbar"); if (!bulkbar) return;
    const selected = _selectedRows(shadowRoot);
    bulkbar.classList.toggle("active", selected.length > 0);
    const count = shadowRoot.querySelector("span#tablebulkcount");
    if (count) count.textContent = `${selected.length} ${table_list.getDataByHost(shadowRoot.host).i18nlabels.selected}`;

    const visible = [...shadowRoot.querySelectorAll("tbody tr:not(.hide) input[data-select-row]")];
    const selectAllBox = shadowRoot.querySelector("input#tableselectall");
    if (selectAllBox) selectAllBox.checked = visible.length > 0 && visible.every(box => box.checked);
}

const _selectedRows = shadowRoot => [...shadowRoot.querySelectorAll("input[data-select-row]:checked")]
    .map(box => {try {return JSON.parse($$.libutil.base64ToString(box.closest("tr").dataset.rowdata));} catch (err) {return null;}})
    .filter(row => row);

/* ---------------------------------------------------------------- bulk actions */

function bulkAction(element, actionIndex) {
    const host = table_list.getHostElement(element), shadowRoot = table_list.getShadowRootByHost(host);
    const data = table_list.getDataByHost(host), action = (data.bulkactions||[])[actionIndex];
    const selected = _selectedRows(shadowRoot); if (!action || !selected.length) return;

    if (action.danger) {_openBulkConfirm(shadowRoot, data, action, selected); return;}
    _executeBulk(shadowRoot, action, selected);
}

function _openBulkConfirm(shadowRoot, data, action, selected) {
    const overlay = shadowRoot.querySelector("div#tableconfirm"); if (!overlay) return;
    shadowRoot.querySelector("div#tableconfirmwhat").textContent =
        (action.confirm || `${action.label} will run on ${selected.length} row(s). This cannot be undone.`)
            .replace("{count}", selected.length);
    shadowRoot.querySelector("div#tableconfirmlist").textContent =
        selected.map(row => row[action.args?.[0]?.key] || row.name_raw || row.name || "").filter(name => name).join("\n");
    const ack = shadowRoot.querySelector("input#tableconfirmack"), go = shadowRoot.querySelector("button#tableconfirmgo");
    ack.checked = false; go.disabled = true;
    data._pendingbulk = {action, selected};
    overlay.classList.add("open");
}

function confirmAckChanged(element) {
    const shadowRoot = table_list.getShadowRootByContainedElement(element);
    shadowRoot.querySelector("button#tableconfirmgo").disabled = !element.checked;
}

function closeBulkConfirm(element) {
    table_list.getShadowRootByContainedElement(element).querySelector("div#tableconfirm")?.classList.remove("open");
}

function confirmBulk(element) {
    const host = table_list.getHostElement(element), shadowRoot = table_list.getShadowRootByHost(host);
    const data = table_list.getDataByHost(host), pending = data._pendingbulk;
    closeBulkConfirm(element); delete data._pendingbulk;
    if (pending) _executeBulk(shadowRoot, pending.action, pending.selected);
}

/** Runs the action's command once per selected row, in order. Output goes to
 *  the alerts stack through cmdmanager, exactly as a form submit would. */
async function _executeBulk(shadowRoot, action, selected) {
    const cmdmanager = monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager;
    const bulkbar = shadowRoot.querySelector("div#tablebulkbar");
    bulkbar?.classList.add("running");

    for (const row of selected) {
        const params = [], values = {};
        (action.args||[]).forEach((arg, index) => {
            const name = `arg${index}`; params.push(name);
            values[name] = arg.const !== undefined ? arg.const : (row[arg.key] !== undefined ? row[arg.key] : "");
        });
        try {await cmdmanager.runCloudCommand(action.command, params, values);}
        catch (err) {LOG.error(`Bulk ${action.command} failed: ${err}`);}
    }

    bulkbar?.classList.remove("running");
    cmdmanager.reloadForm();    // re-read the table so the result is visible
}

/* --------------------------------------------------------------- row clicking */

async function rowClicked(event, rowdataJSON) {
    // Neither selecting a row nor reaching for its kebab counts as opening it.
    if (event.target.closest("td.col-check") || event.target.closest("td.col-actions")) return;
    const rowDataJSON = rowdataJSON?$$.libutil.base64ToString(rowdataJSON):undefined, rowData = JSON.parse(rowDataJSON||"{}");
    const data = table_list.getDataByContainedElement(event.target);
    await _runRowOnClickJavascript(event, rowData);

    if (data.clickrow_command) {    // detail-page mode: pin the row (clickrow_javascript) then open the command
        const cmdmanager = monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager;
        cmdmanager.registerCommand({id: data.clickrow_command});
        cmdmanager.cmdClicked(data.clickrow_command); return;
    }

    // Legacy mode only: with rowactions the menu lives on the kebab instead.
    if (data.popupform && !data.rowactions) await _displayRowActionsMenu(event, data);
}

/** Kebab column handler. Pins the row exactly as a row click would, then opens
 *  the same popupform menu anchored under the button. */
async function rowActions(event, rowdataJSON) {
    event.stopPropagation();
    const rowDataJSON = rowdataJSON?$$.libutil.base64ToString(rowdataJSON):undefined, rowData = JSON.parse(rowDataJSON||"{}");
    const data = table_list.getDataByContainedElement(event.target);
    await _runRowOnClickJavascript(event, rowData);
    if (data.popupform) await _displayRowActionsMenu(event, data, event.target.closest("[data-rowactions-btn]"));
}

async function _displayRowActionsMenu(event, data, anchor) {
    const cmdmanager = monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager;
    const cmdlist = (await import(`${APP_CONSTANTS.LIB_PATH}/cmdlist.mjs`)).cmdlist;
    const commands = await cmdlist.getCommands(undefined, data.popupform);
    if (!commands || !commands.length) return;
    for (const command of commands) cmdmanager.registerCommand(command);

    let menuHTML = `<div class="menu open" role="menu">`;
    for (const command of commands) menuHTML +=
        `<button onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('${command.id}')"><img src="${command.logo}" alt="">${command.label}</button>`;
    menuHTML += `</div>`;

    const shadowRoot = table_list.getShadowRootByContainedElement(event.target);
    const divOnclick = shadowRoot.querySelector("div#onclick_html"), divHider = shadowRoot.querySelector("div#hider");
    divOnclick.innerHTML = menuHTML; divOnclick.classList.add("rowmenu-holder");
    const menuWidth = 240, menuHeight = commands.length*40 + 16;
    // Anchored under the kebab when there is one, at the pointer otherwise.
    const rect = anchor?.getBoundingClientRect();
    const left = rect ? rect.right - menuWidth : event.clientX, top = rect ? rect.bottom + 4 : event.clientY + 8;
    divOnclick.style.left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 16)) + "px";
    divOnclick.style.top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 16)) + "px";
    divHider.classList.add("visible"); divOnclick.classList.add("visible");
}

async function _runRowOnClickJavascript(event, rowData) {
    const tableObject = table_list.getDataByContainedElement(event.target);
    if (!tableObject.clickrow_javascript) return;
    const onclickjs = _getArrayAsJoinedString(tableObject.clickrow_javascript);
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    await (new AsyncFunction(onclickjs))(rowData, tableObject);
}

/* -------------------------------------------------------------------- loading */

async function _runOnLoadJavascript(tabledef) {
    let loadResult;
    if (!tabledef.load_javascript) loadResult = tabledef.table;
    else {
        const onloadjs = _getArrayAsJoinedString(tabledef.load_javascript);
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        loadResult = await (new AsyncFunction(onloadjs))(tabledef);
        if (!loadResult) {LOG.error(`Table load JS failed`); return {headers: [], rows: []};}
    }
    if (!loadResult) return {headers: [], rows: []};

    const columns = tabledef.columns;
    const displayKeys = columns ? columns.map(col=>col.key) : (loadResult.keys||[]);
    const colByKey = {}; if (columns) for (const col of columns) colByKey[col.key] = col;

    const headers = []; for (const key of displayKeys) {
        const col = colByKey[key]||{};
        headers.push({label: await $$.libi18n.get(`${tabledef.i18nPrefix}_${key}`), priority: col.priority,
            index: headers.length, key, sortable: col.sortable === true,
            sortkey: col.sortkey || key, sorttype: col.sorttype || "text"});
    }

    const rows = []; for (const row of loadResult.table||[]) {
        const cells = []; for (const key of displayKeys) {
            const col = colByKey[key]||{}, value = row[key] !== undefined ? row[key] : "";
            const cell = {value, priority: col.priority};
            if (col.type == "badge") {
                cell.isbadge = true;
                const variant = col.badgemap?.[String(value).toLowerCase()] || col.badgemap?.["*"] || "neutral";
                cell.badgeclass = `badge-${variant}`;
            } else cell.tdclass = col.type == "main" ? "cell-main" : col.type == "mono" ? "mono" : col.type == "muted" ? "muted" : "";
            // link: true renders the value as a real button, so it is a keyboard
            // stop with a visible affordance instead of a click anywhere on the row
            if (col.link) cell.islink = true;
            // A "sub" column folds a second field into the same cell as a
            // quieter line, instead of spending a whole column on it.
            const subValue = col.sub !== undefined ? row[col.sub] : undefined;
            if (subValue !== undefined && String(subValue).trim() != "") {
                cell.hassub = true; cell.sub = subValue;
                cell.subclass = col.subtype == "mono" ? "mono" : "";
            }
            cells.push(cell);
        }
        rows.push({cells, roworder: rows.length,
            filtervalue: tabledef.filterkey ? String(row[tabledef.filterkey]||"") : "",
            rowdata_json_base64: $$.libutil.stringToBase64(JSON.stringify(row))});
    }

    // Filter chips are derived from the data, so they can never offer a value
    // that no row has.
    let filterchips;
    if (tabledef.filterkey) {
        const values = [...new Set((loadResult.table||[])
            .map(row => String(row[tabledef.filterkey]||"").trim()).filter(value => value))].sort();
        if (values.length > 1) filterchips = [{value: "*", label: await $$.libi18n.get("TLAll"), active: true},
            ...values.map(value => ({value, label: value}))];
    }

    // A table with a link column hands the click to that button, so the row
    // itself stops being a click target (the wireframes' behaviour). Tables
    // without one keep the legacy whole-row click.
    const rowclickable = !(columns||[]).some(col => col.link);

    return {headers, rows, filterchips, rowclickable};
}

const _getArrayAsJoinedString = (array, skipEOLs) => array?(Array.isArray(array)?array:[array]).join(skipEOLs?"":"\n"):"";

export const table_list = {trueWebComponentMode: true, elementConnected, elementRendered, close, rowClicked,
    hidePopup, searchTable, filterTable, gotoPage, sortTable, rowActions, rowSelected, selectAll, clearSelection,
    bulkAction, confirmAckChanged, closeBulkConfirm, confirmBulk};
$$.libmonkshu_component.register("table-list", `${COMPONENT_PATH}/table-list.html`, table_list);
