/**
 * Dashboard frontend module — landing overview per the Kloudust redesign
 * (index wireframe): KPI tiles, allocated-vs-physical capacity meters,
 * recent activity and quick actions.
 *
 * Capacity is computed, not measured. Physical totals come from the hosts
 * table via listHosts (cores, and memory/disk in bytes); allocation is the
 * sum of VM reservations. Both sides are in the same units, so the ratio is
 * meaningful — but note it is *reserved* capacity, not live utilization,
 * which the schema does not record. The card hides itself when the signed-in
 * role cannot read host data.
 *
 * Deliberately absent versus the wireframe: running/stopped/paused VM
 * breakdowns and host online/unreachable counts. The vms and hosts tables
 * carry no state column, so those numbers cannot be told truthfully.
 *
 * Renders in the light DOM inside the main content area, so all styling
 * comes from the document-level stylesheets — this module contains no CSS.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

const HTML_TEMPLATE = `
<div id="dashboard" class="stack">

<div class="page-head">
    <div>
        <h1>{{i18n.DashboardTitle}}</h1>
        <p class="sub">{{i18n.DashboardSubtitle}} <strong>{{project}}</strong></p>
    </div>
    <div class="page-actions">
        <span class="btn btn-primary" role="button" tabindex="0"
            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('createvm')">
            <svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> {{i18n.DashboardCreateVM}}
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

<div class="grid grid-2">

{{#showcapacity}}
    <div class="card">
        <div class="card-head"><h3>{{i18n.DashboardCapacity}}</h3></div>
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
            <p class="hint mb-0">{{i18n.DashboardCapacityFoot}}</p>
        </div>
    </div>
{{/showcapacity}}

    <div class="card">
        <div class="card-head"><h3>{{i18n.DashboardActivity}}</h3></div>
        <div class="card-body">
        {{#alerts}}
            <div class="feed-item">
                {{#iserror}}<svg class="icon text-danger" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6m0-6-6 6"/></svg>{{/iserror}}
                {{^iserror}}<svg class="icon text-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/></svg>{{/iserror}}
                <div><div class="m">{{message}}</div></div>
            </div>
        {{/alerts}}
        {{^alerts}}
            <div class="empty">
                <svg class="icon" viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>
                <h3>{{i18n.DashboardNoActivityTitle}}</h3>
                <p>{{i18n.DashboardNoActivityMessage}}</p>
            </div>
        {{/alerts}}
        </div>
    </div>

</div>

<div class="card">
    <div class="card-head"><h3>{{i18n.DashboardQuickActions}}</h3></div>
    <div class="card-body grid grid-2">
    {{#quickactions}}
        <button class="btn btn-secondary" type="button"
            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('{{id}}')">{{{iconsvg}}}{{label}}</button>
    {{/quickactions}}
    </div>
</div>

</div>
`;

async function getHTML(formObject, cmdmanager) {
    const i18nL = formObject.i18n?.[$$.libi18n.getSessionLang()] || formObject.i18n?.en || {};
    const project = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT);

    const vms = await _command(`listVMsForOrgOrProject "${$$.libsession.get(APP_CONSTANTS.USERORG)}" "${project}" "${APP_CONSTANTS.VM_TYPE_VM}"`, project, "vms");
    const vnets = await _command(`listVnets`, project, "resources");
    const hosts = await _command(`listHosts`, project, "resources");   // cloud-role gated; [] when not permitted

    const alertObject = cmdmanager.getAlerts(), alerts = [];
    for (const alertID of Object.keys(alertObject).sort().reverse()) for (const alert of alertObject[alertID]) {
        if (alerts.length >= 8) break;
        alerts.push({message: (alert.message||"").split("\n")[0].substring(0, 160),
            iserror: alert.type == cmdmanager.ALERT_ERROR});
    }

    const kpis = [
        {label: i18nL.DashboardKPIVMs||"Virtual machines", value: vms.length},
        {label: i18nL.DashboardKPIVnets||"Virtual networks", value: vnets.length},
        {label: i18nL.DashboardKPIHosts||"Hosts", value: hosts.length},
        {label: i18nL.DashboardKPIAlerts||"Alerts this session", value: Object.keys(alertObject).length}
    ];

    const quickactions = [
        {id: "createvm", label: i18nL.DashboardQACreateVM||"New virtual machine", icon: "plus"},
        {id: "createfirewall", label: i18nL.DashboardQAFirewall||"New firewall ruleset", icon: "firewall"},
        {id: "createvnet", label: i18nL.DashboardQAVnet||"New virtual network", icon: "network"},
        {id: "images", label: i18nL.DashboardQAImages||"Images", icon: "image"},
        {id: "vms", label: i18nL.DashboardQAVMs||"Virtual machines", icon: "vm"},
        {id: "networking", label: i18nL.DashboardQANetworking||"Networking", icon: "router"},
        {id: "projects", label: i18nL.DashboardQAProjects||"Projects", icon: "projects"},
        {id: "cloudshell", label: i18nL.DashboardQACloudShell||"Cloud shell", icon: "shell"}
    ];
    const icons = (await import(`${APP_CONSTANTS.LIB_PATH}/icons.mjs`)).icons;
    for (const action of quickactions) action.iconsvg = icons.svg(action.icon);
    for (const action of quickactions) cmdmanager.registerCommand({id: action.id});

    return await $$.librouter.expandPageData(HTML_TEMPLATE, undefined, {i18n: i18nL, project, kpis, quickactions,
        alerts: alerts.length ? alerts : undefined,
        showcapacity: hosts.length > 0, meters: _buildCapacityMeters(hosts, vms, i18nL)});
}

/** Sums physical host capacity against reserved VM capacity. Both sides use the
 *  same units — cores as counts, memory and disk as bytes. */
