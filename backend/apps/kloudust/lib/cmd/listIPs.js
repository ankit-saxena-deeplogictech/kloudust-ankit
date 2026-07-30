/**
 * listIPs.js - Lists the assignable pool of IP addresses.
 *
 * Params - 0 - Hostname, optional. If given, only IPs routable via that host
 *  are returned, else the whole pool.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

const roleman = require(`${KLOUD_CONSTANTS.LIBDIR}/roleenforcer.js`);
const dbAbstractor = require(`${KLOUD_CONSTANTS.LIBDIR}/dbAbstractor.js`);
const CMD_CONSTANTS = require(`${KLOUD_CONSTANTS.LIBDIR}/cmd/cmdconstants.js`);

/**
 * Lists the IP pool, either whole or for one host.
 * @param {array} params The incoming params, see above.
 */
module.exports.exec = async function(params) {
    if (!roleman.checkAccess(roleman.ACTIONS.lookup_cloud_resource)) {
        params.consoleHandlers.LOGUNAUTH(); return CMD_CONSTANTS.FALSE_RESULT(); }

    const hostname = params[0]?.trim() || undefined;    // param 1 is optional
    const ips = await dbAbstractor.getIPs(hostname);
    if (!ips) {const err = "No IPs found in the assignable pool";
        params.consoleHandlers.LOGERROR(err); return CMD_CONSTANTS.FALSE_RESULT(err); }

    const out = `IP pool information follows\n${JSON.stringify(ips)}`;

    params.consoleHandlers.LOGINFO(out);
    return {result: true, stderr: "", err: "", out, stdout: out, ips};
}
