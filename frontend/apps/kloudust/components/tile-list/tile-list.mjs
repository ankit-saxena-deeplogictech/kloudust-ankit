/**
 * Renders table_display forms whose display is "tiles" as a catalog card
 * grid (images wireframe) — objects picked by recognition rather than by
 * reading a row.
 *
 * The tabledef reuses the table-list load contract — load_javascript returns
 * {table: [objects]} — plus a declarative tile mapping. Everything below is
 * optional and defaults to the previous rendering:
 *   "tiledef": {
 *     "titlekey": "name",            // tile title
 *     "subtitlekey": "description",  // secondary line
 *     "monogramkey": "<key>",        // source for the 2-letter mark and the
 *                                    // data-os colour; defaults to the title
 *     "badges": [{"key": "format", "variant": "neutral",
 *                 "badgemap": {"<value>": "<variant>", "*": "neutral"},
 *                 "uppercase": true}],
 *     "kv": [{"key": "size", "label": "...", "mono": true, "muted": true}],
 *     "actions": [{"id": "<command id>", "label": "...",
 *                  "primary": true, "danger": true}]
 *   },
 *   "searchbar": true,        // count + search + filter chips above the grid
 *   "filterkey": "<key>",     // chips built from that key's distinct values
 *   "countlabel": "{n} images",  // {n} is replaced with the tile count
 *   "clickrow_javascript": [...]  // runs before an action opens its command,
 *                                 // so the tile can be pinned for prefill
 * The OS monogram (data-os colouring) is matched against the monogram source.
 * emptystate: {title, message} as in table-list. No CSS keys are supported.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

const COMPONENT_PATH = $$.libutil.getModulePath(import.meta);

const i18n = {
    "en": {TLNoTilesTitle: "Nothing here yet", TLNoTilesMessage: "No items were found for this view.",
        TLTileSearch: "Search…", TLTileFilter: "Filter", TLTileAll: "All",
        TLTileNoMatch: "Nothing matches the current filters."},
    "hi": {TLNoTilesTitle: "Nothing here yet", TLNoTilesMessage: "No items were found for this view.",
        TLTileSearch: "Search…", TLTileFilter: "Filter", TLTileAll: "All",
        TLTileNoMatch: "Nothing matches the current filters."},
    "ja": {TLNoTilesTitle: "Nothing here yet", TLNoTilesMessage: "No items were found for this view.",
        TLTileSearch: "Search…", TLTileFilter: "Filter", TLTileAll: "All",
        TLTileNoMatch: "Nothing matches the current filters."},
    "zh": {TLNoTilesTitle: "Nothing here yet", TLNoTilesMessage: "No items were found for this view.",
        TLTileSearch: "Search…", TLTileFilter: "Filter", TLTileAll: "All",
        TLTileNoMatch: "Nothing matches the current filters."}
}

const SKELETON_TILES = 6;

const OS_MATCHERS = [["ubuntu","ubuntu"], ["rhel","rhel"], ["redhat","rhel"], ["debian","debian"],
    ["windows","windows"], ["win1","windows"], ["rocky","rocky"]];

async function elementConnected(host) {
    for (const lang of Object.keys(i18n)) await $$.libi18n.setI18NObject(lang, i18n[lang]);
    const tableDefinition = $$.libutil.base64ToString(host.dataset.tabledef);
    const expandedData = await $$.librouter.expandPageData(tableDefinition, undefined, {mustache_start: "{{{", mustache_end: "}}}"});
    const tableObject = JSON.parse(expandedData);
    tableObject.emptystate = {
        title: tableObject.emptystate?.title || await $$.libi18n.get("TLNoTilesTitle"),
        message: tableObject.emptystate?.message || await $$.libi18n.get("TLNoTilesMessage")};
    tableObject.i18nlabels = {
        search: await $$.libi18n.get("TLTileSearch"), filter: await $$.libi18n.get("TLTileFilter"),
        nomatch: await $$.libi18n.get("TLTileNoMatch")};
    tableObject._view = {search: "", filter: "*"};

    // Skeleton first, real tiles diffed in from elementRendered — same pattern
    // as table-list, so a slow catalogue lookup never shows a blank card grid.
    tableObject.loading = true;
    tableObject.skeletontiles = Array.from({length: SKELETON_TILES}, _ => ({}));
    tile_list.setDataByHost(host, tableObject);
}

async function elementRendered(host) {
    const data = tile_list.getDataByHost(host);
    if (!data.loading) {_applyView(tile_list.getShadowRootByHost(host)); return;}

    const built = await _buildTiles(data);
    tile_list.setDataByHost(host, {...data, loading: false, skeletontiles: undefined, ...built});
    await host.render(false);
}

/* ------------------------------------------------------------- view: search/filter */

