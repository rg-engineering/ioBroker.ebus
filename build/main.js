"use strict";
/* eslint-disable prefer-template */
/*
 * Created with @iobroker/create-adapter v2.6.5
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ebus = void 0;
// https://www.iobroker.net/#en/documentation/dev/adapterdev.md
//import os from "os";
//import fs from "fs";
//import path from "path";
//import spawn from "child_process";
const utils = __importStar(require("@iobroker/adapter-core"));
const axios_1 = __importDefault(require("axios"));
const TelnetClient_1 = __importDefault(require("./lib/TelnetClient"));
class ebus extends utils.Adapter {
    intervalID = null;
    updateTimerID = null;
    requestRunning = false;
    oPolledVars = [];
    oHistoryVars = [];
    oHTTPParamsVars = [];
    ebusdMinVersion = [26, 1];
    ebusdVersion = [0, 0];
    ebusdUpdateVersion = [0, 0];
    constructor(options = {}) {
        super({
            ...options,
            name: "ebus",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("objectChange", this.onObjectChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /**
     * Wird aufgerufen, wenn die Datenbanken verbunden sind und die Adapter-Konfiguration empfangen wurde.
     */
    async onReady() {
        this.log.debug(JSON.stringify(this.config));
        try {
            await this.main();
        }
        catch (e) {
            this.log.error("Exception in onReady [" + e + "]");
        }
    }
    /**
     * Wird aufgerufen, wenn der Adapter heruntergefahren wird - Callback MUSS unter allen Umständen aufgerufen werden!
     */
    async onUnload(callback) {
        await Promise.resolve(); //dummy await to make function async
        try {
            // Hier müssen alle Timeouts oder Intervalle gelöscht werden, die noch aktiv sein könnten
            if (this.intervalID != null) {
                clearInterval(this.intervalID);
            }
            if (this.updateTimerID != null) {
                clearTimeout(this.updateTimerID);
            }
            this.log.info("cleaned everything up...");
            callback();
        }
        catch (e) {
            this.log.error("Exception in onUnload " + e);
            callback();
        }
    }
    /**
     * Wird aufgerufen, wenn ein abonniertes Objekt geändert wird
     */
    onObjectChange(id, obj) {
        if (obj) {
            this.log.info(`Objekt ${id} geändert: ${JSON.stringify(obj)}`);
        }
        else {
            this.log.info(`Objekt ${id} gelöscht`);
        }
    }
    /**
     * Wird aufgerufen, wenn ein abonnierter State geändert wird
     */
    async onStateChange(id, state) {
        if (state != null && state.ack !== true) {
            this.log.debug(`handle state change ${id}`);
            const ids = id.split(".");
            if (ids[2] === "cmd") {
                await this.ebusd_Command();
                this.StartDataRequest();
                //see issue #77: only one request possible
                //await Do();
            }
            else if (ids[2] === "find") {
                //unhandled state change ebus.0.find
                await this.ebusd_find();
            }
            else {
                this.log.warn(`unhandled state change ${id}`);
            }
        }
    }
    /**
     * Nachrichtenbehandlung
     */
    async onMessage(obj) {
        this.log.info("on message " + JSON.stringify(obj));
        await Promise.resolve();
        if (typeof obj === "object" && obj.command) {
            switch (obj.command) {
                case "findParams":
                    this.log.debug("message FindParams called");
                    await this.FindParams(obj);
                    break;
                case "Install":
                    this.log.debug("message install called");
                    //await this.CallExternalScript("InstallEbusd.sh", obj);
                    break;
                case "Update":
                    this.log.debug("message update called");
                    //await this.CallExternalScript("UpdateEbusd.sh", obj);
                    break;
                case "checkInstallableversion":
                    await this.CheckVersion("installable", obj);
                    break;
                case "checkCurrentVersion":
                    await this.CheckVersion("current", obj);
                    break;
                case "checkSupportedVersion":
                    await this.CheckVersion("supported", obj);
                    break;
                default:
                    this.log.error(`unknown message ${obj.command}`);
                    break;
            }
        }
    }
    async main() {
        this.log.debug("start with interface ebusd ");
        this.FillPolledVars();
        this.FillHistoryVars();
        this.FillHTTPParamsVars();
        await this.checkVariables();
        await this.subscribeVars();
        let readInterval = 5;
        if (this.config.readInterval > 0) {
            readInterval = this.config.readInterval;
        }
        this.log.debug(`read every  ${readInterval} minutes`);
        this.intervalID = setInterval(this.Do.bind(this), readInterval * 60 * 1000);
        //read at thisstart
        await this.Do();
    }
    async DoRequest() {
        this.log.debug("DoRequest ");
        if (!this.requestRunning) {
            this.requestRunning = true;
            await this.ebusd_ReadValues();
            await this.ebusd_ReceiveData();
        }
        else {
            this.log.debug("DoRequest: do nothing already running ");
        }
        this.requestRunning = false;
    }
    async Do() {
        this.log.debug("starting ... ");
        await this.ebusd_Command();
        await this.DoRequest();
    }
    StartDataRequest() {
        if (this.updateTimerID != null) {
            //already running
            clearTimeout(this.updateTimerID);
            this.updateTimerID = null;
        }
        //start or restart
        this.updateTimerID = setTimeout(this.DataRequest, 500);
        this.log.debug("StartDataRequest");
    }
    async DataRequest() {
        this.log.debug("get data after command and timeout");
        if (this.updateTimerID != null) {
            clearTimeout(this.updateTimerID);
            this.updateTimerID = null;
        }
        await this.DoRequest();
    }
    FillPolledVars() {
        try {
            if (this.config.PolledDPs !== undefined &&
                this.config.PolledDPs != null &&
                this.config.PolledDPs.length > 0) {
                this.log.debug("use new object list for polled vars");
                //2023-02-10 only active vars
                for (let i = 0; i < this.config.PolledDPs.length; i++) {
                    if (this.config.PolledDPs[i].active) {
                        this.oPolledVars.push(this.config.PolledDPs[i]);
                    }
                }
            }
        }
        catch (e) {
            this.log.error(`exception in FillPolledVars [${e}]`);
        }
        this.log.debug(`list of polled vars ${JSON.stringify(this.oPolledVars)}`);
    }
    FillHistoryVars() {
        try {
            if (this.config.HistoryDPs !== undefined &&
                this.config.HistoryDPs != null &&
                this.config.HistoryDPs.length > 0) {
                this.log.debug("use new object list for history vars");
                this.oHistoryVars = this.config.HistoryDPs;
            }
        }
        catch (e) {
            this.log.error(`exception in function FillHistoryVars [${e}]`);
        }
        this.log.debug(`list of history vars ${JSON.stringify(this.oHistoryVars)}`);
        //add a check, that complete dp without ebus.0 is used 2025-08-20
        this.oHistoryVars.forEach((entry, index) => {
            const hasDot = entry.name.includes(".");
            const hasInstance = entry.name.includes("ebus.");
            const hasValue = entry.name.includes("value");
            this.log.debug("checking " + entry.name + " index " + index + " hasDot: " + hasDot + " hasInstance: " + hasInstance + " hasValue: " + hasValue);
            if (!hasDot) {
                this.log.warn("please check history variable: " + entry.name + " -> should contain the complete DP");
            }
            if (!hasValue) {
                this.log.warn("please check history variable " + entry.name + " -> should contain 'value'");
            }
            if (hasInstance) {
                this.log.warn("please check history variable " + entry.name + " -> should not contain instance name and instance number e.g. 'ebus.0' ");
            }
        });
        //list of history vars [{"name":"ActualEnvironmentPower"},{"name":"YieldTotal"},{"name":"SourceTempInput"},{"name":"SourceTempOutput"},{"name":"HwcTemp"}]
    }
    FillHTTPParamsVars() {
        if (this.config.HTTPparameter !== undefined &&
            this.config.HTTPparameter != null &&
            this.config.HTTPparameter.length > 0) {
            this.oHTTPParamsVars = this.config.HTTPparameter;
            this.log.debug(`use optionally HTTP parameter ${JSON.stringify(this.oHTTPParamsVars)}`);
        }
    }
    //===================================================================================================
    // ebusd interface
    async ebusd_Command() {
        const obj = await this.getStateAsync("cmd");
        if (obj !== undefined && obj != null) {
            const cmds = obj.val?.toString();
            if (cmds != null && cmds !== "") {
                this.log.debug(`got command(s): ${cmds}`);
                this.log.debug(`connect telnet to IP ${this.config.targetIP} port ${this.config.targetTelnetPort}`);
                try {
                    //const socket = new net.Socket();
                    //const promiseSocket = new PromiseSocket(socket);
                    //await promiseSocket.connect(parseInt(this.config.targetTelnetPort), this.config.targetIP);
                    //this.log.debug("telnet connected for cmd");
                    //promiseSocket.setTimeout(5000);
                    const telnet = new TelnetClient_1.default();
                    await telnet.connect(this.config.targetIP, this.config.targetTelnetPort);
                    const oCmds = cmds.split(",");
                    if (oCmds.length > 0) {
                        let received = "";
                        for (let n = 0; n < oCmds.length; n++) {
                            this.log.debug(`send ${oCmds[n]}`);
                            //await promiseSocket.write(`${oCmds[n]  }\n`);
                            await telnet.write(`${oCmds[n]}\n`);
                            //const data = await promiseSocket.read();
                            const data = await telnet.read();
                            if (data.includes("ERR")) {
                                this.log.warn(`sent ${oCmds[n]}, received ${data} please check ebusd logs for details!`);
                            }
                            else {
                                this.log.debug(`received ${data}`);
                            }
                            received += data.toString();
                            received += ", ";
                        }
                        //see issue #78: remove CR, LF and last comma
                        received = received.replace(/\r?\n|\r/g, "");
                        received = received.slice(0, -2);
                        //set result to cmdResult
                        await this.setState("cmdResult", { ack: true, val: received });
                    }
                    else {
                        this.log.warn(`no commands in list ${cmds} ${JSON.stringify(oCmds)}`);
                    }
                    await this.setState("cmd", { ack: true, val: "" });
                    //promiseSocket.destroy();
                    await telnet.disconnect();
                }
                catch (e) {
                    this.log.error(`exception from tcp socket` + `[${e}]`);
                }
            }
        }
        else {
            this.log.debug(`object cmd not found ${JSON.stringify(obj)}`);
        }
    }
    async ebusd_find() {
        try {
            //const socket = new net.Socket();
            //const promiseSocket = new PromiseSocket(socket);
            //await promiseSocket.connect(parseInt(this.config.targetTelnetPort), this.config.targetIP);
            //this.log.debug("telnet connected for cmd");
            //promiseSocket.setTimeout(5000);
            const telnet = new TelnetClient_1.default();
            await telnet.connect(this.config.targetIP, this.config.targetTelnetPort);
            //await promiseSocket.write("find -F circuit,name,comment\n");
            await telnet.write("find -F circuit,name,comment\n");
            //const data = await promiseSocket.read();
            const data = await telnet.read();
            if (data.includes("ERR")) {
                this.log.warn(`received error! sent find, received ${data} please check ebusd logs for details!`);
            }
            else {
                this.log.debug(`received ${typeof data} ${data}`);
            }
            let str;
            if (typeof data === "string") {
                str = data;
            }
            else if (data instanceof Uint8Array) {
                str = new TextDecoder().decode(data);
            }
            else if (data instanceof ArrayBuffer) {
                str = new TextDecoder().decode(new Uint8Array(data));
            }
            else {
                // fallback: convert to string
                str = String(data);
            }
            //const str = new TextDecoder().decode(data);
            const datas = str.split(/[\r?\n,]+/);
            this.log.info("found entries: " + datas.length);
            for (let i = 0; i < datas.length; i++) {
                //this.log.info(JSON.stringify(datas[i]));
                const names = datas[i].split(",");
                //circuit,name,comment
                await this.UpdateDP(names[0], names[1], names[2]);
                let cmd = `read -f -c ${names[0]} ${names[1]}`;
                this.log.debug(`send cmd ${cmd}`);
                cmd += "\n";
                //await promiseSocket.write(cmd);
                await telnet.write(cmd);
                //const result = await promiseSocket.read();
                const result = await telnet.read();
                this.log.debug(`received ${typeof result} ${result}`);
            }
            //promiseSocket.destroy();
            await telnet.disconnect();
        }
        catch (e) {
            this.log.error(`exception from tcp socket in ebusd_find` + `[${e}]`);
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
    async subscribeVars() {
        this.subscribeStates("cmd");
        this.subscribeStates("find");
        await this.setState("cmdResult", { ack: true, val: "" });
    }
    async checkVariables() {
        this.log.debug("init variables ");
        let key;
        let obj;
        key = "cmd";
        obj = {
            type: "state",
            common: {
                name: "ebusd command",
                type: "string",
                role: "text",
                read: true,
                write: true,
            },
        };
        await this.CreateObject(key, obj);
        key = "cmdResult";
        obj = {
            type: "state",
            common: {
                name: "ebusd command result",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
        };
        await this.CreateObject(key, obj);
        key = "find";
        obj = {
            type: "state",
            common: {
                name: "find existing data points",
                type: "boolean",
                role: "button",
                read: false,
                write: true,
            },
        };
        await this.CreateObject(key, obj);
        this.log.debug(`init common variables and ${this.oHistoryVars.length} history DP's`);
        if (this.oHistoryVars.length > 0) {
            if (this.oHistoryVars.length > 4) {
                this.log.warn(`too many history values ${this.oHistoryVars.length} -> maximum is  4`);
            }
            for (let n = 1; n <= this.oHistoryVars.length; n++) {
                if (this.oHistoryVars[n - 1].name.length > 0) {
                    const name = `history value ${n} as JSON ${this.oHistoryVars[n - 1].name}`;
                    key = `history.value${n}`;
                    obj = {
                        type: "state",
                        common: {
                            name: name,
                            type: "string",
                            role: "value",
                            unit: "",
                            read: true,
                            write: false,
                        },
                        native: { location: key },
                    };
                    await this.CreateObject(key, obj);
                }
                else {
                    this.log.warn(`ignoring history value ${n} (invalid name)`);
                }
            }
            key = "history.date";
            obj = {
                type: "state",
                common: {
                    name: "ebus history date / time as JSON",
                    type: "string",
                    role: "value",
                    unit: "",
                    read: true,
                    write: false,
                },
                native: {
                    location: key,
                },
            };
            await this.CreateObject(key, obj);
        }
        key = "history.error";
        obj = {
            type: "state",
            common: {
                name: "ebus error",
                type: "string",
                role: "value",
                unit: "",
                read: true,
                write: false,
            },
            native: { location: key },
        };
        await this.CreateObject(key, obj);
    }
    VersionCheck() {
        if (this.ebusdVersion[0] > 0) {
            if (this.ebusdVersion[0] < this.ebusdMinVersion[0] ||
                (this.ebusdVersion[0] == this.ebusdMinVersion[0] && this.ebusdVersion[1] < this.ebusdMinVersion[1])) {
                this.log.info(`please update ebusd, old version found: ${this.ebusdVersion[0]}.${this.ebusdVersion[1]} supported version is ${this.ebusdMinVersion[0]}.${this.ebusdMinVersion[1]}`);
            }
            if (this.ebusdVersion[0] > this.ebusdMinVersion[0] ||
                (this.ebusdVersion[0] >= this.ebusdMinVersion[0] && this.ebusdVersion[1] > this.ebusdMinVersion[1])) {
                this.log.info(`unsupported ebusd version found (too new): ${this.ebusdVersion[0]}.${this.ebusdVersion[1]} supported version is ${this.ebusdMinVersion[0]}.${this.ebusdMinVersion[1]}`);
            }
        }
        if (this.ebusdUpdateVersion[0] > 0 && this.ebusdVersion[0] > 0) {
            if (this.ebusdUpdateVersion[0] > this.ebusdVersion[0] ||
                (this.ebusdUpdateVersion[0] == this.ebusdVersion[0] && this.ebusdUpdateVersion[1] > this.ebusdVersion[1])) {
                this.log.info(`new ebusd version found: ${this.ebusdUpdateVersion[0]}.${this.ebusdUpdateVersion[1]} supported version is ${this.ebusdMinVersion[0]}.${this.ebusdMinVersion[1]}`);
            }
        }
    }
    //get data via https in json -> this is the main data receiver; telnet just triggers ebusd to read data;
    //https://github.com/john30/ebusd/wiki/3.2.-HTTP-client
    async ebusd_ReceiveData() {
        try {
            let sUrl = `http://${this.config.targetIP}:${this.config.targetHTTPPort}/data`;
            //Erweiterung mit optionalen parametern
            let paramsCnt = 0;
            if (this.oHTTPParamsVars !== undefined && this.oHTTPParamsVars != null && this.oHTTPParamsVars.length > 0) {
                for (let i = 0; i < this.oHTTPParamsVars.length; i++) {
                    if (this.oHTTPParamsVars[i].active) {
                        if (paramsCnt == 0) {
                            sUrl += "?";
                        }
                        else {
                            sUrl += "&";
                        }
                        sUrl += `${this.oHTTPParamsVars[i].name}=${this.oHTTPParamsVars[i].value}`;
                        paramsCnt++;
                    }
                }
            }
            this.log.debug(`request data from ${sUrl}`);
            const buffer = await axios_1.default.get(sUrl);
            this.log.debug(`got data ${typeof buffer.data} ${JSON.stringify(buffer.data)}`);
            const flattenObject = (obj, delimiter = ".", prefix = "") => Object.keys(obj).reduce((acc, k) => {
                const pre = prefix.length ? `${prefix}${delimiter}` : "";
                if (typeof obj[k] === "object" && obj[k] !== null && Object.keys(obj[k]).length > 0) {
                    Object.assign(acc, flattenObject(obj[k], delimiter, pre + k));
                }
                else {
                    acc[pre + k] = obj[k];
                }
                return acc;
            }, {});
            const data = flattenObject(buffer.data, ".");
            //todo: replace any
            const historyvalues = [];
            const historydates = [];
            const oToday = new Date();
            const month = oToday.getMonth() + 1;
            historydates.push({
                date: `${oToday.getDate()}.${month}.${oToday.getFullYear()}`,
                time: `${oToday.getHours()}:${oToday.getMinutes()}:${oToday.getSeconds()}`
            });
            let sError = "none";
            for (let key in data) {
                const subnames = key.split(".");
                //const namelength = subnames.length;
                let value = data[key];
                //this.log.debug("key " + key);
                if (key.includes("[") || key.includes("]")) {
                    this.log.debug(`found unsupported chars in ${key}`);
                    const start = key.indexOf("[");
                    const end = key.lastIndexOf("]");
                    if (start > 0 && end > 0) {
                        const toReplace = key.slice(start, end + 1);
                        key = key.replace(toReplace, "");
                    }
                    //this.log.warn("new key is " + key);
                }
                //======== version check
                if (key.includes("global.version")) {
                    //this.log.info("in version, value " + value);
                    const versionInfo = value.split(".");
                    if (versionInfo.length > 1) {
                        this.log.debug(`installed ebusd version is ${versionInfo[0]}.${versionInfo[1]}`);
                        this.ebusdVersion[0] = versionInfo[0];
                        this.ebusdVersion[1] = versionInfo[1];
                        this.VersionCheck();
                    }
                }
                if (key.includes("global.updatecheck")) {
                    //revision v21.2 available
                    value = value.replace("revision v", "");
                    value = value.replace(" available", "");
                    const versionInfo = value.split(".");
                    if (versionInfo.length > 1) {
                        this.log.info(`found ebusd update version ${versionInfo[0]}.${versionInfo[1]}`);
                        this.ebusdUpdateVersion[0] = versionInfo[0];
                        this.ebusdUpdateVersion[1] = versionInfo[1];
                        this.VersionCheck();
                    }
                }
                //============ type check
                let type = this.mapJsTypeToIoBrokerType(value);
                if (this.config.useBoolean4Onoff) {
                    if (type == "string" && (value == "on" || value == "off")) {
                        this.log.debug(`Key ${key} change to boolean ${value}`);
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
                //EVU Sperrzeit
                if (key.includes(".hcmode2.value") || key.includes(".hcmode.value")) {
                    if (parseInt(value) === 0) {
                        this.log.info(`${key}in hcmode2 with value 0: off`);
                        value = "off";
                    }
                    else if (parseInt(value) === 5) {
                        this.log.info(`${key} with value 5: EVU Sperrzeit`);
                        value = "EVU Sperrzeit";
                    }
                    else {
                        this.log.debug(`in hcmode2, value ${value}`);
                    }
                    type = this.mapJsTypeToIoBrokerType(value);
                }
                //lastup umrechnen
                if (key.includes(".lastup")) {
                    if (parseInt(value) > 0) {
                        //this.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);
                        //umrechnen...
                        const oDate = new Date(value * 1000);
                        //const nDate = oDate.getDate();
                        //const nMonth = oDate.getMonth() + 1;
                        //const nYear = oDate.getFullYear();
                        //const nHours = oDate.getHours();
                        //const nMinutes = oDate.getMinutes();
                        //const nSeconds = oDate.getSeconds();
                        const sDate = oDate.toLocaleString();
                        value = sDate;
                        type = this.mapJsTypeToIoBrokerType(value);
                        const oToday = new Date();
                        let bSkip = false;
                        if (subnames[0].includes("scan") ||
                            subnames[0].includes("Scan") ||
                            subnames[0].includes("ehp") ||
                            (subnames.length > 2 && subnames[2].includes("currenterror")) ||
                            this.config.DisableTimeUpdateCheck) {
                            bSkip = true;
                        }
                        //this.log.debug("_______________size " + temp);
                        if (subnames.length > 2 && subnames[2].includes("Timer")) {
                            bSkip = true;
                        }
                        if (!bSkip && Math.abs(oDate.getTime() - oToday.getTime()) > 1 * 60 * 60 * 1000) {
                            const sError1 = `no update since ${sDate} ${key} `;
                            if (sError.includes("none")) {
                                sError = `ebus: ${sError1}`;
                            }
                            else {
                                sError += sError1;
                            }
                            this.log.warn(sError1);
                        }
                    }
                }
                //add and update data
                await this.AddObject(key, type);
                await this.UpdateObject(key, value);
                //push to history
                for (let ii = 0; ii < this.oHistoryVars.length; ii++) {
                    //this.log.debug("check " + key + "==" + oHistoryVars[ii].name);
                    //	check uih.messages.YieldThisYear.fields.energy_1.value==ActualEnvironmentPower
                    /*
                    ehp.messages.ActualEnvironmentPower.fields.value.value
                    ehp.messages.YieldTotal.fields.value.value
                    ehp.messages.SourceTempInput.fields.temp.value
                    ehp.messages.SourceTempOutput.fields.temp.value
                    ehp.messages.HwcTemp.fields.temp.value
                    */
                    if (key === this.oHistoryVars[ii].name) {
                        const sTemp = '{"' + key + '": "' + value + '"}';
                        this.log.debug("push history " + sTemp);
                        historyvalues[ii] = [];
                        historyvalues[ii].push(JSON.parse(sTemp));
                        //this.log.debug(JSON.stringify(historyvalues));
                    }
                }
            }
            await this.setState("history.error", { ack: true, val: sError });
            //this.log.debug(JSON.stringify(historyvalues));
            this.log.debug("all http done");
            if (historyvalues.length > 0 && historydates.length > 0) {
                if (this.config.History4Vis2) {
                    await this.UpdateHistory_Vis2(historyvalues, historydates);
                }
                else {
                    await this.UpdateHistory(historyvalues, historydates);
                }
            }
        }
        catch (e) {
            this.log.error(`exception in ebusd_ReceiveData [${e}]`);
            await this.setState("history.error", { ack: true, val: "exception in receive" });
        }
    }
    mapJsTypeToIoBrokerType(value) {
        if (Array.isArray(value)) {
            return "array";
        }
        switch (typeof value) {
            case "string": return "string";
            case "number": return "number";
            case "boolean": return "boolean";
            case "object": return value === null ? "mixed" : "object";
            default: return "mixed";
        }
    }
    async UpdateHistory_Vis2(values, dates) {
        this.log.debug(`start history 4 VIS-2 ${JSON.stringify(values)} ${JSON.stringify(dates)}`);
        //not used anymore
        await this.setState("history.date", { ack: true, val: "" });
        for (let s = 0; s < values.length; s++) {
            const values1 = values[s];
            //this.log.debug(s + " " + JSON.stringify(values1));
            let val2Write = [];
            const ctr = s + 1;
            const obj = await this.getStateAsync(`history.value${ctr}`);
            if (obj === null || obj === undefined) {
                this.log.warn(`history.value${ctr} not found, creating DP ${JSON.stringify(obj)}`);
                await this.setState(`history.value${ctr}`, { ack: true, val: "[]" });
            }
            else {
                if (obj.val != null && obj.val != "" && typeof obj.val === "string") {
                    val2Write = JSON.parse(obj.val);
                    this.log.debug(`history.value${ctr} got ${JSON.stringify(val2Write)}`);
                }
            }
            for (let ss = 0; ss < values1.length; ss++) {
                const values2 = values1[ss];
                //this.log.debug(ss + " " + JSON.stringify(values2));
                let d = 0;
                for (const n in values2) {
                    const val = values2[n];
                    const time = dates[d].time;
                    const date = dates[d].date;
                    d++;
                    const times = time.split(":");
                    const datesl = date.split(".");
                    const day = parseInt(datesl[0]);
                    const month = parseInt(datesl[1]) - 1;
                    const year = parseInt(datesl[2]);
                    const hours = parseInt(times[0]);
                    const minutes = parseInt(times[1]);
                    const oDate = new Date(year, month, day, hours, minutes, 0, 0);
                    this.log.debug(`${n} ${val} ${oDate.toLocaleString()}`);
                    val2Write.push([oDate, val]);
                    if (val2Write.length > 200) {
                        for (let i = val2Write.length; i > 200; i--) {
                            //this.log.debug("delete");
                            val2Write.shift();
                        }
                    }
                }
            }
            await this.setState(`history.value${ctr}`, { ack: true, val: JSON.stringify(val2Write) });
        }
    }
    async UpdateHistory(values, dates) {
        if (this.oHistoryVars.length > 0) {
            //prüfen ob alle json gleich lang sind
            let NoOfDates = -1;
            const obj = await this.getStateAsync("history.date");
            if (obj !== undefined && obj != null) {
                try {
                    let oEbusDates = [];
                    //this.log.debug("before " + obj.val);
                    if (obj.val != null && obj.val != "" && typeof obj.val === "string") {
                        oEbusDates = JSON.parse(obj.val);
                    }
                    //this.log.debug("after parse " + JSON.stringify(oEbusDates));
                    oEbusDates.push(dates);
                    //this.log.debug("after push " + JSON.stringify(oEbusDates));
                    //limit length of object...
                    if (oEbusDates.length > 200) {
                        for (let i = oEbusDates.length; i > 200; i--) {
                            //this.log.debug("delete");
                            oEbusDates.shift();
                        }
                    }
                    NoOfDates = oEbusDates.length;
                    await this.setState("history.date", { ack: true, val: JSON.stringify(oEbusDates) });
                }
                catch (e) {
                    this.log.error(`exception in UpdateHistory part1 [${e}]`);
                    await this.setState("history.date", { ack: true, val: "[]" });
                    NoOfDates = 0;
                }
            }
            else {
                this.log.warn("history.date not found, creating DP ");
                await this.setState("history.date", { ack: true, val: "[]" });
                NoOfDates = 0;
            }
            if (this.oHistoryVars.length > 0) {
                for (let ctr = 1; ctr <= this.oHistoryVars.length; ctr++) {
                    if (this.oHistoryVars[ctr - 1].name.length > 0) {
                        const ctrOkay = await this.UpdateHistoryValues(values, ctr, NoOfDates);
                        if (!ctrOkay) {
                            await this.setState("history.date", { ack: true, val: "[]" });
                            NoOfDates = 0;
                            this.log.warn("reset history date too");
                        }
                    }
                    else {
                        this.log.debug(`ignoring history value ${ctr}`);
                    }
                }
                this.log.info("all history done");
            }
        }
        else {
            this.log.debug("nothing to do for history");
        }
    }
    async UpdateHistoryValues(values, ctr, curDateCtr) {
        let bRet = true;
        const obj = await this.getStateAsync(`history.value${ctr}`);
        if (obj !== undefined && obj != null) {
            try {
                let oEbusValues = [];
                if (obj !== null) {
                    //this.log.debug("before " + obj.val);
                    if (obj.val != null && obj.val != "" && typeof obj.val === "string") {
                        oEbusValues = JSON.parse(obj.val);
                    }
                    //this.log.debug("after parse " + JSON.stringify(oEbusValues));
                    //this.log.debug("after parse cnt " + oEbusValues.length);
                }
                //this.log.debug("values " + ctr + ": " + JSON.stringify(values[ctr-1]));
                oEbusValues.push(values[ctr - 1]);
                //this.log.debug("after push " + JSON.stringify(oEbusValues));
                //this.log.debug("after push cnt " + oEbusValues.length);
                //limit length of object...
                if (oEbusValues.length > 200) {
                    for (let i = oEbusValues.length; i > 200; i--) {
                        //this.log.debug("delete");
                        oEbusValues.shift();
                    }
                }
                const key = `history.value${ctr}`;
                this.log.debug(`update history ${key}`);
                if (curDateCtr != oEbusValues.length) {
                    bRet = false;
                    await this.setState(`history.value${ctr}`, { ack: true, val: "[]" });
                    this.log.warn(`reset history ${key} because number of values different to date values`);
                }
                else {
                    await this.setState(key, { ack: true, val: JSON.stringify(oEbusValues) });
                }
            }
            catch (e) {
                this.log.error(`exception in UpdateHistory part2 [${e}]`);
                await this.setState(`history.value${ctr}`, { ack: true, val: "[]" });
                if (curDateCtr > 0) {
                    bRet = false;
                }
            }
        }
        else {
            this.log.warn(`history.value${ctr} not found, creating DP ${JSON.stringify(obj)}`);
            await this.setState(`history.value${ctr}`, { ack: true, val: "[]" });
            if (curDateCtr > 0) {
                bRet = false;
            }
        }
        return bRet;
    }
    //this function just triggers ebusd to read data; result will not be parsed; we just take the values from http result
    //here we need a loop over all configured read data in admin-page
    async ebusd_ReadValues() {
        if (this.oPolledVars.length > 0) {
            this.log.debug(`to poll ctr ${this.oPolledVars.length} vals:  ${JSON.stringify(this.oPolledVars)}`);
            try {
                //const socket = new net.Socket();
                //const promiseSocket = new PromiseSocket(socket);
                //await promiseSocket.connect(parseInt(this.config.targetTelnetPort), this.config.targetIP);
                //this.log.debug(`telnet connected to poll variables ${  this.config.targetIP  } port ${  this.config.targetTelnetPort}`);
                //promiseSocket.setTimeout(5000);
                const telnet = new TelnetClient_1.default();
                await telnet.connect(this.config.targetIP, this.config.targetTelnetPort);
                let retries = 0;
                for (let nCtr = 0; nCtr < this.oPolledVars.length; nCtr++) {
                    let circuit = "";
                    let params = "";
                    if (this.oPolledVars[nCtr].circuit != null && this.oPolledVars[nCtr].circuit.length > 0) {
                        circuit = `-c ${this.oPolledVars[nCtr].circuit} `;
                    }
                    if (this.oPolledVars[nCtr].parameter != null && this.oPolledVars[nCtr].parameter.length > 0) {
                        params = ` ${this.oPolledVars[nCtr].parameter}`;
                    }
                    let cmd = `read -f ${circuit}${this.oPolledVars[nCtr].name}${params}`;
                    this.log.debug(`send cmd ${cmd}`);
                    cmd += "\n";
                    let data = null;
                    try {
                        //await promiseSocket.write(cmd);
                        await telnet.write(cmd);
                        //const data = await promiseSocket.read();
                        data = await telnet.read();
                    }
                    catch (e) {
                        this.log.warn(`exception from tcp socket write/read in ebusd_ReadValues for cmd ${cmd}` + `[${e}]` + ` -> retry`);
                        //todo: retry nur für timeout und arbitration lost? 2025-11-01
                        retries++;
                        if (retries > this.config.maxretries) {
                            this.log.error(`max retries, skip cmd ${cmd}`);
                        }
                        else {
                            nCtr--; //counter wieder zurücksetzen
                            this.log.debug("retry to send data ");
                        }
                    }
                    if (data !== null) {
                        this.log.debug(`received ${data} for ${JSON.stringify(this.oPolledVars[nCtr])}`);
                        //todo: parse data and set DP's 2025-11-01
                    }
                    //received ERR: arbitration lost for YieldThisYear
                    //if (data !== null && data.includes("ERR")) {
                    //    this.log.warn(`sent ${  cmd  }, received ${  data  } for ${  JSON.stringify(oPolledVars[nCtr])  } please check ebusd logs for details!`);
                    //
                    //    /*
                    //     * sent read -f YieldLastYear, received ERR: arbitration lost for {"circuit":"","name":"YieldLastYear","parameter":""}
                    //     * */
                    //    if (data.includes("arbitration lost")) {
                    //        retries++;
                    //        if (retries > this.config.maxretries) {
                    //            this.log.error(`max retries, skip cmd ${  cmd}`);
                    //            retries = 0;
                    //        } else {
                    //            nCtr--;
                    //            this.log.debug("retry to send data ");
                    //        }
                    //    }
                    //} else {
                    //
                    //    //muss wieder debug werden 2025-11-01 todo
                    //    this.log.info(`received ${  data  } for ${  JSON.stringify(oPolledVars[nCtr])}`);
                    //}
                }
                //promiseSocket.destroy();
                await telnet.disconnect();
                this.log.debug("telnet disonnected");
            }
            catch (e) {
                this.log.error(`exception from tcp socket in ebusd_ReadValues ` + `[${e}]`);
            }
        }
        else {
            this.log.debug("nothing to poll; skip telnet");
        }
    }
    async FindParams(obj) {
        //todo muss wieder debug werden 2025-11-01
        this.log.debug(`FindParams ${JSON.stringify(obj)}`);
        const list = [];
        try {
            //FindParams {"command":"findParams","message":{"circuit":"cc"},"from":"system.this.admin.0","callback":{"message":{"circuit":"cc"},"id":90,"ack":false,"time":1733690088670},"_id":39690903}
            if (obj.message !== null && obj.message.circuit !== null) {
                const circuit = obj.message.circuit;
                //const socket = new net.Socket();
                //const promiseSocket = new PromiseSocket(socket);
                //await promiseSocket.connect(parseInt(this.config.targetTelnetPort), this.config.targetIP);
                //this.log.debug("telnet connected for cmd");
                //promiseSocket.setTimeout(5000);
                const telnet = new TelnetClient_1.default();
                await telnet.connect(this.config.targetIP, this.config.targetTelnetPort);
                const cmd = `find -c ${circuit} -F circuit,name\n`;
                //await promiseSocket.write(cmd);
                this.log.debug(`send cmd ${cmd}`);
                await telnet.write(cmd);
                this.log.debug(`sent, wait for data...`);
                //const data = await promiseSocket.read();
                const data = await telnet.read();
                this.log.info(`data received: ` + data);
                if (data.includes("ERR")) {
                    this.log.warn(`received error! sent find, received ${data} please check ebusd logs for details! ${cmd}`);
                }
                else {
                    this.log.info(`received ${typeof data} ${data} ${+cmd}`);
                }
                /*
                  received object ehp,AccelerationTestModeehp,AccelerationTestModeehp,ActualEnvironmentPowerehp,ActualEnvironmentPowerehp,ActualEnvironmentPowerPercentageehp,ActualEnvironmentPowerPercentageehp,ApplianceCodeehp,ApplianceCodeehp,Backupehp,Backupehp,BackupHoursehp,BackupHoursHcehp,BackupHoursHwcehp,BackupHysteresisehp,BackupIntegralehp,BackupModeHcehp,BackupModeHwcehp,BackupPowerCutehp,BackupStartsehp,BackupStartsHcehp,BackupStartsHwcehp,BackupTypeehp,BivalentTempehp,Bleedingehp,Bleedingehp,CirPumpehp,CirPumpehp,Code1ehp,Code1Code2Validehp,Code2ehp,Compehp,Compehp,CompControlStateehp,CompCutPressHighCountehp,CompCutPressLowCountehp,CompCutTempCountehp,CompDemandehp,CompHoursehp,CompHoursHcehp,CompHoursHwcehp,CompHysteresisehp,CompIntegralehp,CompPressHighehp,CompPressHighehp,CompPressLowehp,CompPressLowehp,CompStartsehp,CompStartsHcehp,CompStartsHwcehp,CompStateehp,CondensorTempehp,CondensorTempehp,currenterrorehp,Dateehp,DateTimeehp,DeltaTempT6T7ehp,ElectricWiringDiagramehp,ElectricWiringDiagramehp,EnergyBalancingReleaseehp,errorhistoryehp,FlowTempehp,FlowTempehp,FlowtempCoolingMinehp,FlowTempOffsetehp,Hc1Pumpehp,Hc1Pumpehp,Hc1PumpHoursehp,Hc1PumpPortehp,Hc1PumpStartsehp,Hc2Pumpehp,Hc2PumpHoursehp,HcFlowTempehp,HcFlowTempOffsetehp,HcModeDemandHoursehp,HcModeFulfilledHoursehp,HcParallelStorageFillingEnabledehp,HcPressehp,HcReturnTempehp,HcReturnTempehp,HcReturnTempOffsetehp,HeatPumpStatusehp,HeatPumpStatusehp,HeatpumpTypeehp,HwcHcValveehp,HwcHcValveehp,HwcHcValveStartsehp,HwcLaggingTimeehp,HwcLoadingDelayehp,HwcModeDemandHoursehp,HwcModeFulfilledHoursehp,HwcPumpStartsehp,HwcSwitchehp,HwcTempehp,HwcTempehp,HwcTempOffsetehp,HydraulicSchemeehp,ICLOutehp,ICLOutehp,Injectionehp,Integralehp,Mixer1DutyCycleehp,NumberCompStartsehp,OutsideTempehp,OutsideTempOffsetehp,OverpressureThresholdehp,PhaseOrderehp,PhaseOrderehp,PhaseStatusehp,PhaseStatusehp,PowerCutehp,PowerCutPreloadingehp,PressSwitchehp,PressSwitchehp,RebootCounterehp,ReturnTempMaxehp,SetModeehp,SoftwareCodeehp,Source2PumpHoursehp,Sourceehp,Sourceehp,SourceHoursehp,SourcePortehp,SourcePressehp,SourcePumpPrerunTimeehp,SourceStartsehp,SourceSwitchehp,SourceSwitchehp,SourceTempInputehp,SourceTempInputehp,SourceTempInputOffsetehp,SourceTempOutputehp,SourceTempOutputehp,SourceTempOutputOffsetehp,SourceTempOutputT8Minehp,StateSoftwareCodeehp,StateSoftwareCodeehp,Status01ehp,Status02ehp,Status16ehp,Statusehp,StatusCirPumpehp,StorageTempBottomehp,StorageTempBottomehp,StorageTempBottomOffsetehp,StorageTempTopehp,StorageTempTopehp,StorageTempTopOffsetehp,Subcoolingehp,Superheatehp,T19MaxToCompOffehp,TempInputehp,TempInputehp,TempInputOffsetehp,TempOutputehp,TempOutputehp,TempOutputOffsetehp,Timeehp,TimeBetweenTwoCompStartsMinehp,TimeCompOffMinehp,TimeCompOnMinehp,TimeOfNextPredictedPowerCutehp,TimeOfNextPredictedPowerCutehp,Weekdayehp,YieldTotalehp,YieldTotal
                */
                //const str = new TextDecoder().decode(data);
                let str;
                if (typeof data === "string") {
                    str = data;
                }
                else if (data instanceof Uint8Array) {
                    str = new TextDecoder().decode(data);
                }
                else if (data instanceof ArrayBuffer) {
                    str = new TextDecoder().decode(new Uint8Array(data));
                }
                else {
                    // fallback: convert to string
                    str = String(data);
                }
                const datas = str.split(/[\r?\n,]+/);
                this.log.info("found entries: " + datas.length);
                for (let i = 0; i < datas.length; i++) {
                    //this.log.info(JSON.stringify(datas[i]));
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
                            name: names[1],
                        };
                        list.push(entry);
                    }
                }
                await telnet.disconnect();
            }
            else {
                this.log.error("no circuit defined where to look for parameter, check values!");
            }
        }
        catch (e) {
            this.log.error(`exception in FindParams ` + `[${e}]`);
        }
        this.log.info(`parameters ${JSON.stringify(list)}`);
        this.sendTo(obj.from, obj.command, list, obj.callback);
    }
    /*
    async CallExternalScript(script, msg) {



        try {
            if (os.platform() == "linux") {
                //const cmd = spawn("ls", ["-la"]);

                this.log.info("we are on linux ");

                const folderName = path.join(__dirname, '..', 'iobroker.ebus', 'lib', 'scripts');


                if (!fs.existsSync(folderName)) {

                    this.log.info("folder doesnt exists " + folderName);

                    this.sendTo(msg.from, msg.command, { error: 'script folder not found ' + folderName }, msg.callback);
                    return;
                }


                this.log.info("folder exists " + folderName);

                const scriptfile = path.join(folderName, script);
                const stats = await fs.statSync(scriptfile);

                if (!stats.isFile()) {

                    this.log.info("file doenst exists " + scriptfile);

                    this.sendTo(msg.from, msg.command, { error: 'script not found ' + scriptfile }, msg.callback);

                    return;

                } else {

                    this.log.info("file exists " + scriptfile);

                    const cmd = spawn(scriptfile, [""]);

                    cmd.stdout.on("data", data => {
                        this.log.error(`stdout: ${data}`);
                    });

                    cmd.stderr.on("data", data => {
                        this.log.error(`stderr: ${data}`);
                    });

                    cmd.on('error', (error) => {
                        this.log.error(`error: ${error.message}`);
                    });

                    cmd.on("close", code => {
                        this.log.error(`child process exited with code ${code}`);
                        this.sendTo(msg.from, msg.command, {
                            info: 'success '

                        }, msg.callback);
                    });
                }

            } else {
                this.sendTo(msg.from, msg.command, { error: 'possible only on Linux systems, this system is  ' + os.platform() }, msg.callback);
            }
        } catch (e) {
            this.log.error("exception in CallExternalScript " + "[" + e + "]");

            this.sendTo(msg.from, msg.command, { error: 'error  ' + e }, msg.callback);
        }


        /*
            try {
                if (os.platform() == "linux") {
        
        
                    let cmd = "\\lib\\scripts\\" + script;
        
                    exec(cmd, (error, stdout, stderr) => {
                        if (error) {
                            this.log.error(`error: ${error.message}`);
                            this.sendTo(msg.from, msg.command, { error: 'error  ' + error.message }, msg.callback);
                            return;
                        }
                        if (stderr) {
                            this.log.error(`stderr: ${stderr}`);
                            this.sendTo(msg.from, msg.command, { error: 'error  ' + stderr }, msg.callback);
                            return;
                        }
                        this.log.info(`stdout: ${stdout}`);
                        this.sendTo(msg.from, msg.command, {
                            info: 'success '
        
                        }, msg.callback);
                    });
                }
                else {
                    this.sendTo(msg.from, msg.command, { error: 'possible only on Linux systems, this system is  ' + os.platform() }, msg.callback);
                }
            } catch (e) {
                this.log.error("exception in CallExternalScript " + "[" + e + "]");
            }
        
        */
    //}
    async CheckVersion(version, msg) {
        if (version == "installable") {
            let vers = "unknown";
            if (this.ebusdUpdateVersion[0] > 0 && this.ebusdVersion[0] > 0) {
                vers = `${this.ebusdUpdateVersion[0]}.${this.ebusdUpdateVersion[1]}`;
            }
            else {
                vers = await this.GetLatestVersionGithub();
            }
            this.sendTo(msg.from, msg.command, vers, msg.callback);
        }
        else if (version == "current") {
            this.sendTo(msg.from, msg.command, `${this.ebusdVersion[0]}.${this.ebusdVersion[1]}`, msg.callback);
        }
        else if (version == "supported") {
            this.sendTo(msg.from, msg.command, `${this.ebusdMinVersion[0]}.${this.ebusdMinVersion[1]}`, msg.callback);
        }
    }
    async GetLatestVersionGithub() {
        let latestVersion = "unknown";
        try {
            const url = "https://api.github.com/repos/john30/ebusd/releases/latest";
            this.log.debug(`call ${url}`);
            const result = await axios_1.default.get(url, { timeout: 5000 });
            if (result != null && result.status == 200 && result.data != null) {
                this.log.info(`installable version on github ${JSON.stringify(result.data.tag_name)} (${JSON.stringify(result.data.name)})`);
                latestVersion =
                    "on github " + JSON.stringify(result.data.tag_name) + "(" + JSON.stringify(result.data.name) + ")";
            }
            else {
                latestVersion = "unknown / no result";
            }
        }
        catch (e) {
            this.log.error(`exception in GetLatestVersionGithub [${e}]`);
            latestVersion = "unknown / error";
        }
        return latestVersion;
    }
    //==========================================================
    // replace by general functions from base.ts
    async CreateObject(key, obj) {
        const obj_new = await this.getObjectAsync(key);
        //adapter.log.warn("got object " + JSON.stringify(obj_new));
        if (obj_new != null) {
            if ((obj_new.common.role != obj.common.role ||
                obj_new.common.type != obj.common.type ||
                (obj_new.common.unit != obj.common.unit && obj.common.unit != null) ||
                obj_new.common.read != obj.common.read ||
                obj_new.common.write != obj.common.write ||
                obj_new.common.name != obj.common.name) &&
                obj.type === "state") {
                this.log.warn(`change object ${JSON.stringify(obj)} ${JSON.stringify(obj_new)}`);
                await this.extendObject(key, {
                    common: {
                        name: obj.common.name,
                        role: obj.common.role,
                        type: obj.common.type,
                        unit: obj.common.unit,
                        read: obj.common.read,
                        write: obj.common.write,
                    },
                });
            }
        }
        else {
            await this.setObjectNotExistsAsync(key, obj);
        }
    }
    //circuit,name,comment
    async UpdateDP(circuit, name, comment) {
        const key = `${circuit}.messages.${name}`;
        this.log.debug(`update check for ${key}`);
        //       ehp.messages.Injection
        //ebus.0.ehp.messages.Injection
        const obj = await this.getObjectAsync(key);
        this.log.debug(`update check got ${JSON.stringify(obj)}`);
        //update check got null
        if (obj != null) {
            if (obj.common.name != comment) {
                this.log.debug(`update  ${key} ${comment}`);
                await this.extendObject(key, {
                    common: {
                        name: comment,
                        read: true,
                        write: false,
                    },
                });
            }
        }
        else {
            await this.setObjectNotExistsAsync(key, {
                type: "channel",
                common: {
                    name: comment
                    //read: true,
                    //write: false,
                },
                native: {}
            });
        }
    }
    async AddObject(key, types) {
        try {
            const obj = await this.getObjectAsync(key);
            if (obj != null) {
                if (obj.common.role != "value" || obj.common.type != types) {
                    this.log.debug(` !!! need to extend for ${key}`);
                    await this.extendObject(key, {
                        common: {
                            type: types,
                            role: "value",
                        },
                    });
                }
            }
            else {
                this.log.warn(` !!! does not exist, creating now ${key}`);
                await this.setObjectNotExistsAsync(key, {
                    type: "state",
                    common: {
                        name: "data",
                        type: types,
                        role: "value",
                        unit: "",
                        read: true,
                        write: false,
                    },
                    native: {
                        location: key,
                    },
                });
            }
        }
        catch (e) {
            this.log.error(`exception in AddObject ` + `[${e}]`);
        }
    }
    async UpdateObject(key, value) {
        try {
            if (value === undefined) {
                this.log.warn(`updateObject: not updated ${key} value: ${value} ${typeof value}`);
            }
            else if (value == null) {
                this.log.debug(`updateObject: update to null ${key} value: ${value}`);
                await this.setState(key, { ack: true, val: null });
            }
            else {
                //this.log.debug("updateObject " + key + " : " + value);
                await this.setState(key, { ack: true, val: value });
            }
        }
        catch (e) {
            this.log.error(`exception in UpdateObject ` + `[${e}]`);
        }
    }
}
exports.ebus = ebus;
if (require.main !== module) {
    // Exportiere den Konstruktor im Kompaktmodus
    module.exports = (options) => new ebus(options);
}
else {
    // Starte die Instanz direkt
    (() => new ebus())();
}
//# sourceMappingURL=main.js.map