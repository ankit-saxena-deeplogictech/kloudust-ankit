/**
 * VM detail frontend module — object detail page per the Kloudust redesign
 * (vm-detail wireframe): size KPIs, tabbed Overview / Networking / Disks /
 * Snapshots, and role-filtered actions.
 *
 * The VMs table pins the clicked row into APP_CONSTANTS.ENV._vms_form_data
 * (unchanged legacy contract). This module then calls getVMInfo for the
 * authoritative record — that command returns every vms column except the
 * creation command, with disksjson already parsed into vm.disks — and falls
 * back to the pinned row if the lookup fails. getVMVnets and listSnapshots
 * (which accepts an optional VM name) fill the networking and snapshot
 * sections. Every action button opens its registered command, which reads the
 * same pinned row; the snapshot row actions pin _snapshots_form_data instead,
 * which is the contract restoresnapshot and deletesnapshot already read.
 *
 * Live state (running/stopped) is deliberately not shown: the vms table has
 * no state column, so there is nothing truthful to display.
 *
 * Renders in the light DOM — all styling comes from the document-level
 * stylesheets; this module contains no CSS.
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

<div class="grid grid-kpi">
{{#kpis}}
    <div class="card kpi">
        <span class="kpi-label">{{label}}</span>
        <span class="kpi-value">{{value}}</span>
        {{#meta}}<span class="kpi-meta">{{.}}</span>{{/meta}}
    </div>
{{/kpis}}
</div>

<div class="tabs" role="tablist">
    <button class="tab" role="tab" data-tab="overview" aria-selected="true"
        onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].vmdetail.selectTab('overview')">{{i18n.VMDetailOverview}}</button>
    <button class="tab" role="tab" data-tab="networking" aria-selected="false"
        onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].vmdetail.selectTab('networking')">{{i18n.VMDetailNetworking}}</button>
    <button class="tab" role="tab" data-tab="disks" aria-selected="false"
        onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].vmdetail.selectTab('disks')">{{i18n.VMDetailDisks}}</button>
    <button class="tab" role="tab" data-tab="snapshots" aria-selected="false"
        onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].vmdetail.selectTab('snapshots')">{{i18n.VMDetailSnapshots}}</button>
</div>

<div class="tab-panel" role="tabpanel" data-panel="overview">
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
</div>

<div class="tab-panel" role="tabpanel" data-panel="networking" hidden>
    <div class="card">
        <div class="card-head"><h3>{{i18n.VMDetailIPAddresses}}</h3></div>
        <div class="card-body">
            <dl class="props">
            {{#networkprops}}
                <dt>{{label}}</dt><dd {{#mono}}class="mono"{{/mono}}>{{value}}</dd>
            {{/networkprops}}
            </dl>
        </div>
    </div>

    <div class="card">
        <div class="card-head"><h3>{{i18n.VMDetailVnets}}</h3></div>
        <div class="card-body">
        {{#vnetlist.length}}<div class="cluster">{{#vnetlist}}<span class="badge badge-info">{{.}}</span>{{/vnetlist}}</div>{{/vnetlist.length}}
        {{^vnetlist}}<p class="muted">{{i18n.VMDetailNoVnets}}</p>{{/vnetlist}}
        </div>
    </div>

    <div class="card">
        <div class="card-head"><h3>{{i18n.VMDetailRulesets}}</h3></div>
        <div class="card-body">
        {{#rulesetlist.length}}<div class="cluster">{{#rulesetlist}}<span class="badge badge-neutral">{{.}}</span>{{/rulesetlist}}</div>{{/rulesetlist.length}}
        {{^rulesetlist}}<p class="muted">{{i18n.VMDetailNoRulesets}}</p>{{/rulesetlist}}
        </div>
        <div class="card-foot">{{i18n.VMDetailRulesetsFoot}}</div>
    </div>
</div>

<div class="tab-panel" role="tabpanel" data-panel="disks" hidden>
    <div class="card table-card">
    {{#disks.length}}
        <div class="table-scroll">
        <table class="dt">
            <thead><tr><th>{{i18n.VMDetailDiskName}}</th><th>{{i18n.VMDetailDiskSize}}</th></tr></thead>
            <tbody>
            {{#disks}}
                <tr><td class="cell-main mono">{{name}}</td><td class="muted">{{size}}</td></tr>
            {{/disks}}
            </tbody>
        </table>
        </div>
    {{/disks.length}}
    {{^disks}}
        <div class="empty">
            <svg class="icon" viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>
            <h3>{{i18n.VMDetailNoDisksTitle}}</h3>
            <p>{{i18n.VMDetailNoDisksMessage}}</p>
        </div>
    {{/disks}}
    </div>
</div>

<div class="tab-panel" role="tabpanel" data-panel="snapshots" hidden>
    <div class="card table-card">
    {{#snapshots.length}}
        <div class="table-scroll">
        <table class="dt">
            <thead><tr>
                <th>{{i18n.VMDetailSnapshotName}}</th>
                <th>{{i18n.VMDetailSnapshotCreated}}</th>
                <th><span class="sr-only">{{i18n.VMDetailSnapshotActions}}</span></th>
            </tr></thead>
            <tbody>
            {{#snapshots}}
                <tr>
                    <td class="cell-main">{{name}}</td>
                    <td class="muted">{{created}}</td>
                    <td>
                        <div class="cluster">
                            <span class="btn btn-sm btn-secondary" role="button" tabindex="0"
                                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].vmdetail.openSnapshotCommand('restoresnapshot', '{{{payload}}}')">{{i18n.VMDetailSnapshotRestore}}</span>
                            <span class="btn btn-sm btn-danger-outline" role="button" tabindex="0"
                                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].vmdetail.openSnapshotCommand('deletesnapshot', '{{{payload}}}')">{{i18n.VMDetailSnapshotDelete}}</span>
                        </div>
                    </td>
                </tr>
            {{/snapshots}}
            </tbody>
        </table>
        </div>
    {{/snapshots.length}}
    {{^snapshots}}
        <div class="empty">
            <svg class="icon" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M12 7v5l3 2"/></svg>
            <h3>{{i18n.VMDetailNoSnapshotsTitle}}</h3>
            <p>{{i18n.VMDetailNoSnapshotsMessage}}</p>
        </div>
    {{/snapshots}}
    </div>
</div>

<div class="card">
    <div class="card-head"><h3>{{i18n.VMDetailActions}}</h3></div>
    <div class="card-body cluster">
    {{#actions}}
        <span class="btn {{#isdanger}}btn-danger-outline{{/isdanger}}{{^isdanger}}btn-secondary{{/isdanger}}" role="button" tabindex="0"
            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('{{id}}')">
            {{{iconsvg}}}{{^iconsvg}}<img class="cmdicon" src="{{{logo}}}" alt="" width="16" height="16">{{/iconsvg}}{{label}}
        </span>
    {{/actions}}
    </div>
    <div class="card-foot">{{i18n.VMDetailActionsFoot}}</div>
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
    if (!monkshu_env.apps[APP_CONSTANTS.APP_NAME].vmdetail) monkshu_env.apps[APP_CONSTANTS.APP_NAME].vmdetail = vmdetail;
    const i18nL = formObject.i18n?.[$$.libi18n.getSessionLang()] || formObject.i18n?.en || {};
    const pinned = APP_CONSTANTS.ENV._vms_form_data;
    if (!pinned) return await $$.librouter.expandPageData(NO_VM_TEMPLATE, undefined, {i18n: i18nL});

    const project = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT);
    const vmName = pinned.name_raw || pinned.name;

    // getVMInfo is authoritative; the pinned row is the fallback and supplies the
    // display-formatted fields the table already computed.
    let vm = {...pinned};
    const info = await _command(`getVMInfo "${vmName}"`, project, "vm");
    if (info) vm = {...pinned, ...info, name_raw: info.name_raw || vmName};

    const vnets = await _command(`getVMVnets "${vmName}"`, project, "vnets");
    // listSnapshots takes an optional VM name, so this is the same command the
    // snapshots page uses, scoped to one machine.
    const snapshotRecords = await _command(`listSnapshots "${vmName}"`, project, "snapshots");

    const kpis = [
        {label: i18nL.VMDetailCores||"vCPU cores", value: vm.cpus ?? "—"},
        {label: i18nL.VMDetailMemory||"Memory", value: _formatBytesOrRaw(vm.memory, pinned.memory, "MB")},
        {label: i18nL.VMDetailDisk||"OS disk", value: _formatBytesOrRaw(vm.disk, pinned.disk, "GB")},
        {label: i18nL.VMDetailHost||"Host", value: vm.hostname || "—"}
    ];

    const props = _properties([
        [i18nL.VMDetailName||"Name", vm.name_raw, true],
        [i18nL.VMDetailDescription||"Description", vm.description],
        [i18nL.VMDetailImage||"Image / OS", vm.os],
        [i18nL.VMDetailArch||"Architecture", vm.arch],
        [i18nL.VMDetailType||"Type", vm.vmtype],
        [i18nL.VMDetailHost||"Host", vm.hostname, true],
        [i18nL.VMDetailProject||"Project", vm.projectid || project],
        [i18nL.VMDetailOrg||"Organization", vm.org],
        [i18nL.VMDetailCreated||"Created", vm.timestamp ? new Date(parseInt(vm.timestamp)).toLocaleString() : pinned.datetime]
    ]);

    // Vnets and rulesets moved to their own cards below, so they are not
    // repeated here.
    const networkprops = _properties([
        [i18nL.VMDetailPublicIP||"Public IP", vm.ips || pinned.ips, true],
        [i18nL.VMDetailPrivateIPs||"Private IPs", pinned.privateips, true]
    ]);

    // The table joins these into display strings, so prefer the raw arrays it
    // now also pins; split the string only as a fallback for an older pin.
    const vnetlist = _list(vnets, pinned.vnets_list, pinned.vnets);
    const rulesetlist = _list(undefined, pinned.rulesets_list, pinned.rulesets);

    const snapshots = (snapshotRecords||[]).map(snapshot => ({
        name: snapshot.name,
        created: snapshot.timestamp ? new Date(parseInt(snapshot.timestamp)).toLocaleString() : "",
        payload: $$.libutil.stringToBase64(JSON.stringify({vm: vmName, name: snapshot.name}))
    }));

    const disks = (vm.disks||[]).map(disk => typeof disk == "string"
        ? {name: disk, size: ""}
        : {name: disk.name || disk.disk || disk.path || JSON.stringify(disk),
           size: disk.size !== undefined ? _formatBytes(disk.size) : ""});

    const cmdlist = (await import(`${APP_CONSTANTS.LIB_PATH}/cmdlist.mjs`)).cmdlist;
    const actions = (await cmdlist.getCommands(undefined, formObject)) || [];
    for (const action of actions) {cmdmanager.registerCommand(action); action.isdanger = action.id.includes("delete");}

    return await $$.librouter.expandPageData(HTML_TEMPLATE, undefined,
        {i18n: i18nL, vm, kpis, props, networkprops, actions,
         disks: disks.length ? disks : undefined, snapshots: snapshots.length ? snapshots : undefined,
         vnetlist: vnetlist.length ? vnetlist : undefined,
         rulesetlist: rulesetlist.length ? rulesetlist : undefined});
}

function selectTab(name) {
    for (const tab of document.querySelectorAll("#vmdetail .tabs button.tab"))
        tab.setAttribute("aria-selected", String(tab.dataset.tab == name));
    for (const panel of document.querySelectorAll("#vmdetail .tab-panel"))
        panel.hidden = panel.dataset.panel != name;
}

/** Snapshot row actions. restoresnapshot and deletesnapshot both prefill from
 *  APP_CONSTANTS.ENV._snapshots_form_data, so this pins the same shape the
 *  snapshots table pins and then opens the command unchanged. */
