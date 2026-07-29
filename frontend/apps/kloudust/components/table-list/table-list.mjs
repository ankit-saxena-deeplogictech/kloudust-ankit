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
 *              priority: 2|3}] — replaces plain keys-driven cells with typed cells.
 *              priority feeds responsive column hiding (data-priority).
 *  - searchbar: true — renders a client-side filter toolbar.
 *  - emptystate: {title, message} — shown when the table has no rows.
 *  - popupform: {rolelist} — row actions, rendered as a native menu on row
 *              click (role filtered; each entry opens its command).
 *  - clickrow_command: "<command id>" — row click runs clickrow_javascript
 *              (typically pinning the row into APP_CONSTANTS.ENV) and then
 *              opens the given command (e.g. a detail page).
 *
 * clickrow_javascript runs on every row click in all modes. Raw HTML/CSS
 * injection (onclickrow_html, bottom_bar_html, style) is not supported —
 * tabledefs are data only.
 *
 * (C) 2023 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

const COMPONENT_PATH = $$.libutil.getModulePath(import.meta);

const i18n = {
    "en": {ClickToCopy: "Shift+click to copy", Copied: "Copied", TLNoDataTitle: "Nothing here yet", TLNoDataMessage: "No records were found for this view."},
    "hi": {ClickToCopy: "Shift+click to copy", Copied: "Copied", TLNoDataTitle: "Nothing here yet", TLNoDataMessage: "No records were found for this view."},
    "ja": {ClickToCopy: "Shift+click to copy", Copied: "Copied", TLNoDataTitle: "Nothing here yet", TLNoDataMessage: "No records were found for this view."},
    "zh": {ClickToCopy: "Shift+click to copy", Copied: "Copied", TLNoDataTitle: "Nothing here yet", TLNoDataMessage: "No records were found for this view."}
}

async function elementConnected(host) {
    for (const lang of Object.keys(i18n)) await $$.libi18n.setI18NObject(lang, i18n[lang]);
    const tableDefinition = $$.libutil.base64ToString(host.dataset.tabledef);
    const expandedData = await $$.librouter.expandPageData(tableDefinition, undefined, {mustache_start: "{{{", mustache_end: "}}}"});
    let tableObject = JSON.parse(expandedData);
    const tableData = await _runOnLoadJavascript(tableObject);
    tableObject.emptystate = {
        title: tableObject.emptystate?.title || await $$.libi18n.get("TLNoDataTitle"),
        message: tableObject.emptystate?.message || await $$.libi18n.get("TLNoDataMessage")};
    table_list.setDataByHost(host, {...tableObject, ...tableData});
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

function searchTable(event) {
    const shadowRoot = table_list.getShadowRootByContainedElement(event.target);
    const filter = event.target.value.trim().toLowerCase();
    for (const tr of shadowRoot.querySelectorAll("tbody tr"))
        tr.style.display = (!filter || tr.textContent.toLowerCase().includes(filter)) ? "" : "none";
}

async function rowClicked(event, rowdataJSON) {
    const rowDataJSON = rowdataJSON?$$.libutil.base64ToString(rowdataJSON):undefined, rowData = JSON.parse(rowDataJSON||"{}");
    const data = table_list.getDataByContainedElement(event.target);
    await _runRowOnClickJavascript(event, rowData);

    if (data.clickrow_command) {    // detail-page mode: pin the row (clickrow_javascript) then open the command
        const cmdmanager = monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager;
        cmdmanager.registerCommand({id: data.clickrow_command});
        cmdmanager.cmdClicked(data.clickrow_command); return;
    }

    if (data.popupform) await _displayRowActionsMenu(event, data);    // native row actions menu
}

async function _displayRowActionsMenu(event, data) {
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
    divOnclick.style.left = Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 16)) + "px";
    divOnclick.style.top = Math.max(8, Math.min(event.clientY + 8, window.innerHeight - menuHeight - 16)) + "px";
    divHider.classList.add("visible"); divOnclick.classList.add("visible");
}

async function _runRowOnClickJavascript(event, rowData) {
    const tableObject = table_list.getDataByContainedElement(event.target);
    if (!tableObject.clickrow_javascript) return;
    const onclickjs = _getArrayAsJoinedString(tableObject.clickrow_javascript);
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    await (new AsyncFunction(onclickjs))(rowData, tableObject);
}

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

    const headers = []; for (const key of displayKeys)
        headers.push({label: await $$.libi18n.get(`${tabledef.i18nPrefix}_${key}`), priority: colByKey[key]?.priority});

    const rows = []; for (const row of loadResult.table||[]) {
        const cells = []; for (const key of displayKeys) {
            const col = colByKey[key]||{}, value = row[key] !== undefined ? row[key] : "";
            const cell = {value, priority: col.priority};
            if (col.type == "badge") {
                cell.isbadge = true;
                const variant = col.badgemap?.[String(value).toLowerCase()] || col.badgemap?.["*"] || "neutral";
                cell.badgeclass = `badge-${variant}`;
            } else cell.tdclass = col.type == "main" ? "cell-main" : col.type == "mono" ? "mono" : col.type == "muted" ? "muted" : "";
            cells.push(cell);
        }
        rows.push({cells, rowdata_json_base64: $$.libutil.stringToBase64(JSON.stringify(row))});
    }
    return {headers, rows};
}

const _getArrayAsJoinedString = (array, skipEOLs) => array?(Array.isArray(array)?array:[array]).join(skipEOLs?"":"\n"):"";

export const table_list = {trueWebComponentMode: true, elementConnected, close, rowClicked, hidePopup, searchTable};
$$.libmonkshu_component.register("table-list", `${COMPONENT_PATH}/table-list.html`, table_list);