function searchTiles(event) {
    const data = tile_list.getDataByContainedElement(event.target);
    data._view.search = event.target.value.trim().toLowerCase();
    _applyView(tile_list.getShadowRootByContainedElement(event.target));
}

function filterTiles(element, value) {
    const shadowRoot = tile_list.getShadowRootByContainedElement(element);
    tile_list.getDataByContainedElement(element)._view.filter = value;
    for (const chip of shadowRoot.querySelectorAll("div#tilefilters button.chip"))
        chip.setAttribute("aria-pressed", String(chip.dataset.value == value));
    _applyView(shadowRoot);
}

/** Single source of truth for which tiles are on screen: text search over the
 *  tile's searchable text, then the chip filter. */
function _applyView(shadowRoot) {
    if (!shadowRoot) return;
    const data = tile_list.getDataByHost(shadowRoot.host); if (!data?._view) return;
    const {search, filter} = data._view;

    let shown = 0;
    for (const tile of shadowRoot.querySelectorAll("div.tile-grid div.tile")) {
        const matchesSearch = !search || (tile.dataset.search||"").includes(search);
        const matchesFilter = filter == "*" || (tile.dataset.filter||"") == filter;
        const visible = matchesSearch && matchesFilter;
        tile.classList.toggle("hide", !visible);
        if (visible) shown++;
    }

    const count = shadowRoot.querySelector("h3#tilecount");
    if (count) count.textContent = _countText(data.countlabel, shown);
    shadowRoot.querySelector("div#tilenomatch")?.classList.toggle("hide", shown > 0);
}

const _countText = (label, count) => label ? String(label).replace("{n}", count) : String(count);

/** Page-level action (page-head buttons): opens a command with nothing pinned. */
function pageAction(event, commandID) {
    event.stopPropagation();
    const cmdmanager = monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager;
    cmdmanager.registerCommand({id: commandID});
    cmdmanager.cmdClicked(commandID);
}

/** Footer action: pins the tile through clickrow_javascript — the same contract
 *  table rows use — then opens the command, which reads that pin to prefill. */
async function tileAction(event, commandID, tiledataBase64) {
    event.stopPropagation();
    const data = tile_list.getDataByContainedElement(event.target);
    let tile; try {tile = JSON.parse($$.libutil.base64ToString(tiledataBase64));}
    catch (err) {LOG.error(`Bad tile payload: ${err}`); return;}

    if (data.clickrow_javascript) {
        const js = (Array.isArray(data.clickrow_javascript)?data.clickrow_javascript:[data.clickrow_javascript]).join("\n");
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        await (new AsyncFunction(js))(tile, data);
    }

    const cmdmanager = monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager;
    cmdmanager.registerCommand({id: commandID});
    cmdmanager.cmdClicked(commandID);
}

async function close(element) {
    const onclose = await tile_list.getAttrValue(tile_list.getHostElement(element), "onclose");
    if (onclose && onclose.trim() != "") new Function(onclose)();
}

