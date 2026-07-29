/**
 * Cloud shell frontend module — the redesign's cloud-shell wireframe.
 *
 * A two column workspace: command composer + result on the left, a searchable
 * command reference and recent history on the right. Replaces the old
 * "Run cloud command" form, whose only affordance was a textarea that closed
 * itself on submit and dumped output into the alerts panel.
 *
 * Everything it knows about commands comes from the "commands" catalogue in
 * cloudshell.form.json — this module holds no command knowledge of its own.
 *
 * Renders in the light DOM inside the main content area, so tokens and the
 * shared component classes apply directly. The only CSS below is the page's
 * own layout (composer grid, reference rows), following the same pattern as
 * iconlist.mjs and alerts.mjs; it uses tokens exclusively.
 *
 * Design notes worth keeping:
 *  - The catalogue is a REFERENCE, not a whitelist. Unknown verbs and unusual
 *    argument counts produce advisory hints, never a refusal — this is a raw
 *    command line and the backend stays authoritative. (createVM alone is
 *    invoked with 8 to 16 arguments across the existing forms.)
 *  - There is deliberately no "dry run" toggle. The wireframe shows one, but
 *    the Kloudust backend has no dry-run flag, and a switch that claims
 *    "nothing changed" while the command really executes would be dangerous.
 *    Destructive verbs get a typed confirmation instead, which is real.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

const HISTORY_KEY = "__com_tekmonks_kloudust_cloudshell_history", HISTORY_MAX = 50, RECENT_SHOWN = 6;

let _catalogue = [], _history = [], _cmdmanager, _i18n = {};

const HTML_TEMPLATE = `
<style>
/* Page-local layout only — every value is a token. */
div#cloudshell div#cs_grid {
    display: grid;
    gap: var(--sp-4);
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    align-items: start;
}
@media (max-width: 1023px) { div#cloudshell div#cs_grid { grid-template-columns: 1fr; } }

div#cloudshell textarea#cs_command {
    width: 100%;
    min-height: 132px;
    resize: vertical;
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    line-height: 1.6;
    background: var(--n-900);
    color: var(--n-100);
    border: 1px solid var(--n-700);
    border-radius: var(--r-md);
    padding: var(--sp-3);
    outline: none;
}
div#cloudshell textarea#cs_command:focus { border-color: var(--focus-ring); box-shadow: 0 0 0 3px var(--primary-soft); }
div#cloudshell textarea#cs_command::placeholder { color: var(--n-500); }

div#cloudshell div#cs_composer_foot { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
div#cloudshell div#cs_composer_foot .grow { flex: 1; }

div#cloudshell div.cs_refitem { border-bottom: 1px solid var(--border); padding: var(--sp-3) 0; }
div#cloudshell div.cs_refitem:last-child { border-bottom: none; }
div#cloudshell div.cs_refitem .v { font-family: var(--font-mono); font-weight: 600; font-size: var(--fs-md); }
div#cloudshell div.cs_refitem .d { color: var(--text-3); font-size: var(--fs-sm); margin: 2px 0 var(--sp-2); }
div#cloudshell div.cs_refitem code.s {
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--text-2);
    background: var(--surface-2); border-radius: var(--r-sm); padding: 4px 6px;
    display: block; overflow-x: auto; white-space: pre;
}
div#cloudshell div.cs_refgroup {
    font-size: var(--fs-xs); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--text-3); padding: var(--sp-3) 0 var(--sp-1);
}
div#cloudshell div#cs_reflist { max-height: 520px; overflow-y: auto; }
div#cloudshell div#cs_recent .feed-item { cursor: pointer; }
div#cloudshell div#cs_recent .feed-item:hover .t { color: var(--primary); }
div#cloudshell details#cs_raw summary { cursor: pointer; font-size: var(--fs-sm); color: var(--text-2); }
</style>

<div id="cloudshell" class="stack">

