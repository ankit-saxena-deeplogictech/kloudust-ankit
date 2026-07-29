/**
 * Interprets and runs form.json files. Renders the
 * UI for the form. This component is a form UI generator
 * basically.
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
    formObject = await _runOnLoadJavascript(formObject);
    formObject.required_rowgroups = _groupFieldsIntoRows(formObject.required_fields);
    formObject.optional_rowgroups = _groupFieldsIntoRows(formObject.optional_fields);
    form_runner.setDataByHost(host, formObject);
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
    for (const input of allFormElements) if ((input.dataset.optional?.toLowerCase() != "true") && (!input.checkValidity())) {
        LOG.error(`Submit failed due to failed validation of ${input.id} whose value is ${input.type != "password" ? input.value.trim() != "" ? input.value : "empty value" : "***********" }`);
        input.reportValidity(); return false;
    }

    const retObject = {}; for (const formElement of allFormElements) 
        retObject[formElement.id] = (formElement.type != "password" ? formElement.value.trim() : formElement.value);
    const onsubmit = await form_runner.getAttrValue(form_runner.getHostElement(element), "onsubmit");
    if (onsubmit && onsubmit.trim() != "") {
        const form = form_runner.getDataByContainedElement(element);
        await _runOnSubmitJavascript(retObject, form);

        const functionCode = `const formdata = ${JSON.stringify(retObject)}; ${onsubmit}`;
        new Function(functionCode)();
    }
}

async function _runOnLoadJavascript(form) {
    const onloadjsFunction = _getFromPropertyJSAsFunction(form, "load_javascript");
    if (!onloadjsFunction) return form;
    const load_js_result = await onloadjsFunction(form);
    if (!load_js_result) {
        LOG.error(`Form load JS failed`);
        return form;
    } else return load_js_result;
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
export const form_runner = {trueWebComponentMode, elementConnected, elementRendered, close, formSubmitted};
monkshu_component.register("form-runner", `${COMPONENT_PATH}/form-runner.html`, form_runner);