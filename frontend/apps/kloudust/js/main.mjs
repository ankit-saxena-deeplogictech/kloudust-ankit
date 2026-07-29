/**
 * Post login main page support. 
 * (C) 2020 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {cmdlist} from "./cmdlist.mjs";
import {cmdmanager as cmdman} from "./cmdmanager.mjs";

const LEFTBAR_COMMANDS = `${APP_CONSTANTS.FORMS_PATH}/main_leftbar.json`, 
    MAIN_COMMANDS = `${APP_CONSTANTS.FORMS_PATH}/main_content.json`;

let _hostingDiv, _initialContentTemplate, _closingClass, _animationWait;

/**
 * Registers the hosting DIV which will host all content
 * @param {element} div The hosting DIV
 * @param {element} initialContentTemplate HTML5 template element hosting initial content
 * @param {string} closingClass Optional: The class to add when closing (useful for effects)
 * @param {number} animationWait Optional: The wait time for the animation (useful for effects)
 */
function registerHostingDivAndInitialContentTemplate(div, initialContentTemplate, closingClass, animationWait=0) {
    _hostingDiv = div; _initialContentTemplate = initialContentTemplate; _closingClass = closingClass; _animationWait = animationWait;
}

/**
 * Shows the given content. Must be either HTML string or
 * a DOM subtree of nodes. If no content given then same as 
 * hiding and going back to home content.
 * @param {string|Object} contentNode The content to show
 * @param {boolean} disableAnimation Whether to disable animation, default is false
 */
function showContent(contentNode, disableAnimation=false) { 
    if (!_hostingDiv) {LOG.error(`Asked to show content but no hosting DIV is registered`); return;}
    if (_closingClass && (!disableAnimation)) _hostingDiv.classList.add(_closingClass);
    const _refreshWithNewContent = _ => {
        $$.libutil.removeAllChildElements(_hostingDiv); 
        const content = contentNode ? (typeof contentNode === "string" ? _getHTMLNodesToInsert(contentNode) : contentNode) : 
            _initialContentTemplate.content.cloneNode(true);
        _hostingDiv.appendChild(content);
        if (_closingClass && (!disableAnimation)) _hostingDiv.classList.remove(_closingClass);
    }
    if (_animationWait && (!disableAnimation)) setTimeout(_refreshWithNewContent, _animationWait); else _refreshWithNewContent();
}

/**
 * Hides open content
 * @param {boolean} disableAnimation Whether to disable animation, default is false
 */
function hideOpenContent(disableAnimation) {showContent(undefined, disableAnimation);}

/** Plugs in our data interceptor which loads initial main and leftbar contents */
const interceptPageLoadData = _ => $$.librouter.addOnLoadPageData(APP_CONSTANTS.MAIN_HTML, async (data, _url) => {
    const mustache = await $$.librouter.getMustache(), mainPageData = {};
    mainPageData.welcomeHeading = mustache.render(await $$.libi18n.get("WelcomeHeading"), {user: $$.libsession.get(APP_CONSTANTS.USERNAME)});
    const leftbar = await cmdlist.fetchCommandsWithGroups(LEFTBAR_COMMANDS);
    mainPageData.leftbarCommands = leftbar.commands;
    mainPageData.leftbarGroups = _groupCommands(leftbar.commands, leftbar.groups);
    mainPageData.mainCommands = await cmdlist.fetchCommands(MAIN_COMMANDS);

    const seenPaletteIDs = new Set(); mainPageData.paletteCommands = [];
    for (const command of [...mainPageData.leftbarCommands, ...mainPageData.mainCommands])
        if (!seenPaletteIDs.has(command.id)) {seenPaletteIDs.add(command.id); mainPageData.paletteCommands.push(command);}

    const username = String($$.libsession.get(APP_CONSTANTS.USERNAME)||"");
    mainPageData.username = username;
    mainPageData.userInitials = username.split(/\s+/).filter(word=>word).slice(0,2).map(word=>word[0].toUpperCase()).join("") || "?";
    mainPageData.alertcount = Object.keys(cmdman.getAlerts()).length;
    const projectsLookupResult = await window.monkshu_env.frameworklibs.apimanager.rest(APP_CONSTANTS.API_KLOUDUSTCMD, 
        'POST', {cmd: 'getUserProjects'}, true);
    mainPageData.userprojects = projectsLookupResult?projectsLookupResult.projects:[];

    const selectedProject = $$.libsession.get(APP_CONSTANTS.ACTIVE_PROJECT) || mainPageData.userprojects[0]?.name;
    const selectProjectIndex = mainPageData.userprojects.findIndex(prj=>prj.name==selectedProject);
    if (selectProjectIndex != -1) mainPageData.userprojects[selectProjectIndex].selected = true;
    $$.libsession.set(APP_CONSTANTS.ACTIVE_PROJECT, selectedProject);

    data.mainPageData = mainPageData;
    
    for (const cmd of [...mainPageData.leftbarCommands, ...mainPageData.mainCommands]) try{
        cmdman.registerCommand(cmd); } catch (err) {LOG.error(`Error registering command ${cmd.id}.`);}
});

