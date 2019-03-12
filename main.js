/*
 * ebus adapter für iobroker
 *
 * Created: 15.09.2016 21:31:28
 *  Author: Rene


*/

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
//var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
const utils = require('@iobroker/adapter-core');

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
//this is the old version without compact
//var adapter = utils.adapter('ebus');

//new version with compact
let adapter;
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: 'ebus',
        ready: function () {
            try {
                //adapter.log.debug('start');
                main();
            }
            catch (e) {
                adapter.log.error('exception catch after ready [' + e + ']');
            }
        }
    });
    adapter = new utils.Adapter(options);

    return adapter;
};

var request = require('request');
var parseString = require('xml2js').parseString;




//Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
/* adapter.on('message', function (obj) {
	if (obj) {
        switch (obj.command) {
        	case 'send':
        		// e.g. send email or pushover or whatever
        		console.log('send command');

        		// Send response in callback if required
        		if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        		break;

    	}
    }
});

*/
// is called when adapter shuts down - callback has to be called under any circumstances!
/*adapter.on('unload', function (callback) {
    try {
        adapter.log.debug('cleaned everything up...');
        callback();
    }
    catch (e) {
        callback();
    }
});
*/


// is called if a subscribed object changes
/*adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));

});
*/
// is called if a subscribed state changes
/*adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});
*/


// is called when databases are connected and adapter received configuration.
// start here!
/*adapter.on('ready', function () {
    try {
        //adapter.log.debug('start');
        main();
    }
    catch (e) {
        adapter.log.error('exception catch after ready [' + e + ']');
    }
});
*/


function main() {
    var options = {
        targetIP: adapter.config.targetIP || '192.168.0.100',
        targetHTTPPort: parseInt(adapter.config.targetHTTPPort),
        targetTelnetPort: parseInt(adapter.config.targetTelnetPort),
        polledValues: adapter.config.PolledValues,
        historyValues: adapter.config.HistoryValues
    };

    var nParseTimeout = 60;
    if (adapter.config.parseTimeout > 0) {
        nParseTimeout = adapter.config.parseTimeout;
    }
    adapter.log.debug('set timeout to ' + nParseTimeout + ' sec');
    nParseTimeout = nParseTimeout * 1000;
    // force terminate after 1min
    // don't know why it does not terminate by itself...
    setTimeout(function () {
        adapter.log.warn('force terminate');
        //process.exit(0);
        adapter.terminate ? adapter.terminate(11) : process.exit(11);
    }, nParseTimeout);

    /*
    if (adapter.config.interfacetype == "arduino") {
        adapter.log.debug('start with interface arduino ');
        Arduino_checkVariables(options);

        Arduino_ReceiveData(options, function () {
            setTimeout(function () {
                adapter.stop();
            }, 6000);
        });

    }
    else */
    //if (adapter.config.interfacetype == "ebusd") {
        adapter.log.debug('start with interface ebusd ');
        ebusd_checkVariables(options);

        ebusd_Command(options);

       

    //}
    //else {
    //    adapter.log.error('unknown interface type ' + adapter.config.interfacetype);
    //}

}


//===================================================================================================
// arduino interface
/*
VaillantInterface >
    <sender IP="192.168.3.181" name="Arduino"> </sender>
    <version name="Vaillant Interface" number="1.5.8"> </version>
    <system RAM="239" Rx="110033959" lstate="0"> </system>
    <data>
        <date date="02.03.2017"> </date>
        <time time="20:21:00"> </time>
        <TempOut value="5.81" unit="C"> </TempOut>
        <TempVorlauf value="30.19" unit="C"> </TempVorlauf>
        <TempQuelle value="5.69" unit="C"> </TempQuelle>
        <HeizLeistungMomentan value="0.00" unit="kW"/>
        <Status value="Bereitschaft" unit=""/>
        <Error value="-1 (0xFF 0xFF) " unit=""/>
        <Warning value="-1 (0xFF 0xFF) " unit=""/>
        <pump state="on"> </pump>
    </data>
</VaillantInterface >
*/