<div class="page-head">
    <div>
        <h1>{{i18n.CloudShellTitle}}</h1>
        <p class="sub">{{i18n.CloudShellSubtitle}}</p>
    </div>
    <div class="page-actions">
        <span class="btn btn-secondary" role="button" tabindex="0"
            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.showAllHistory()">
            <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
            {{i18n.CloudShellHistory}}
        </span>
        <span class="btn btn-secondary" role="button" tabindex="0"
            onclick="window.open(APP_CONSTANTS.APP_ABOUT_URL||'https://tekmonks.com', '_blank')">
            <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8v.5M12 17v.01"/></svg>
            {{i18n.CloudShellDocs}}
        </span>
    </div>
</div>

<div class="banner banner-info" role="status">
    <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/></svg>
    <div>{{i18n.CloudShellScopePre}} <strong>{{username}}</strong> {{i18n.CloudShellScopeOrg}}
        <strong>{{org}}</strong>, {{i18n.CloudShellScopeProject}} <strong>{{project}}</strong>.
        {{i18n.CloudShellScopePost}}</div>
</div>

<div id="cs_grid">

<div class="stack" style="margin-top:0;">
    <section class="card">
        <div class="card-head">
            <h3>{{i18n.CloudShellCommand}}</h3>
            <span class="badge badge-info"><span class="dot"></span>{{i18n.CloudShellProject}} {{project}}</span>
        </div>
        <div class="card-body">
            <label class="sr-only" for="cs_command">{{i18n.CloudShellCommand}}</label>
            <textarea id="cs_command" spellcheck="false" autocomplete="off" placeholder="{{i18n.CloudShellPlaceholder}}"
                oninput="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.check()"
                onkeydown="if ((event.metaKey||event.ctrlKey) &amp;&amp; event.key==='Enter') {event.preventDefault(); monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.run();}"></textarea>
            <p class="hint" id="cs_parse" style="min-height:20px;">{{i18n.CloudShellParseIdle}}</p>
            <div class="banner banner-danger hide" id="cs_danger" style="margin-top:var(--sp-2);">
                <svg class="icon" viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4m0 3v.01"/></svg>
                <div id="cs_dangertext"></div>
            </div>
        </div>
        <div class="card-foot" id="cs_composer_foot">
            <span class="text-sm muted">{{i18n.CloudShellRunHint}}</span>
            <span class="grow"></span>
            <span class="btn btn-sm btn-secondary" role="button" tabindex="0"
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.clear()">{{i18n.CloudShellClear}}</span>
            <span class="btn btn-primary" id="cs_run" role="button" tabindex="0"
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.run()">
                <svg class="icon" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg> {{i18n.CloudShellRun}}
            </span>
        </div>
    </section>

    <section class="card">
        <div class="card-head">
            <h3>{{i18n.CloudShellResult}}</h3>
            <div class="cluster hide" id="cs_resultactions">
                <span class="btn btn-sm btn-ghost" role="button" tabindex="0"
                    onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.copyOutput()">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 5H5a2 2 0 0 0-2 2v10"/></svg>
                    {{i18n.CloudShellCopy}}
                </span>
                <span class="btn btn-sm btn-secondary" role="button" tabindex="0"
                    onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.run()">{{i18n.CloudShellRunAgain}}</span>
            </div>
        </div>
        <div class="card-body" id="cs_result">
            <div class="empty" style="padding: var(--sp-6) var(--sp-4);">
                <svg class="icon" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 9 3 3-3 3M12 15h6"/></svg>
                <h3>{{i18n.CloudShellNoOutputTitle}}</h3>
                <p>{{i18n.CloudShellNoOutputMessage}}</p>
            </div>
        </div>
    </section>
</div>

