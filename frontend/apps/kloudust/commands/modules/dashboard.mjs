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
        <p class="sub">{{i18n.DashboardSubtitle}} <strong>{{project}}</strong>{{#hostsummary}} · {{.}}{{/hostsummary}}</p>
    </div>
    <div class="page-actions">
        {{#cancreatehost}}
        <span class="btn btn-secondary" role="button" tabindex="0"
            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('addhost')">
            <img src="img/addhost.svg" alt="" width="16" height="16">{{i18n.DashboardAttachHost}}
        </span>
        {{/cancreatehost}}
        <span class="btn btn-primary" role="button" tabindex="0"
            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('createvm')">
            <svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> {{i18n.DashboardCreateVM}}
        </span>
    </div>
</div>

{{#banner}}
<div class="banner banner-warning" role="status">
    <svg class="icon" viewBox="0 0 24 24"><path d="M12 9v4m0 4v.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
    <div><strong>{{title}}</strong> {{message}}</div>
</div>
{{/banner}}

<div class="grid grid-kpi">
{{#kpis}}
    <div class="card kpi">
        <span class="kpi-label">{{label}}</span>
        <span class="kpi-value">{{value}}</span>
        {{#meta}}<span class="kpi-meta">{{.}}</span>{{/meta}}
        {{#segments}}
        <div class="segbar" aria-hidden="true">
        {{#parts}}
            <span style="flex: {{count}}; background: var(--{{color}});"></span>
        {{/parts}}
        </div>
        <div class="seg-legend">
        {{#parts}}
            <span><span class="dot" style="background: var(--{{color}});"></span>{{count}} {{label}}</span>
        {{/parts}}
        </div>
        {{/segments}}
        {{#metabadges}}
        <span class="kpi-meta">
        {{#badges}}
            <span class="badge badge-{{variant}}"><span class="dot"></span>{{text}}</span>
        {{/badges}}
        </span>
        {{/metabadges}}
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
        <div class="card-head">
            <h3>{{i18n.DashboardActivity}}</h3>
            {{#alerts}}<a class="text-sm" role="button" tabindex="0"
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('alerts')"
                onkeydown="if (event.key == 'Enter' || event.key == ' ') {event.preventDefault(); monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('alerts');}">{{i18n.DashboardViewAll}}</a>{{/alerts}}
        </div>
        <div class="card-body">
        {{#alerts}}
            <div class="feed-item">
                {{#iserror}}<svg class="icon text-danger" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6m0-6-6 6"/></svg>{{/iserror}}
                {{^iserror}}<svg class="icon text-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/></svg>{{/iserror}}
                <div>
                    <div class="t">{{title}}</div>
                    {{#message}}<div class="m">{{.}}</div>{{/message}}
                </div>
                {{#when}}<time>{{.}}</time>{{/when}}
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

    <div class="card">
        <div class="card-head"><h3>{{i18n.DashboardQuickActions}}</h3></div>
        <div class="card-body grid grid-2">
        {{#quickactions}}
            <span class="btn btn-secondary" role="button" tabindex="0"
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('{{id}}')">
                <img src="{{{logo}}}" alt="" width="16" height="16">{{label}}
            </span>
        {{/quickactions}}
        </div>
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

    // Each stack is keyed by the millisecond it started, so the key is the timestamp
    // and the first line of the first message is what the command was.
    const alertObject = cmdmanager.getAlerts(), alerts = [];
    let errorstacks = 0, infostacks = 0;
    for (const alertID of Object.keys(alertObject).sort().reverse()) {
        const stack = alertObject[alertID], iserror = stack.some(alert => alert.type == cmdmanager.ALERT_ERROR);
        if (iserror) errorstacks++; else infostacks++;
        if (alerts.length >= 6) continue;
        const last = stack[stack.length-1];
        alerts.push({iserror, title: _firstLine(stack[0]?.message, 90),
            message: stack.length > 1 ? _firstLine(last?.message, 120) : undefined,
            when: _relativeTime(parseInt(alertID))});
    }

    const meters = _buildCapacityMeters(hosts, vms, i18nL);
    const strained = meters.find(meter => meter.level == "crit") || meters.find(meter => meter.level == "warn");
    const hostsinuse = hosts.filter(host => vms.some(vm => vm.hostname == host.hostname)).length;

    const kpis = [
        {label: i18nL.DashboardKPIVMs||"Virtual machines", value: vms.length,
         segments: vms.length ? {parts: _vmsPerHost(vms, i18nL)} : undefined},
        {label: i18nL.DashboardKPIVnets||"Virtual networks", value: vnets.length},
        {label: i18nL.DashboardKPIHosts||"Hosts", value: hosts.length,
         metabadges: hosts.length ? {badges: [
            {variant: "success", text: `${hostsinuse} ${i18nL.DashboardHostsInUse||"in use"}`},
            ...(hosts.length-hostsinuse ? [{variant: "neutral", text: `${hosts.length-hostsinuse} ${i18nL.DashboardHostsIdle||"idle"}`}] : [])
         ]} : undefined},
        {label: i18nL.DashboardKPIAlerts||"Alerts this session", value: Object.keys(alertObject).length,
         metabadges: (errorstacks || infostacks) ? {badges: [
            ...(errorstacks ? [{variant: "danger", text: `${errorstacks} ${i18nL.DashboardFailed||"failed"}`}] : []),
            ...(infostacks ? [{variant: "success", text: `${infostacks} ${i18nL.DashboardOK||"ok"}`}] : [])
         ]} : undefined}
    ];

    const quickactions = [
        {id: "createvm", label: i18nL.DashboardQACreateVM||"New virtual machine", logo: "img/createvm.svg"},
        {id: "createfirewall", label: i18nL.DashboardQAFirewall||"New firewall ruleset", logo: "img/createfirewall.svg"},
        {id: "createvnet", label: i18nL.DashboardQAVnet||"New virtual network", logo: "img/createvnet.svg"},
        {id: "createrouter", label: i18nL.DashboardQARouter||"New router", logo: "img/createrouter.svg"},
        {id: "vms", label: i18nL.DashboardQAVMs||"Virtual machines", logo: "img/vms.svg"},
        {id: "networking", label: i18nL.DashboardQANetworking||"Networking", logo: "img/vnets.svg"},
        {id: "projects", label: i18nL.DashboardQAProjects||"Projects", logo: "img/projects.svg"},
        {id: "cloudshell", label: i18nL.DashboardQACloudShell||"Cloud shell", logo: "img/cloudcommand.svg"}
    ];
    for (const action of quickactions) cmdmanager.registerCommand({id: action.id});
    cmdmanager.registerCommand({id: "alerts"}); cmdmanager.registerCommand({id: "addhost"});

    return await $$.librouter.expandPageData(HTML_TEMPLATE, undefined, {i18n: i18nL, project, kpis, quickactions,
        alerts: alerts.length ? alerts : undefined,
        hostsummary: hosts.length ? `${hosts.length} ${i18nL.DashboardKPIHosts||"Hosts"}`.toLowerCase() : undefined,
        cancreatehost: cmdmanager.isCloudAdminLoggedIn() ? true : undefined,
        banner: strained ? {title: `${strained.label} ${strained.percent}%.`,
            message: `${strained.used} ${i18nL.DashboardBannerOf||"of"} ${strained.total} ${i18nL.DashboardBannerReserved||"reserved across this project."}`} : undefined,
        showcapacity: hosts.length > 0, meters});
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

const SEG_COLORS = ["data-good", "data-brand", "data-idle", "data-warn"];

/** Where the machines actually sit. Three biggest hosts, then everything else. */
function _vmsPerHost(vms, i18nL) {
    const counts = {}; for (const vm of vms) {
        const host = vm.hostname || (i18nL.DashboardHostUnknown||"unassigned");
        counts[host] = (counts[host]||0)+1;
    }
    const ranked = Object.entries(counts).sort((a, b) => b[1]-a[1]);
    const parts = ranked.slice(0, 3).map(([label, count], index) => ({label, count, color: SEG_COLORS[index]}));
    const rest = ranked.slice(3).reduce((total, entry) => total+entry[1], 0);
    if (rest) parts.push({label: i18nL.DashboardHostsOther||"other hosts", count: rest, color: SEG_COLORS[3]});
    return parts;
}

const _firstLine = (text, max) => (text||"").split("\n")[0].substring(0, max);

function _relativeTime(timestamp) {
    if (!timestamp) return undefined;
    const minutes = Math.floor((Date.now()-timestamp)/60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes/60); if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours/24)}d`;
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
