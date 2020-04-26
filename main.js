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








function main() {
    const options = {
        targetIP: adapter.config.targetIP || "192.168.0.100",
        targetHTTPPort: parseInt(adapter.config.targetHTTPPort),
        targetTelnetPort: parseInt(adapter.config.targetTelnetPort),
        polledValues: adapter.config.PolledValues,
        historyValues: adapter.config.HistoryValues
    };

    let nParseTimeout = 60;
    if (adapter.config.parseTimeout > 0) {
        nParseTimeout = adapter.config.parseTimeout;
    }
    adapter.log.debug("set timeout to " + nParseTimeout + " sec");
    nParseTimeout = nParseTimeout * 1000;
    // force terminate after 1min
    // don't know why it does not terminate by itself...
    setTimeout(function () {
        adapter.log.warn("force terminate");
        //process.exit(0);
        adapter.terminate ? adapter.terminate(15) : process.exit(15);
    }, nParseTimeout);

    adapter.log.debug("start with interface ebusd ");
    ebusd_checkVariables(options);

    ebusd_Command(options);
}



function Common_checkVariables(options) {

    // histories
    let nCtr = 0;

    const oHistory = options.historyValues.split(",");
    nCtr = oHistory.length + 1;

    adapter.log.debug("init common variables ");
    //adapter.log.debug("_____ ctr " + nCtr);
    for (let n = 1; n < nCtr; n++) {

        adapter.setObjectNotExists("history.value" + n, {
            type: "state",
            common: { name: "ebus history value " + n + " as JSON", type: "string", role: "value", unit: "", read: true, write: false },
            native: { location: "history.value" + n }
        });
        adapter.extendObject("history.value" + n, {
            common: {
                role: "value",
            }
        });

    }
    adapter.setObjectNotExists("history.date", {
        type: "state",
        common: { name: "ebus history date as JSON", type: "string", role: "value", unit: "", read: true, write: false },
        native: { location: "history.date" }
    });
    adapter.extendObject("history.date", {
        common: {
            role: "value",
        }
    });
    adapter.setObjectNotExists("history.error", {
        type: "state",
        common: { name: "ebus error", type: "string", role: "value", unit: "", read: true, write: false },
        native: { location: "history.error" }
    });
    adapter.extendObject("history.error", {
        common: {
            role: "value",
        }
    });



}




//===================================================================================================
// ebusd interface

function ebusd_Command(options) {
    adapter.getState("cmd", function (err, obj) {
        if (err) {
            adapter.log.error(err);
        } else {
            if (obj !== null) {
                const cmd = obj.val;
                if (cmd !== "") {
                    adapter.log.debug("got command " + cmd);

                    adapter.log.debug("connect telnet to IP " + options.targetIP + " port " + options.targetTelnetPort);

                    const client = new net.Socket();
                    client.setTimeout(5000, function () {
                        client.destroy();
                    });
                    client.connect(options.targetTelnetPort, options.targetIP, function () {
                        adapter.log.debug("telnet connected for cmd");
                    });
                    client.on("data", function (data) {
                        adapter.log.debug("received " + data);

                        
                        //set result to cmdResult 
                        adapter.setState("cmdResult", { ack: true, val: data.toString() });
                        //aufruf next step
                        ebusd_ReadValues(options); // to trigger read over ebus

                        adapter.setState("cmd", { ack: true, val: "" });
                    });
                    client.on("end", function () {
                        adapter.log.debug("Daten ausgelesen");
                    });

                  

                    client.write(cmd + "\n");


                    //client.end();
                    client.on("error", function (err) {

                        client.destroy();
                        adapter.log.error("Telnet Server nicht erreichbar. " + err);
                        ebusd_ReadValues(options); // to trigger read over ebus
                    });

                }
                else {
                    ebusd_ReadValues(options); // to trigger read over ebus
                }
            }
            else {
                ebusd_ReadValues(options); // to trigger read over ebus
            }
        }
    });
}


//just call http://192.168.0.123:8889/data
function ebusd_checkVariables(options) {
    adapter.log.debug("init variables ");



    adapter.setObjectNotExists("cmd", {
        type: "state",
        common: {
            name: "ebusd command",
            type: "string",
            role: "text",
            read: true,
            write: true
        }
    });
    adapter.extendObject("cmd", {
        common: {
            role: "text",
        }
    });
    adapter.setObjectNotExists("cmdResult", {
        type: "state",
        common: {
            name: "ebusd command result",
            type: "string",
            role: "text",
            read: true,
            write: false
        }
    });
    adapter.extendObject("cmdResult", {
        common: {
            role: "text",
        }
    });
    Common_checkVariables(options);
}

//get data via https in json -> this is the main data receiver; telnet just triggers ebusd to read data;
//https://github.com/john30/ebusd/wiki/3.2.-HTTP-client
async function ebusd_ReceiveData(options) {

    const sUrl = "http://" + options.targetIP + ":" + options.targetHTTPPort + "/data";
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

        const oHistory = options.historyValues.split(",");

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
                AddObject(key);
                if (name === "hcmode2") {
                    adapter.log.info("in hcmode2, value " + value);
                    if (parseInt(value) === 5) {
                        adapter.log.info("with value 5");
                        value = "EVU Sperrzeit";
                    }
                }
                UpdateObject(key, value);

                //name parallel to value: used for lists in admin...
                const keyname = key.replace("value", "name");
                AddObject(keyname);




                UpdateObject(keyname, name);

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
                    AddObject(key);
                    UpdateObject(key, sDate);

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
                AddObject(key);
                UpdateObject(key, value);
            }
        }
        adapter.setState("history.error", { ack: true, val: sError });

        //adapter.log.debug(JSON.stringify(historyvalues));

        UpdateHistory(historyvalues, historydates);

        adapter.log.info("all http done");

    }
    catch (e) {
        adapter.log.error("exception in ebusd_ReceiveData [" + e + "]");

        adapter.setState("history.error", { ack: true, val: "exception in receive" });
    }
    //});
}