<div class="stack" style="margin-top:0;">
    <section class="card">
        <div class="card-head"><h3>{{i18n.CloudShellReference}}</h3></div>
        <div class="card-body">
            <div class="search" style="margin-bottom:var(--sp-3);">
                <svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <input class="input" type="search" id="cs_refsearch" placeholder="{{i18n.CloudShellSearchVerbs}}"
                    aria-label="{{i18n.CloudShellSearchVerbs}}"
                    oninput="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.filterReference(this.value)">
            </div>
            <div id="cs_reflist">
            {{#referenceGroups}}
                <div class="cs_refgroup" data-group="{{label}}">{{label}}</div>
                {{#items}}
                <div class="cs_refitem" data-search="{{searchtext}}" data-group="{{group}}">
                    <div class="spread">
                        <span class="v">{{verb}}{{#danger}} <span class="badge badge-danger"><span class="dot"></span>{{i18n.CloudShellDestructive}}</span>{{/danger}}</span>
                        <span class="btn btn-sm btn-ghost" role="button" tabindex="0"
                            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.insert({{index}})">{{i18n.CloudShellInsert}}</span>
                    </div>
                    <div class="d">{{description}}</div>
                    <code class="s">{{syntax}}</code>
                </div>
                {{/items}}
            {{/referenceGroups}}
            </div>
            <p class="hint hide" id="cs_refempty">{{i18n.CloudShellNoVerbMatch}}</p>
        </div>
        <div class="card-foot">{{i18n.CloudShellInsertFoot}}</div>
    </section>

    <section class="card">
        <div class="card-head">
            <h3>{{i18n.CloudShellRecent}}</h3>
            <span class="btn btn-sm btn-ghost" role="button" tabindex="0"
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.showAllHistory()">{{i18n.CloudShellAll}}</span>
        </div>
        <div class="card-body" id="cs_recent" style="padding-top: var(--sp-1);"></div>
    </section>
</div>

</div>

<div class="overlay" id="cs_confirm" role="dialog" aria-modal="true" aria-label="{{i18n.CloudShellConfirmTitle}}">
    <div class="modal danger">
        <div class="modal-head">
            <h2>{{i18n.CloudShellConfirmTitle}}</h2>
            <span class="iconbtn" role="button" tabindex="0" aria-label="Close"
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.closeConfirm()">
                <svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
            </span>
        </div>
        <div class="modal-body">
            <div class="banner banner-danger" style="margin-bottom:var(--sp-4);">
                <svg class="icon" viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4m0 3v.01"/></svg>
                <div id="cs_confirmwhat"></div>
            </div>
            <p class="hint mt-0">{{i18n.CloudShellConfirmAbout}}</p>
            <div class="console" id="cs_confirmcmd" style="margin-bottom:var(--sp-4);">&mdash;</div>
            <label class="checkbox mb-0">
                <input type="checkbox" id="cs_confirmack"
                    onchange="document.querySelector('#cs_confirmgo').disabled = !this.checked;">
                <span>{{i18n.CloudShellConfirmAck}}</span>
            </label>
        </div>
        <div class="modal-foot">
            <span class="btn btn-secondary" role="button" tabindex="0"
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.closeConfirm()">{{i18n.CloudShellCancel}}</span>
            <button class="btn btn-danger" id="cs_confirmgo" disabled
                onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.confirmRun()">{{i18n.CloudShellConfirmGo}}</button>
        </div>
    </div>
</div>

</div>
`;

async function getHTML(formObject, cmdmanager) {
    if (!monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell) monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell = cloudshell;
    _cmdmanager = cmdmanager;
    _i18n = formObject.i18n?.[$$.libi18n.getSessionLang()] || formObject.i18n?.en || {};
    _catalogue = formObject.commands || [];
    _history = $$.libsession.get(HISTORY_KEY, []);

    _catalogue.forEach((entry, index) => {entry.index = index;
        entry.searchtext = `${entry.verb} ${entry.description||""} ${entry.group||""}`.toLowerCase();});

    const referenceGroups = [];
    for (const entry of _catalogue) {
        let group = referenceGroups.find(candidate => candidate.label == entry.group);
        if (!group) {group = {label: entry.group||"", items: [], i18n: _i18n}; referenceGroups.push(group);}
        group.items.push({...entry, i18n: _i18n});
    }

    const html = await $$.librouter.expandPageData(HTML_TEMPLATE, undefined, {i18n: _i18n, referenceGroups,
        project: $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT),
        org: $$.libsession.get(APP_CONSTANTS.USERORG)||"", username: $$.libsession.get(APP_CONSTANTS.USERNAME)||""});

    _renderRecentWhenMounted();     // the returned HTML is not in the DOM yet
    return html;
}

/** getHTML returns markup that main.showContent inserts afterwards — and it may
 *  animate first — so wait for the container rather than assuming a tick. */
function _renderRecentWhenMounted(attempt = 0) {
    setTimeout(_ => {
        if (document.querySelector("#cs_recent")) _renderRecent();
        else if (attempt < 20) _renderRecentWhenMounted(attempt+1);
    }, attempt == 0 ? 0 : 50);
}

/* ---------------------------------------------------------------- composing */

function insert(index) {
    const entry = _catalogue[index]; if (!entry) return;
    const input = document.querySelector("#cs_command"); if (!input) return;
    input.value = entry.syntax; input.focus(); check();
}

function clear() {
    const input = document.querySelector("#cs_command"); if (!input) return;
    input.value = ""; input.focus(); check();
}

/** Parses "verb "arg" "arg"" into its verb and quoted arguments. */
function _parse(raw) {
    const trimmed = (raw||"").trim(); if (!trimmed) return null;
    const verb = trimmed.split(/\s+/)[0];
    const args = trimmed.slice(verb.length).match(/"[^"]*"/g) || [];
    return {raw: trimmed, verb, args};
}

const _findVerb = verb => _catalogue.find(entry => entry.verb.toLowerCase() == (verb||"").toLowerCase());

/**
 * Advisory validation — reports what it can see, never blocks a run.
 * @returns the catalogue entry when the verb is known, else undefined
 */
function check() {
    const input = document.querySelector("#cs_command"), parseLine = document.querySelector("#cs_parse");
    const dangerBanner = document.querySelector("#cs_danger"), dangerText = document.querySelector("#cs_dangertext");
    if (!input || !parseLine) return;
    dangerBanner.classList.add("hide");

    const parsed = _parse(input.value);
    if (!parsed) {parseLine.textContent = _i18n.CloudShellParseIdle||""; return;}

    const known = _findVerb(parsed.verb);
    if (!known) {
        const near = _catalogue.find(entry => entry.verb.toLowerCase().startsWith(parsed.verb.slice(0, 4).toLowerCase()));
        parseLine.innerHTML = `<span class="text-warning">${_esc(parsed.verb)}</span> ${_esc(_i18n.CloudShellUnknownVerb||"")}` +
            (near ? ` ${_esc(_i18n.CloudShellDidYouMean||"")} <span class="mono">${_esc(near.verb)}</span>?` : "");
        return;
    }

    let message = `<span class="text-success">✓ ${_esc(known.verb)}</span> · ${_esc(known.description||"")}`;
    if (known.args !== undefined && parsed.args.length != known.args) message +=
        `<br><span class="mono">${_esc(known.syntax)}</span>`;
    parseLine.innerHTML = message;

    if (known.danger) {
        dangerBanner.classList.remove("hide");
        dangerText.innerHTML = `<strong>${_esc(known.verb)}</strong> ${_esc(known.danger)}`;
    }
    return known;
}

function filterReference(query) {
    const needle = (query||"").trim().toLowerCase();
    let visible = 0;
    for (const item of document.querySelectorAll("#cs_reflist div.cs_refitem")) {
        const matches = !needle || item.dataset.search.includes(needle);
        item.classList.toggle("hide", !matches); if (matches) visible++;
    }
    for (const groupLabel of document.querySelectorAll("#cs_reflist div.cs_refgroup")) {
        const groupItems = [...document.querySelectorAll(`#cs_reflist div.cs_refitem[data-group="${CSS.escape(groupLabel.dataset.group)}"]`)];
        groupLabel.classList.toggle("hide", !groupItems.some(item => !item.classList.contains("hide")));
    }
    document.querySelector("#cs_refempty")?.classList.toggle("hide", visible > 0);
}

/* ------------------------------------------------------------------ running */

function run() {
    const input = document.querySelector("#cs_command"); if (!input) return;
    const parsed = _parse(input.value); if (!parsed) {input.focus(); return;}

    const known = _findVerb(parsed.verb);
    if (known?.danger) {_openConfirm(parsed.raw, known); return;}
    _execute(parsed.raw);
}

function confirmRun() {
    const command = document.querySelector("#cs_confirmcmd")?.textContent || "";
    closeConfirm();
    if (command.trim()) _execute(command.trim());
}

function _openConfirm(raw, known) {
    const overlay = document.querySelector("#cs_confirm"); if (!overlay) return;
    document.querySelector("#cs_confirmcmd").textContent = raw;
    document.querySelector("#cs_confirmwhat").innerHTML =
        `<strong>${_esc(known.verb)}</strong> ${_esc(known.danger)} ${_esc(_i18n.CloudShellConfirmProject||"")} ` +
        `<strong>${_esc($$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT))}</strong>.`;
    const ack = document.querySelector("#cs_confirmack"), go = document.querySelector("#cs_confirmgo");
    ack.checked = false; go.disabled = true;
    overlay.classList.add("open");
}

function closeConfirm() {document.querySelector("#cs_confirm")?.classList.remove("open");}

async function _execute(raw) {
    const project = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT);
    _renderRunning(raw);

    const started = Date.now(); let cmdResult;
    try {
        cmdResult = await $$.libapimanager.rest({url: APP_CONSTANTS.API_KLOUDUSTCMD, type: "POST",
            req: {cmd: raw, project}, sendToken: true, sseURL: APP_CONSTANTS.API_SSE});
    } catch (err) {LOG.error(`Cloud shell command failed: ${err}`); cmdResult = {result: false, err: String(err)};}
    const duration = Date.now() - started;

    _renderResult(raw, cmdResult, duration, project);
    _pushHistory(raw, cmdResult, duration, project);
    _recordAlerts(raw, cmdResult, project);
}

/* ---------------------------------------------------------------- rendering */

function _renderRunning(raw) {
    document.querySelector("#cs_resultactions")?.classList.add("hide");
    const body = document.querySelector("#cs_result"); if (!body) return;
    body.innerHTML = `<div class="feed-item" style="border:0;">
        <span class="spinner" role="img" aria-label="Running"></span>
        <div><div class="t">${_esc(_i18n.CloudShellRunning||"Running…")}</div>
        <div class="m mono text-sm">${_esc(raw)}</div></div></div>`;
}

function _renderResult(raw, cmdResult, duration, project) {
    const body = document.querySelector("#cs_result"); if (!body) return;
    const succeeded = cmdResult?.result == true, exitcode = cmdResult?.exitcode;
    const outputText = [cmdResult?.out, cmdResult?.err].filter(part => (part||"").trim() != "").join("\n");

    const statusLabel = succeeded
        ? `${_i18n.CloudShellExitCode||"Exit code"} ${exitcode !== undefined ? exitcode : 0}`
        : (_i18n.CloudShellFailed||"Command failed");
    const consoleHTML = outputText.trim() == ""
        ? `<div class="dim">${_esc(_i18n.CloudShellNoTextOutput||"(no output)")}</div>`
        : outputText.split(/\r?\n/).map(line => `<div class="${_lineClass(line)}">${_esc(line)}</div>`).join("");

    body.innerHTML = `
        <div class="spread" style="margin-bottom:var(--sp-3);">
            <span class="badge ${succeeded ? "badge-success" : "badge-danger"}"><span class="dot"></span>${_esc(statusLabel)}</span>
            <span class="hint" style="margin:0;">${_esc(_i18n.CloudShellTook||"took")} ${_formatDuration(duration)} · ${_esc(_i18n.CloudShellProject||"project")} ${_esc(project)}</span>
        </div>
        <p class="mono text-sm" style="color:var(--text-2);">$ ${_esc(raw)}</p>
        <div class="console" id="cs_console">${consoleHTML}</div>`;
    document.querySelector("#cs_resultactions")?.classList.remove("hide");
}

const _lineClass = line => /exit code:\s*0\b/i.test(line) ? "ok"
    : /exit code:\s*[1-9]|error|failed|abort|mismatch/i.test(line) ? "err" : "";

function copyOutput() {
    const consoleBox = document.querySelector("#cs_console"); if (!consoleBox) return;
    $$.copyTextToClipboard(consoleBox.innerText);
}

/* ------------------------------------------------------------------ history */

function _pushHistory(raw, cmdResult, duration, project) {
    const entry = {command: raw, ok: cmdResult?.result == true, exitcode: cmdResult?.exitcode,
        duration, project, timestamp: Date.now()};
    _history = [entry, ..._history.filter(old => old.command != raw)].slice(0, HISTORY_MAX);
    $$.libsession.set(HISTORY_KEY, _history);
    _renderRecent();
}

function _renderRecent(showAll) {
    const container = document.querySelector("#cs_recent"); if (!container) return;
    if (!_history.length) {
        container.innerHTML = `<p class="hint mt-0">${_esc(_i18n.CloudShellNoHistory||"")}</p>`; return;
    }
    const shown = showAll ? _history : _history.slice(0, RECENT_SHOWN);
    container.innerHTML = shown.map((entry, index) => `
        <div class="feed-item" onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].cloudshell.loadHistory(${index})">
            ${entry.ok
                ? `<svg class="icon text-success" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9"/></svg>`
                : `<svg class="icon text-danger" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6m0-6-6 6"/></svg>`}
            <div style="flex:1; min-width:0;">
                <div class="t mono text-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_esc(entry.command)}</div>
                <div class="m">${_esc(entry.ok ? (_i18n.CloudShellCompleted||"Completed") : (_i18n.CloudShellFailed||"Failed"))} · ${_formatDuration(entry.duration)} · ${_esc(entry.project||"")}</div>
            </div>
            <time>${_esc(_formatAge(entry.timestamp))}</time>
        </div>`).join("");
}

function showAllHistory() {_renderRecent(true);}

function loadHistory(index) {
    const entry = _history[index]; if (!entry) return;
    const input = document.querySelector("#cs_command"); if (!input) return;
    input.value = entry.command; input.focus(); check();
    input.scrollIntoView({behavior: "smooth", block: "center"});
}

/** Mirrors command output into the shared alerts stack so the alerts panel
 *  and dashboard feed still see everything run from here. */
function _recordAlerts(raw, cmdResult, project) {
    if (!_cmdmanager) return;
    const alertID = Date.now();
    _cmdmanager.addAlert(alertID, `Running command for project ${project} - ${raw}`);
    if (cmdResult?.result) {
        _cmdmanager.addAlert(alertID, `Success. Command output follows.`);
        if ((cmdResult.out||"").trim() != "") _cmdmanager.addAlert(alertID, cmdResult.out);
        if ((cmdResult.err||"").trim() != "") _cmdmanager.addAlert(alertID, cmdResult.err);
        _cmdmanager.addAlert(alertID, `Exit code: ${cmdResult.exitcode}`);
    } else _cmdmanager.addAlert(alertID,
        `Command Failed for project ${project} - ${raw}${cmdResult?.err?". Error was\n"+cmdResult.err:""}`, true);
}

/* ------------------------------------------------------------------ helpers */

const _esc = text => $$.libutil.encodeHTMLEntities(String(text === undefined || text === null ? "" : text));

function _formatDuration(ms) {
    if (ms === undefined) return "";
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60000) return `${(ms/1000).toFixed(1)} s`;
    const minutes = Math.floor(ms/60000), seconds = Math.round((ms%60000)/1000);
    return `${minutes} m ${seconds} s`;
}

function _formatAge(timestamp) {
    const elapsed = Date.now() - timestamp;
    if (elapsed < 60000) return _i18n.CloudShellJustNow||"now";
    if (elapsed < 3600000) return `${Math.floor(elapsed/60000)}m`;
    if (elapsed < 86400000) return `${Math.floor(elapsed/3600000)}h`;
    return new Date(timestamp).toLocaleDateString();
}

export const cloudshell = {getHTML, insert, clear, check, filterReference, run, confirmRun, closeConfirm,
    copyOutput, loadHistory, showAllHistory};