/*
function Arduino_ReceiveData(options, cb) {


    try {
        adapter.log.debug("request data from " + options.targetIP);
        //request('http://192.168.3.181', function (error, response, body) {
        //request('http://192.168.3.143/abfrage.php', function (error, response, body) {
        request("http://" + options.targetIP, function (error, response, body) {

            if (!error && response.statusCode == 200) {
                //adapter.log.debug("Body: " + body + " " + response.statusCode);

                parseString(body, function (err, result) {

                    try {
                        //adapter.log.debug(JSON.stringify(result));
                        var oToday = new Date();
                        var sDate = JSON.stringify(result.VaillantInterface.data[0].date[0].$.date);
                        //Date "20.02.2018"
                        sDate = sDate.replace(/"/g, '');
                        var sDateArr = sDate.split(".");

                        var sTime = JSON.stringify(result.VaillantInterface.data[0].time[0].$.time)
                        //time "21:05:04"
                        sTime = sTime.replace(/"/g, '');
                        var sTimeArr = sTime.split(":");
                        //year, month, day, hours, minutes, seconds, milliseconds
                        var oDate = new Date(parseInt(sDateArr[2]), parseInt(sDateArr[1]) - 1, parseInt(sDateArr[0]), parseInt(sTimeArr[0]), parseInt(sTimeArr[1]), parseInt(sTimeArr[2]), 0);

                        adapter.log.debug("got from " + oDate.toString());
                        //adapter.log.debug("got from " + oDate.toString() + " " + oToday.toString());
                        //adapter.log.debug("date " + sDate + " " + sDateArr[2] + " " + sDateArr[1] + " " + sDateArr[0]);
                        //adapter.log.debug("time " + sTime + " " + sTimeArr[0] + " " + sTimeArr[1] + " " + sTimeArr[2]);

                        //just check if we got correct date and time 

                        //adapter.log.debug("*** " + Math.abs(oDate.getTime() - oToday.getTime()) + " " + (12 * 60 * 60 * 1000))


                        if (Math.abs(oDate.getTime() - oToday.getTime()) < (12 * 60 * 60 * 1000)) {

                            adapter.log.debug("result " + JSON.stringify(result.VaillantInterface));


                            adapter.setState('sender.IP', { ack: true, val: result.VaillantInterface.sender[0].$.IP });

                            adapter.setState('sender.name', { ack: true, val: result.VaillantInterface.sender[0].$.name });
                            adapter.setState('sender.versionname', { ack: true, val: result.VaillantInterface.version[0].$.name });
                            adapter.setState('sender.version', { ack: true, val: result.VaillantInterface.version[0].$.number });
                            adapter.setState('sender.RAM', { ack: true, val: result.VaillantInterface.system[0].$.RAM });
                            adapter.setState('sender.RX', { ack: true, val: result.VaillantInterface.system[0].$.Rx });

                            adapter.setState('data.date', { ack: true, val: sDate });
                            adapter.setState('data.time', { ack: true, val: sTime });
                            adapter.setState('data.TempOut', { ack: true, val: result.VaillantInterface.data[0].TempOut[0].$.value });
                            adapter.setState('data.TempVorlauf', { ack: true, val: result.VaillantInterface.data[0].TempVorlauf[0].$.value });
                            adapter.setState('data.TempQuelle', { ack: true, val: result.VaillantInterface.data[0].TempQuelle[0].$.value });
                            adapter.setState('data.HeizLeistungMomentan', { ack: true, val: result.VaillantInterface.data[0].HeizLeistungMomentan[0].$.value });
                            adapter.setState('data.Status', { ack: true, val: result.VaillantInterface.data[0].Status[0].$.value });
                            adapter.setState('data.Error', { ack: true, val: result.VaillantInterface.data[0].Error[0].$.value });
                            adapter.setState('data.Warning', { ack: true, val: result.VaillantInterface.data[0].Warning[0].$.value });
                            adapter.setState('data.Pump', { ack: true, val: result.VaillantInterface.data[0].pump[0].$.state });


                            //myhomecontrol_ebus.0.data.history
                            //use datapoint behaviour as storage for json object
                            var historyvalues = [];
                            var historydates = [];
                            
                            historydates.push({
                                "date": result.VaillantInterface.data[0].date[0].$.date,
                                "time": result.VaillantInterface.data[0].time[0].$.time,
                            });
                            //adapter.log.debug(JSON.stringify(historydates));

                            historyvalues[0] = [];
                            historyvalues[0].push({
                                "TempVorlauf": result.VaillantInterface.data[0].TempVorlauf[0].$.value
                            });

                            historyvalues[1] = [];
                            historyvalues[1].push({
                                "TempQuelle": result.VaillantInterface.data[0].TempQuelle[0].$.value
                            });

                            historyvalues[2] = [];
                            historyvalues[2].push({
                                "HeizLeistung": result.VaillantInterface.data[0].HeizLeistungMomentan[0].$.value
                            });

                            historyvalues[3] = [];
                            historyvalues[3].push({
                                "Status": result.VaillantInterface.data[0].Status[0].$.value
                            });
    
                            //adapter.log.debug(JSON.stringify(historyvalues));
    
                            
                            UpdateHistory(historyvalues, historydates);
                            

                            
                        }
                    }
                    catch (e) {
                        adapter.log.error('exception in arduino_ReceiveData [' + e + ']');
                    }

                });
            } else {
                adapter.log.error(error);
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in Arduino_ReceiveData [' + e + ']');
    }
    if (cb) cb();
}
*/

