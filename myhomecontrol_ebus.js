/*
 * homecontrol adapter für iobroker
 *
 * Created: 15.09.2016 21:31:28
 *  Author: Rene

Copyright(C)[2016, 2017][René Glaß]

Dieses Programm ist freie Software.Sie können es unter den Bedingungen der GNU General Public License, wie von der Free Software 
Foundation veröffentlicht, weitergeben und/ oder modifizieren, entweder gemäß Version 3 der Lizenz oder (nach Ihrer Option) jeder 
späteren Version.

Die Veröffentlichung dieses Programms erfolgt in der Hoffnung, daß es Ihnen von Nutzen sein wird, aber OHNE IRGENDEINE GARANTIE,
    sogar ohne die implizite Garantie der MARKTREIFE oder der VERWENDBARKEIT FÜR EINEN BESTIMMTEN ZWECK.Details finden Sie in der
GNU General Public License.

Sie sollten ein Exemplar der GNU General Public License zusammen mit diesem Programm erhalten haben.Falls nicht,
    siehe < http://www.gnu.org/licenses/>.

*/

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils


// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('myhomecontrol_ebus');
var request = require('request');
var parseString = require('xml2js').parseString;

var ReceiveTimer = null;


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

    //feuert auch, wenn adapter im admin anghalten oder gestartet wird...

    if (obj == null && myPort != null) {
        myPort.close();
    }

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
        receiveInterval: parseInt(adapter.config.receiveInterval) || 60,
    };

    checkVariables();

    if (!ReceiveTimer) {
        adapter.log.debug("init timer");
        var _ReceiveTimer = setInterval(function () {
            ReceiveData(options);
        }, options.receiveInterval * 1000);  
        ReceiveTimer = _ReceiveTimer;
    }

}

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
function ReceiveData(options) {


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

                    
                });
            } else {
                adapter.log.error(error);
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in ReceiveData [' + e + ']');
    }
}


function checkVariables() {
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
}



/*


var parseString = require('xml2js').parseString;
var xml = '<?xml version="1.0" encoding="UTF-8" ?><business><company>Code Blog</company><owner>Nic Raboy</owner><employee><firstname>Nic</firstname><lastname>Raboy</lastname></employee><employee><firstname>Maria</firstname><lastname>Campos</lastname></employee></business>';
parseString(xml, function (err, result) {
    console.dir(JSON.stringify(result));
});
*/

