/**
 * VM detail frontend module — object detail page per the Kloudust redesign
 * (vm-detail wireframe): header with the VM name, an overview properties
 * card and an actions card. Reads the row pinned into
 * APP_CONSTANTS.ENV._vms_form_data by the VMs table's clickrow_javascript;
 * every action button opens its registered command, which reads the same
 * pinned row (unchanged legacy contract).
 *
 * Renders in the light DOM — all styling comes from the document-level
 * stylesheets; this module intentionally contains no CSS.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

const HTML_TEMPLATE = `
<div id="vmdetail" class="stack">

<div class="page-head">
    <div>
        <nav class="breadcrumb" aria-label="Breadcrumb">
            <a onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm()">{{i18n.VMDetailBack}}</a>
            <span class="sep">/</span>
            <span class="current">{{vm.name_raw}}</span>
        </nav>
        <h1>{{vm.name_raw}}</h1>
        {{#vm.description}}<p class="sub">{{.}}</p>{{/vm.description}}
    </div>
    <div class="page-actions">
        <span class="iconbtn" role="button" tabindex="0" aria-label="Close"
            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm()">
            <svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </span>
    </div>
</div>

<div class="grid grid-2">
    <div class="card">
        <div class="card-head"><h3>{{i18n.VMDetailOverview}}</h3></div>
        <div class="card-body">
            <dl class="props">
            {{#props}}
                <dt>{{label}}</dt><dd {{#mono}}class="mono"{{/mono}}>{{value}}</dd>
            {{/props}}
            </dl>
        </div>
    </div>

    <div class="card">
        <div class="card-head"><h3>{{i18n.VMDetailActions}}</h3></div>
        <div class="card-body cluster">
        {{#actions}}
            <span class="btn {{#isdanger}}btn-danger-outline{{/isdanger}}{{^isdanger}}btn-secondary{{/isdanger}}" role="button" tabindex="0"
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('{{id}}')">
                <img src="{{{logo}}}" alt="" width="16" height="16">{{label}}
            </span>
        {{/actions}}
        </div>
        <div class="card-foot">{{i18n.VMDetailActionsFoot}}</div>
    </div>
</div>

</div>
`;

const NO_VM_TEMPLATE = `
<div id="vmdetail">
    <div class="banner banner-warning">
        <svg class="icon" viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4m0 3v.01"/></svg>
        <div>{{i18n.VMDetailNoVM}}</div>
    </div>
    <span class="btn btn-secondary" role="button" tabindex="0"
        onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm()">{{i18n.VMDetailBack}}</span>
</div>
`;

async function getHTML(formObject, cmdmanager) {
    const i18nL = formObject.i18n?.[$$.libi18n.getSessionLang()] || formObject.i18n?.en || {};
    const vm = APP_CONSTANTS.ENV._vms_form_data;
    if (!vm) return await $$.librouter.expandPageData(NO_VM_TEMPLATE, undefined, {i18n: i18nL});

    const props = [
        {label: i18nL.VMDetailPublicIP||"Public IP", value: vm.ips, mono: true},
        {label: i18nL.VMDetailPrivateIPs||"Private IPs", value: vm.privateips, mono: true},
        {label: i18nL.VMDetailVnets||"Virtual networks", value: vm.vnets},
        {label: i18nL.VMDetailRulesets||"Firewall rulesets", value: vm.rulesets},
        {label: i18nL.VMDetailImage||"Image / OS", value: vm.os},
        {label: i18nL.VMDetailDisk||"OS disk (GB)", value: vm.disk},
        {label: i18nL.VMDetailCores||"vCPU cores", value: vm.cpus},
        {label: i18nL.VMDetailMemory||"Memory (MB)", value: vm.memory},
        {label: i18nL.VMDetailCreated||"Created", value: vm.datetime}
    ].filter(prop => prop.value !== undefined && String(prop.value).trim() != "");

    const cmdlist = (await import(`${APP_CONSTANTS.LIB_PATH}/cmdlist.mjs`)).cmdlist;
    const actions = (await cmdlist.getCommands(undefined, formObject)) || [];
    for (const action of actions) {cmdmanager.registerCommand(action); action.isdanger = action.id.includes("delete");}

    return await $$.librouter.expandPageData(HTML_TEMPLATE, undefined, {i18n: i18nL, vm, props, actions});
}

export const vmdetail = {getHTML};
