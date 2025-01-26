/*
 * ebus adapter für iobroker
 *
 * Created: 15.09.2016 21:31:28
 *  Author: Rene


*/

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";




const utils = require("@iobroker/adapter-core");
const ebusdMinVersion = [24, 1];
const ebusdVersion = [0, 0];
const ebusdUpdateVersion = [0, 0];

let adapter;
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: "ebus",
        //#######################################
        //
        ready: function () {
            try {
                //adapter.log.debug('start');
                main();
            }
            catch (e) {
                adapter.log.error("exception catch after ready [" + e + "]");
            }
        },
        //#######################################
        //  is called when adapter shuts down
        unload: function (callback) {
            try {

                if (intervalID != null) {
                    clearInterval(intervalID);
                }
                if (updateTimerID != null) {
                    clearTimeout(updateTimerID);
                }
                adapter && adapter.log && adapter.log.info && adapter.log.info("cleaned everything up...");
                //to do stop intervall
                callback();
            } catch (e) {
                callback();
            }
        },

        stateChange: async (id, state) => {
            await HandleStateChange(id, state);
        },
        //#######################################
        //
        message: async (obj) => {
            if (obj) {
                switch (obj.command) {
                    case "findParams":
                        // e.g. send email or pushover or whatever
                        //adapter.log.debug("findParams command");
                        // Send response in callback if required
                        await FindParams(obj);
                        break;
                    default:
                        adapter.log.error("unknown message " + obj.command);
                        break;
                }
            }
        }
        //#######################################
        //
    });
    adapter = new utils.Adapter(options);

    return adapter;
}


const axios = require("axios");
const net = require("net");
const { PromiseSocket } = require("promise-socket");

let intervalID=null;
let updateTimerID=null;

async function main() {

    adapter.log.debug("start with interface ebusd ");

    FillPolledVars();
    FillHistoryVars();
    FillHTTPParamsVars();

    await checkVariables();

    await subscribeVars();

    let readInterval = 5;
    if (parseInt(adapter.config.readInterval) > 0) {
        readInterval = adapter.config.readInterval;
    }
    adapter.log.debug("read every  " + readInterval + " minutes");
    intervalID = setInterval(Do, readInterval * 60 * 1000);

    //read at adapterstart
    await Do();

}

let requestRunning = false;

async function DoRequest() {

    adapter.log.debug("DoRequest ");

    if (!requestRunning) {
        requestRunning = true;
        await ebusd_ReadValues();

        await ebusd_ReceiveData();
    }
    else {
        adapter.log.debug("DoRequest: do nothing already running ");
    }
    requestRunning = false;
}

async function Do() {

    adapter.log.debug("starting ... " );

    await ebusd_Command();

    await DoRequest();
    
}


async function HandleStateChange(id, state) {
   

    if (state != null && state.ack !== true) {

        adapter.log.debug("handle state change " + id);
        const ids = id.split(".");

        if (ids[2] === "cmd") {
            await ebusd_Command();
            StartDataRequest();
            //see issue #77: only one request possible
            //await Do();
        }
        //unhandled state change ebus.0.find
        else if (ids[2] === "find") {
            await ebusd_find();
        }
        else {
            adapter.log.warn("unhandled state change " + id);
        }
    }
}


function StartDataRequest() {

    if (updateTimerID != null) {
        //already running
        clearTimeout(updateTimerID);
        updateTimerID = null;
    }
    //start or restart
    updateTimerID = setTimeout(DataRequest, 500);
    adapter.log.debug("StartDataRequest");
}


async function DataRequest() {
    adapter.log.debug("get data after command and timeout");
    if (updateTimerID != null) {
        clearTimeout(updateTimerID);
        updateTimerID = null;
    }
    await DoRequest();
}


const oPolledVars = [];
function FillPolledVars() {

    try {
        if (adapter.config.PolledDPs !== undefined && adapter.config.PolledDPs != null && adapter.config.PolledDPs.length > 0) {
            adapter.log.debug("use new object list for polled vars");

            //2023-02-10 only active vars
            for (let i = 0; i < adapter.config.PolledDPs.length; i++) {
                if (adapter.config.PolledDPs[i].active) {
                    oPolledVars.push(adapter.config.PolledDPs[i]);
                }
            }

        }
        else {
            //make it compatible to old versions
            adapter.log.debug("check old comma separeted list for polled vars " + adapter.config.PolledValues);

            if (adapter.config.PolledValues !== undefined && typeof adapter.config.PolledValues == "string") {
                const oPolled = adapter.config.PolledValues.split(",");

                if (oPolled.length > 0) {

                    for (let i = 0; i < oPolled.length; i++) {
                        if (oPolled[i].length > 0) {
                            //console.log('add ' + oPolled[i]);
                            const value = {
                                circuit: "",
                                name: oPolled[i],
                                parameter: ""
                            };
                            oPolledVars.push(value);
                        }
                    }
                }
            }
        }
    }
    catch (e) {
        adapter.log.error("exception in FillPolledVars [" + e + "]");
    }

    adapter.log.info("list of polled vars " + JSON.stringify(oPolledVars));

}