function Common_checkVariables(options) {

    // histories
    var nCtr = 0;
    /* if (adapter.config.interfacetype == "arduino") {
        nCtr = 5;
    }
    else if (adapter.config.interfacetype == "ebusd") {
    */
        var oHistory = options.historyValues.split(",");
        nCtr = oHistory.length + 1;
    //}

    adapter.log.debug("init common variables ");
    //adapter.log.debug("_____ ctr " + nCtr);
    for (var n = 1; n < nCtr; n++) {

        adapter.setObjectNotExists('history.value' + n, {
            type: 'state',
            common: { name: 'ebus history value ' + n + ' as JSON', type: 'string', role: 'history', unit: '', read: true, write: false },
            native: { location: 'history.value' + n }
        });
    }
    adapter.setObjectNotExists('history.date' , {
        type: 'state',
        common: { name: 'ebus history date as JSON', type: 'string', role: 'history', unit: '', read: true, write: false },
        native: { location: 'history.date' }
    });

    adapter.setObjectNotExists('history.error', {
        type: 'state',
        common: { name: 'ebus error', type: 'string', role: 'history', unit: '', read: true, write: false },
        native: { location: 'history.error' }
    });


    
}
/*
function Arduino_checkVariables(options) {
    adapter.log.debug("init variables ");

    adapter.setObjectNotExists('sender', {
        type: 'channel',
        role: 'climatic',
        common: { name: 'Vaillant data' },
        native: { location: adapter.config.location }
    });

    adapter.setObjectNotExists('sender.IP', {
        type: 'state',
        role: 'value',
        common: { name: 'sender IP' },
        native: { id: 'sender.IP' }
    });
    adapter.setObjectNotExists('sender.name', {
        type: 'state',
        role: 'value',
        common: { name: 'sender name' },
        native: { id: 'sender.name' }
    });
    adapter.setObjectNotExists('sender.version', {
        type: 'state',
        role: 'value',
        common: { name: 'sender version' },
        native: { id: 'sender.version' }
    });
    adapter.setObjectNotExists('sender.versionname', {
        type: 'state',
        role: 'value',
        common: { name: 'sender version name' },
        native: { id: 'sender.versionname' }
    });
    adapter.setObjectNotExists('sender.RAM', {
        type: 'state',
        role: 'value',
        common: { name: 'sender remaining RAM' },
        native: { id: 'sender.RAM' }
    });
    adapter.setObjectNotExists('sender.RX', {
        type: 'state',
        role: 'value',
        common: { name: 'sender received bytes on ebus' },
        native: { id: 'sender.RX' }
    });
    adapter.setObjectNotExists('data', {
        type: 'channel',
        role: 'climatic',
        common: { name: 'Vaillant data' },
        native: { location: adapter.config.location }
    });



    adapter.setObjectNotExists('data.date', {
        type: 'state',
        role: 'date',
        common: { name: 'update date' },
        native: { id: 'data.date' }
    });

    adapter.setObjectNotExists('data.time', {
        type: 'state',
        role: 'time',
        common: { name: 'update time' },
        native: { id: 'data.time' }
    });

    adapter.setObjectNotExists('data.TempOut', {
        type: 'state',
        role: 'value',
        common: { name: 'temperature out' },
        native: { id: 'data.TempOut' }
    });
    adapter.setObjectNotExists('data.TempVorlauf', {
        type: 'state',
        role: 'value',
        common: { name: 'Vorlauftemperatur' },
        native: { id: 'data.TempVorlauf' }
    });
    adapter.setObjectNotExists('data.TempQuelle', {
        type: 'state',
        role: 'value',
        common: { name: 'Quellentemperatur' },
        native: { id: 'data.TempQuelle' }
    });
    adapter.setObjectNotExists('data.HeizLeistungMomentan', {
        type: 'state',
        role: 'value',
        common: { name: 'momentane Heizleistung' },
        native: { id: 'data.HeizLeistungMomentan' }
    });
    adapter.setObjectNotExists('data.Status', {
        type: 'state',
        role: 'value',
        common: { name: 'Status' },
        native: { id: 'data.Status' }
    });
    adapter.setObjectNotExists('data.Error', {
        type: 'state',
        role: 'value',
        common: { name: 'Error' },
        native: { id: 'data.Error' }
    });
    adapter.setObjectNotExists('data.Warning', {
        type: 'state',
        role: 'value',
        common: { name: 'Warning' },
        native: { id: 'data.Warning' }
    });
    adapter.setObjectNotExists('data.Pump', {
        type: 'state',
        role: 'value',
        common: { name: 'pump state' },
        native: { id: 'data.Pump' }
    });

    
    Common_checkVariables(options);
}

*/