function openSnapshotCommand(commandID, payloadBase64) {
    let payload; try {payload = JSON.parse($$.libutil.base64ToString(payloadBase64));}
    catch (err) {LOG.error(`Bad snapshot payload: ${err}`); return;}
    APP_CONSTANTS.ENV._snapshots_form_data = payload;
    const cmdmanager = monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager;
    cmdmanager.registerCommand({id: commandID});
    cmdmanager.cmdClicked(commandID);
}

/** First real array wins; a joined display string is split as a last resort and
 *  the table's "none" sentinels are dropped rather than shown as entries. */
function _list(...candidates) {
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {if (candidate.length) return candidate; continue;}
        if (typeof candidate != "string" || candidate.trim() == "") continue;
        const parts = candidate.split(",").map(part => part.trim())
            .filter(part => part && !/^no\s|not assigned$/i.test(part));
        if (parts.length) return parts;
    }
    return [];
}

const _properties = rows => rows
    .filter(([_label, value]) => value !== undefined && value !== null && String(value).trim() != "")
    .map(([label, value, mono]) => ({label, value, mono: mono||false}));

/** getVMInfo returns raw bytes; the pinned row already holds the table's
 *  converted display value. Prefer the raw figure, fall back to the row. */
function _formatBytesOrRaw(rawBytes, fallback, fallbackUnit) {
    const bytes = parseInt(rawBytes);
    if (!isNaN(bytes) && bytes > 1048576) return _formatBytes(bytes);
    return fallback !== undefined && fallback !== "" ? `${fallback} ${fallbackUnit}` : "—";
}

function _formatBytes(bytes) {
    const value = parseInt(bytes); if (isNaN(value) || value <= 0) return "—";
    const gb = value/1073741824;
    return gb >= 1024 ? `${(gb/1024).toFixed(1)} TB` : gb >= 1 ? `${Math.round(gb)} GB` : `${Math.round(value/1048576)} MB`;
}

async function _command(cmd, project, resultKey) {
    try {
        const result = await $$.libapimanager.rest(APP_CONSTANTS.API_KLOUDUSTCMD, 'POST', {cmd, project}, true);
        return result?.result ? result[resultKey] : undefined;
    } catch (err) {LOG.error(`VM detail lookup failed for ${cmd}: ${err}`); return undefined;}
}

export const vmdetail = {getHTML, selectTab, openSnapshotCommand};