let oHistoryVars = [];
function FillHistoryVars() {

    try {
        if (adapter.config.HistoryDPs !== undefined && adapter.config.HistoryDPs != null && adapter.config.HistoryDPs.length > 0) {
            adapter.log.debug("use new object list for history vars");
            oHistoryVars = adapter.config.HistoryDPs;
        }
        else {
            //make it compatible to old versions
            adapter.log.debug("check old comma separeted list for history vars");
            const oHistory = adapter.config.HistoryValues.split(",");

            if (oHistory.length > 0) {

                for (let i = 0; i < oHistory.length; i++) {
                    if (oHistory[i].length > 0) {
                        console.log("add " + oHistory[i]);
                        const value = {
                            name: oHistory[i],
                        };
                        oHistoryVars.push(value);
                    }
                }
            }
        }
    }
    catch (e) {
        adapter.log.error("exception in function FillHistoryVars [" + e + "]");
    }
}

let oHTTPParamsVars = [];
function FillHTTPParamsVars() {
    if (adapter.config.HTTPparameter !== undefined && adapter.config.HTTPparameter != null && adapter.config.HTTPparameter.length > 0) {

        oHTTPParamsVars = adapter.config.HTTPparameter;

        adapter.log.debug("use optionally HTTP parameter " + JSON.stringify(oHTTPParamsVars));
    }
}





//===================================================================================================
// ebusd interface

async function ebusd_Command() {
    const obj = await adapter.getStateAsync("cmd");

    if (obj !== undefined && obj != null) {
        const cmds = obj.val;
        if (cmds !== "") {
            adapter.log.debug("got command(s): " + cmds);

            adapter.log.debug("connect telnet to IP " + adapter.config.targetIP + " port " + parseInt(adapter.config.targetTelnetPort));

            try {
                const socket = new net.Socket();
                const promiseSocket = new PromiseSocket(socket);

                await promiseSocket.connect(parseInt(adapter.config.targetTelnetPort), adapter.config.targetIP);
                adapter.log.debug("telnet connected for cmd");
                promiseSocket.setTimeout(5000);

                const oCmds = cmds.split(",");

                if (oCmds.length > 0) {
                    let received = "";
                    for (let n = 0; n < oCmds.length; n++) {

                        adapter.log.debug("send " + oCmds[n]);
                        await promiseSocket.write(oCmds[n] + "\n");

                        const data = await promiseSocket.read();

                        if (data.includes("ERR")) {
                            adapter.log.warn("sent " + oCmds[n] + ", received " + data + " please check ebusd logs for details!");
                        }
                        else {
                            adapter.log.debug("received " + data);
                        }
                        received += data.toString();
                        received += ", ";
                    }

                    //see issue #78: remove CR, LF and last comma
                    received = received.replace(/\r?\n|\r/g,"");
                    received = received.slice(0, -2);

                    //set result to cmdResult 
                    await adapter.setStateAsync("cmdResult", { ack: true, val: received });
                }
                else {
                    adapter.log.warn("no commands in list " + cmds + " " + JSON.stringify(oCmds));
                }
                await adapter.setStateAsync("cmd", { ack: true, val: "" });

                promiseSocket.destroy();

            } catch (e) {
                adapter.log.error("exception from tcp socket" + "[" + e + "]");
            }
        }
    }
    else {
        adapter.log.debug("object cmd not found " + JSON.stringify(obj));
    }
}

async function ebusd_find(){
    try {
        const socket = new net.Socket();
        const promiseSocket = new PromiseSocket(socket);

        await promiseSocket.connect(parseInt(adapter.config.targetTelnetPort), adapter.config.targetIP);
        adapter.log.debug("telnet connected for cmd");
        promiseSocket.setTimeout(5000);

        await promiseSocket.write("find -F circuit,name,comment\n");

        const data = await promiseSocket.read();

        if (data.includes("ERR")) {
            adapter.log.warn("received error! sent find, received " + data + " please check ebusd logs for details!");
        }
        else {
            adapter.log.debug("received " + typeof data + " " + data);
        }

        const str = new TextDecoder().decode(data); 
        const datas = str.split(/\r?\n/);

        for (let i = 0; i < datas.length; i++) {

            //adapter.log.debug(JSON.stringify(datas[i]));

            const names = datas[i].split(",");

            //circuit,name,comment
            await UpdateDP(names[0], names[1], names[2]);

            let cmd = "read -f -c " + names[0] + " " + names[1] ;

            adapter.log.debug("send cmd " + cmd);

            cmd += "\n";
            await promiseSocket.write(cmd);

            const result = await promiseSocket.read();

            adapter.log.debug("received " + typeof result + " " + result);
        }
        

        promiseSocket.destroy();

    } catch (e) {
        adapter.log.error("exception from tcp socket in ebusd_find" + "[" + e + "]");
    }

}



//just call http://192.168.0.123:8889/data


/*
    http://localhost:8080/data/mc?verbose&since=1483890000&exact

    since=seconds: limit to messages that have changed since the specified UTC seconds
    poll=prio: set the poll priority of matching message(s) to prio
    exact[=true]: exact search for circuit/message name
    verbose[=true]: include comments and field units
    indexed[=true]: return field indexes instead of names
    numeric[=true]: return numeric values of value list entries
    valuename[=true]: include value and name of value list entries
    full[=true]: include all available attributes
    required[=true]: retrieve the data from the bus if not yet cached
    maxage[=seconds]: retrieve the data from the bus if cached value is older than specified seconds (or not present at all)
    write[=true]: include write messages in addition to read
    raw[=true]: include the raw master/slave symbols as int arrays
    def[=true]: include message/field definition (qq, id, fielddefs)
    define=DEFINITION: (re-)define the message from DEFINITION (in CSV format)
    user=USER: authenticate with USER name
    secret=SECRET: authenticate with user SECRET


*/