function _buildCapacityMeters(hosts, vms, i18nL) {
    if (!hosts.length) return [];
    const physical = {cores: 0, memory: 0, disk: 0}, allocated = {cores: 0, memory: 0, disk: 0};
    for (const host of hosts) {
        physical.cores += parseInt(host.cores)||0;
        physical.memory += parseInt(host.memory)||0;
        physical.disk += parseInt(host.disk)||0;
    }
    for (const vm of vms) {
        allocated.cores += parseInt(vm.cpus)||0;
        allocated.memory += parseInt(vm.memory)||0;
        allocated.disk += parseInt(vm.disk)||0;
    }
    return [
        _meter(i18nL.DashboardMeterCores||"vCPU", allocated.cores, physical.cores, value => `${value}`, i18nL),
        _meter(i18nL.DashboardMeterMemory||"Memory", allocated.memory, physical.memory, _formatBytes, i18nL),
        _meter(i18nL.DashboardMeterDisk||"Storage", allocated.disk, physical.disk, _formatBytes, i18nL)
    ];
}

function _meter(label, used, total, format, i18nL) {
    const percent = total > 0 ? Math.min(Math.round(used/total*100), 999) : 0;
    const level = percent >= 90 ? "crit" : percent >= 75 ? "warn" : "";
    const note = percent >= 90 ? (i18nL.DashboardMeterOver||"over-committed")
        : percent >= 75 ? (i18nL.DashboardMeterNear||"approaching limit") : undefined;
    return {label, used: format(used), total: format(total), percent, level, note};
}

function _formatBytes(bytes) {
    if (!bytes) return "0 GB";
    const gb = bytes/1073741824;
    return gb >= 1024 ? `${(gb/1024).toFixed(1)} TB` : `${Math.round(gb)} GB`;
}

/** Runs a read-only lookup, returning the named array or [] when the command
 *  fails or the role is not permitted to see it. */
async function _command(cmd, project, resultKey) {
    try {
        const result = await $$.libapimanager.rest(APP_CONSTANTS.API_KLOUDUSTCMD, 'POST', {cmd, project}, true);
        return result?.[resultKey] || [];
    } catch (err) {LOG.error(`Dashboard lookup failed for ${cmd}: ${err}`); return [];}
}

export const dashboard = {getHTML};
