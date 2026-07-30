/**
 * Handles Kloudust UI commands. Registers and runs them.
 *  
 * (C) 2022 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

import {rolemanager as roleman} from "./rolemanager.mjs";

const REGISTERED_COMMANDS = {}, KLOUDUST_CMDLINE = "kloudust_cmdline", AUTOMATION_CMDLINE = "automation_cmdline",
    FRONTEND_MODULE = "frontend_module", ALERT_OBJECT_KEY = "__com_tekmonks_kloudust_frontend_alerts",
    ALERT_ERROR = "error", ALERT_INFO = "info", RAW_COMMANDLINE_COMMAND = "RAW_COMMANDLINE",
    TABLE_DISPLAY = "table_display", DRAWER = "drawer", apiman = $$.libapimanager;

// Page-level commands only. A drawer sits over the page rather than replacing
// it, so it is tracked separately and never enters the back stack.
const cmd_stack = [];
let _open_drawer_id = null;

const _main = _ => monkshu_env.apps[APP_CONSTANTS.APP_NAME].main;

/**
 * Registers the given command object.
 * @param {Object} cmdObject Command object
 */
function registerCommand(cmdObject) {
    REGISTERED_COMMANDS[cmdObject.id] = cmdObject;

    // plug ourselves into the enviornment if not present
    if (!monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager) monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager = cmdmanager;
}

/**
 * Handles command clicked event
 * @param {string} id The ID of the command clicked 
 * @returns The command output
 */
async function cmdClicked(id) {
    const command = REGISTERED_COMMANDS[id]; if (!command) {LOG.error(`Commands ${id} not found.`); return;}

    try {
        const formJSON = await $$.requireJSON(`${APP_CONSTANTS.FORMS_PATH}/${id}.form.json`, APP_CONSTANTS.INSECURE_DEVELOPMENT_MODE?true:undefined);
        const asDrawer = formJSON.presentation?.toLowerCase() == DRAWER;

        // Drawer forms render embedded — the drawer chrome supplies the heading
        // and the close button, so the component must not repeat them.
        const html = await _getFormHTML(formJSON, asDrawer||undefined);
        if (asDrawer) {_open_drawer_id = id; _main().openDrawer(html, await _expandTitle(formJSON.title)); return;}

        _main().showContent(html, true);
        if (!cmd_stack.length) cmd_stack.push(id); else if (cmd_stack[cmd_stack.length-1] != id) cmd_stack.push(id);
    } catch (err) {LOG.error(`Error loading command files for ${id}: ${err}`); return;}
}

/** Titles carry i18n mustache; _getFormHTML has already registered the form's
 *  i18n objects by the time this runs, so expansion resolves them. */
async function _expandTitle(title) {
    if (!title) return "";
    try {return (await $$.librouter.expandPageData(title, undefined, {})).trim();}
    catch (err) {LOG.warn(`Could not expand drawer title ${title}: ${err}`); return "";}
}

function closeForm() {
    // A drawer closes back onto the page that was already there.
    if (_open_drawer_id) {_open_drawer_id = null; _main().closeDrawer(); return;}

    const _currentForm = cmd_stack.pop(), nextForm = cmd_stack.pop();
    if (nextForm) cmdClicked(nextForm); else _main().hideOpenContent();
}

function reloadForm() {
    const currentForm = cmd_stack.pop()
    cmdClicked(currentForm);
}

async function formSubmitted(id, values) {
    const wasDrawer = _open_drawer_id == id;
    closeForm();    // close the form (or the drawer it was in)

    const form = await $$.requireJSON(`${APP_CONSTANTS.FORMS_PATH}/${id}.form.json`);

    if (form.type == AUTOMATION_CMDLINE) {
        const automationModule = (await import(`${APP_CONSTANTS.AUTOMATIONS_PATH}/${form.command}.mjs`))[form.command];
        const valueArray = []; for (const key of form.kloudust_cmdline_params) valueArray.push(values[key]);
        automationModule.exec(valueArray, async (command, project)=>_kdcmd(RAW_COMMANDLINE_COMMAND, ["command"], {command}, project));
    } else if (form.type == KLOUDUST_CMDLINE) await _kdcmd(form.command, form.kloudust_cmdline_params, values);

    // Closing a drawer leaves the page untouched, so it is still showing
    // pre-command data. A page form already re-rendered via the back stack.
    if (wasDrawer && cmd_stack.length) reloadForm();
}

/**
 * Runs a Kloudust command line directly, outside the form flow — used by bulk
 * table actions. Output lands in the alerts stack exactly as a form submit does.
 * @param {string} command The Kloudust command verb
 * @param {array} params Ordered value keys, mapped to quoted command arguments
 * @param {Object} values The values, keyed by the names in params
 * @param {string} projectOverride Optional project to run against
 * @returns The command result
 */
const runCloudCommand = (command, params, values, projectOverride) => _kdcmd(command, params, values, projectOverride);

function addAlert(id, text, isError) {
    const formattedAlert = {type: isError?ALERT_ERROR:ALERT_INFO, message: text};
    const alertObject = $$.libsession.get(ALERT_OBJECT_KEY, {});
    const thisAlertStack = alertObject[id]||[];
    thisAlertStack.push(formattedAlert);
    alertObject[id] = thisAlertStack;
    $$.libsession.set(ALERT_OBJECT_KEY, alertObject);
}