async function subscribeVars() {
    adapter.subscribeStates("cmd");

    adapter.subscribeStates("find");

    await adapter.setStateAsync("cmdResult", { ack: true, val: "" });
}

async function CreateObject(key, obj) {

    const obj_new = await adapter.getObjectAsync(key);
    //adapter.log.warn("got object " + JSON.stringify(obj_new));

    if (obj_new != null) {

        if ((obj_new.common.role != obj.common.role
            || obj_new.common.type != obj.common.type
            || (obj_new.common.unit != obj.common.unit && obj.common.unit != null)
            || obj_new.common.read != obj.common.read
            || obj_new.common.write != obj.common.write
            || obj_new.common.name != obj.common.name)
            && obj.type === "state"
        ) {
            adapter.log.warn("change object " + JSON.stringify(obj) + " " + JSON.stringify(obj_new));
            await adapter.extendObject(key, {
                common: {
                    name: obj.common.name,
                    role: obj.common.role,
                    type: obj.common.type,
                    unit: obj.common.unit,
                    read: obj.common.read,
                    write: obj.common.write
                }
            });
        }
    }
    else {
        await adapter.setObjectNotExistsAsync(key, obj);
    }
}


//circuit,name,comment
async function UpdateDP(circuit, name, comment) {

    const key = circuit + ".messages." + name;
    adapter.log.debug("update check for " + key);


    //       ehp.messages.Injection
    //ebus.0.ehp.messages.Injection

    const obj = await adapter.getObjectAsync(key);
    adapter.log.debug("update check got " + JSON.stringify(obj));


    //update check got null

    if (obj != null) {

        if (obj.common.name != comment) {
            adapter.log.debug("update  " + key + " " + comment);
            await adapter.extendObject(key, {
                common: {
                    name: comment,
                    read: true,
                    write: false
                }
            });
        }
    }
    else {
        await adapter.setObjectNotExistsAsync(key, {
            type: "channel",
            common: {
                name: comment,
                read: true,
                write: false
            }
        });
    }

}



async function checkVariables() {
    adapter.log.debug("init variables ");

    let key;
    let obj;

    key = "cmd";
    obj= {
        type: "state",
        common: {
            name: "ebusd command",
            type: "string",
            role: "text",
            read: true,
            write: true
        }
    };
    await CreateObject(key, obj);

    key = "cmdResult";
    obj = {
        type: "state",
        common: {
            name: "ebusd command result",
            type: "string",
            role: "text",
            read: true,
            write: false
        }
    };
    await CreateObject(key, obj);

    key = "find";
    obj = {
        type: "state",
        common: {
            name: "find existing data points",
            type: "boolean",
            role: "button",
            read: false,
            write: true
        }
    };
    await CreateObject(key, obj);



    adapter.log.debug("init common variables and " + oHistoryVars.length + " history DP's");
    
    if (oHistoryVars.length > 0) {

        if (oHistoryVars.length > 4) {
            adapter.log.warn("too many history values " + oHistoryVars.length + " -> maximum is  4");
        }

        for (let n = 1; n <= oHistoryVars.length; n++) {

            if (oHistoryVars[n - 1].name.length > 0) {
                const name = "history value " + n + " as JSON " + oHistoryVars[n - 1].name;
                key = "history.value" + n;
                obj= {
                    type: "state",
                    common: {
                        name: name,
                        type: "string",
                        role: "value",
                        unit: "",
                        read: true,
                        write: false
                    },
                    native: { location: key }
                };
                await CreateObject(key, obj);
            }
            else {
                adapter.log.warn("ignoring history value " + n + " (invalid name)");
            }
        }

        key = "history.date";
        obj= {
            type: "state",
            common: {
                name: "ebus history date / time as JSON",
                type: "string",
                role: "value",
                unit: "",
                read: true,
                write: false
            },
            native: {
                location: key
            }
        };
        await CreateObject(key, obj);
    }
    key = "history.error";
    obj= {
        type: "state",
        common: {
            name: "ebus error",
            type: "string",
            role: "value",
            unit: "",
            read: true,
            write: false
        },
        native: { location: key }
    };
    await CreateObject(key, obj);
}


function VersionCheck() {

    if (ebusdVersion[0] > 0 ) {
        if (ebusdVersion[0] < ebusdMinVersion[0] || (ebusdVersion[0] == ebusdMinVersion[0] && ebusdVersion[1] < ebusdMinVersion[1])) {
            adapter.log.info("please update ebusd, old version found: " + ebusdVersion[0] + "." + ebusdVersion[1] + " supported version is " + ebusdMinVersion[0] + "." + ebusdMinVersion[1]);
        }
        if (ebusdVersion[0] > ebusdMinVersion[0] || (ebusdVersion[0] >= ebusdMinVersion[0] && ebusdVersion[1] > ebusdMinVersion[1])) {
            adapter.log.info("unsupported ebusd version found (too new): " + ebusdVersion[0] + "." + ebusdVersion[1] + " supported version is " + ebusdMinVersion[0] + "." + ebusdMinVersion[1]);
        }
    }

    if (ebusdUpdateVersion[0] > 0 && ebusdVersion[0] > 0) {

        if (ebusdUpdateVersion[0] > ebusdVersion[0] || (ebusdUpdateVersion[0] == ebusdVersion[0] && ebusdUpdateVersion[1] > ebusdVersion[1])) {
            adapter.log.info("new ebusd version found: " + ebusdUpdateVersion[0] + "." + ebusdUpdateVersion[1] + " supported version is " + ebusdMinVersion[0] + "." + ebusdMinVersion[1]);

        }

    }
}

