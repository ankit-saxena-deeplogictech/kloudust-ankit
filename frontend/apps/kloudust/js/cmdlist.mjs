/**
 * Processes command lists
 * 
 * (C) 2022 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

import {rolemanager as roleman} from "./rolemanager.mjs";

async function fetchCommands(listFileLocation) {
    const listJSON = await $$.requireText(listFileLocation), listObject = JSON.parse(listJSON);
    return await getCommands(listJSON, listObject);
}

/**
 * Same as fetchCommands but also returns the list file's optional "groups"
 * declaration (i18n-expanded) for grouped navigation rendering.
 * @returns {commands, groups} — groups is undefined when the file has none
 */
async function fetchCommandsWithGroups(listFileLocation) {
    const listJSON = await $$.requireText(listFileLocation), listObject = JSON.parse(listJSON);
    const mustache = await $$.librouter.getMustache(), i18nObject = {i18n: listObject.i18n?.[$$.libi18n.getSessionLang()]||{}};
    const expandedListObject = JSON.parse(mustache.render(listJSON, i18nObject));
    const commands = await roleman.filterRoleList(expandedListObject.rolelist);
    return {commands, groups: expandedListObject.groups};
}

async function getCommands(listJSON, listObject) {
    if (!listJSON) listJSON = JSON.stringify(listObject);
    const mustache = await $$.librouter.getMustache(), i18nObject = {i18n: listObject.i18n?.[$$.libi18n.getSessionLang()]||{}};
    const expandedListJSON = mustache.render(listJSON, i18nObject), expandedListObject = JSON.parse(expandedListJSON);
    const cmdList = await roleman.filterRoleList(expandedListObject.rolelist);
    return cmdList;
}

export const cmdlist = {fetchCommands, fetchCommandsWithGroups, getCommands}