/**
 * IP pools frontend module — the pool-utilization view of the redesign's
 * ip-addresses wireframe, rendered as one card per host that IPs route through.
 *
 * Reads listIPs, which returns the whole assignable pool. Each row's
 * allocatedto tells the state, and that is the only state there is:
 *   ''          free
 *   'reserved'  network / gateway / broadcast, held back by addHostIP
 *   anything    the resolved resource holding it (raw_org_project)
 *
 * Scope note: the wireframe groups by CIDR block. addHostIP expands a block
 * into individual rows and keeps no mask, so blocks are not recoverable from
 * the schema — inferring them from the addresses would be guesswork. Grouping
 * by the routing host is the same idea using data that actually exists.
 *
 * Renders in the light DOM — document stylesheets apply and this module
 * contains no CSS. Segment colours are the shared .seg-* classes; only the
 * proportions are inline, because they are data.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

const HTML_TEMPLATE = `
<div id="ippools" class="stack">

<div class="grid grid-kpi">
{{#kpis}}
    <div class="card kpi">
        <span class="kpi-label">{{label}}</span>
        <span class="kpi-value">{{value}}</span>
        {{#meta}}<span class="kpi-meta">{{.}}</span>{{/meta}}
    </div>
{{/kpis}}
</div>

{{#pools.length}}
<div class="grid grid-2">
{{#pools}}
    <div class="card">
        <div class="card-head">
            <h3>{{hostname}}</h3>
            <span class="badge badge-{{levelbadge}}">{{utilization}}%</span>
        </div>
        <div class="card-body">
            <div class="segbar" aria-hidden="true">
            {{#segments}}<span class="{{cssclass}}" style="flex: {{count}};"></span>{{/segments}}
            </div>
            <div class="seg-legend">
            {{#segments}}<span><span class="dot {{cssclass}}"></span>{{count}} {{label}}</span>{{/segments}}
            </div>
            <dl class="kv mt-0">
                <dt>{{i18n.IPPoolsTotal}}</dt><dd>{{total}}</dd>
                <dt>{{i18n.IPPoolsFree}}</dt><dd>{{free}}</dd>
            </dl>
        </div>
        <div class="card-foot">{{i18n.IPPoolsFoot}}</div>
    </div>
{{/pools}}
</div>
{{/pools.length}}

{{^pools}}
<div class="card">
    <div class="empty">
        <svg class="icon" viewBox="0 0 24 24"><path d="M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>
        <h3>{{i18n.IPPoolsEmptyTitle}}</h3>
        <p>{{i18n.IPPoolsEmptyMessage}}</p>
    </div>
</div>
{{/pools}}

</div>
`;

async function getHTML(formObject, _cmdmanager, _embedded) {
    const i18nL = formObject.i18n?.[$$.libi18n.getSessionLang()] || formObject.i18n?.en || {};
    const project = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT);
    const ips = await _command("listIPs", project, "ips");

    // One bucket per routing host; the pool is only ever grouped by what routes it.
    const byHost = new Map();
    for (const entry of ips) {
        const hostname = (entry.hostname||"").trim() || i18nL.IPPoolsNoHost || "unrouted";
        if (!byHost.has(hostname)) byHost.set(hostname, {hostname, total: 0, assigned: 0, reserved: 0, free: 0});
        const pool = byHost.get(hostname), held = (entry.allocatedto||"").trim();
        pool.total++;
        if (held === "") pool.free++;
        else if (held.toLowerCase() === "reserved") pool.reserved++;
        else pool.assigned++;
    }

    const pools = [...byHost.values()].sort((a, b) => a.hostname.localeCompare(b.hostname)).map(pool => {
        // Reserved addresses are spent as far as assignment goes, so they count
        // towards utilization — otherwise a full pool would read as having room.
        const utilization = pool.total > 0 ? Math.round((pool.assigned + pool.reserved)/pool.total*100) : 0;
        const segments = [
            {label: i18nL.IPPoolsAssigned||"assigned", count: pool.assigned, cssclass: "seg-used"},
            {label: i18nL.IPPoolsReserved||"reserved", count: pool.reserved, cssclass: "seg-held"},
            {label: i18nL.IPPoolsFreeLower||"free", count: pool.free, cssclass: "seg-idle"}
        ].filter(segment => segment.count > 0);
        return {...pool, utilization, segments,
            levelbadge: utilization >= 100 ? "danger" : utilization >= 85 ? "warning" : "success"};
    });

    const totals = pools.reduce((sum, pool) => ({
        total: sum.total + pool.total, free: sum.free + pool.free,
        assigned: sum.assigned + pool.assigned, reserved: sum.reserved + pool.reserved}),
        {total: 0, free: 0, assigned: 0, reserved: 0});

    const kpis = [
        {label: i18nL.IPPoolsKPITotal||"Addresses in the pool", value: totals.total},
        {label: i18nL.IPPoolsKPIFree||"Free to assign", value: totals.free},
        {label: i18nL.IPPoolsKPIAssigned||"Assigned", value: totals.assigned},
        {label: i18nL.IPPoolsKPIHosts||"Routing hosts", value: pools.length}
    ];

    return await $$.librouter.expandPageData(HTML_TEMPLATE, undefined,
        {i18n: i18nL, kpis, pools: pools.length ? pools : undefined});
}

async function _command(cmd, project, resultKey) {
    try {
        const result = await $$.libapimanager.rest(APP_CONSTANTS.API_KLOUDUSTCMD, 'POST', {cmd, project}, true);
        return result?.[resultKey] || [];
    } catch (err) {LOG.error(`IP pool lookup failed for ${cmd}: ${err}`); return [];}
}

export const ippools = {getHTML};