//get data via https in json -> this is the main data receiver; telnet just triggers ebusd to read data;
//https://github.com/john30/ebusd/wiki/3.2.-HTTP-client

async function ebusd_ReceiveData() {

    let sUrl = "http://" + adapter.config.targetIP + ":" + parseInt(adapter.config.targetHTTPPort) + "/data";

    //Erweiterung mit optionalen parametern
    var paramsCnt = 0;
    if (oHTTPParamsVars !== undefined && oHTTPParamsVars != null && oHTTPParamsVars.length > 0) {
        for (let i = 0; i < oHTTPParamsVars.length; i++) {

            if (oHTTPParamsVars[i].active) {
                if (paramsCnt == 0) {
                    sUrl += "?"  ;
                }
                else {
                    sUrl += "&";
                }
                sUrl += oHTTPParamsVars[i].name + "=" + oHTTPParamsVars[i].value;
                paramsCnt++;
            }
        }
    }

    adapter.log.debug("request data from " + sUrl);

    if (adapter.config.DisableTimeUpdateCheck === undefined) {
        adapter.log.error("please check config, DisableTimeUpdateCheck not defined yet ");
    }



    try {

        const buffer = await axios.get(sUrl);

        adapter.log.debug("got data " + typeof buffer.data + " " + JSON.stringify(buffer.data));

        //workaround issue #338
        //const oData = buffer.data;

        //erst nach string
        const sData = JSON.stringify(buffer.data);

        const oData = JSON.parse(sData.replace('\"updatecheck\": \"\n', '\"updatecheck\": \"'));

        //adapter.log.debug("000 " + typeof oData + JSON.stringify(oData));

        //adapter.log.debug("oData " + oData);

        const flatten = require("flat");

        const newData = flatten(oData);

        //adapter.log.debug("111 " + JSON.stringify(newData));

        const keys = Object.keys(newData);

        //adapter.log.debug("222 " + JSON.stringify(keys));

        //adapter.log.debug("history: " + options.historyValues);

        const historyvalues = [];
        const historydates = [];

        const oToday = new Date();
        const month = oToday.getMonth() + 1;

        historydates.push({
            "date": oToday.getDate() + "." + month + "." + oToday.getFullYear(),
            "time": oToday.getHours() + ":" + oToday.getMinutes() + ":" + oToday.getSeconds()
        });
        //adapter.log.debug(JSON.stringify(historydates));

        let name = "unknown";
        let sError = "none";
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            const org_key = key;

            if (key.includes("[") || key.includes("]")) {
                adapter.log.debug("found unsupported chars in " + key);
                const start = key.indexOf("[");
                const end = key.lastIndexOf("]");

                if (start > 0 && end > 0) {
                    const toReplace = key.slice(start, end + 1);
                    key = key.replace(toReplace, "");
                }
                //adapter.log.warn("new key is " + key);
            }

            const subnames = key.split(".");
            const temp = subnames.length;
            //adapter.log.debug('Key : ' + key + ', Value : ' + newData[key]);

            //
            //if (key.match(adapter.FORBIDDEN_CHARS)) { continue; }


            if (key.includes("global.version")) {
                const value = newData[org_key];
                //adapter.log.info("in version, value " + value);
                const versionInfo = value.split(".");
                if (versionInfo.length > 1) {
                    adapter.log.info("installed ebusd version is " + versionInfo[0] + "." + versionInfo[1]);

                    ebusdVersion[0] = versionInfo[0];
                    ebusdVersion[1] = versionInfo[1];

                    VersionCheck();
                }
            }

            if (key.includes("global.updatecheck")) {
                let value = newData[org_key];
                //adapter.log.info("in version, value " + value);

                //revision v21.2 available
                value = value.replace("revision v", "");
                value = value.replace(" available", "");

                const versionInfo = value.split(".");
                if (versionInfo.length > 1) {
                    adapter.log.info("found ebusd update version " + versionInfo[0] + "." + versionInfo[1]);

                    ebusdUpdateVersion[0] = versionInfo[0];
                    ebusdUpdateVersion[1] = versionInfo[1];

                    VersionCheck();
                }
            }



            if (subnames[temp - 1].includes("name")) {
                name = newData[org_key];
            }
            else if (subnames[temp - 1].includes("value")) {
                //adapter.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);

                let value = newData[org_key];

                if (value == null || value === undefined) {
                    adapter.log.debug("Key : " + key + ", Value : " + newData[org_key] + " name " + name);
                }


                if (name === "hcmode2") {
                    if (parseInt(value) === 0) {
                        adapter.log.info(key + "in hcmode2 with value 0: off");
                        value = "off";
                    }
                    else if (parseInt(value) === 5) {
                        adapter.log.info(key + " with value 5: EVU Sperrzeit");
                        value = "EVU Sperrzeit";
                    }
                    else {
                        adapter.log.debug("in hcmode2, value " + value);
                    }
                }

                let type = typeof value;

                if (adapter.config.useBoolean4Onoff) {
                    if (type == "string" && (value == "on" || value == "off")) {
                        adapter.log.debug("Key " + key + " change to boolean " + value);
                        //Key mc.messages.Status.fields.1.value could be boolean off

                        type = "boolean";

                        if (value == "on") {
                            value = true;
                        }
                        else {
                            value = false;
                        }

                    }
                }
                //value, change type if necessary
                await AddObject(key, type);
                await UpdateObject(key, value);

                //name parallel to value: used for lists in admin...
                const keyname = key.replace("value", "name");
                await AddObject(keyname, "string");

                await UpdateObject(keyname, name);

                //push to history
                //ebus.0.bai.messages.ReturnTemp.fields.temp.value
                //ebus.0.bai.messages.ReturnTemp.fields.tempmirror.value
                if (!subnames[temp - 2].includes("sensor") //ignore sensor states
                    && !subnames[temp - 2].includes("mirror") //ignore mirror-data
                ) {
                    for (let ii = 0; ii < oHistoryVars.length; ii++) {

                        if (name === oHistoryVars[ii].name) {

                            const sTemp = '{"' + name + '": "' + value + '"}';
                            //adapter.log.debug(sTemp);
                            historyvalues[ii] = [];
                            historyvalues[ii].push(JSON.parse(sTemp));
                            //adapter.log.debug(JSON.stringify(historyvalues));
                        }
                    }
                }
            }
            else if (subnames[temp - 1].includes("lastup")) {

                const value = newData[org_key];

                if (parseInt(value) > 0) {
                    //adapter.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);

                    //umrechnen...
                    const oDate = new Date(value * 1000);
                    //const nDate = oDate.getDate();
                    //const nMonth = oDate.getMonth() + 1;
                    //const nYear = oDate.getFullYear();
                    //const nHours = oDate.getHours();
                    //const nMinutes = oDate.getMinutes();
                    //const nSeconds = oDate.getSeconds();

                    const sDate = oDate.toLocaleString();
                    await AddObject(key, "string");
                    await UpdateObject(key, sDate);

                    const oToday = new Date();

                    let bSkip = false;

                    if (subnames[0].includes("scan") ||
                        subnames[0].includes("Scan") ||
                        subnames[0].includes("ehp") ||
                        (subnames.length > 2 && subnames[2].includes("currenterror")) ||
                        adapter.config.DisableTimeUpdateCheck

                    ) {
                        bSkip = true;
                    }
                    if (temp > 2) {
                        //adapter.log.debug("_______________size " + temp);
                        if (subnames[2].includes("Timer")) {
                            bSkip = true;
                        }
                    }

                    if (!bSkip && Math.abs(oDate.getTime() - oToday.getTime()) > 1 * 60 * 60 * 1000) {



                        /*2024-11-20
                        ebus: no update since 19.11.2024, 21:11:14 Scan.15.messages.Id.lastup no update since 19.11.2024, 21:11:19 Scan.23.messages.Id.lastup no update since 19.11.2024, 21:10:34 Scan.25.messages.Id.lastup no update since 19.11.2024, 21:12:04 Scan.50.messages.Id.lastup 

                        */



                        const sError1 = "no update since " + sDate + " " + key + " ";
                        if (sError.includes("none")) {
                            sError = "ebus: " + sError1;
                        }
                        else {
                            sError += sError1;
                        }
                        adapter.log.warn(sError1);
                    }


                }
            }
            else if (subnames[0].includes("global")) {
                //adapter.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);
                const value = newData[org_key];
                await AddObject(key, typeof value);
                await UpdateObject(key, value);
            }
        }
        await adapter.setStateAsync("history.error", { ack: true, val: sError });

        //adapter.log.debug(JSON.stringify(historyvalues));

        adapter.log.info("all http done");

        if (adapter.config.History4Vis2) {
            await UpdateHistory_Vis2(historyvalues, historydates);
        }
        else {
            await UpdateHistory(historyvalues, historydates);
        }

    }
    catch (e) {
        adapter.log.error("exception in ebusd_ReceiveData [" + e + "]");

        await adapter.setStateAsync("history.error", { ack: true, val: "exception in receive" });

    }
    //});
}

