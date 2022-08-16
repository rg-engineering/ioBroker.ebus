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
const ebusdMinVersion = [22, 2];
let ebusdVersion = [0, 0];
let ebusdUpdateVersion = [0, 0];

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
                adapter && adapter.log && adapter.log.info && adapter.log.info("cleaned everything up...");
                //to do stop intervall
                callback();
            } catch (e) {
                callback();
            }
        },
        //#######################################
        //
        //SIGINT: function () {
        //    clearInterval(intervalID);
        //    intervalID = null;
        //    adapter && adapter.log && adapter.log.info && adapter.log.info("cleaned everything up...");
        //    CronStop();
        //},
        //#######################################
        //  is called if a subscribed object changes
        //objectChange: function (id, obj) {
        //    adapter.log.debug("[OBJECT CHANGE] ==== " + id + " === " + JSON.stringify(obj));
        //},
        //#######################################
        // is called if a subscribed state changes
        //stateChange: function (id, state) {
        //HandleStateChange(id, state);
        //},
        stateChange: async (id, state) => {
            await HandleStateChange(id, state);
        },
        //#######################################
        //
    });
    adapter = new utils.Adapter(options);

    return adapter;
}

//var request = require('request');
//const bent = require("bent");
const axios = require('axios');
//const parseString = require("xml2js").parseString;
const net = require("net");
const { PromiseSocket } = require("promise-socket");



//let killTimer;
let intervalID;


async function main() {

    /*
    let nParseTimeout = 60;
    if (adapter.config.parseTimeout > 0) {
        nParseTimeout = adapter.config.parseTimeout;
    }
    adapter.log.debug("set timeout to " + nParseTimeout + " sec");
    nParseTimeout = nParseTimeout * 1000;
    // force terminate after 1min
    // don't know why it does not terminate by itself...
    killTimer = setTimeout(function () {
        adapter.log.warn("force terminate");
        //process.exit(0);
        adapter.terminate ? adapter.terminate(15) : process.exit(15);
    }, nParseTimeout);
    */

    adapter.log.debug("start with interface ebusd ");

    FillPolledVars();
    FillHistoryVars();

    await checkVariables();

    subscribeVars();

    //await TestFunction();

    let readInterval = 5;
    if (parseInt(adapter.config.readInterval) > 0) {
        readInterval = adapter.config.readInterval;
    }
    adapter.log.debug("read every  " + readInterval + " minutes");
    intervalID = setInterval(Do, readInterval * 60 * 1000);

    /*
    if (killTimer) {
        clearTimeout(killTimer);
        adapter.log.debug("timer killed");
    }

    adapter.terminate ? adapter.terminate(0) : process.exit(0);
    */
}

async function Do() {

    adapter.log.debug("starting ... " );

    await ebusd_Command();

    await ebusd_ReadValues();

    await ebusd_ReceiveData();
}


async function HandleStateChange(id, state) {
   

    if (state.ack !== true) {

        adapter.log.debug("handle state change " + id);
        const ids = id.split(".");

        if (ids[2] === "cmd") {
            await ebusd_Command();
        }
        else {
            adapter.log.warn("unhandled state change " + id);
        }
    }

}



let oPolledVars = [];
function FillPolledVars() {

    if (typeof adapter.config.PolledDPs !== 'undefined' && adapter.config.PolledDPs != null && adapter.config.PolledDPs.length > 0) {
        adapter.log.debug("use new object list for polled vars");
        oPolledVars = adapter.config.PolledDPs;
    }
    else {
        //make it compatible to old versions
        adapter.log.debug("check old comma separeted list for polled vars");
        const oPolled = adapter.config.PolledValues.split(",");

        if (oPolled.length > 0) {

            for (let i = 0; i < oPolled.length; i++) {
                if (oPolled[i].length > 0) {
                    console.log('add ' + oPolled[i]);
                    const value = {
                        circuit: "",
                        name: oPolled[i],
                        parameter: ""
                    }
                    oPolledVars.push(value);
                }
            }
        }
    }
}

let oHistoryVars = [];
function FillHistoryVars() {
    
    if (typeof adapter.config.HistoryDPs !== 'undefined' && adapter.config.HistoryDPs != null && adapter.config.HistoryDPs.length > 0) {
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
                    console.log('add ' + oHistory[i]);
                    const value = {
                        name: oHistory[i],
                    }
                    oHistoryVars.push(value);
                }
            }
        }
    }
}







//===================================================================================================
// ebusd interface