function getAlerts() {
    const alertObject = $$.libsession.get(ALERT_OBJECT_KEY, {});
    return $$.libutil.clone(alertObject);
}

const clearAlerts = _ => $$.libsession.set(ALERT_OBJECT_KEY, {});

async function _kdcmd(formCommand, formKloudust_cmdline_params, values, projectOverride) {
    if (values._override_form_command) formCommand = values._override_form_command;
    let command = formCommand == RAW_COMMANDLINE_COMMAND?"":formCommand;
    const cmdLineMap = formKloudust_cmdline_params;
    for (const param of cmdLineMap) command += formCommand == RAW_COMMANDLINE_COMMAND ?
        values[param]+" " : " "+('"'+values[param]+'"'||'""');
    command = command.trim();
    
    const project = projectOverride || $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT, APP_CONSTANTS.DEFAULT_PROJECT);
    const alertID = Date.now();
    _processCommandOutput(alertID, `Running command for project ${project} - ${command}`, false);
    const cmdResult = await apiman.rest({url: APP_CONSTANTS.API_KLOUDUSTCMD, 
        type: "POST", req: {cmd: command, project}, sendToken: true, sseURL: APP_CONSTANTS.API_SSE});
    if (cmdResult?.result) {
        _processCommandOutput(alertID, `Success. Command output follows.`);
        if ((cmdResult.out||"").trim() != "") _processCommandOutput(alertID, cmdResult.out);
        if ((cmdResult.err||"").trim() != "") _processCommandOutput(alertID, cmdResult.err);
        _processCommandOutput(alertID, `Exit code: ${cmdResult.exitcode}`);
    } else _processCommandOutput(alertID, `Command Failed for project ${project} - ${command}${cmdResult?.err?". Error was\n"+cmdResult.err:""}`, true);

    // One toast per command — the alerts stack keeps the full transcript, this is
    // only the immediate outcome so the user need not go looking for it.
    _toast(cmdResult?.result ? `${formCommand}: success` : `${formCommand} failed. See alerts for details.`,
        cmdResult?.result ? "success" : "error");
    return cmdResult;
}

const _toast = (message, type) => {try {_main()?.toast(message, type);} catch (err) {LOG.warn(`Toast failed: ${err}`);}}

function _processCommandOutput(id, text, isError=false) {
    if (isError) addAlert(id, text, true);
    else addAlert(id, text);
}

/**
 * Builds the HTML for a form JSON.
 * @param {Object} formJSON The parsed form.json
 * @param {boolean} embedded Optional: rendering inside another page (a tab, say),
 *                  so the component should skip its own page heading and close button
 */
async function _getFormHTML(formJSON, embedded) {
    let html = "";

    // Registered up front so every type — including frontend_module and the
    // drawer title — can resolve the form's own i18n keys.
    if (formJSON.i18n) for (const [lang, i18nObject] of Object.entries(formJSON.i18n)) await $$.libi18n.setI18NObject(lang, i18nObject);

    if (formJSON.type.toLowerCase() == KLOUDUST_CMDLINE || formJSON.type.toLowerCase() == AUTOMATION_CMDLINE) {
        // formtitle lets the component render a page heading; dropped by JSON.stringify if the form has no title
        const base64FormJSON = $$.libutil.stringToBase64(JSON.stringify({...formJSON.form, formtitle: formJSON.title, embedded})), id = formJSON.id;

        const formComponent = formJSON.display?.toLowerCase() == "wizard" ? "form-wizard" : "form-runner";
        html = `<${formComponent} id="${id}" data-form='${base64FormJSON}'
            onclose='monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm()'
            onsubmit='monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.formSubmitted("${id}", formdata)'></${formComponent}>`;
    }

    if (formJSON.type.toLowerCase() == TABLE_DISPLAY) {
        const base64TabledefJSON = $$.libutil.stringToBase64(JSON.stringify({...formJSON.tabledef, formtitle: formJSON.title, embedded})), id = formJSON.id;

        const tableComponent = formJSON.display?.toLowerCase() == "tiles" ? "tile-list" : "table-list";
        html = `<${tableComponent} id="${id}" data-tabledef='${base64TabledefJSON}'
            onclose='monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm()'></${tableComponent}>`;
    }
    
    if (formJSON.type.toLowerCase() == FRONTEND_MODULE) {
        const formModule = await import(`${APP_CONSTANTS.FORM_MODULES_PATH}/${formJSON.command}.mjs`);
        // embedded is a third, optional arg — modules that ignore it are unaffected
        html = await formModule[formJSON.command].getHTML(formJSON, cmdmanager, embedded);
    }

    return html;
}

export const cmdmanager = {registerCommand, cmdClicked, formSubmitted, closeForm, addAlert, getAlerts, clearAlerts,
    reloadForm, isCloudAdminLoggedIn: roleman.isCloudAdminLoggedIn, getFormHTML: _getFormHTML,
    runCloudCommand, ALERT_ERROR, ALERT_INFO};