async function UpdateHistory_Vis2(values, dates) {
    adapter.log.debug("start history 4 VIS-2 " + JSON.stringify(values) + " " + JSON.stringify(dates));

    //not used anymore
    await adapter.setStateAsync("history.date", { ack: true, val: "" });

    for (let s = 0; s < values.length; s++) {

        const values1 = values[s];
        //adapter.log.debug(s + " " + JSON.stringify(values1));

        let val2Write = [];
        const ctr = s + 1;

        const obj = await adapter.getStateAsync("history.value" + ctr);

        if (obj === null || obj === undefined) {
            adapter.log.warn("history.value" + ctr + " not found, creating DP " + JSON.stringify(obj));
            await adapter.setStateAsync("history.value" + ctr, { ack: true, val: "[]" });
        }

        val2Write = JSON.parse(obj.val);
        adapter.log.debug("history.value" + ctr + " got " + JSON.stringify(val2Write));

        for (let ss = 0; ss < values1.length; ss++) {
            const values2 = values1[ss];
            //adapter.log.debug(ss + " " + JSON.stringify(values2));

            let d = 0;

            for (const n in values2) {

                const val = values2[n];
                const time = dates[d]["time"];
                const date = dates[d]["date"];
                d++;

                const times = time.split(":");
                const datesl = date.split(".");

                const day = parseInt(datesl[0]);
                const month = parseInt(datesl[1]) - 1;
                const year = parseInt(datesl[2]);
                const hours = parseInt(times[0]);
                const minutes = parseInt(times[1]);

                const oDate = new Date(year, month, day, hours, minutes, 0, 0);

                adapter.log.debug(n + " " + val + " " + oDate.toLocaleString());

                val2Write.push(
                    [
                        oDate,
                        val
                    ]
                );

                if (val2Write.length > 200) {

                    for (let i = val2Write.length; i > 200; i--) {
                        //adapter.log.debug("delete");
                        val2Write.shift();
                    }
                }

            }
        }
        await adapter.setStateAsync("history.value" + ctr, { ack: true, val: JSON.stringify(val2Write) });
    }
}





