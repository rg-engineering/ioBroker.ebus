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


let adapter;
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: "ebus",
        ready: function () {
            try {
                //adapter.log.debug('start');
                main();
            }
            catch (e) {
                adapter.log.error("exception catch after ready [" + e + "]");
            }
        }
    });
    adapter = new utils.Adapter(options);

    return adapter;
}

//var request = require('request');
const bent = require("bent");
//const parseString = require("xml2js").parseString;
const net = require("net");
const { PromiseSocket } = require("promise-socket");



let killTimer;


async function main() {

    /*
    const options = {
        targetIP: adapter.config.targetIP || "192.168.0.100",
        targetHTTPPort: parseInt(adapter.config.targetHTTPPort),
        targetTelnetPort: parseInt(adapter.config.targetTelnetPort),
        polledValues: adapter.config.PolledValues,
        historyValues: adapter.config.HistoryValues
    };
    */

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

    adapter.log.debug("start with interface ebusd ");
    await ebusd_checkVariables();

    await ebusd_Command();
    await ebusd_ReadValues();
    //await ebusd_StartReceive(options);


    //await TestFunction();

    await ebusd_ReceiveData();

    

    if (killTimer) {
        clearTimeout(killTimer);
        adapter.log.debug("timer killed");
    }

    adapter.terminate ? adapter.terminate(0) : process.exit(0);

}



