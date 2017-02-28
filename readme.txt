Ideen für Visu:
http://homematic-forum.de/forum/viewtopic.php?f=19&t=31682

javascript:logout();

Manual für Adapter-Entwicklung
https://github.com/ioBroker/ioBroker/wiki/Adapter-Development-Documentation

node.js serial port driver.
https://www.npmjs.com/package/serialport2

https://itp.nyu.edu/physcomp/labs/labs-serial-communication/lab-serial-communication-with-node-js/
https://www.npmjs.com/package/serialport#raspberry-pi-linux



        


iobroker restart homecontrol
iobroker upload homecontrol




Vorbereitung:

cd /opt/iobroker 

npm install serialport --build-from-source

test.js

var serialport = require('serialport');
var SerialPort = serialport.SerialPort;

portName = '/dev/ttyACM0';

var myPort = new SerialPort(portName, {
        baudrate: 115200,
        parser: serialport.parsers.readline("\n")
});

myPort.on('open', showPortOpen);
myPort.on('data', sendSerialData);
myPort.on('close', showPortClose);
myPort.on('error', showError);


function showPortOpen()
{
   console.log('port open. Data rate: ' + myPort.options.baudRate);
   myPort.write("V\n\r");
   myPort.write("hr\n\r");
}

function sendSerialData(data) {
   console.log(data);
}

function showPortClose() {
   console.log('port closed.');
}

function showError(error) {
   console.log('Serial port error: ' + error);
}