//===================================================================================================
// ebusd interface

function ebusd_Command(options) {
    adapter.getState('cmd', function (err, obj) {
        if (err) {
            adapter.log.error(err);
        } else {
            if (obj != null) {
                var cmd = obj.val;
                if (cmd != "") {
                    adapter.log.debug("got command " + cmd);

                    adapter.log.debug("connect telnet to IP " + options.targetIP + " port " + options.targetTelnetPort);

                    var client = new net.Socket();
                    client.setTimeout(5000, function () {
                        client.destroy();
                    });
                    client.connect(options.targetTelnetPort, options.targetIP, function () {
                        adapter.log.debug("telnet connected for cmd");
                    });
                    client.on('data', function (data) {
                        adapter.log.debug("received " + data);

                        
                        //set result to cmdResult 
                        adapter.setState('cmdResult', { ack: true, val: data.toString() });
                        //aufruf next step
                        ebusd_ReadValues(options); // to trigger read over ebus

                        adapter.setState('cmd', { ack: true, val: "" });
                    });
                    client.on('end', function () {
                        adapter.log.debug('Daten ausgelesen');
                    });

                  

                    client.write(cmd + '\n');


                    //client.end();
                    client.on('error', function (err) {

                        client.destroy();
                        adapter.log.error('Telnet Server nicht erreichbar.');
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
            read: true,
            write: true
        }
    });
    adapter.setObjectNotExists("cmdResult", {
        type: "state",
        common: {
            name: "ebusd command result",
            type: "string",
            read: true,
            write: false
        }
    });

    Common_checkVariables(options);
}

//get data via https in json -> this is the main data receiver; telnet just triggers ebusd to read data;
//https://github.com/john30/ebusd/wiki/3.2.-HTTP-client
function ebusd_ReceiveData(options, cb) {

    var sUrl = "http://" + options.targetIP + ":" + options.targetHTTPPort + "/data";
    adapter.log.debug("request data from " + sUrl);

    request(sUrl, function (error, response, body) {

        try {
            if (!error && response.statusCode == 200) {
                //adapter.log.debug("Body: " + body + " " + response.statusCode);

                var oData = JSON.parse(body);

                //console.log(JSON.stringify(oData));

                //adapter.log.debug("length " + oData.length);

                var flatten = require('flat');

                var newData = flatten(oData);

                var keys = Object.keys(newData);

                //adapter.log.debug("history: " + options.historyValues);

                var oHistory = options.historyValues.split(",");

                var historyvalues = [];
                var historydates = [];

                var oToday = new Date();
                var month = oToday.getMonth() + 1;
                
                historydates.push({
                    "date": oToday.getDate() + "." + month  + "." + oToday.getFullYear(),
                    "time": oToday.getHours() + ":" + oToday.getMinutes() + ":" + oToday.getSeconds()
                });
                //adapter.log.debug(JSON.stringify(historydates));
                
                var name = "unknown";
                var sError = "none";
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var subnames = key.split('.');
                    var temp = subnames.length;
                    //adapter.log.debug('Key : ' + key + ', Value : ' + newData[key]);

                    
                    if (subnames[temp - 1].includes("name")) {
                        name = newData[key];
                    }
                    else if (subnames[temp - 1].includes("value")) {
                        //adapter.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);

                        var value = newData[key];

                        //value
                        AddObject(key);
                        if (name == "hcmode2") {
                            adapter.log.info("in hcmode2, value " + value);
                            if (parseInt(value) == 5) {
                                adapter.log.info("with value 5");
                                value = "EVU Sperrzeit";
                            }
                        }
                        UpdateObject(key, value);

                        //name parallel to value: used for lists in admin...
                        var keyname = key.replace("value", "name");
                        AddObject(keyname);
                        
                        
                        

                        UpdateObject(keyname, name);

                        //push to history
                        if (!subnames[temp - 2].includes("sensor")) { //ignore sensor states
                            for (var ii = 0; ii < oHistory.length; ii++) {

                                if (name == oHistory[ii]) {

                                    var sTemp = '{"' + name + '": "' + value + '"}';
                                    //adapter.log.debug(sTemp);
                                    historyvalues[ii] = [];
                                    historyvalues[ii].push(JSON.parse(sTemp));
                                    //adapter.log.debug(JSON.stringify(historyvalues));
                                }
                            }
                        }
                    }
                    else if (subnames[temp - 1].includes("lastup")) {

                        var value = newData[key];

                        if (parseInt(value) > 0) {
                            //adapter.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);

                            //umrechnen...
                            var oDate = new Date(value * 1000);
                            var nDate = oDate.getDate();
                            var nMonth = oDate.getMonth() + 1;
                            var nYear = oDate.getFullYear();
                            var nHours = oDate.getHours();
                            var nMinutes = oDate.getMinutes();
                            var nSeconds = oDate.getSeconds();
                            
                            var sDate = nDate + "." + nMonth + "." + nYear + " " + nHours + ":" + nMinutes + ":" + nSeconds;
                            AddObject(key);
                            UpdateObject(key, sDate);

                            var oToday = new Date();

                            var bSkip = false;

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
                                
                            if (!bSkip && Math.abs(oDate.getTime() - oToday.getTime()) > (1 * 60 * 60 * 1000)) {
                               
                                var sError1 = "no update since " + sDate + " " + key + " ";
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
                        var value = newData[key];
                        AddObject(key);
                        UpdateObject(key, value);
                    }
                }
                adapter.setState('history.error', { ack: true, val: sError });

                //adapter.log.debug(JSON.stringify(historyvalues));

                UpdateHistory(historyvalues, historydates);

                adapter.log.info("all http done");
            }
        }
        catch (e) {
            adapter.log.error('exception in ebusd_ReceiveData [' + e + ']');
        }
    });
}

function UpdateHistory(values, dates) {

    var oEbusDates = [];

    adapter.getState('history.date', function (err, obj) {
        if (err) {
            adapter.log.error(err);
        } else {
            try {
                if (obj != null) {
                    //adapter.log.debug("before " + obj.val);
                    oEbusDates = JSON.parse(obj.val);
                    //adapter.log.debug("after parse " + JSON.stringify(oEbusDates));
                }


                oEbusDates.push(dates);
                //adapter.log.debug("after push " + JSON.stringify(oEbusDates));
                //limit length of object...
                if (oEbusDates.length > 200) {

                    for (var i = oEbusDates.length; i > 200; i--) {
                        adapter.log.debug("delete");
                        oEbusDates.shift();
                    }
                }
                adapter.setState('history.date', { ack: true, val: JSON.stringify(oEbusDates) });
            }
            catch (e) {
                adapter.log.error('exception in UpdateHistory part1 [' + e + ']');
            }
        }
    });


    UpdateHistoryValues(values, 1);

        
    

}

function UpdateHistoryValues(values, ctr) {
    adapter.getState('history.value' + ctr, function (err, obj) {
        if (err) {
            adapter.log.error(err);
        } else {
            try {
                var oEbusValues = [];
                if (obj != null) {
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

                    for (var i = oEbusValues.length; i > 200; i--) {
                        adapter.log.debug("delete");
                        oEbusValues.shift();
                    }
                }
                adapter.setState('history.value' + ctr, { ack: true, val: JSON.stringify(oEbusValues) });

                
                if (ctr < values.length) {
                    ctr++;
                    UpdateHistoryValues(values, ctr);  //recursive call
                }
                else {
                    adapter.log.info("all history done (exit)");

                    adapter.terminate ? adapter.terminate(11) : process.exit(11);
                }
            }
            catch (e) {
                adapter.log.error('exception in UpdateHistory part2 [' + e + ']');
            }
        }
    });
}
function AddObject(key) {
    adapter.setObjectNotExists(key, {
        type: 'state',
        common: { name: 'data', type: 'string', role: 'history', unit: '', read: true, write: false },
        native: { location: key }
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
var net = require('net');

//this function just triggers ebusd to read data; result will not be parsed; we just take the values from http result
//here we need a loop over all configured read data in admin-page
function ebusd_ReadValues(options) {
   

    //adapter.log.debug("polled: " + options.polledValues);
    //adapter.log.debug("history: " + options.historyValues);

    var oPolled = options.polledValues.split(",");
    var nCtr = 0;

    if (oPolled.length > 0 && options.polledValues.length>0) {

        adapter.log.debug("to poll ctr " + oPolled.length + " vals:  " + oPolled + " org " + options.polledValues + " org length " + options.polledValues.length);

        var client = new net.Socket();
        client.setTimeout(5000, function () {
            client.destroy();
            adapter.log.error('Telnet Server timeout');
            ebusd_StartReceive(options);
        });
        adapter.log.debug("connect telnet to IP " + options.targetIP + " port " + options.targetTelnetPort);
        client.connect(options.targetTelnetPort, options.targetIP, function () {
            adapter.log.debug("telnet connected");
        });
        client.on('data', function (data) {
            if (data.includes("ERR")){
                adapter.log.error("received " + data + " for " + oPolled[nCtr - 1]);
            }
            else {
                adapter.log.debug("received " + data + " for " + oPolled[nCtr - 1] );
            }

            if (oPolled.length > nCtr) {
                client.write('read -f ' + oPolled[nCtr] + '\n');
                nCtr++;
            }
            else {
                client.end();
                client.destroy();
                adapter.log.debug("all telnet done ");
                ebusd_StartReceive(options);
            }
        });
        client.on('end', function () {
            adapter.log.debug('Daten ausgelesen');
        });

        if (oPolled.length > nCtr) {
            client.write('read -f ' + oPolled[nCtr] + '\n');
            nCtr++;
        }
        //client.end();
        client.on('error', function (err) {

            client.destroy();
            adapter.log.error('Telnet Server nicht erreichbar.');
            ebusd_StartReceive(options);
        });
    }
    else {
        adapter.log.debug("nothing to poll; skip telnet");

        ebusd_StartReceive(options);
    }

}


function ebusd_StartReceive(options) {
    ebusd_ReceiveData(options, function () {
        setTimeout(function () {
            adapter.log.warn('force terminate in receive');
            //adapter.stop();
            adapter.terminate ? adapter.terminate(15) : process.exit(15);
        }, 6000);
    });
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 