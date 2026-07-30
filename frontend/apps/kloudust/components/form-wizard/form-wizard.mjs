/**
 * Interprets and runs form.json files whose display is "wizard".
 * Renders a multi-step form with a progress stepper, per-step validation,
 * an auto-generated review step and a final submit.
 *
 * Schema — the form object carries "steps" instead of required_fields:
 *   "form": {
 *     "description": "...",
 *     "steps": [
 *       {"label": "...", "fields": [ <same field schema as form-runner> ]},
 *       {"label": "...", "review": true}     <- auto-generated summary
 *     ],
 *     "submitlabel": "...", "load_javascript": [...], "submit_javascript": [...]
 *   }
 * Fields support the same declarative keys as form-runner (label, hint,
 * fieldrow, variant, rows, pattern, …) and the same value-collection and
 * load/rendered/submit javascript contracts, so kloudust_cmdline submission
 * through cmdmanager is unchanged.
 *
 * A step may also declare "presets" — shortcut cards that fill fields the step
 * already has, so they are a faster path into those fields and never a
 * substitute for them:
 *   "presets": {"label": "...", "hint": "...", "options": [
 *      {"label": "Small", "spec": "1 vCPU · 2 GB · 20 GB",
 *       "values": {"<field id>": "<value>", …}, "selected": true}]}
 * Clicking a card writes its values into those fields and fires an input event
 * so any listener sees a normal edit; editing a field by hand deselects the
 * card, since the values no longer describe what is in the form.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */
import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta), INPUT_ELEMENTS = ["input", "select", "textarea"];

async function elementConnected(host) {
    const formData = util.base64ToString(host.dataset.form);
    const expandedData = await router.expandPageData(formData);
    let formObject = JSON.parse(expandedData);
    formObject = await _runOnLoadJavascript(formObject);
    let stepindex = 0; for (const step of formObject.steps||[]) {
        step.stepindex = ++stepindex; step.first = step.stepindex == 1;
        for (const field of step.fields||[]) {
            field.label = field.label||"";
            // type: "switch" is ours, not an HTML input type — translate it here
            if (field.type == "switch") {field.switchfield = true; field.checked = String(field.value) == "true";}
        }
        step.rowgroups = _groupFieldsIntoRows(step.fields);
        // Base64 keeps the values map out of the HTML attribute's quoting rules.
        for (const option of step.presets?.options||[])
            option.valuesbase64 = util.stringToBase64(JSON.stringify(option.values||{}));
    }
    formObject.totalsteps = stepindex;
    form_wizard.setDataByHost(host, formObject);
}

async function elementRendered(host) {
    const formObject = form_wizard.getDataByHost(host);
    formObject._form_host_element = host;
    formObject._form_shadowroot = form_wizard.getShadowRootByHost(host);
    host.dataset.currentstep = "1";
    _refreshWizardState(host);
    _wirePresetDeselection(formObject._form_shadowroot);
    _applySelectedPresets(formObject._form_shadowroot);
    await _runOnRenderedJavascript(formObject);
}

/** Writes a preset's values into the fields it names. The fields stay the
 *  source of truth — this only types into them on the user's behalf. */
function applyPreset(element) {
    const shadowRoot = form_wizard.getShadowRootByContainedElement(element);
    const grid = element.closest("div.preset-grid"); if (!grid) return;
    for (const preset of grid.querySelectorAll("button.preset"))
        preset.setAttribute("aria-pressed", String(preset == element));
    _writePresetValues(shadowRoot, grid, element);
}

function _writePresetValues(shadowRoot, grid, preset) {
    let values; try {values = JSON.parse(util.base64ToString(preset.dataset.preset||""));}
    catch (err) {LOG.error(`Bad preset values on ${preset.textContent}: ${err}`); return;}

    grid.dataset.applying = "true";     // our own writes must not deselect the card
    for (const [id, value] of Object.entries(values)) {
        const field = shadowRoot.querySelector(`#${CSS.escape(id)}`);
        if (!field) {LOG.warn(`Preset references unknown field ${id}`); continue;}
        field.value = value;
        field.dispatchEvent(new Event("input", {bubbles: true}));
        field.dispatchEvent(new Event("change", {bubbles: true}));
    }
    delete grid.dataset.applying;
}

