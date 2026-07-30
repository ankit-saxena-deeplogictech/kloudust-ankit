/**
 * Returns HTML for the cloud alerts.
 *
 * Presented in the shared drawer (alerts.form.json declares
 * "presentation": "drawer"), so when embedded is set the drawer chrome already
 * supplies the heading and the close button and this drops its own.
 * 
 * (C) 2023 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

const RESOURCES_PATH = $$.libutil.getModulePath(import.meta)+"/resources";

const HTML_TEMPLATE = `
<style>
/* Redesign skin — colors/spacing come from css/tokens.css (document level).
   Ids kept stable; structure unchanged. */
div#body {
    box-sizing: border-box;
    color: var(--text);
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

span#header {
    display: flex;
    flex-direction: row;
    gap: var(--sp-1);
    margin-bottom: var(--sp-3);
}
div#clear, div#close {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: var(--r-sm);
    color: var(--text-3);
    cursor: pointer;
    font: 500 var(--fs-md) var(--font-sans);
}
div#clear:hover, div#close:hover {background-color: var(--surface-2); color: var(--text);}
div#clear img {width: 16px; height: 16px; filter: brightness(0) invert(0.35);}
[data-theme="dark"] div#clear img {filter: brightness(0) invert(0.8);}

div#main {
    display: flex;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
}

span#alertpartition {
    font-size: var(--fs-sm);
    font-weight: 500;
    color: var(--text-2);
    margin: var(--sp-2) 0;
    padding: var(--sp-1) var(--sp-2);
    cursor: pointer;
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    border-radius: var(--r-sm);
}
span#alertpartition:hover {background-color: var(--surface-2); color: var(--text);}
div#alertcontainer {
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background-color: var(--surface);
    box-shadow: var(--shadow-sm);
    overflow: clip;
    height: 0;
    flex-shrink: 0;
}
div#alertcontainer.visible {height: auto; margin-bottom: var(--sp-3);}
div#alertdiv {
    padding: var(--sp-2) var(--sp-3);
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: center;
    border-bottom: 1px solid var(--border);
}
div#alertcontainer div#alertdiv:last-child {border-bottom: none;}
span#alertmessage {
    width: calc(100% - 2.5em);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    user-select: text;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
}
span#alerticon {
    margin-right: var(--sp-3);
    height: 18px;
    width: 18px;
    flex: none;
}
span#alerticon img {height: 100%;}
</style>

<div id="body">
<span id="header">
<div id="clear" onclick='event.stopPropagation(); 
    monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.clearAlerts(this);
    monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.reloadForm(this)'><img src='{{{clear_icon}}}'></div>
{{^embedded}}<div id="close" onclick='event.stopPropagation(); monkshu_env.apps[APP_CONSTANTS.APP_NAME].cmdmanager.closeForm(this)'>X</div>{{/embedded}}
</span>

<div id="main">
{{^alert_stacks}}
<div id="alertdiv"><span id="alerticon"><img src="{{{info_icon}}}"></span><span id="alertmessage">No alerts.</span></div>
{{/alert_stacks}}
{{#alert_stacks}}
    <span id="alertpartition" onclick="
        const containerThis = this.nextElementSibling;
        containerThis.classList.toggle('visible');
        if (containerThis.classList.contains('visible')) this.innerText = this.innerText.replace('>','⌄');
        else this.innerText = this.innerText.replace('⌄','>');
    ">&gt;&nbsp;{{{heading}}}</span>
    <div id="alertcontainer">
    {{#alerts}}
    <div id="alertdiv"><span id="alerticon"><img src="{{{alerticon}}}"></span><span id="alertmessage">{{{message}}}</span></div>
    {{/alerts}}
    </div>
{{/alert_stacks}}
</div>

</div>
`;

async function getHTML(_formJSON, cmdmanager, embedded) {
    const alertsObject = cmdmanager.getAlerts();
    const alertIDsSorted = Object.keys(alertsObject).sort((a, b) => a - b);
    let alertStackObjects; for (const alertID of alertIDsSorted) {
        const alertStackObject = {heading: $$.libutil.encodeHTMLEntities(alertsObject[alertID][0].message), alerts: []};
        for (const alert of alertsObject[alertID]) {
            if (alert.type == cmdmanager.ALERT_ERROR) alert.error = true;
            alert.alerticon = alert.error?`${RESOURCES_PATH}/alerts_error.svg`:`${RESOURCES_PATH}/alerts_info.svg`;
            alert.message = $$.libutil.encodeHTMLEntities(alert.message).replaceAll(/\r?\n/g, "<br/>");
            alertStackObject.alerts.push(alert);
        }
        if (!alertStackObjects) alertStackObjects = []; alertStackObjects.push(alertStackObject);
    }
    const html = await $$.librouter.expandPageData(HTML_TEMPLATE, undefined, {alert_stacks: alertStackObjects, embedded,
        clear_icon: `${RESOURCES_PATH}/alerts_clear.svg`, info_icon: `${RESOURCES_PATH}/alerts_info.svg`});
    return html;
}

export const alerts = {getHTML};