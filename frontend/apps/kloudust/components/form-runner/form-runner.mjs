/**
 * Interprets and runs form.json files. Renders the
 * UI for the form. This component is a form UI generator
 * basically.
 *
 * Field schema extras beyond the legacy keys (all optional, all defaulting to
 * the old rendering):
 *  - type: "switch"      renders a toggle (.switch) over a checkbox instead of
 *                        a Yes/No select. The control is always treated as
 *                        optional, because "off" is a real answer, and its
 *                        collected value is the string "true"/"false" so
 *                        kloudust_cmdline_params are unchanged. The wrapping
 *                        <label> still carries for="<id>", so the
 *                        label[for=...] hide/show contract keeps working.
 *  - validation_error    already existed; it now also renders a persistent
 *                        inline .error-msg instead of only a native bubble.
 *
 * The form object also takes layout: "wide", which removes the reading-width
 * cap on div#main. Use it only when a field genuinely needs the room — a
 * custom component that lays its inputs out in a row — never for plain forms,
 * where a narrow column is easier to read.
 *
 * (C) 2022 TekMonks. All rights reserved.
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
    if (formObject.optional_fields) formObject.showOptional = true;
    // layout: "wide" drops the reading-width cap — see the note in the template
    formObject.wide = String(formObject.layout||"").toLowerCase() == "wide";
    formObject = await _runOnLoadJavascript(formObject);
    _markSwitchFields(formObject.required_fields); _markSwitchFields(formObject.optional_fields);
    formObject.required_rowgroups = _groupFieldsIntoRows(formObject.required_fields);
    formObject.optional_rowgroups = _groupFieldsIntoRows(formObject.optional_fields);
    form_runner.setDataByHost(host, formObject);
}

/** type: "switch" is ours, not an HTML input type — translate it for the template. */
function _markSwitchFields(fields) {
    for (const field of fields||[]) if (field.type == "switch") {
        field.switchfield = true;
        field.checked = String(field.value) == "true";
    }
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

async function elementRendered(host) {
    const formObject = form_runner.getDataByHost(host);
    formObject._form_host_element = host;
    formObject._form_shadowroot = form_runner.getShadowRootByHost(host);
    await _runOnRenderedJavascript(formObject);
}

async function close(element) {
    const onclose = await form_runner.getAttrValue(form_runner.getHostElement(element), "onclose");
    if (onclose && onclose.trim() != "") new Function(onclose)();
}

async function formSubmitted(element) {
    const shadowRoot = form_runner.getShadowRootByContainedElement(element);
    const allFormElements = []; for (const inputElement of INPUT_ELEMENTS) allFormElements.push(...shadowRoot.querySelectorAll(inputElement));
    _clearFieldErrors(shadowRoot);
    for (const input of allFormElements) if ((input.dataset.optional?.toLowerCase() != "true") && (!input.checkValidity())) {
        LOG.error(`Submit failed due to failed validation of ${input.id} whose value is ${input.type != "password" ? input.value.trim() != "" ? input.value : "empty value" : "***********" }`);
        showFieldError(shadowRoot, input); return false;
    }

    const retObject = {}; for (const formElement of allFormElements)
        retObject[formElement.id] = _valueOf(formElement);
    const onsubmit = await form_runner.getAttrValue(form_runner.getHostElement(element), "onsubmit");
    if (onsubmit && onsubmit.trim() != "") {
        const form = form_runner.getDataByContainedElement(element);
        await _runOnSubmitJavascript(retObject, form);

        const functionCode = `const formdata = ${JSON.stringify(retObject)}; ${onsubmit}`;
        new Function(functionCode)();
    }
}

/** A checkbox carries its answer in .checked, not .value — mapped to the same
 *  "true"/"false" strings the Yes/No selects produce so command lines are
 *  identical either way. Everything else keeps the legacy behaviour exactly. */
function _valueOf(formElement) {
    if (formElement.type == "checkbox") return String(formElement.checked);
    return formElement.type != "password" ? formElement.value.trim() : formElement.value;
}

/** Shows the field's declared validation_error inline and keeps it visible.
 *  Falls back to the native bubble when the form declared no message. */
function showFieldError(shadowRoot, input) {
    const message = shadowRoot.querySelector(`span.error-msg[data-errorfor="${input.id}"]`);
    if (!message) {input.reportValidity(); return;}
    message.classList.add("visible"); input.classList.add("error");
    input.focus();
}

function clearFieldError(input) {
    const shadowRoot = input.getRootNode();
    shadowRoot.querySelector(`span.error-msg[data-errorfor="${input.id}"]`)?.classList.remove("visible");
    input.classList.remove("error");
}

const _clearFieldErrors = shadowRoot => {
    for (const message of shadowRoot.querySelectorAll("span.error-msg.visible")) message.classList.remove("visible");
    for (const input of shadowRoot.querySelectorAll(".error")) input.classList.remove("error");
}

/** A form's load javascript reaches out to the backend, so it can throw —
 *  a lookup returning nothing, a role refusing the command. Letting that
 *  escape kills elementConnected and the form renders as a blank page with no
 *  clue why. Catching it means the fields still appear, minus whatever the
 *  script would have filled in, and the reason lands in the console. */
async function _runOnLoadJavascript(form) {
    const onloadjsFunction = _getFromPropertyJSAsFunction(form, "load_javascript");
    if (!onloadjsFunction) return form;

    let load_js_result; try {load_js_result = await onloadjsFunction(form);}
    catch (err) {
        LOG.error(`Form load JS threw for ${form.formtitle||"form"}: ${err}${err?.stack?"\n"+err.stack:""}`);
        return form;    // render what we have rather than nothing at all
    }
    if (!load_js_result) {LOG.error(`Form load JS failed`); return form;}
    return load_js_result;
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

const trueWebComponentMode = true;	// making this false renders the component without using Shadow DOM
export const form_runner = {trueWebComponentMode, elementConnected, elementRendered, close, formSubmitted,
    clearFieldError};
monkshu_component.register("form-runner", `${COMPONENT_PATH}/form-runner.html`, form_runner);