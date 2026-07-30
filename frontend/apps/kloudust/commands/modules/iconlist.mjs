/**
 * Returns HTML for icon lists to be displayed
 * in a main area.
 * 
 * (C) 2023 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

const HTML_TEMPLATE = `
<style>
/* Redesign skin — colors/spacing come from css/tokens.css (document level).
   Ids div#body, div#buttons, div#button are targeted by legacy style
   overrides inside form.jsons (row-click popups) — do not rename. */
div#body {
    box-sizing: border-box;
    color: var(--text);
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

div#close {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: var(--r-sm);
    color: var(--text-3);
    cursor: pointer;
    font: 500 var(--fs-md) var(--font-sans);
}
div#close:hover { background-color: var(--surface-2); color: var(--text); }

div#buttons {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    width: 100%;
    justify-content: left;
    margin-top: var(--sp-4);
    flex-wrap: wrap;
    gap: var(--sp-4);
}
div#button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-3);
    width: 11em;
    height: 8em;
    max-height: 8em;
    overflow: hidden;
    font-size: 0.9em;
    padding: var(--sp-4);
    box-sizing: border-box;
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: border-color 150ms ease, box-shadow 150ms ease;
}
div#button:hover { border-color: var(--primary); box-shadow: var(--shadow-md); }
div#button img {width: 40px; height: 40px; filter: var(--icon-filter);}
div#button .icon {width: 40px; height: 40px; stroke-width: 1.4; color: var(--primary);}
div#button span {text-align: center; color: var(--text);}
</style>

<div id="body">
<div id="close" onclick='event.stopPropagation(); monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm(this)'>X</div>

<div id="buttons">
{{#icons}}
<div id="button" onclick="window.monkshu_env.apps[APP_CONSTANTS.APP_NAME].iconlist.cmdClicked('{{id}}')">
    {{{iconsvg}}}{{^iconsvg}}<img class="cmdicon" src="{{{logo}}}">{{/iconsvg}}<span>{{label}}</span>
</div>
{{/icons}}
</div>

</div>
`;

async function getHTML(formObject, cmdmanager) {
    const cmdlist = (await import(`${APP_CONSTANTS.LIB_PATH}/cmdlist.mjs`)).cmdlist;

    // plug ourselves into the enviornment if not present
    if (!monkshu_env.apps[APP_CONSTANTS.APP_NAME].iconlist) monkshu_env.apps[APP_CONSTANTS.APP_NAME].iconlist = iconlist;
    const commands = await cmdlist.getCommands(undefined, formObject); 
    for (const command of commands) cmdmanager.registerCommand(command);

    const html = await $$.librouter.expandPageData(HTML_TEMPLATE, undefined, {icons: commands});
    return html;
}

export const iconlist = {getHTML, cmdClicked: id => monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked(id)};