function activeProjectChanged(new_project) {
    $$.libsession.set(APP_CONSTANTS.ACTIVE_PROJECT, new_project);
}

/** Buckets commands into the ordered "groups" declared by the list file.
 *  No groups declared -> one unlabeled group (legacy flat sidebar). */
function _groupCommands(commands, groupDefs) {
    if (!groupDefs || !groupDefs.length) return [{items: commands}];
    const groups = groupDefs.map(groupDef => ({...groupDef, items: []}));
    for (const command of commands) {
        const group = groups.find(candidate => candidate.id == command.group) || groups[0];
        group.items.push(command);
    }
    return groups.filter(group => group.items.length);
}

/** Wires document-level shell interactions: command palette shortcut and menu dismissal */
function initShell() {
    document.addEventListener("keydown", event => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() == "k") {event.preventDefault(); togglePalette(true);}
        if (event.key == "Escape") {togglePalette(false); _closeAllMenus();}
    });
    document.addEventListener("click", event => {if (!event.target.closest(".menu-wrap")) _closeAllMenus();});
}

function togglePalette(open) {
    const overlay = document.querySelector("#palette_overlay"); if (!overlay) return;
    const shouldOpen = open !== undefined ? open : !overlay.classList.contains("open");
    overlay.classList.toggle("open", shouldOpen);
    if (shouldOpen) {const input = overlay.querySelector("input"); input.value = ""; paletteFilter(""); input.focus();}
}

function paletteFilter(filter) {
    const query = (filter||"").trim().toLowerCase();
    for (const item of document.querySelectorAll("#palette_list li"))
        item.classList.toggle("hide", query != "" && !item.textContent.toLowerCase().includes(query));
}

function paletteKeydown(event) {
    if (event.key != "Enter") return;
    const firstMatch = document.querySelector("#palette_list li:not(.hide) button");
    if (firstMatch) firstMatch.click();
}

function paletteRun(id) {togglePalette(false); cmdman.cmdClicked(id);}

function toggleMenu(button) {
    const menu = button.parentNode.querySelector(".menu"); if (!menu) return;
    const wasOpen = menu.classList.contains("open");
    _closeAllMenus();
    if (!wasOpen) menu.classList.add("open");
    button.setAttribute("aria-expanded", String(!wasOpen));
}

const _closeAllMenus = _ => {for (const menu of document.querySelectorAll(".menu.open")) menu.classList.remove("open");}

function _getHTMLNodesToInsert(htmlContent) {
    const wrapper = document.createElement("div"); wrapper.innerHTML = htmlContent;
    return wrapper;
}

export const main = {interceptPageLoadData, registerHostingDivAndInitialContentTemplate, showContent,
    cmdClicked: (_element, id) => cmdman.cmdClicked(id), hideOpenContent, activeProjectChanged,
    initShell, togglePalette, paletteFilter, paletteKeydown, paletteRun, toggleMenu};