async function UpdateHistory(values, dates) {

    if (oHistoryVars.length > 0) {
        //prüfen ob alle json gleich lang sind
        let NoOfDates = -1;

        const obj = await adapter.getStateAsync("history.date");

        if (obj !== undefined && obj != null) {
            try {
                let oEbusDates = [];
                //adapter.log.debug("before " + obj.val);
                oEbusDates = JSON.parse(obj.val);
                //adapter.log.debug("after parse " + JSON.stringify(oEbusDates));



                oEbusDates.push(dates);
                //adapter.log.debug("after push " + JSON.stringify(oEbusDates));
                //limit length of object...
                if (oEbusDates.length > 200) {

                    for (let i = oEbusDates.length; i > 200; i--) {
                        //adapter.log.debug("delete");
                        oEbusDates.shift();
                    }
                }
                NoOfDates = oEbusDates.length;
                await adapter.setStateAsync("history.date", { ack: true, val: JSON.stringify(oEbusDates) });
            }
            catch (e) {
                adapter.log.error("exception in UpdateHistory part1 [" + e + "]");
                await adapter.setStateAsync("history.date", { ack: true, val: "[]" });
                NoOfDates = 0;
            }
        }
        else {
            adapter.log.warn("history.date not found, creating DP ");
            await adapter.setStateAsync("history.date", { ack: true, val: "[]" });
            NoOfDates = 0;
        }
        
        if (oHistoryVars.length > 0) {
            for (let ctr = 1; ctr <= oHistoryVars.length; ctr++) {

                if (oHistoryVars[ctr - 1].name.length > 0) {
                    const ctrOkay = await UpdateHistoryValues(values, ctr, NoOfDates);

                    if (!ctrOkay) {
                        await adapter.setStateAsync("history.date", { ack: true, val: "[]" });
                        NoOfDates = 0;
                        adapter.log.warn("reset history date too");
                    }
                }
                else {
                    adapter.log.debug("ignoring history value " + ctr);
                }
            }

            adapter.log.info("all history done");
        }
    }
    else {
        adapter.log.debug("nothing to do for history");
    }
}



async function UpdateHistoryValues(values, ctr, curDateCtr) {


    let bRet = true;

    const obj = await adapter.getStateAsync("history.value" + ctr);

    if (obj !== undefined && obj != null) {
        try {
            let oEbusValues = [];
            if (obj !== null) {
                //adapter.log.debug("before " + obj.val);

                oEbusValues = JSON.parse(obj.val);

                //adapter.log.debug("after parse " + JSON.stringify(oEbusValues));

                //adapter.log.debug("after parse cnt " + oEbusValues.length);
            }

            //adapter.log.debug("values " + ctr + ": " + JSON.stringify(values[ctr-1]));

            oEbusValues.push(values[ctr - 1]);
            //adapter.log.debug("after push " + JSON.stringify(oEbusValues));
            //adapter.log.debug("after push cnt " + oEbusValues.length);
            //limit length of object...
            if (oEbusValues.length > 200) {

                for (let i = oEbusValues.length; i > 200; i--) {
                    //adapter.log.debug("delete");
                    oEbusValues.shift();
                }
            }

            const key = "history.value" + ctr;
            adapter.log.debug("update history " + key); 

            if (curDateCtr != oEbusValues.length) {
                bRet = false;
                await adapter.setStateAsync("history.value" + ctr, { ack: true, val: "[]" });
                adapter.log.warn("reset history " + key + " because number of values different to date values"); 

            }
            else {
                await adapter.setStateAsync(key, { ack: true, val: JSON.stringify(oEbusValues) });
            }

            
        }
        catch (e) {
            adapter.log.error("exception in UpdateHistory part2 [" + e + "]");
            await adapter.setStateAsync("history.value" + ctr, { ack: true, val: "[]" });
            if (curDateCtr > 0) {
                bRet = false;
            }
        }
    }
    else {
        adapter.log.warn("history.value" + ctr + " not found, creating DP " + JSON.stringify(obj));
        await adapter.setStateAsync("history.value" + ctr, { ack: true, val: "[]" });
        if (curDateCtr > 0) {
            bRet = false;
        }
    }

    return bRet;
}



async function AddObject(key, type) {
    //adapter.log.debug("addObject " + key);

    try {
        const obj = await adapter.getObjectAsync(key);

        if (obj != null) {
            //adapter.log.debug(" got Object " + JSON.stringify(obj));
            if (obj.common.role != "value"
                || obj.common.type != type) {
                adapter.log.debug(" !!! need to extend for " + key);
                await adapter.extendObject(key, {
                    common: {
                        type: type,
                        role: "value",
                    }
                });
            }
        }
        else {
            adapter.log.warn(" !!! does not exist, creating now " + key );

            await adapter.setObjectNotExistsAsync(key, {
                type: "state",
                common: {
                    name: "data",
                    type: type,
                    role: "value",
                    unit: "",
                    read: true,
                    write: false
                },
                native: {
                    location: key
                }
            });
        }

    } catch (e) {
        adapter.log.error("exception in AddObject " + "[" + e + "]");
    }
}