/** A preset marked "selected" is a default, so the form opens already filled in. */
function _applySelectedPresets(shadowRoot) {
    if (!shadowRoot) return;
    for (const grid of shadowRoot.querySelectorAll("div.preset-grid")) {
        const selected = grid.querySelector('button.preset[aria-pressed="true"]');
        if (selected) _writePresetValues(shadowRoot, grid, selected);
    }
}

/** Editing any field a preset controls means the card no longer describes the
 *  form, so it stops claiming it does. */
function _wirePresetDeselection(shadowRoot) {
    if (!shadowRoot) return;
    for (const grid of shadowRoot.querySelectorAll("div.preset-grid")) {
        const fieldIDs = new Set();
        for (const preset of grid.querySelectorAll("button.preset")) {
            try {for (const id of Object.keys(JSON.parse(util.base64ToString(preset.dataset.preset||"")))) fieldIDs.add(id);}
            catch (err) {LOG.error(`Bad preset values: ${err}`);}
        }
        for (const id of fieldIDs) {
            const field = shadowRoot.querySelector(`#${CSS.escape(id)}`); if (!field) continue;
            field.addEventListener("input", _ => {
                if (grid.dataset.applying == "true") return;
                for (const preset of grid.querySelectorAll("button.preset")) preset.setAttribute("aria-pressed", "false");
            });
        }
    }
}

async function close(element) {
    const onclose = await form_wizard.getAttrValue(form_wizard.getHostElement(element), "onclose");
    if (onclose && onclose.trim() != "") new Function(onclose)();
}

function next(element) {
    const host = form_wizard.getHostElement(element), shadowRoot = form_wizard.getShadowRootByHost(host);
    const data = form_wizard.getDataByHost(host), current = parseInt(host.dataset.currentstep||"1");
    if (!_validateStep(shadowRoot, current)) return;
    const newStep = Math.min(current+1, data.totalsteps);
    host.dataset.currentstep = ""+newStep;
    if ((data.steps||[])[newStep-1]?.review) _buildReview(shadowRoot, data);
    _refreshWizardState(host);
}

function back(element) {
    const host = form_wizard.getHostElement(element);
    host.dataset.currentstep = ""+Math.max(parseInt(host.dataset.currentstep||"1")-1, 1);
    _refreshWizardState(host);
}

async function formSubmitted(element) {
    const host = form_wizard.getHostElement(element), shadowRoot = form_wizard.getShadowRootByHost(host);
    const allFormElements = []; for (const inputElement of INPUT_ELEMENTS) allFormElements.push(...shadowRoot.querySelectorAll(inputElement));
    _clearFieldErrors(shadowRoot);
    for (const input of allFormElements) if ((input.dataset.optional?.toLowerCase() != "true") && (!input.checkValidity())) {
        const panel = input.closest("section.wizard-panel");    // jump to the step holding the invalid field
        if (panel) {host.dataset.currentstep = panel.dataset.step; _refreshWizardState(host);}
        LOG.error(`Submit failed due to failed validation of ${input.id}`);
        _showFieldError(shadowRoot, input); return false;
    }

    const retObject = {}; for (const formElement of allFormElements)
        retObject[formElement.id] = _valueOf(formElement);
    const onsubmit = await form_wizard.getAttrValue(host, "onsubmit");
    if (onsubmit && onsubmit.trim() != "") {
        const form = form_wizard.getDataByHost(host);
        await _runOnSubmitJavascript(retObject, form);

        const functionCode = `const formdata = ${JSON.stringify(retObject)}; ${onsubmit}`;
        new Function(functionCode)();
    }
}

function _refreshWizardState(host) {
    const shadowRoot = form_wizard.getShadowRootByHost(host), data = form_wizard.getDataByHost(host);
    const current = parseInt(host.dataset.currentstep||"1");
    for (const panel of shadowRoot.querySelectorAll("section.wizard-panel"))
        panel.hidden = parseInt(panel.dataset.step) != current;
    for (const step of shadowRoot.querySelectorAll("li.step")) {
        const index = parseInt(step.dataset.step);
        step.classList.toggle("active", index == current);
        step.classList.toggle("done", index < current);
    }
    shadowRoot.querySelector("#wizback")?.classList.toggle("hide", current == 1);
    shadowRoot.querySelector("#wiznext")?.classList.toggle("hide", current == data.totalsteps);
    shadowRoot.querySelector("#wizsubmit")?.classList.toggle("hide", current != data.totalsteps);
}