async function Common_checkVariables() {

    // histories
    let nCtr = 0;

    const oHistory = adapter.config.HistoryValues.split(",");
    nCtr = oHistory.length;

    adapter.log.debug("init common variables and " + nCtr + " history DP's");
    let key;
    let obj;
    //adapter.log.debug("_____ ctr " + nCtr);

    if (adapter.config.HistoryValues.length>0 && nCtr > 0) {

        if (nCtr > 4) {
            adapter.log.warn("too many history values " + nCtr + " -> maximum is  4");
        }

        for (let n = 1; n <= nCtr; n++) {

            if (oHistory[n - 1].length > 0) {
                const name = "history value " + n + " as JSON " + oHistory[n - 1];
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




//===================================================================================================
// ebusd interface

async function ebusd_Command() {
    const obj = await adapter.getStateAsync("cmd");

    if (typeof obj != undefined && obj != null) {
        const cmd = obj.val;
        if (cmd !== "") {
            adapter.log.debug("got command " + cmd);

            adapter.log.debug("connect telnet to IP " + adapter.config.targetIP + " port " + parseInt(adapter.config.targetTelnetPort));


            const socket = new net.Socket();
            const promiseSocket = new PromiseSocket(socket);

            try {
                await promiseSocket.connect(parseInt(adapter.config.targetTelnetPort), adapter.config.targetIP);
                adapter.log.debug("telnet connected for cmd");
                promiseSocket.setTimeout(5000);

                await promiseSocket.write(cmd + "\n");

                const data = await promiseSocket.read();

                adapter.log.debug("received " + data);

                //set result to cmdResult 
                await adapter.setStateAsync("cmdResult", { ack: true, val: data.toString() });
                //aufruf next step
                //ebusd_ReadValues(options); // to trigger read over ebus

                await adapter.setStateAsync("cmd", { ack: true, val: "" });

            } catch (e) {
                //if (e instanceof TimeoutError) {
                //    adapter.log.error("Socket timeout");
                //}
                //else {
                adapter.log.error("exception from tcp socket" + "[" + e + "]");
                //}
            }

            promiseSocket.destroy();



            
        }
       
    }
    else {
        adapter.log.debug("object cmd not found " + JSON.stringify(obj));
    }
}


//just call http://192.168.0.123:8889/data

async function ebusd_checkVariables() {
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
    Common_checkVariables();
}

//get data via https in json -> this is the main data receiver; telnet just triggers ebusd to read data;
//https://github.com/john30/ebusd/wiki/3.2.-HTTP-client

async function ebusd_ReceiveData() {

    const sUrl = "http://" + adapter.config.targetIP + ":" + parseInt(adapter.config.targetHTTPPort) + "/data";
    adapter.log.debug("request data from " + sUrl);

    try {

        const getBuffer = bent("string");
        const buffer = await getBuffer(sUrl);

        const oData = JSON.parse(buffer);

        adapter.log.debug("oData " + JSON.stringify(oData));

        const flatten = require("flat");

        const newData = flatten(oData);

        const keys = Object.keys(newData);

        //adapter.log.debug("history: " + options.historyValues);

        const oHistory = adapter.config.HistoryValues.split(",");

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
            const key = keys[i];
            const subnames = key.split(".");
            const temp = subnames.length;
            //adapter.log.debug('Key : ' + key + ', Value : ' + newData[key]);


            if (subnames[temp - 1].includes("name")) {
                name = newData[key];
            }
            else if (subnames[temp - 1].includes("value")) {
                //adapter.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);

                let value = newData[key];

                //value
                await AddObject(key);
                if (name === "hcmode2") {
                    adapter.log.info("in hcmode2, value " + value);
                    if (parseInt(value) === 5) {
                        adapter.log.info("with value 5");
                        value = "EVU Sperrzeit";
                    }
                }
                await UpdateObject(key, value);

                //name parallel to value: used for lists in admin...
                const keyname = key.replace("value", "name");
                await AddObject(keyname);




                await UpdateObject(keyname, name);

                //push to history
                if (!subnames[temp - 2].includes("sensor")) { //ignore sensor states
                    for (let ii = 0; ii < oHistory.length; ii++) {

                        if (name === oHistory[ii]) {

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

                const value = newData[key];

                if (parseInt(value) > 0) {
                    //adapter.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);

                    //umrechnen...
                    const oDate = new Date(value * 1000);
                    const nDate = oDate.getDate();
                    const nMonth = oDate.getMonth() + 1;
                    const nYear = oDate.getFullYear();
                    const nHours = oDate.getHours();
                    const nMinutes = oDate.getMinutes();
                    const nSeconds = oDate.getSeconds();

                    const sDate = nDate + "." + nMonth + "." + nYear + " " + nHours + ":" + nMinutes + ":" + nSeconds;
                    await AddObject(key);
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
                const value = newData[key];
                await AddObject(key);
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

    if (adapter.config.HistoryValues.length > 0) {
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
                        adapter.log.debug("delete");
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

        const oHistory = adapter.config.HistoryValues.split(",");

        if (oHistory.length > 0) {
            for (let ctr = 1; ctr <= oHistory.length; ctr++) {

                if (oHistory[ctr - 1].length > 0) {
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
                    adapter.log.debug("delete");
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



async function AddObject(key) {

    adapter.log.debug("addObject " + key);

    await adapter.setObjectNotExistsAsync(key, {
        type: "state",
        common: {
            name: "data",
            type: "string",
            role: "value", 
            unit: "",
            read: true,
            write: false
        },
        native: {
            location: key
        }
    });

    const obj = await adapter.getObjectAsync(key);

    if (obj != null) {
        //adapter.log.debug(" got Object " + JSON.stringify(obj));
        if (obj.common.role != "value") {
            //adapter.log.debug(" !!! need to extend for " + key);
            await adapter.extendObject(key, {
                common: {
                    role: "value",
                }
            });
        }

    }
}



async function UpdateObject(key, value) {
    await adapter.setStateAsync(key, { ack: true, val: value });
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

*/


//this function just triggers ebusd to read data; result will not be parsed; we just take the values from http result
//here we need a loop over all configured read data in admin-page
async function ebusd_ReadValues() {
   

    //adapter.log.debug("polled: " + options.polledValues);
    //adapter.log.debug("history: " + options.historyValues);

    const oPolled = adapter.config.PolledValues.split(",");
    let nCtr = 0;

    if (oPolled.length > 0 && adapter.config.PolledValues.length>0) {

        adapter.log.debug("to poll ctr " + oPolled.length + " vals:  " + oPolled + " org " + adapter.config.PolledValues + " org length " + adapter.config.PolledValues.length);

        const socket = new net.Socket();
        const promiseSocket = new PromiseSocket(socket);

        try {
            await promiseSocket.connect(parseInt(adapter.config.targetTelnetPort), adapter.config.targetIP);
            adapter.log.debug("telnet connected for cmd");
            promiseSocket.setTimeout(5000);




            for (nCtr = 0; nCtr < oPolled.length; nCtr++) {

                let cmd = "read -f " + oPolled[nCtr];

                adapter.log.debug("send cmd " + cmd);

                cmd += "\n";
                await promiseSocket.write(cmd);

                const data = await promiseSocket.read();

                adapter.log.debug("received " + data + " for " + oPolled[nCtr]);

            }

        } catch (e) {
            adapter.log.error("exception from tcp socket in ebusd_ReadValues " + "[" + e + "]");
        }

        promiseSocket.destroy();


        
    }
    else {
        adapter.log.debug("nothing to poll; skip telnet");

        //ebusd_StartReceive(options);
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