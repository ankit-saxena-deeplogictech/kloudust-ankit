/**
 * Image detail frontend module — the slide-over behind an image tile's Details
 * action, per the redesign's images wireframe.
 *
 * The Images tile pins the clicked image into APP_CONSTANTS.ENV._images_form_data
 * (the same row-to-command handoff table rows use). Everything shown here is
 * read from that record plus one listVMsForOrgOrProject call:
 *   - extrainfo is "<ostype>:<imgtype>" (see backend createVM.js), giving the
 *     OS variant and the image format
 *   - createVM writes that same ostype into vms.os, so the VMs built from this
 *     image are a real join, not an estimate
 *
 * Deliberately absent, because the schema has no column for them: image state
 * (ready/downloading/failed), size on disk, SHA-256, which hosts hold a copy,
 * and who added it. The wireframe shows those; inventing them would misreport
 * the cloud.
 *
 * Rendered embedded inside the shared drawer, so it supplies no heading or
 * close button of its own. Light DOM — document stylesheets apply and this
 * module contains no CSS.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

const HTML_TEMPLATE = `
<div id="imagedetail" class="stack">

<div class="cluster">
    <span class="os-mark" {{#image.os}}data-os="{{.}}"{{/image.os}} aria-hidden="true">{{image.monogram}}</span>
    <span class="mono">{{image.name}}</span>
</div>

{{#badges.length}}
<div class="cluster">
{{#badges}}<span class="badge badge-{{variant}}">{{value}}</span>{{/badges}}
</div>
{{/badges.length}}

<dl class="props">
{{#props}}
    <dt>{{label}}</dt>
    <dd {{#mono}}class="mono"{{/mono}}{{#muted}}class="muted"{{/muted}}>{{value}}{{#copyable}}
        <span class="iconbtn" role="button" tabindex="0" aria-label="{{i18n.ImageDetailCopy}}"
            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].imagedetail.copyValue(this, '{{{copyable}}}')">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>
        </span>
    {{/copyable}}</dd>
{{/props}}
</dl>

<div class="card table-card">
    <div class="card-head"><h3>{{i18n.ImageDetailVMs}}{{#vms.length}} ({{vmcount}}){{/vms.length}}</h3></div>
    {{#vms.length}}
    <div class="table-scroll">
        <table class="dt">
            <thead><tr><th>{{i18n.ImageDetailVMName}}</th><th>{{i18n.ImageDetailVMCreated}}</th></tr></thead>
            <tbody>
            {{#vms}}
                <tr>
                    <td class="cell-main">
                        <button class="name-link"
                            onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].imagedetail.openVM('{{{payload}}}')">{{name}}</button>
                    </td>
                    <td class="muted">{{created}}</td>
                </tr>
            {{/vms}}
            </tbody>
        </table>
    </div>
    <div class="card-foot">{{i18n.ImageDetailVMsFoot}}</div>
    {{/vms.length}}
    {{^vms}}
    <div class="empty">
        <svg class="icon" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        <h3>{{i18n.ImageDetailNoVMsTitle}}</h3>
        <p>{{i18n.ImageDetailNoVMsMessage}}</p>
    </div>
    {{/vms}}
</div>

<div class="cluster">
{{#actions}}
    <span class="btn {{buttonclass}}" role="button" tabindex="0"
        onclick="monkshu_env.apps[APP_CONSTANTS.APP_NAME].imagedetail.runCommand('{{id}}')">{{label}}</span>
{{/actions}}
</div>

</div>
`;

const NO_IMAGE_TEMPLATE = `
<div id="imagedetail">
    <div class="banner banner-warning">
        <svg class="icon" viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4m0 3v.01"/></svg>
        <div>{{i18n.ImageDetailNoImage}}</div>
    </div>
</div>
`;

const OS_MATCHERS = [["ubuntu","ubuntu"], ["rhel","rhel"], ["redhat","rhel"], ["debian","debian"],
    ["windows","windows"], ["win1","windows"], ["rocky","rocky"]];

async function getHTML(formObject, cmdmanager, _embedded) {
    if (!monkshu_env.apps[APP_CONSTANTS.APP_NAME].imagedetail) monkshu_env.apps[APP_CONSTANTS.APP_NAME].imagedetail = imagedetail;
    const i18nL = formObject.i18n?.[$$.libi18n.getSessionLang()] || formObject.i18n?.en || {};
    const pinned = APP_CONSTANTS.ENV._images_form_data;
    if (!pinned) return await $$.librouter.expandPageData(NO_IMAGE_TEMPLATE, undefined, {i18n: i18nL});

    // The tile already derived these; recompute so the drawer stands alone if
    // it is ever opened from somewhere that pins only the raw record.
    const splits = String(pinned.extrainfo||"").split(":");
    const osvariant = pinned.osvariant || (splits[0]||"").trim();
    const format = pinned.format || (splits[1]||"").trim();

    const markSource = String(osvariant || pinned.name || "").toLowerCase();
    let os = ""; for (const [needle, osname] of OS_MATCHERS) if (markSource.includes(needle)) {os = osname; break;}
    const image = {...pinned, os, monogram: markSource.substring(0, 2).toUpperCase()};

    const org = $$.libsession.get(APP_CONSTANTS.USERORG);
    const project = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT);
    const allVMs = await _command(
        `listVMsForOrgOrProject "${org}" "${project}" "${APP_CONSTANTS.VM_TYPE_VM}"`, project, "vms");
    const builtFrom = osvariant ? allVMs.filter(vm => vm.os == osvariant) : [];

    const badges = [];
    if (format) badges.push({value: format.toUpperCase(), variant: "neutral"});
    if (pinned.processorarchitecture) badges.push({value: pinned.processorarchitecture, variant: "neutral"});

    const props = _properties([
        [i18nL.ImageDetailDescription||"Description", pinned.description],
        [i18nL.ImageDetailOSVariant||"OS variant", osvariant, {mono: true}],
        [i18nL.ImageDetailFormat||"Format", format ? format.toUpperCase() : undefined],
        [i18nL.ImageDetailArch||"Architecture", pinned.processorarchitecture],
        [i18nL.ImageDetailSource||"Source", pinned.uri, {mono: true, copyable: pinned.uri}],
        [i18nL.ImageDetailVisibility||"Visibility",
            org ? (i18nL.ImageDetailVisibilityValue||"All projects in {org}").replace("{org}", org) : undefined],
        [i18nL.ImageDetailAdded||"Added",
            pinned.timestamp ? new Date(parseInt(pinned.timestamp)).toLocaleString() : undefined, {muted: true}]
    ]);

    const vms = builtFrom.map(vm => ({
        name: vm.name_raw || vm.name,
        created: vm.timestamp ? new Date(parseInt(vm.timestamp)).toLocaleDateString() : "",
        payload: $$.libutil.stringToBase64(JSON.stringify(vm))
    }));

    const cmdlist = (await import(`${APP_CONSTANTS.LIB_PATH}/cmdlist.mjs`)).cmdlist;
    const actions = (await cmdlist.getCommands(undefined, formObject)) || [];
    for (const action of actions) {
        cmdmanager.registerCommand(action);
        action.buttonclass = action.id == "deleteimage" ? "btn-danger-outline"
            : action.id == "createvm" ? "btn-primary" : "btn-secondary";
    }

    return await $$.librouter.expandPageData(HTML_TEMPLATE, undefined,
        {i18n: i18nL, image, badges, props, actions, vmcount: vms.length, vms: vms.length ? vms : undefined});
}

/** Opens a command from the drawer. The image stays pinned, so addimage and
 *  deleteimage prefill from it exactly as they do from a tile action. */