function _validateStep(shadowRoot, stepindex) {
    const panel = shadowRoot.querySelector(`section.wizard-panel[data-step="${stepindex}"]`);
    if (!panel) return true;
    _clearFieldErrors(panel);
    for (const input of panel.querySelectorAll(INPUT_ELEMENTS.join(",")))
        if ((input.dataset.optional?.toLowerCase() != "true") && (!input.checkValidity())) {
            _showFieldError(shadowRoot, input); return false;}
    return true;
}

/** A checkbox answers with .checked, not .value — mapped to the same
 *  "true"/"false" strings the Yes/No selects produce, so the command line is
 *  identical either way. Everything else keeps the legacy behaviour. */
function _valueOf(formElement) {
    if (formElement.type == "checkbox") return String(formElement.checked);
    return formElement.type != "password" ? formElement.value.trim() : formElement.value;
}

/** Shows the field's declared validation_error inline; native bubble if none. */
function _showFieldError(shadowRoot, input) {
    const message = shadowRoot.querySelector(`span.error-msg[data-errorfor="${input.id}"]`);
    if (!message) {input.reportValidity(); return;}
    message.classList.add("visible"); input.classList.add("error"); input.focus();
}

function clearFieldError(input) {
    input.getRootNode().querySelector(`span.error-msg[data-errorfor="${input.id}"]`)?.classList.remove("visible");
    input.classList.remove("error");
}

const _clearFieldErrors = scope => {
    for (const message of scope.querySelectorAll("span.error-msg.visible")) message.classList.remove("visible");
    for (const input of scope.querySelectorAll(".error")) input.classList.remove("error");
}

function _buildReview(shadowRoot, data) {
    const dl = shadowRoot.querySelector("dl#reviewlist"); if (!dl) return;
    const parts = []; for (const step of data.steps||[]) for (const field of step.fields||[]) {
        if (field.type == "hidden") continue;
        const element = shadowRoot.querySelector(`#${field.id}`); if (!element) continue;
        const label = field.label || field.placeholder || field.id;
        let value = element.value || "";
        if (element.tagName == "SELECT" && element.selectedOptions.length) value = element.selectedOptions[0].text;
        if (field.type == "password") value = value ? "••••••••" : "";
        if (value.toString().trim() == "") continue;
        parts.push(`<dt>${label}</dt><dd>${_escapeHTML(value)}</dd>`);
    }
    dl.innerHTML = parts.join("\n");
}

/** Consecutive fields sharing the same "fieldrow" value render side by side (.field-row). */
function _groupFieldsIntoRows(fields) {
    if (!fields) return null;
    const groups = []; for (const field of fields) {
        const lastGroup = groups[groups.length-1];
        if (field.fieldrow && lastGroup && lastGroup.fieldrow == field.fieldrow) lastGroup.fields.push(field);
        else groups.push({fieldrow: field.fieldrow, fields: [field]});
    }
    for (const group of groups) group.isrow = group.fields.length > 1;
    return groups;
}

async function _runOnLoadJavascript(form) {
    const onloadjsFunction = _getFromPropertyJSAsFunction(form, "load_javascript");
    if (!onloadjsFunction) return form;
    const load_js_result = await onloadjsFunction(form);
    if (!load_js_result) {LOG.error(`Form load JS failed`); return form;}
    else return load_js_result;
}

async function _runOnRenderedJavascript(form) {
    const renderedFunction = _getFromPropertyJSAsFunction(form, "rendered_javascript");
    if (!renderedFunction) return;
    const rendered_js_result = await renderedFunction(form);
    if (!rendered_js_result) LOG.error(`Form render failed due to failed on render javascript`);
}

async function _runOnSubmitJavascript(retObject, form) {
    const onsubmitjsFunction = _getFromPropertyJSAsFunction(form, "submit_javascript");
    if (!onsubmitjsFunction) return;
    const submit_js_result = await onsubmitjsFunction(retObject, form);
    if (!submit_js_result) LOG.error(`Submit failed due to failed on submit javascript`);
}

function _getFromPropertyJSAsFunction(form, property) {
    if (!form[property]) return null;
    const propertyjs = (Array.isArray(form[property])?form[property]:[form[property]]).join("\n");
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    return new AsyncFunction(propertyjs);
}

const _escapeHTML = text => text.toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

const trueWebComponentMode = true;
export const form_wizard = {trueWebComponentMode, elementConnected, elementRendered, close, next, back,
    formSubmitted, applyPreset, clearFieldError};
monkshu_component.register("form-wizard", `${COMPONENT_PATH}/form-wizard.html`, form_wizard);
