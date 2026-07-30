/**
 * Generic tabbed page host — renders several existing commands as tabs of a
 * single page (the redesign's networking wireframe, and reusable for any other
 * page that groups existing views).
 *
 * It owns no data and no view logic of its own: each tab names an existing
 * command id, whose form.json is loaded and rendered through
 * cmdmanager.getFormHTML() in embedded mode, so the child renders without its
 * own page heading and close button. Tables stay tables, tiles stay tiles —
 * this only arranges them.
 *
 *   "tabs": [{"id": "vnets", "label": "..."}, {"id": "routers", "label": "..."}]
 *   "activetab": "routers"     // optional, defaults to the first tab
 *
 * Only the active tab is mounted. Its markup is built for every tab up front,
 * which costs nothing, but a tab's component is inserted into the DOM - and so
 * runs its load javascript - when that tab is selected. Mounting them all at
 * once instead fires their commands concurrently, and the backend rejects
 * identical concurrent commands as duplicate requests, which killed the
 * mounts that lost the race. One tab at a time also means selecting a tab
 * re-reads its data.
 *
 * Renders in the light DOM, so tokens and shared classes apply directly and
 * this module carries no CSS.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

let _tabHTML = [];

const HTML_TEMPLATE = `
<div id="tabgroup" class="stack">

<div class="page-head">
    <div>
        {{#title}}<h1>{{.}}</h1>{{/title}}
        {{#subtitle}}<p class="sub">{{.}}</p>{{/subtitle}}
    </div>
    <div class="page-actions">
        <span class="iconbtn" role="button" tabindex="0" aria-label="Close"
            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm()">
            <svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </span>
    </div>
</div>

<div class="tabs" role="tablist">
{{#tabs}}
    <button class="tab" role="tab" id="tabgroup_tab_{{index}}" aria-controls="tabgroup_panel_{{index}}"
        aria-selected="{{#active}}true{{/active}}{{^active}}false{{/active}}"
        onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].tabgroup.select({{index}})">{{label}}</button>
{{/tabs}}
</div>

{{#tabs}}
<div class="tab-panel" role="tabpanel" id="tabgroup_panel_{{index}}" aria-labelledby="tabgroup_tab_{{index}}" {{^active}}hidden{{/active}}>
{{#active}}{{{html}}}{{/active}}
</div>
{{/tabs}}

</div>
`;

async function getHTML(formObject, cmdmanager) {
    if (!monkshu_env.apps[APP_CONSTANTS.APP_NAME].tabgroup) monkshu_env.apps[APP_CONSTANTS.APP_NAME].tabgroup = tabgroup;
    const i18nL = formObject.i18n?.[$$.libi18n.getSessionLang()] || formObject.i18n?.en || {};
    
    formObject = JSON.parse(await $$.librouter.expandPageData(JSON.stringify(formObject), undefined, {i18n: i18nL}));

    const tabs = [];
    for (const [index, tabDef] of (formObject.tabs||[]).entries()) {
        let html = "";
        try {
            const childJSON = await $$.requireJSON(`${APP_CONSTANTS.FORMS_PATH}/${tabDef.id}.form.json`,
                APP_CONSTANTS.INSECURE_DEVELOPMENT_MODE?true:undefined);
            html = await cmdmanager.getFormHTML(childJSON, true);   // embedded: no child page head
        } catch (err) {LOG.error(`Tab ${tabDef.id} failed to load: ${err}`);}
        tabs.push({index, label: tabDef.label||tabDef.id, html,
            active: (formObject.activetab||formObject.tabs[0]?.id) == tabDef.id});
    }

    _tabHTML = tabs.map(tab => tab.html);

    return await $$.librouter.expandPageData(HTML_TEMPLATE, undefined,
        {i18n: i18nL, title: formObject.title, subtitle: formObject.subtitle, tabs});
}

function select(index) {
    for (const tab of document.querySelectorAll("#tabgroup .tabs button.tab"))
        tab.setAttribute("aria-selected", String(tab.id == `tabgroup_tab_${index}`));
    for (const panel of document.querySelectorAll("#tabgroup .tab-panel")) {
        const active = panel.id == `tabgroup_panel_${index}`;
        panel.hidden = !active;
        panel.innerHTML = active ? (_tabHTML[index]||"") : "";
    }
}

export const tabgroup = {getHTML, select};
