var data = {
    "VaillantInterface": {
        "sender": [{
            "$": {
                "IP": "192.168.3.181",
                "name": "Arduino"
            }
        }],
        "version": [{
            "$": {
                "name": "Vaillant Interface",
                "number": "1.5.8"
            }
        }],
        "system": [{
            "$": {
                "RAM": "239",
                "Rx": "115879279",
                "lstate": "0"
            }
        }],
        "data": [{
            "date": [{
                "$": { "date": "04.03.2017" }
            }],
            "time": [{
                "$": { "time": "13:41:02" }
            }],
            "TempOut": [{
                "$": {
                    "value": "11.63",
                    "unit": "C"
                }
            }],
            "TempVorlauf": [{
                "$": {
                    "value": "37.63",
                    "unit": "C"
                }
            }],
            "TempQuelle": [{
                "$": {
                    "value": "5.69",
                    "unit": "C"
                }
            }],
            "HeizLeistungMomentan": [{
                "$": {
                    "value": "0.00",
                    "unit": "kW"
                }
            }],
            "Status": [{
                "$": {
                    "value": "Bereitschaft",
                    "unit": ""
                }
            }],
            "Error": [{
                "$": {
                    "value": "-1 (0xFF 0xFF) ",
                    "unit": ""
                }
            }],
            "Warning": [{
                "$": {
                    "value": "-1 (0xFF 0xFF) ",
                    "unit": ""
                }
            }],
            "pump": [{
                "$": {
                    "state": "on"
                }
            }]
        }]
    }
}

/*
for (var attributename in data) {
    console.log(attributename + ": " + data[attributename]);
}
*/
console.log(JSON.stringify(data));
console.log(" ");
console.log(JSON.stringify(data.VaillantInterface));
console.log(" ");
console.log(JSON.stringify(data.VaillantInterface.sender));
console.log(" ");
console.log(JSON.stringify(data.VaillantInterface.version[0].$.name));
console.log(JSON.stringify(data.VaillantInterface.system[0].$.Rx));
console.log(JSON.stringify(data.VaillantInterface.data[0].date[0].$.date));
console.log(JSON.stringify(data.VaillantInterface.data[0].time[0].$.time));
console.log(JSON.stringify(data.VaillantInterface.data[0].pump[0].$.state

/*var data = {
    "device_id": "8020",
    "data": [{
        "Timestamp": "04-29-11 05:22:39 pm",
        "Start_Value": 0.02,
        "Abstract": 18.60,
        "Editor": 65.20
    }, {
            "Timestamp": "04-29-11 04:22:39 pm",
            "End_Value": 22.22,
            "Text": 8.65,
            "Common": 1.10,
            "Editable": "true",
            "Insert": 6.0
        }]
};


for (var attributename in data) {
    console.log(attributename + ": " + data[attributename]);

}

console.log(data.data[0]);
console.log(" ");
console.log(data.data[0].Timestamp);
console.log(" ");
console.log("data0 " + JSON.stringify(data.data[0]));
console.log(" ");
console.log(data.data[1]);

*/