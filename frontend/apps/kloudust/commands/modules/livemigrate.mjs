/**
 * Live migration frontend module — per the redesign's live-migration
 * wireframe: pick a VM, pick a compatible destination, and see what the move
 * does to both hosts before committing to it.
 *
 * Compatible destinations come from listLiveMigrateHosts, which also reports
 * the VM's current host, so the source side never has to be guessed. The
 * before/after figures are computed the same way as the dashboard card:
 * physical capacity from listHosts, allocation summed from VM reservations,
 * with the selected VM's cores and memory moved from source to destination.
 *
 * As everywhere else, this is reserved capacity — the schema stores declared
 * sizes, not live utilization, so this predicts allocation pressure, not
 * runtime load.
 *
 * Renders in the light DOM — all styling comes from the document-level
 * stylesheets; this module contains no CSS.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

let _i18n = {}, _vms = [], _hosts = [], _cmdmanager;

const HTML_TEMPLATE = `
<div id="livemigrate" class="stack">

<div class="page-head">
    <div>
        <h1>{{i18n.LMTitle}}</h1>
        <p class="sub">{{i18n.LMSubtitle}}</p>
    </div>
    <div class="page-actions">
        <span class="iconbtn" role="button" tabindex="0" aria-label="Close"
            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm()">
            <svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </span>
    </div>
</div>

<div class="banner banner-info" role="status">
    <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/></svg>
    <div>{{i18n.LMBanner}}</div>
</div>

<div class="grid grid-2">
    <div class="card">
        <div class="card-head"><h3>{{i18n.LMStart}}</h3></div>
        <div class="card-body">
            <div class="field">
                <label for="lm_vm">{{i18n.LMVM}}</label>
                <select class="input" id="lm_vm"
                    onchange="monkshu_env.apps[APP_CONSTANTS.APP_NAME].livemigrate.vmChanged(this.value)">
                    <option value="">{{i18n.LMSelectVM}}</option>
                    {{#vms}}<option value="{{name_raw}}">{{name_raw}} — {{hostname}}</option>{{/vms}}
                </select>
            </div>
            <div class="field">
                <label for="lm_host">{{i18n.LMDestination}}</label>
                <select class="input" id="lm_host" disabled
                    onchange="monkshu_env.apps[APP_CONSTANTS.APP_NAME].livemigrate.hostChanged()">
                    <option value="">{{i18n.LMSelectVMFirst}}</option>
                </select>
                <p class="hint" id="lm_hosthint">{{i18n.LMHostHint}}</p>
            </div>
        </div>
        <div class="card-foot" style="display:flex; justify-content:flex-end;">
            <button class="btn btn-primary" id="lm_go" disabled
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].livemigrate.migrate()">
                <svg class="icon" viewBox="0 0 24 24"><path d="M3 8h14m0 0-3.5-3.5M17 8l-3.5 3.5M21 16H7m0 0 3.5-3.5M7 16l3.5 3.5"/></svg>
                {{i18n.LMMigrate}}
            </button>
        </div>
    </div>

    <div class="card">
        <div class="card-head"><h3>{{i18n.LMImpact}}</h3></div>
        <div class="card-body" id="lm_impact">
            <div class="empty" style="padding: var(--sp-6) var(--sp-4);">
                <svg class="icon" viewBox="0 0 24 24"><path d="M3 8h14m0 0-3.5-3.5M17 8l-3.5 3.5M21 16H7m0 0 3.5-3.5M7 16l3.5 3.5"/></svg>
                <h3>{{i18n.LMNothingTitle}}</h3>
                <p>{{i18n.LMNothingMessage}}</p>
            </div>
        </div>
    </div>
</div>

<div class="card" id="lm_resultcard" style="display:none;">
    <div class="card-head"><h3>{{i18n.LMResult}}</h3></div>
    <div class="card-body" id="lm_result"></div>
</div>

</div>
`;

async function getHTML(formObject, cmdmanager) {
    if (!monkshu_env.apps[APP_CONSTANTS.APP_NAME].livemigrate) monkshu_env.apps[APP_CONSTANTS.APP_NAME].livemigrate = livemigrate;
    _cmdmanager = cmdmanager;
    _i18n = formObject.i18n?.[$$.libi18n.getSessionLang()] || formObject.i18n?.en || {};
    const project = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT);

    _vms = await _command(`listVMsForOrgOrProject "${$$.libsession.get(APP_CONSTANTS.USERORG)}" "${project}" "${APP_CONSTANTS.VM_TYPE_VM}"`, project, "vms");
    _hosts = await _command(`listHosts`, project, "resources");

    return await $$.librouter.expandPageData(HTML_TEMPLATE, undefined, {i18n: _i18n, vms: _vms});
}

/** A VM was chosen — ask the backend which hosts can actually take it. */
async function vmChanged(vmName) {
    const hostSelect = document.querySelector("#lm_host"), hint = document.querySelector("#lm_hosthint");
    const go = document.querySelector("#lm_go");
    go.disabled = true; _renderImpact(null, null);

    if (!vmName) {
        hostSelect.disabled = true; hostSelect.innerHTML = `<option value="">${_esc(_i18n.LMSelectVMFirst||"")}</option>`;
        hint.textContent = _i18n.LMHostHint||""; return;
    }

    hostSelect.disabled = true; hostSelect.innerHTML = `<option value="">${_esc(_i18n.LMLoadingHosts||"Loading…")}</option>`;
    const project = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT);
    const result = await _commandFull(`listLiveMigrateHosts "${vmName}"`, project);
    const candidates = result?.hosts || [];

    if (!candidates.length) {
        hostSelect.innerHTML = `<option value="">${_esc(_i18n.LMNoHosts||"No compatible hosts")}</option>`;
        hint.textContent = _i18n.LMNoHostsHint||""; return;
    }

    hostSelect.innerHTML = `<option value="">${_esc(_i18n.LMSelectHost||"")}</option>` +
        candidates.map(host => {
            const name = typeof host == "string" ? host : (host.hostname||host.name||"");
            return `<option value="${_esc(name)}">${_esc(name)}</option>`;
        }).join("");
    hostSelect.disabled = false;
    hostSelect.dataset.sourcehost = result?.sourceHost || _vms.find(vm => vm.name_raw == vmName)?.hostname || "";
    hint.textContent = `${candidates.length} ${_i18n.LMCompatible||"compatible host(s)"}`;
}

