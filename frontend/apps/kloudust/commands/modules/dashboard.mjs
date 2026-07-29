/**
 * Dashboard frontend module — landing overview per the Kloudust redesign
 * (index wireframe): KPI tiles, recent activity feed and quick actions.
 *
 * Renders in the light DOM inside the main content area, so all styling
 * comes from the document-level stylesheets (tokens/components/shell) —
 * this module intentionally contains no CSS.
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

    <div class="card">
        <div class="card-head"><h3>{{i18n.DashboardQuickActions}}</h3></div>
        <div class="card-body cluster">
        {{#quickactions}}
            <span class="btn btn-secondary" role="button" tabindex="0"
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.cmdClicked('{{id}}')">{{label}}</span>
        {{/quickactions}}
        </div>
    </div>
</div>

</div>
`;

async function getHTML(formObject, cmdmanager) {
    const i18nL = formObject.i18n?.[$$.libi18n.getSessionLang()] || formObject.i18n?.en || {};
    const project = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT);

    let vms = [], vnets = [];
    try {
        const vmsResult = await $$.libapimanager.rest(APP_CONSTANTS.API_KLOUDUSTCMD, 'POST', {
            cmd: `listVMsForOrgOrProject "${$$.libsession.get(APP_CONSTANTS.USERORG)}" "${project}" "${APP_CONSTANTS.VM_TYPE_VM}"`,
            project}, true);
        vms = vmsResult?.vms || [];
    } catch (err) {LOG.error(`Dashboard VM lookup failed: ${err}`);}
    try {
        const vnetsResult = await $$.libapimanager.rest(APP_CONSTANTS.API_KLOUDUSTCMD, 'POST', {cmd: `listVnets`, project}, true);
        vnets = vnetsResult?.resources || [];
    } catch (err) {LOG.error(`Dashboard vnet lookup failed: ${err}`);}

    const totalCores = vms.reduce((sum, vm) => sum + (parseInt(vm.cpus)||0), 0);
    const totalMemoryGB = Math.round(vms.reduce((sum, vm) => sum + (parseInt(vm.memory)||0), 0)/1073741824);
    const kpis = [
        {label: i18nL.DashboardKPIVMs||"Virtual machines", value: vms.length, meta: i18nL.DashboardKPIVMsMeta||""},
        {label: i18nL.DashboardKPICores||"vCPU cores in use", value: totalCores},
        {label: i18nL.DashboardKPIMemory||"Memory in use", value: `${totalMemoryGB} GB`},
        {label: i18nL.DashboardKPIVnets||"Virtual networks", value: vnets.length}
    ];

    const alertObject = cmdmanager.getAlerts(), alerts = [];
    for (const alertID of Object.keys(alertObject).sort().reverse()) for (const alert of alertObject[alertID]) {
        const message = (alert.message||"").split("\n")[0].substring(0, 160);
        alerts.push({message, iserror: alert.type == cmdmanager.ALERT_ERROR});
        if (alerts.length >= 8) break;
    }

    const quickactions = [
        {id: "createvm", label: i18nL.DashboardQACreateVM||"New virtual machine"},
        {id: "vms", label: i18nL.DashboardQAVMs||"Virtual machines"},
        {id: "vnets", label: i18nL.DashboardQAVnets||"Virtual networks"},
        {id: "projects", label: i18nL.DashboardQAProjects||"Projects"},
        {id: "alerts", label: i18nL.DashboardQAAlerts||"Alerts"}
    ];
    for (const action of quickactions) cmdmanager.registerCommand({id: action.id});

    return await $$.librouter.expandPageData(HTML_TEMPLATE, undefined,
        {i18n: i18nL, project, kpis, alerts: alerts.slice(0, 8), quickactions});
}

export const dashboard = {getHTML};