function runCommand(commandID) {
    const cmdmanager = monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager;
    cmdmanager.registerCommand({id: commandID});
    cmdmanager.cmdClicked(commandID);
}

/** Jumps to a VM built from this image, pinning it the way the VMs table does. */
function openVM(payloadBase64) {
    let vm; try {vm = JSON.parse($$.libutil.base64ToString(payloadBase64));}
    catch (err) {LOG.error(`Bad VM payload: ${err}`); return;}
    APP_CONSTANTS.ENV._vms_form_data = vm;
    runCommand("vmdetail");
}

function copyValue(element, value) {
    $$.copyTextToClipboard(value);
    element.setAttribute("aria-label", "Copied");
}

const _properties = rows => rows
    .filter(([_label, value]) => value !== undefined && value !== null && String(value).trim() != "")
    .map(([label, value, options]) => ({label, value, mono: options?.mono||false,
        muted: options?.muted||false, copyable: options?.copyable}));

async function _command(cmd, project, resultKey) {
    try {
        const result = await $$.libapimanager.rest(APP_CONSTANTS.API_KLOUDUSTCMD, 'POST', {cmd, project}, true);
        return result?.[resultKey] || [];
    } catch (err) {LOG.error(`Image detail lookup failed for ${cmd}: ${err}`); return [];}
}

export const imagedetail = {getHTML, runCommand, openVM, copyValue};