async function ebusd_Command() {
    const obj = await adapter.getStateAsync("cmd");

    if (typeof obj != undefined && obj != null) {
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
                            adapter.log.warn("sent " + oCmds[n] + ", received " + data + " please check ebusd logs for details!";
                        }
                        else {
                            adapter.log.debug("received " + data);
                        }
                        received += data.toString();
                        received += ", ";
                    }

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


//just call http://192.168.0.123:8889/data

function subscribeVars() {
    adapter.subscribeStates("cmd");
}


async function checkVariables() {
    adapter.log.debug("init variables ");

    let key;
    let obj;

    key = "cmd";
    await adapter.setObjectNotExistsAsync(key, {
        type: "state",
        common: {
            name: "ebusd command",
            type: "string",
            role: "text",
            read: true,
            write: true
        }
    });

    obj = await adapter.getObjectAsync(key);

    if (obj != null) {

        if (obj.common.role != "text") {
            await adapter.extendObject(key, {
                common: {
                    role: "text",
                }
            });
        }
    }

    key = "cmdResult";
    await adapter.setObjectNotExistsAsync(key, {
        type: "state",
        common: {
            name: "ebusd command result",
            type: "string",
            role: "text",
            read: true,
            write: false
        }
    });
    obj = await adapter.getObjectAsync(key);

    if (obj != null) {

        if (obj.common.role != "text") {
            await adapter.extendObject(key, {
                common: {
                    role: "text",
                }
            });
        }
    }



    adapter.log.debug("init common variables and " + oHistoryVars.length + " history DP's");
    

    if (oHistoryVars.length > 0) {

        if (oHistoryVars.length > 4) {
            adapter.log.warn("too many history values " + oHistoryVars.length + " -> maximum is  4");
        }

        for (let n = 1; n <= oHistoryVars.length; n++) {

            if (oHistoryVars[n - 1].name.length > 0) {
                const name = "history value " + n + " as JSON " + oHistoryVars[n - 1].name;
                key = "history.value" + n;
                await adapter.setObjectNotExistsAsync(key, {
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
                });

                obj = await adapter.getObjectAsync(key);

                if (obj != null) {

                    if (obj.common.role != "value" || obj.common.name != name) {
                        await adapter.extendObject(key, {
                            common: {
                                name: name,
                                role: "value",
                            }
                        });
                    }
                }
            }
            else {
                adapter.log.warn("ignoring history value " + n + " (invalid name)");
            }
        }

        key = "history.date";
        await adapter.setObjectNotExistsAsync(key, {
            type: "state",
            common: { name: "ebus history date as JSON", type: "string", role: "value", unit: "", read: true, write: false },
            native: { location: key }
        });
        obj = await adapter.getObjectAsync(key);

        if (obj != null) {

            if (obj.common.role != "value") {
                await adapter.extendObject(key, {
                    common: {
                        role: "value",
                    }
                });
            }
        }
    }
    key = "history.error";
    await adapter.setObjectNotExistsAsync(key, {
        type: "state",
        common: { name: "ebus error", type: "string", role: "value", unit: "", read: true, write: false },
        native: { location: key }
    });
    obj = await adapter.getObjectAsync(key);

    if (obj != null) {

        if (obj.common.role != "value") {
            await adapter.extendObject(key, {
                common: {
                    role: "value",
                }
            });
        }
    }
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

    const sUrl = "http://" + adapter.config.targetIP + ":" + parseInt(adapter.config.targetHTTPPort) + "/data";
    adapter.log.debug("request data from " + sUrl);

    try {
        /*
        const getBuffer = bent("string");
        const buffer = await getBuffer(sUrl);
        */

        const buffer = await axios.get(sUrl);

        adapter.log.debug("got data " + typeof buffer.data + " " + JSON.stringify(buffer.data));

        //const oData = JSON.parse(buffer.data);
        const oData = buffer.data;

        //adapter.log.debug("oData " + oData);

        const flatten = require("flat");

        const newData = flatten(oData);

        const keys = Object.keys(newData);

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
                const start = key.indexOf('[');
                const end = key.lastIndexOf(']');

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
                const versionInfo = value.split('.');
                if (versionInfo.length > 1) {
                    adapter.log.info("found ebusd version " + versionInfo[0] + "." + versionInfo[1]);

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

                const versionInfo = value.split('.');
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

                if (value == null || value == undefined) {
                    adapter.log.debug('Key : ' + key + ', Value : ' + newData[org_key] + " name " + name);
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
                        adapter.log.debug('Key ' + key + " change to boolean " + value);
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
                        subnames[0].includes("ehp")) {
                        bSkip = true;
                    }
                    if (temp > 2) {
                        //adapter.log.debug("_______________size " + temp);
                        if (subnames[2].includes("Timer")) {
                            bSkip = true;
                        }
                    }

                    if (!bSkip && Math.abs(oDate.getTime() - oToday.getTime()) > 1 * 60 * 60 * 1000) {

                        const sError1 = "no update since " + sDate + " " + key + " ";
                        if (sError.includes("none")) {
                            sError = "ebus: " + sError1;
                        }
                        else {
                            sError += sError1;
                        }
                        adapter.log.debug(sError1);
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

       
        await UpdateHistory(historyvalues, historydates);
       

    }
    catch (e) {
        adapter.log.error("exception in ebusd_ReceiveData [" + e + "]");

        await adapter.setStateAsync("history.error", { ack: true, val: "exception in receive" });
    }
    //});
}



async function UpdateHistory(values, dates) {

    if (oHistoryVars.length > 0) {
        //prüfen ob alle json gleich lang sind
        let NoOfDates = -1;

        const obj = await adapter.getStateAsync("history.date");

        if (typeof obj != undefined && obj != null) {
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

    if (typeof obj != undefined && obj != null) {
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
        if (value == null || value == undefined) {
            adapter.log.debug("updateObject: not updated " + key + " value: " + value);
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

/*
async function TestFunction(){


    const key = "Test.Test";

    await AddObject(key);

}
*/

/*
async function ebusd_StartReceive(options) {
    await ebusd_ReceiveData(options);
}
*/

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 