async function _buildTiles(tabledef) {
    let loadResult = tabledef.table;
    if (tabledef.load_javascript) {
        const onloadjs = (Array.isArray(tabledef.load_javascript)?tabledef.load_javascript:[tabledef.load_javascript]).join("\n");
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        loadResult = await (new AsyncFunction(onloadjs))(tabledef);
        if (!loadResult) {LOG.error(`Tile list load JS failed`); return {tiles: []};}
    }

    const tiledef = tabledef.tiledef||{}, tiles = [], items = loadResult?.table||[];
    for (const item of items) {
        const title = String(item[tiledef.titlekey||"name"]||"");
        const subtitle = item[tiledef.subtitlekey||"description"]||"";

        // The monogram source can differ from the title — an image's OS variant
        // identifies the family better than a versioned file name does.
        const markSource = String(tiledef.monogramkey ? (item[tiledef.monogramkey]||title) : title).toLowerCase();
        let os = ""; for (const [needle, osname] of OS_MATCHERS) if (markSource.includes(needle)) {os = osname; break;}

        const badges = []; for (const badgedef of tiledef.badges||[]) {
            const raw = item[badgedef.key];
            if (raw === undefined || String(raw).trim() == "") continue;
            const value = badgedef.uppercase ? String(raw).toUpperCase() : raw;
            const variant = badgedef.badgemap?.[String(raw).toLowerCase()]
                || badgedef.badgemap?.["*"] || badgedef.variant || "neutral";
            badges.push({value, variant});
        }

        const kv = []; for (const kvdef of tiledef.kv||[]) {
            const value = item[kvdef.key];
            if (value === undefined || String(value).trim() == "") continue;
            kv.push({label: kvdef.label||kvdef.key, value, mono: kvdef.mono===true, muted: kvdef.muted===true});
        }

        const tiledata = $$.libutil.stringToBase64(JSON.stringify(item));
        const actions = (tiledef.actions||[]).map(action => ({...action,
            buttonclass: action.primary ? "btn-primary" : action.danger ? "btn-danger-outline" : "btn-secondary",
            tiledata_json_base64: tiledata}));

        tiles.push({title, subtitle, monogram: markSource.substring(0, 2).toUpperCase(), os,
            badges, hasbadges: badges.length > 0, kv, haskv: kv.length > 0,
            hasbody: badges.length > 0 || kv.length > 0,
            actions, hasactions: actions.length > 0,
            filtervalue: tabledef.filterkey ? String(item[tabledef.filterkey]||"") : "",
            // Everything the toolbar search should match, lowercased once here
            searchtext: [title, subtitle, ...badges.map(badge => badge.value), ...kv.map(entry => entry.value)]
                .join(" ").toLowerCase(),
            tiledata_json_base64: tiledata});
    }

    // Chips come from the data, so they can never offer a value no tile has.
    let filterchips;
    if (tabledef.filterkey) {
        const values = [...new Set(items.map(item => String(item[tabledef.filterkey]||"").trim()).filter(value => value))].sort();
        if (values.length > 1) filterchips = [{value: "*", label: await $$.libi18n.get("TLTileAll"), active: true},
            ...values.map(value => ({value, label: value}))];
    }

    const pageactions = (tabledef.pageactions||[]).map(action => ({...action,
        buttonclass: action.primary ? "btn-primary" : "btn-secondary"}));

    return {tiles, filterchips, pageactions, counttext: _countText(tabledef.countlabel, tiles.length),
        // {n} in the page subtitle counts what was loaded, so it cannot drift
        subtitletext: tabledef.subtitle ? _countText(tabledef.subtitle, tiles.length) : undefined};
}

export const tile_list = {trueWebComponentMode: true, elementConnected, elementRendered, close,
    searchTiles, filterTiles, tileAction, pageAction};
$$.libmonkshu_component.register("tile-list", `${COMPONENT_PATH}/tile-list.html`, tile_list);
