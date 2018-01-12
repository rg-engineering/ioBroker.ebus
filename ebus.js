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
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils


// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('ebus');
var request = require('request');
var parseString = require('xml2js').parseString;

var oEbusHistory = [];


//Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
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

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.debug('cleaned everything up...');
        callback();
    }
    catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));

});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});



// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    try {
        main();
    }
    catch (e) {
        adapter.log.error('exception catch after ready [' + e + ']');
    }
});

function main() {
    var options = {
        targetIP: adapter.config.targetIP || '192.168.0.100',
        targetPort: parseInt(adapter.config.targetPort)
       
    };

    // force terminate after 1min
    // don't know why it does not terminate by itself...
    setTimeout(function () {
        adapter.log.warn('force terminate');
        process.exit(0);
    }, 60000);

    if (adapter.config.interfacetype == "arduino") {
        adapter.log.debug('start with interface arduino ');
        Arduino_checkVariables();

        Arduino_ReceiveData(options, function () {
            setTimeout(function () {
                adapter.stop();
            }, 6000);
        });

    }
    else if (adapter.config.interfacetype == "ebusd") {
        adapter.log.debug('start with interface ebusd ');
        ebusd_checkVariables();

        ebusd_ReceiveData(options, function () {
            setTimeout(function () {
                adapter.stop();
            }, 6000);
        });

    }
    else {
        adapter.log.error('unknown interface type ' + adapter.config.interfacetype);
    }

    
 
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
function Arduino_ReceiveData(options, cb) {


    try {
        adapter.log.debug("request data from " + options.targetIP);
        //request('http://192.168.3.181', function (error, response, body) {
        //request('http://192.168.3.143/abfrage.php', function (error, response, body) {
        request("http://" + options.targetIP, function (error, response, body) {

            if (!error && response.statusCode == 200) {
                //adapter.log.debug("Body: " + body + " " + response.statusCode);

                parseString(body, function (err, result) {
                    //adapter.log.debug(JSON.stringify(result));

                    adapter.log.debug("result " + JSON.stringify(result.VaillantInterface));
                    adapter.log.debug("date " + JSON.stringify(result.VaillantInterface.data[0].date[0].$.date));
                    adapter.log.debug("time " + JSON.stringify(result.VaillantInterface.data[0].time[0].$.time));

                    adapter.setState('sender.IP', { ack: true, val: result.VaillantInterface.sender[0].$.IP });

                    adapter.setState('sender.name', { ack: true, val: result.VaillantInterface.sender[0].$.name });
                    adapter.setState('sender.versionname', { ack: true, val: result.VaillantInterface.version[0].$.name });
                    adapter.setState('sender.version', { ack: true, val: result.VaillantInterface.version[0].$.number });
                    adapter.setState('sender.RAM', { ack: true, val: result.VaillantInterface.system[0].$.RAM });
                    adapter.setState('sender.RX', { ack: true, val: result.VaillantInterface.system[0].$.Rx });

                    adapter.setState('data.date', { ack: true, val: result.VaillantInterface.data[0].date[0].$.date });
                    adapter.setState('data.time', { ack: true, val: result.VaillantInterface.data[0].time[0].$.time });
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
                    adapter.getState('data.history', function (err, obj) {
                        if (err) {
                            adapter.log.error(err);
                        } else {

                            //adapter.log.debug("before " + obj.val);
                            if (obj != null) {
                                oEbusHistory = JSON.parse(obj.val);
                            }
                            //adapter.log.debug("after " + JSON.stringify(oEbusHistory));

                            oEbusHistory.push({
                                "date": result.VaillantInterface.data[0].date[0].$.date,
                                "time": result.VaillantInterface.data[0].time[0].$.time,
                                "TempVorlauf": result.VaillantInterface.data[0].TempVorlauf[0].$.value,
                                "TempQuelle": result.VaillantInterface.data[0].TempQuelle[0].$.value,
                                "HeizLeistung": result.VaillantInterface.data[0].HeizLeistungMomentan[0].$.value,
                                "Status": result.VaillantInterface.data[0].Status[0].$.value
                            });
                            //adapter.log.debug("after push " + JSON.stringify(oEbusHistory));
                            //limit length of object...
                            if (oEbusHistory.length > 200) {

                                for (var i = oEbusHistory.length; i > 200; i--) {
                                    adapter.log.debug("delete");
                                    oEbusHistory.shift();
                                }
                            }

                            adapter.setState('data.history', { ack: true, val: JSON.stringify(oEbusHistory) });
                        }

                    });
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


function Arduino_checkVariables() {
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

    // histories
    adapter.setObjectNotExists('data.history', {
        type: 'state',
        common: { name: 'ebus history as JSON', type: 'string', role: 'history', unit: '', read: true, write: false },
        native: { location: 'data.history' }
    });

}





//===================================================================================================
// ebusd interface
//just call http://192.168.0.123:8889/data
function ebusd_checkVariables() {
}


function ebusd_ReceiveData(options, cb) {

    var sUrl = "http://" + options.targetIP + ":" + options.targetPort + "/data";
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

                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var subnames = key.split('.');
                    var temp = subnames.length;

                    if (subnames[temp - 1].includes("value")) {
                        adapter.log.debug('Key : ' + key + ', Value : ' + newData[key]);

                        var value = newData[key];

                        AddObject(key);
                        UpdateObject(key, value);
                    }
                    else if (subnames[temp - 1].includes("lastup")) {

                        var value = newData[key];

                        if (parseInt(value) > 0) {
                            adapter.log.debug('Key : ' + key + ', Value : ' + newData[key]);
                            AddObject(key);
                            UpdateObject(key, value);
                        }
                    }
                    else if (subnames[0].includes("global")) {
                        adapter.log.debug('Key : ' + key + ', Value : ' + newData[key]);
                        var value = newData[key];
                        AddObject(key);
                        UpdateObject(key, value);
                    }
                }
                adapter.log.info("all done");
            }
        }
        catch (e) {
            adapter.log.error('exception in ebusd_ReceiveData [' + e + ']');
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