async function UpdateObject(key, value) {
    try {
        if (value === undefined) {
            adapter.log.warn("updateObject: not updated " + key + " value: " + value + " " + typeof value);
        }
        else if (value == null ) {
            adapter.log.debug("updateObject: update to null " + key + " value: " + value);
            await adapter.setStateAsync(key, { ack: true, val: null });
        }
        else {
            adapter.log.debug("updateObject " + key + " : " + value);
            await adapter.setStateAsync(key, { ack: true, val: value });
        }        
    } catch (e) {
        adapter.log.error("exception in UpdateObject " + "[" + e + "]");
    }
}


//telnet client to write to ebusd
//https://github.com/john30/ebusd/wiki/3.1.-TCP-client-commands
/*
telnet 192.168.3.144 8890

find -f -c broadcast outsidetemp
find -f  outsidetemp
find -f  YieldTotal

read -f YieldTotal
read LegioProtectionEnabled

read -f YieldTotal,read LegioProtectionEnabled,read -f -c broadcast outsidetemp

*/


//this function just triggers ebusd to read data; result will not be parsed; we just take the values from http result
//here we need a loop over all configured read data in admin-page
async function ebusd_ReadValues() {

    if (oPolledVars.length > 0) {

        adapter.log.debug("to poll ctr " + oPolledVars.length + " vals:  " + JSON.stringify(oPolledVars));

        try {
            const socket = new net.Socket();
            const promiseSocket = new PromiseSocket(socket);

            await promiseSocket.connect(parseInt(adapter.config.targetTelnetPort), adapter.config.targetIP);
            adapter.log.debug("telnet connected to poll variables " + adapter.config.targetIP + " port " + adapter.config.targetTelnetPort);
            promiseSocket.setTimeout(5000);

            let retries = 0;
            for (let nCtr = 0; nCtr < oPolledVars.length; nCtr++) {

                let circuit = "";
                let params = "";
                if (oPolledVars[nCtr].circuit != null && oPolledVars[nCtr].circuit.length > 0) {
                    circuit = "-c " + oPolledVars[nCtr].circuit + " ";
                }
                if (oPolledVars[nCtr].parameter != null && oPolledVars[nCtr].parameter.length > 0) {
                    params = " " + oPolledVars[nCtr].parameter;
                }
                let cmd = "read -f " + circuit + oPolledVars[nCtr].name + params;

                adapter.log.debug("send cmd " + cmd);

                cmd += "\n";
                await promiseSocket.write(cmd);

                const data = await promiseSocket.read();

                //received ERR: arbitration lost for YieldThisYear
                if (data.includes("ERR")) {
                    adapter.log.warn("sent " + cmd + ", received " + data + " for " + JSON.stringify(oPolledVars[nCtr]) + " please check ebusd logs for details!");

                    /*
                    * sent read -f YieldLastYear, received ERR: arbitration lost for {"circuit":"","name":"YieldLastYear","parameter":""}
                    * */
                    if (data.includes("arbitration lost")) {

                        retries++;
                        if (retries > adapter.config.maxretries) {
                            adapter.log.error("max retries, skip cmd " + cmd);
                            retries = 0;
                        }
                        else {
                            nCtr--;
                            adapter.log.debug("retry to send data ");
                        }
                    }
                }
                else {
                    adapter.log.debug("received " + data + " for " + JSON.stringify(oPolledVars[nCtr]));
                }
            }
            promiseSocket.destroy();
            adapter.log.debug("telnet disonnected");

        } catch (e) {
            adapter.log.error("exception from tcp socket in ebusd_ReadValues " + "[" + e + "]");
        }


    }
    else {
        adapter.log.debug("nothing to poll; skip telnet");
    }

}