function UpdateHistory(values, dates) {

    let oEbusDates = [];

    adapter.getState("history.date", function (err, obj) {
        if (err) {
            adapter.log.error(err);
        } else {
            try {
                if (obj !== null) {
                    //adapter.log.debug("before " + obj.val);
                    oEbusDates = JSON.parse(obj.val);
                    //adapter.log.debug("after parse " + JSON.stringify(oEbusDates));
                }


                oEbusDates.push(dates);
                //adapter.log.debug("after push " + JSON.stringify(oEbusDates));
                //limit length of object...
                if (oEbusDates.length > 200) {

                    for (let i = oEbusDates.length; i > 200; i--) {
                        adapter.log.debug("delete");
                        oEbusDates.shift();
                    }
                }
                adapter.setState("history.date", { ack: true, val: JSON.stringify(oEbusDates) });
            }
            catch (e) {
                adapter.log.error("exception in UpdateHistory part1 [" + e + "]");
            }
        }
    });


    UpdateHistoryValues(values, 1);

        
    

}

function UpdateHistoryValues(values, ctr) {
    adapter.getState("history.value" + ctr, function (err, obj) {
        if (err) {
            adapter.log.error(err);
        } else {
            try {
                let oEbusValues = [];
                if (obj !== null) {
                    //adapter.log.debug("before " + obj.val);

                    oEbusValues = JSON.parse(obj.val);

                    //adapter.log.debug("after parse " + JSON.stringify(oEbusValues));

                    //adapter.log.debug("after parse cnt " + oEbusValues.length);
                }

                //adapter.log.debug("values " + ctr + ": " + JSON.stringify(values[ctr-1]));

                oEbusValues.push(values[ctr-1]);
                //adapter.log.debug("after push " + JSON.stringify(oEbusValues));
                //adapter.log.debug("after push cnt " + oEbusValues.length);
                //limit length of object...
                if (oEbusValues.length > 200) {

                    for (let i = oEbusValues.length; i > 200; i--) {
                        adapter.log.debug("delete");
                        oEbusValues.shift();
                    }
                }
                adapter.setState("history.value" + ctr, { ack: true, val: JSON.stringify(oEbusValues) });

                
                if (ctr < values.length) {
                    ctr++;
                    UpdateHistoryValues(values, ctr);  //recursive call
                }
                else {
                    adapter.log.info("all history done (exit)");

                    adapter.terminate ? adapter.terminate(0) : process.exit(0);
                }
            }
            catch (e) {
                adapter.log.error("exception in UpdateHistory part2 [" + e + "]");
            }
        }
    });
}
function AddObject(key) {
    adapter.setObjectNotExists(key, {
        type: "state",
        common: { name: "data", type: "string", role: "value", unit: "", read: true, write: false },
        native: { location: key }
    });
    adapter.extendObject(key, {
        common: {
            role: "value",
        }
    });

}

function UpdateObject(key, value) {
    adapter.setState(key, { ack: true, val: value });
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
const net = require("net");

//this function just triggers ebusd to read data; result will not be parsed; we just take the values from http result
//here we need a loop over all configured read data in admin-page
function ebusd_ReadValues(options) {
   

    //adapter.log.debug("polled: " + options.polledValues);
    //adapter.log.debug("history: " + options.historyValues);

    const oPolled = options.polledValues.split(",");
    let nCtr = 0;

    if (oPolled.length > 0 && options.polledValues.length>0) {

        adapter.log.debug("to poll ctr " + oPolled.length + " vals:  " + oPolled + " org " + options.polledValues + " org length " + options.polledValues.length);

        const client = new net.Socket();
        client.setTimeout(5000, function () {
            client.destroy();
            adapter.log.error("Telnet Server timeout");
            ebusd_StartReceive(options);
        });
        adapter.log.debug("connect telnet to IP " + options.targetIP + " port " + options.targetTelnetPort);
        client.connect(options.targetTelnetPort, options.targetIP, function () {
            adapter.log.debug("telnet connected");
        });
        client.on("data", function (data) {
            if (data.includes("ERR")){
                adapter.log.error("received " + data + " for " + oPolled[nCtr - 1]);
            }
            else {
                adapter.log.debug("received " + data + " for " + oPolled[nCtr - 1] );
            }

            if (oPolled.length > nCtr) {
                client.write("read -f " + oPolled[nCtr] + "\n");
                nCtr++;
            }
            else {
                client.end();
                client.destroy();
                adapter.log.debug("all telnet done ");
                ebusd_StartReceive(options);
            }
        });
        client.on("end", function () {
            adapter.log.debug("Daten ausgelesen");
        });

        if (oPolled.length > nCtr) {
            client.write("read -f " + oPolled[nCtr] + "\n");
            nCtr++;
        }
        //client.end();
        client.on("error", function (err) {

            client.destroy();
            adapter.log.error("Telnet Server nicht erreichbar. " + err);

            adapter.setState("history.error", { ack: true, val: "telnet server no reachable" });

            ebusd_StartReceive(options);
        });
    }
    else {
        adapter.log.debug("nothing to poll; skip telnet");

        ebusd_StartReceive(options);
    }

}


function ebusd_StartReceive(options) {
    ebusd_ReceiveData(options);
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 