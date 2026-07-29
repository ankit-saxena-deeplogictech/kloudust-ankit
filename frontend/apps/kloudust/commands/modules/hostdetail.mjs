/**
 * Host detail frontend module — the drilldown behind the Hosts list, per the
 * redesign's hosts wireframe: connection properties, allocated-vs-physical
 * capacity meters for this host, and the VMs placed on it.
 *
 * The Hosts table pins the clicked row into APP_CONSTANTS.ENV._hosts_form_data;
 * this module reads it for the physical specs (the hosts table stores cores as
 * a count and memory/disk in bytes) and calls listVMsForHost for placement.
 *
 * As on the dashboard, capacity here is reserved, not measured — the schema
 * records declared sizes, not live utilization. Host reachability is likewise
 * not shown: the hosts table has no status column.
 *
 * Renders in the light DOM — all styling comes from the document-level
 * stylesheets; this module contains no CSS.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

const HTML_TEMPLATE = `
<div id="hostdetail" class="stack">

<div class="page-head">
    <div>
        <nav class="breadcrumb" aria-label="Breadcrumb">
            <a onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm()">{{i18n.HostDetailBack}}</a>
            <span class="sep">/</span>
            <span class="current">{{host.hostname}}</span>
        </nav>
        <h1>{{host.hostname}}</h1>
        <p class="sub mono">{{host.hostaddress}}</p>
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
        <div class="card-head"><h3>{{i18n.HostDetailCapacity}}</h3></div>
        <div class="card-body">
        {{#meters}}
            <div class="meter {{level}}">
                <div class="meter-head">
                    <span>{{label}}</span>
                    <span><strong>{{used}}</strong> / {{total}} · {{percent}}%{{#note}} — {{.}}{{/note}}</span>
                </div>
                <div class="track"><div class="fill" style="width: {{percent}}%;"></div></div>
            </div>
        {{/meters}}
            <p class="hint mb-0">{{i18n.HostDetailCapacityFoot}}</p>
        </div>
    </div>

    <div class="card">
        <div class="card-head"><h3>{{i18n.HostDetailOverview}}</h3></div>
        <div class="card-body">
            <dl class="props">
            {{#props}}
                <dt>{{label}}</dt><dd {{#mono}}class="mono"{{/mono}}>{{value}}</dd>
            {{/props}}
            </dl>
        </div>
    </div>
</div>

<div class="card table-card">
    <div class="card-head"><h3>{{i18n.HostDetailVMs}}{{#vms.length}} ({{vmcount}}){{/vms.length}}</h3></div>
    {{#vms.length}}
    <div class="table-scroll">
        <table class="dt">
            <thead><tr>
                <th>{{i18n.HostDetailVMName}}</th><th>{{i18n.HostDetailVMCores}}</th><th>{{i18n.HostDetailVMMemory}}</th>
            </tr></thead>
            <tbody>
            {{#vms}}
                <tr><td class="cell-main">{{name}}</td><td>{{cores}}</td><td class="muted">{{memory}}</td></tr>
            {{/vms}}
            </tbody>
        </table>
    </div>
    {{/vms.length}}
    {{^vms}}
    <div class="empty">
        <svg class="icon" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        <h3>{{i18n.HostDetailNoVMsTitle}}</h3>
        <p>{{i18n.HostDetailNoVMsMessage}}</p>
    </div>
    {{/vms}}
</div>

</div>
`;

const NO_HOST_TEMPLATE = `
<div id="hostdetail">
    <div class="banner banner-warning">
        <svg class="icon" viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4m0 3v.01"/></svg>
        <div>{{i18n.HostDetailNoHost}}</div>
    </div>
    <span class="btn btn-secondary" role="button" tabindex="0"
        onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm()">{{i18n.HostDetailBack}}</span>
</div>
`;

async function getHTML(formObject, _cmdmanager) {
    const i18nL = formObject.i18n?.[$$.libi18n.getSessionLang()] || formObject.i18n?.en || {};
    const host = APP_CONSTANTS.ENV._hosts_form_data;
    if (!host) return await $$.librouter.expandPageData(NO_HOST_TEMPLATE, undefined, {i18n: i18nL});

    const project = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT);
    const hostVMs = await _command(`listVMsForHost "${host.hostname}" "${APP_CONSTANTS.VM_TYPE_VM}"`, project, "vms");

    const allocated = {cores: 0, memory: 0, disk: 0};
    for (const vm of hostVMs) {
        allocated.cores += parseInt(vm.cpus)||0;
        allocated.memory += parseInt(vm.memory)||0;
        allocated.disk += parseInt(vm.disk)||0;
    }

    const meters = [
        _meter(i18nL.HostDetailCores||"vCPU", allocated.cores, parseInt(host.cores)||0, value => `${value}`, i18nL),
        _meter(i18nL.HostDetailMemory||"Memory", allocated.memory, parseInt(host.memory)||0, _formatBytes, i18nL),
        _meter(i18nL.HostDetailDisk||"Storage", allocated.disk, parseInt(host.disk)||0, _formatBytes, i18nL)
    ];

    const props = [
        [i18nL.HostDetailAddress||"Address", host.hostaddress, true],
        [i18nL.HostDetailOS||"Operating system", host.type],
        [i18nL.HostDetailPort||"SSH port", host.port],
        [i18nL.HostDetailProcessor||"Processor", host.processor],
        [i18nL.HostDetailArch||"Architecture", host.processorarchitecture],
        [i18nL.HostDetailSockets||"Sockets", host.sockets],
        [i18nL.HostDetailNetSpeed||"Network speed", host.networkspeed ? `${_formatBytes(host.networkspeed)}/s` : undefined],
        [i18nL.HostDetailAdded||"Added", host.timestamp ? new Date(parseInt(host.timestamp)).toLocaleString() : undefined]
    ].filter(([_label, value]) => value !== undefined && value !== null && String(value).trim() != "")
     .map(([label, value, mono]) => ({label, value, mono: mono||false}));

    const vms = hostVMs.map(vm => ({name: vm.name_raw || vm.name, cores: vm.cpus, memory: _formatBytes(vm.memory)}));

    return await $$.librouter.expandPageData(HTML_TEMPLATE, undefined,
        {i18n: i18nL, host, meters, props, vmcount: vms.length, vms: vms.length ? vms : undefined});
}

function _meter(label, used, total, format, i18nL) {
    const percent = total > 0 ? Math.min(Math.round(used/total*100), 999) : 0;
    const level = percent >= 90 ? "crit" : percent >= 75 ? "warn" : "";
    const note = percent >= 90 ? (i18nL.HostDetailMeterOver||"over-committed")
        : percent >= 75 ? (i18nL.HostDetailMeterNear||"approaching limit") : undefined;
    return {label, used: format(used), total: format(total), percent, level, note};
}

function _formatBytes(bytes) {
    const value = parseInt(bytes); if (isNaN(value) || value <= 0) return "0 GB";
    const gb = value/1073741824;
    return gb >= 1024 ? `${(gb/1024).toFixed(1)} TB` : gb >= 1 ? `${Math.round(gb)} GB` : `${Math.round(value/1048576)} MB`;
}

async function _command(cmd, project, resultKey) {
    try {
        const result = await $$.libapimanager.rest(APP_CONSTANTS.API_KLOUDUSTCMD, 'POST', {cmd, project}, true);
        return result?.[resultKey] || [];
    } catch (err) {LOG.error(`Host detail lookup failed for ${cmd}: ${err}`); return [];}
}

export const hostdetail = {getHTML};