async function FindParams(obj) {

    adapter.log.debug("FindParams " + JSON.stringify(obj) + " " + JSON.stringify(obj.message) + " " + JSON.stringify(obj.message.circuit));

    const list = [];
    

    try {
        //FindParams {"command":"findParams","message":{"circuit":"cc"},"from":"system.adapter.admin.0","callback":{"message":{"circuit":"cc"},"id":90,"ack":false,"time":1733690088670},"_id":39690903}

        if (obj.message != null) {

            const circuit = obj.message.circuit;

            const socket = new net.Socket();
            const promiseSocket = new PromiseSocket(socket);

            await promiseSocket.connect(parseInt(adapter.config.targetTelnetPort), adapter.config.targetIP);
            adapter.log.debug("telnet connected for cmd");
            promiseSocket.setTimeout(5000);

            const cmd = "find -c " + circuit + " -F circuit,name\n";
            await promiseSocket.write(cmd);

            const data = await promiseSocket.read();

            if (data.includes("ERR")) {
                adapter.log.warn("received error! sent find, received " + data + " please check ebusd logs for details! " + cmd);
            }
            else {
                adapter.log.debug("received " + typeof data + " " + data + " " + + cmd);
            }
            /*
              received object ehp,AccelerationTestModeehp,AccelerationTestModeehp,ActualEnvironmentPowerehp,ActualEnvironmentPowerehp,ActualEnvironmentPowerPercentageehp,ActualEnvironmentPowerPercentageehp,ApplianceCodeehp,ApplianceCodeehp,Backupehp,Backupehp,BackupHoursehp,BackupHoursHcehp,BackupHoursHwcehp,BackupHysteresisehp,BackupIntegralehp,BackupModeHcehp,BackupModeHwcehp,BackupPowerCutehp,BackupStartsehp,BackupStartsHcehp,BackupStartsHwcehp,BackupTypeehp,BivalentTempehp,Bleedingehp,Bleedingehp,CirPumpehp,CirPumpehp,Code1ehp,Code1Code2Validehp,Code2ehp,Compehp,Compehp,CompControlStateehp,CompCutPressHighCountehp,CompCutPressLowCountehp,CompCutTempCountehp,CompDemandehp,CompHoursehp,CompHoursHcehp,CompHoursHwcehp,CompHysteresisehp,CompIntegralehp,CompPressHighehp,CompPressHighehp,CompPressLowehp,CompPressLowehp,CompStartsehp,CompStartsHcehp,CompStartsHwcehp,CompStateehp,CondensorTempehp,CondensorTempehp,currenterrorehp,Dateehp,DateTimeehp,DeltaTempT6T7ehp,ElectricWiringDiagramehp,ElectricWiringDiagramehp,EnergyBalancingReleaseehp,errorhistoryehp,FlowTempehp,FlowTempehp,FlowtempCoolingMinehp,FlowTempOffsetehp,Hc1Pumpehp,Hc1Pumpehp,Hc1PumpHoursehp,Hc1PumpPortehp,Hc1PumpStartsehp,Hc2Pumpehp,Hc2PumpHoursehp,HcFlowTempehp,HcFlowTempOffsetehp,HcModeDemandHoursehp,HcModeFulfilledHoursehp,HcParallelStorageFillingEnabledehp,HcPressehp,HcReturnTempehp,HcReturnTempehp,HcReturnTempOffsetehp,HeatPumpStatusehp,HeatPumpStatusehp,HeatpumpTypeehp,HwcHcValveehp,HwcHcValveehp,HwcHcValveStartsehp,HwcLaggingTimeehp,HwcLoadingDelayehp,HwcModeDemandHoursehp,HwcModeFulfilledHoursehp,HwcPumpStartsehp,HwcSwitchehp,HwcTempehp,HwcTempehp,HwcTempOffsetehp,HydraulicSchemeehp,ICLOutehp,ICLOutehp,Injectionehp,Integralehp,Mixer1DutyCycleehp,NumberCompStartsehp,OutsideTempehp,OutsideTempOffsetehp,OverpressureThresholdehp,PhaseOrderehp,PhaseOrderehp,PhaseStatusehp,PhaseStatusehp,PowerCutehp,PowerCutPreloadingehp,PressSwitchehp,PressSwitchehp,RebootCounterehp,ReturnTempMaxehp,SetModeehp,SoftwareCodeehp,Source2PumpHoursehp,Sourceehp,Sourceehp,SourceHoursehp,SourcePortehp,SourcePressehp,SourcePumpPrerunTimeehp,SourceStartsehp,SourceSwitchehp,SourceSwitchehp,SourceTempInputehp,SourceTempInputehp,SourceTempInputOffsetehp,SourceTempOutputehp,SourceTempOutputehp,SourceTempOutputOffsetehp,SourceTempOutputT8Minehp,StateSoftwareCodeehp,StateSoftwareCodeehp,Status01ehp,Status02ehp,Status16ehp,Statusehp,StatusCirPumpehp,StorageTempBottomehp,StorageTempBottomehp,StorageTempBottomOffsetehp,StorageTempTopehp,StorageTempTopehp,StorageTempTopOffsetehp,Subcoolingehp,Superheatehp,T19MaxToCompOffehp,TempInputehp,TempInputehp,TempInputOffsetehp,TempOutputehp,TempOutputehp,TempOutputOffsetehp,Timeehp,TimeBetweenTwoCompStartsMinehp,TimeCompOffMinehp,TimeCompOnMinehp,TimeOfNextPredictedPowerCutehp,TimeOfNextPredictedPowerCutehp,Weekdayehp,YieldTotalehp,YieldTotal
            */
            const str = new TextDecoder().decode(data);
            const datas = str.split(/\r?\n/);

            for (let i = 0; i < datas.length; i++) {

                //adapter.log.debug(JSON.stringify(datas[i]));

                const names = datas[i].split(",");

                //doppelte und leere herausfiltern
                let add = true;

                if (names[0] == "" || names[1] == "") {
                    add = false;
                }
                else {

                    for (let n = 0; n < list.length; n++) {

                        if (list[n].circuit == names[0] && list[n].name == names[1]) {
                            add = false;
                            //already in list
                        }
                    }
                }

                if (add) {
                    const entry = {
                        active: false,
                        circuit: names[0],
                        name: names[1]
                    };

                    list.push(entry);
                }
            }
        }
        else {
            adapter.log.error("no circuit defined where to look for parameter, check values!");
        }
    } catch (e) {
        adapter.log.error("exception in FindParams " + "[" + e + "]");
    }

    adapter.log.info("parameters " + JSON.stringify(list));


    adapter.sendTo(obj.from, obj.command, list, obj.callback);
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 