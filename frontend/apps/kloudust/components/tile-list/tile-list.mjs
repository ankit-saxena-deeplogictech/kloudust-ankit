/**
 * Renders table_display forms whose display is "tiles" as a catalog card
 * grid (images wireframe) — objects picked by recognition rather than by
 * reading a row.
 *
 * The tabledef reuses the table-list load contract — load_javascript returns
 * {table: [objects]} — plus a declarative tile mapping:
 *   "tiledef": {
 *     "titlekey": "name",            // tile title (mono)
 *     "subtitlekey": "description",  // secondary line
 *     "kv": [{"key": "size", "label": "..."}]   // optional key/value rows
 *   }
 * The OS monogram (data-os coloring) is derived from the title text.
 * emptystate: {title, message} as in table-list. No CSS keys are supported.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

const COMPONENT_PATH = $$.libutil.getModulePath(import.meta);

const i18n = {
    "en": {TLNoTilesTitle: "Nothing here yet", TLNoTilesMessage: "No items were found for this view."},
    "hi": {TLNoTilesTitle: "Nothing here yet", TLNoTilesMessage: "No items were found for this view."},
    "ja": {TLNoTilesTitle: "Nothing here yet", TLNoTilesMessage: "No items were found for this view."},
    "zh": {TLNoTilesTitle: "Nothing here yet", TLNoTilesMessage: "No items were found for this view."}
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

    // Skeleton first, real tiles diffed in from elementRendered — same pattern
    // as table-list, so a slow catalogue lookup never shows a blank card grid.
    tableObject.loading = true;
    tableObject.skeletontiles = Array.from({length: SKELETON_TILES}, _ => ({}));
    tile_list.setDataByHost(host, tableObject);
}

async function elementRendered(host) {
    const data = tile_list.getDataByHost(host); if (!data.loading) return;
    const tiles = await _buildTiles(data);
    tile_list.setDataByHost(host, {...data, loading: false, skeletontiles: undefined, tiles});
    await host.render(false);
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
        if (!loadResult) {LOG.error(`Tile list load JS failed`); return [];}
    }

    const tiledef = tabledef.tiledef||{}, tiles = [];
    for (const item of loadResult?.table||[]) {
        const title = String(item[tiledef.titlekey||"name"]||"");
        const titleLower = title.toLowerCase();
        let os = ""; for (const [needle, osname] of OS_MATCHERS) if (titleLower.includes(needle)) {os = osname; break;}
        const kv = []; for (const kvdef of tiledef.kv||[]) {
            const value = item[kvdef.key];
            if (value !== undefined && String(value).trim() != "") kv.push({label: kvdef.label||kvdef.key, value});
        }
        tiles.push({title, subtitle: item[tiledef.subtitlekey||"description"]||"",
            monogram: title.substring(0, 2).toUpperCase(), os, kv, haskv: kv.length > 0});
    }
    return tiles;
}

export const tile_list = {trueWebComponentMode: true, elementConnected, elementRendered, close};
$$.libmonkshu_component.register("tile-list", `${COMPONENT_PATH}/tile-list.html`, tile_list);