function hostChanged() {
    const vmName = document.querySelector("#lm_vm").value;
    const hostSelect = document.querySelector("#lm_host"), destination = hostSelect.value;
    document.querySelector("#lm_go").disabled = !(vmName && destination);
    _renderImpact(vmName, destination, hostSelect.dataset.sourcehost);
}

/** Shows what the move does to both hosts' reserved capacity. */
function _renderImpact(vmName, destination, sourceHostName) {
    const panel = document.querySelector("#lm_impact"); if (!panel) return;
    if (!vmName || !destination) {
        panel.innerHTML = `<div class="empty" style="padding: var(--sp-6) var(--sp-4);">
            <h3>${_esc(_i18n.LMNothingTitle||"")}</h3><p>${_esc(_i18n.LMNothingMessage||"")}</p></div>`;
        return;
    }
    const vm = _vms.find(candidate => candidate.name_raw == vmName); if (!vm) return;
    const moving = {cores: parseInt(vm.cpus)||0, memory: parseInt(vm.memory)||0};

    panel.innerHTML =
        _hostBlock(sourceHostName, _i18n.LMSource||"Source after the move", {cores: -moving.cores, memory: -moving.memory}) +
        _hostBlock(destination, _i18n.LMDestination2||"Destination after the move", {cores: moving.cores, memory: moving.memory});
}

function _hostBlock(hostName, heading, delta) {
    const host = _hosts.find(candidate => candidate.hostname == hostName);
    if (!host) return `<h4 style="margin-bottom:var(--sp-2);">${_esc(heading)}</h4>
        <p class="hint">${_esc(hostName||"")} — ${_esc(_i18n.LMNoHostData||"no capacity data")}</p>`;

    const current = {cores: 0, memory: 0};
    for (const vm of _vms) if (vm.hostname == hostName) {
        current.cores += parseInt(vm.cpus)||0; current.memory += parseInt(vm.memory)||0;
    }
    const after = {cores: current.cores + delta.cores, memory: current.memory + delta.memory};

    return `<h4 style="margin-bottom:var(--sp-2);">${_esc(heading)} — <span class="mono">${_esc(hostName)}</span></h4>` +
        _meter(_i18n.LMCores||"vCPU", after.cores, parseInt(host.cores)||0, value => `${value}`, delta.cores) +
        _meter(_i18n.LMMemory||"Memory", after.memory, parseInt(host.memory)||0, _formatBytes, delta.memory) +
        `<p class="hint" style="margin-bottom:var(--sp-4);">${_esc(_i18n.LMReserved||"")}</p>`;
}

function _meter(label, used, total, format, delta) {
    const percent = total > 0 ? Math.min(Math.round(used/total*100), 999) : 0;
    const level = percent >= 90 ? "crit" : percent >= 75 ? "warn" : "";
    const sign = delta > 0 ? "+" : "";
    return `<div class="meter ${level}">
        <div class="meter-head"><span>${_esc(label)}</span>
        <span><strong>${_esc(format(used))}</strong> / ${_esc(format(total))} · ${percent}%
        ${delta ? `<span class="${delta > 0 ? "text-warning" : "text-success"}">(${sign}${_esc(format(Math.abs(delta)).replace("-",""))})</span>` : ""}</span></div>
        <div class="track"><div class="fill" style="width: ${Math.min(percent,100)}%;"></div></div>
    </div>`;
}

async function migrate() {
    const vmName = document.querySelector("#lm_vm").value, destination = document.querySelector("#lm_host").value;
    if (!vmName || !destination) return;
    const go = document.querySelector("#lm_go"), card = document.querySelector("#lm_resultcard"),
        result = document.querySelector("#lm_result");
    go.disabled = true; card.style.display = "";
    result.innerHTML = `<div class="feed-item" style="border:0;"><span class="spinner" role="img" aria-label="Running"></span>
        <div><div class="t">${_esc(_i18n.LMRunning||"Migrating…")}</div>
        <div class="m mono text-sm">liveMigrate "${_esc(vmName)}" "${_esc(destination)}"</div></div></div>`;

    const cmdResult = await _cmdmanager.runCloudCommand("liveMigrate", ["vm_name","host_to"],
        {vm_name: vmName, host_to: destination});

    const ok = cmdResult?.result == true;
    const output = [cmdResult?.out, cmdResult?.err].filter(part => (part||"").trim() != "").join("\n");
    result.innerHTML = `<div class="spread" style="margin-bottom:var(--sp-3);">
            <span class="badge ${ok ? "badge-success" : "badge-danger"}"><span class="dot"></span>${
                _esc(ok ? (_i18n.LMDone||"Migration finished") : (_i18n.LMFailed||"Migration failed"))}</span>
        </div>
        <div class="console">${output.trim() == "" ? _esc(_i18n.LMNoOutput||"(no output)")
            : output.split(/\r?\n/).map(line => `<div>${_esc(line)}</div>`).join("")}</div>`;
    go.disabled = false;
}

const _esc = text => $$.libutil.encodeHTMLEntities(String(text === undefined || text === null ? "" : text));

function _formatBytes(bytes) {
    const value = Math.abs(parseInt(bytes)); if (isNaN(value) || value == 0) return "0 GB";
    const gb = value/1073741824;
    return gb >= 1024 ? `${(gb/1024).toFixed(1)} TB` : `${Math.round(gb)} GB`;
}

async function _commandFull(cmd, project) {
    try {return await $$.libapimanager.rest(APP_CONSTANTS.API_KLOUDUSTCMD, 'POST', {cmd, project}, true);}
    catch (err) {LOG.error(`Live migrate lookup failed for ${cmd}: ${err}`); return undefined;}
}

async function _command(cmd, project, resultKey) {
    const result = await _commandFull(cmd, project);
    return result?.[resultKey] || [];
}

export const livemigrate = {getHTML, vmChanged, hostChanged, migrate};
