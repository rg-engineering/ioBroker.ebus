/*
 * ebus adapter für iobroker
 *
 * Created: 15.09.2016 21:31:28
 *  Author: Rene
*/

import { Adapter, AdapterInstance } from '@iobroker/adapter-core';
// var request = require('request');
// const bent = require("bent");
import axios from 'axios';
// @ts-ignore
import { flatten } from 'flat';
// const parseString = require("xml2js").parseString;
import net from 'net';
import { PromiseSocket } from 'promise-socket';

interface IEbusAdapterConfig extends ioBroker.AdapterConfig{
    [key: string]: any;
    targetTelnetPort: string;
}

export default class EbusAdapter extends Adapter implements Omit<AdapterInstance<false, false>, 'config'> {
    public config: IEbusAdapterConfig;

    private _intervalId: NodeJS.Timer | undefined;

    private _oPolledVars: any;

    private _oHistoryVars: any;

    private _ebusdMinVersion = [ 22, 3 ];

    private _ebusdVersion = [ 0, 0 ];

    private _ebusdUpdateVersion = [ 0, 0 ];

    /**
     * The constructor
     * @param options
     */
    constructor (options?: any) {
        options = {
            options,
            ...{
                name: 'ebus'
            }
        };
        super(options);
        this.config = {
            ...super.config,
            targetTelnetPort: '8888'
        };
        /**
         * this is called when iobroker is ready
         */
        this.on('ready', this._main.bind(this));
        /**
         * this is called before shutdown of iobroker
         * @param callback
         */
        this.on('unload', this._destroy.bind(this));

        /**
         * this is called if a subscribed state changes
         * @param id
         * @param state
         */
        this.on('stateChange', this._handleStateChange.bind(this));

    }

    /**
     * end the adapter
     * @param callback
     * @private
     */
    private _destroy (callback: Function) {
        this.log.info('cleaned everything up...');
        clearInterval(this._intervalId);
        // to do stop intervall
        callback();
    }

    /**
     * start the adapter
     * @private
     */
    private async _main () {

        /*
        let nParseTimeout = 60;
        if (this.config.parseTimeout > 0) {
            nParseTimeout = this.config.parseTimeout;
        }
        this.log.debug("set timeout to " + nParseTimeout + " sec");
        nParseTimeout = nParseTimeout * 1000;
        // force terminate after 1min
        // don't know why it does not terminate by itself...
        killTimer = setTimeout(function () {
            this.log.warn("force terminate");
            //process.exit(0);
            adapter.terminate ? adapter.terminate(15) : process.exit(15);
        }, nParseTimeout);
        */

        this.log.debug('start with interface ebusd ');

        this._fillPolledVars();
        this._fillHistoryVars();

        await this._ebusdReadValues();

        this._subscribeVars();

        // await TestFunction();

        let readInterval = 5;
        if (parseInt(this.config.readInterval) > 0) {
            readInterval = this.config.readInterval;
        }
        this.log.debug('read every  ' + readInterval + ' minutes');
        this._intervalId = setInterval(this._doPeriodic, readInterval * 60 * 1000);

        /*
        if (killTimer) {
            clearTimeout(killTimer);
            this.log.debug("timer killed");
        }

        adapter.terminate ? adapter.terminate(0) : process.exit(0);
        */
    }

    /**
     * stuff we do on the interval
     * @private
     */
    private async _doPeriodic () {

        this.log.debug('starting ... ');

        await this._ebusSendCommand();

        await this._ebusdReadValues();

        await this._ebusGetData();
    }

    /**
     * handle change of a state
     * @param id
     * @param state
     * @private
     */
    private async _handleStateChange (id: string, state: ioBroker.State | undefined | null) {

        if (state && !state.ack) {

            this.log.debug('handle state change ' + id);
            const ids = id.split('.');

            if (ids[2] === 'cmd') {
                await this._ebusSendCommand();
            } else {
                this.log.warn('unhandled state change ' + id);
            }
        }

    }

    /**
     * send command to eBus using telnet
     * @private
     */
    private async _ebusSendCommand () {
        const cmdState = await this.getStateAsync('cmd');

        if (cmdState) {
            const commands = cmdState.val;
            if (typeof commands === 'string') {
                this.log.debug('got command(s): ' + commands);

                this.log.debug('connect telnet to IP ' + this.config.targetIP + ' port ' + parseInt(this.config.targetTelnetPort));

                try {
                    const socket = new net.Socket();
                    const promiseSocket = new PromiseSocket(socket);

                    await promiseSocket.connect(parseInt(this.config.targetTelnetPort), this.config.targetIP);
                    this.log.debug('telnet connected for cmd');
                    promiseSocket.setTimeout(5000);

                    const oCmds = commands.split(',');

                    if (oCmds.length > 0) {
                        let received = '';
                        for (const oCmd of oCmds) {

                            this.log.debug('send ' + oCmd);
                            await promiseSocket.write(oCmd + '\n');

                            const data = await promiseSocket.read();

                            if (data?.includes('ERR')) {
                                this.log.warn('sent ' + oCmd + ', received ' + data + ' please check ebusd logs for details!');
                            } else {
                                this.log.debug('received ' + data);
                            }
                            received += data?.toString();
                            received += ', ';
                        }

                        // set result to cmdResult
                        await this.setStateAsync('cmdResult', { ack: true, val: received });
                    } else {
                        this.log.warn('no commands in list ' + commands + ' ' + JSON.stringify(oCmds));
                    }
                    await this.setStateAsync('cmd', { ack: true, val: '' });

                    promiseSocket.destroy();

                } catch (e) {
                    this.log.error('exception from tcp socket' + '[' + e + ']');
                }
            }
        } else {
            this.log.debug('object cmd not found ' + JSON.stringify(cmdState));
        }
    }

    /**
     * check compatibility
     * @private
     */
    private _versionCheck () {

        if (this._ebusdVersion[0] > 0) {
            if (this._ebusdVersion[0] < this._ebusdMinVersion[0] || (this._ebusdVersion[0] == this._ebusdMinVersion[0] && this._ebusdVersion[1] < this._ebusdMinVersion[1])) {
                this.log.info('please update ebusd, old version found: ' + this._ebusdVersion[0] + '.'
                  + this._ebusdVersion[1] + ' supported version is ' + this._ebusdMinVersion[0] + '.' + this._ebusdMinVersion[1]);
            }
            if (this._ebusdVersion[0] > this._ebusdMinVersion[0] || (this._ebusdVersion[0] >= this._ebusdMinVersion[0] && this._ebusdVersion[1] > this._ebusdMinVersion[1])) {
                this.log.info('unsupported ebusd version found (too new): ' + this._ebusdVersion[0] + '.'
                  + this._ebusdVersion[1] + ' supported version is ' + this._ebusdMinVersion[0] + '.' + this._ebusdMinVersion[1]);
            }
        }

        if (this._ebusdUpdateVersion[0] > 0 && this._ebusdVersion[0] > 0) {

            if (this._ebusdUpdateVersion[0] > this._ebusdVersion[0] || (this._ebusdUpdateVersion[0] == this._ebusdVersion[0] && this._ebusdUpdateVersion[1] > this._ebusdVersion[1])) {
                this.log.info('new ebusd version found: ' + this._ebusdUpdateVersion[0] + '.' + this._ebusdUpdateVersion[1]
                  + ' supported version is ' + this._ebusdMinVersion[0] + '.' + this._ebusdMinVersion[1]);

            }

        }
    }

    /**
     * get data from eBus
     * @private
     */
    private async _ebusGetData () {
        const sUrl = 'http://' + this.config.targetIP + ':' + parseInt(this.config.targetHTTPPort) + '/data';
        this.log.debug('request data from ' + sUrl);

        try {
            const ebusResponse = await axios.get(sUrl);

            this.log.debug('got data ' + typeof ebusResponse.data + ' ' + JSON.stringify(ebusResponse.data));

            type EbusData = {[key: string]: any};

            const ebusData: EbusData = ebusResponse.data;

            const nonDeviceSections = [
                /scan\.*/,
                'global',
                'broadcast'
            ];

            for (const section in ebusData) {
                const basePath = [];
                if (nonDeviceSections.some(ignoreSection => section.match(ignoreSection))) {
                    // i'm a circuit
                    basePath.push('circuit');
                    basePath.push(section);
                    if (ebusData[section].messages) {
                        // todo
                    }
                } else if (section === 'broadcast') {
                    basePath.push('broadcast');
                    // i'm broadcast
                } else if (section === 'global') {
                    basePath.push('global');
                    // i'm global
                }
            }

            const newData = flatten(ebusData);

            const keys = Object.keys(newData);

            // this.log.debug("history: " + options.historyValues);

            const historyvalues: string[][] = [];
            const historydates: {date: string; time: string}[] = [];

            const oToday = new Date();
            const month = oToday.getMonth() + 1;

            historydates.push({
                date: oToday.getDate() + '.' + month + '.' + oToday.getFullYear(),
                time: oToday.getHours() + ':' + oToday.getMinutes() + ':' + oToday.getSeconds()
            });
            // this.log.debug(JSON.stringify(historydates));

            let name = 'unknown';
            let sError = 'none';
            const unsupportedChars = [
                '[',
                ']'
            ];

            if (keys.includes('global.updatecheck')) {
                const updateCheck = newData['global.updatecheck'];

                // revision v21.2 available
                // revision v22.3 available, vaillant/08.bai.csv: newer version available, vaillant/bai.0010007508.inc: different version available
                const version = updateCheck.match(/v(\d*\.\d)/s)[1];

                const versionInfo = version.split('.');
                if (versionInfo.length > 1) {
                    this.log.info('found ebusd update version ' + versionInfo[0] + '.' + versionInfo[1] + 'updateCheck: ' + updateCheck);

                    this._ebusdUpdateVersion[0] = versionInfo[0];
                    this._ebusdUpdateVersion[1] = versionInfo[1];

                    this._versionCheck();
                }
            }

            if (keys.includes('global.version')) {
                const value = newData['global.version'];
                const versionInfo = value.split('.');
                if (versionInfo.length > 1) {
                    this.log.info('installed ebusd version is ' + versionInfo[0] + '.' + versionInfo[1]);

                    this._ebusdVersion[0] = versionInfo[0];
                    this._ebusdVersion[1] = versionInfo[1];

                    this._versionCheck();
                }
            }

            for (let key of keys) {
                const originalKey = key;

                for (const unsupportedChar of unsupportedChars) {
                    if (key.includes(unsupportedChar)) {
                        key = key.replaceAll(unsupportedChar, '__');
                        this.log.debug('unsupported char ' + unsupportedChar + ' found in key ' + originalKey + ' resolved with '+ key);
                    }
                }

                const path = key.split('.');
                const pathLength = path.length;
                // this.log.debug('Key : ' + key + ', Value : ' + newData[key]);

                //
                // if (key.match(adapter.FORBIDDEN_CHARS)) { continue; }

                if (path[pathLength - 1].includes('name')) {
                    name = newData[originalKey];
                } else if (path[pathLength - 1].includes('value')) {
                    // this.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);

                    let value = newData[originalKey];

                    if (value === null || value === undefined) {
                        this.log.debug('Key : ' + key + ', Value : ' + newData[originalKey] + ' name ' + name);
                    }

                    if (name === 'hcmode2') {
                        if (parseInt(value) === 0) {
                            this.log.info(key + 'in hcmode2 with value 0: off');
                            value = 'off';
                        } else if (parseInt(value) === 5) {
                            this.log.info(key + ' with value 5: EVU Sperrzeit');
                            value = 'EVU Sperrzeit';
                        } else {
                            this.log.debug('in hcmode2, value ' + value);
                        }
                    }

                    let type = typeof value;

                    if (this.config.useBoolean4Onoff) {
                        if (type == 'string' && (value == 'on' || value == 'off')) {
                            this.log.debug('Key ' + key + ' change to boolean ' + value);
                            // Key mc.messages.Status.fields.1.value could be boolean off

                            type = 'boolean';

                            if (value == 'on') {
                                value = true;
                            } else {
                                value = false;
                            }

                        }
                    }
                    // value, change type if necessary
                    await this._addObject(key, type);
                    await this._updateObject(key, value);

                    // name parallel to value: used for lists in admin...
                    const keyname = key.replace('value', 'name');
                    await this._addObject(keyname, 'string');

                    await this._updateObject(keyname, name);

                    // push to history
                    // ebus.0.bai.messages.ReturnTemp.fields.pathLength.value
                    // ebus.0.bai.messages.ReturnTemp.fields.tempmirror.value
                    if (!path[pathLength - 2].includes('sensor') // ignore sensor states
                      && !path[pathLength - 2].includes('mirror') // ignore mirror-data
                    ) {
                        for (let ii = 0; ii < this._oHistoryVars.length; ii++) {

                            if (name === this._oHistoryVars[ii].name) {

                                const sTemp = '{"' + name + '": "' + value + '"}';
                                // this.log.debug(sTemp);
                                historyvalues[ii] = [];
                                historyvalues[ii].push(JSON.parse(sTemp));
                                // this.log.debug(JSON.stringify(historyvalues));
                            }
                        }
                    }
                } else if (path[pathLength - 1].includes('lastup')) {

                    const value = newData[originalKey];

                    if (parseInt(value) > 0) {
                        // this.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);

                        // umrechnen...
                        const oDate = new Date(value * 1000);
                        // const nDate = oDate.getDate();
                        // const nMonth = oDate.getMonth() + 1;
                        // const nYear = oDate.getFullYear();
                        // const nHours = oDate.getHours();
                        // const nMinutes = oDate.getMinutes();
                        // const nSeconds = oDate.getSeconds();

                        const sDate = oDate.toLocaleString();
                        await this._addObject(key, 'string');
                        await this._updateObject(key, sDate);

                        const oToday = new Date();

                        let bSkip = false;

                        if (path[0].includes('scan') ||
                          path[0].includes('ehp') ||
                          (path.length>2 && path[2].includes('currenterror'))

                        ) {
                            bSkip = true;
                        }
                        if (pathLength > 2) {
                            // this.log.debug("_______________size " + pathLength);
                            if (path[2].includes('Timer')) {
                                bSkip = true;
                            }
                        }

                        if (!bSkip && Math.abs(oDate.getTime() - oToday.getTime()) > 1 * 60 * 60 * 1000) {

                            const sError1 = 'no update since ' + sDate + ' ' + key + ' ';
                            if (sError.includes('none')) {
                                sError = 'ebus: ' + sError1;
                            } else {
                                sError += sError1;
                            }
                            this.log.warn(sError1);
                        }

                    }
                } else if (path[0].includes('global')) {
                    // this.log.debug('Key : ' + key + ', Value : ' + newData[key] + " name " + name);
                    const value = newData[originalKey];
                    await this._addObject(key, typeof value);
                    await this._updateObject(key, value);
                }
            }
            await this.setStateAsync('history.error', { ack: true, val: sError });

            // this.log.debug(JSON.stringify(historyvalues));

            this.log.info('all http done');

            await this._updateHistory(historyvalues, historydates);

        } catch (e) {
            this.log.error('exception in ebusd_ReceiveData [' + e + ']');

            await this.setStateAsync('history.error', { ack: true, val: 'exception in receive' });
        }
        // });
    }

    /**
     * todo
     * @private
     */
    private _fillPolledVars () {

        if (typeof this.config.PolledDPs !== 'undefined' && this.config.PolledDPs != null && this.config.PolledDPs.length > 0) {
            this.log.debug('use new object list for polled vars');
            this._oPolledVars = this.config.PolledDPs;
        } else {
            // make it compatible to old versions
            this.log.debug('check old comma separeted list for polled vars');
            const oPolled = this.config.PolledValues.split(',');

            if (oPolled.length > 0) {

                for (const oPolledItem of oPolled) {
                    if (oPolledItem) {
                        this.log.debug('add ' + oPolledItem);
                        const value = {
                            circuit: '',
                            name: oPolledItem,
                            parameter: ''
                        };
                        this._oPolledVars.push(value);
                    }
                }
            }
        }
    }

    /**
     * todo
     * @private
     */
    private _fillHistoryVars () {

        if (typeof this.config.HistoryDPs !== 'undefined' && this.config.HistoryDPs != null && this.config.HistoryDPs.length > 0) {
            this.log.debug('use new object list for history vars');
            this._oHistoryVars = this.config.HistoryDPs;
        } else {
            // make it compatible to old versions
            this.log.debug('check old comma separeted list for history vars');
            const oHistories = this.config.HistoryValues.split(',');

            if (oHistories.length > 0) {

                for (const oHistory of oHistories) {
                    if (oHistory) {
                        this.log.debug('add ' + oHistory);
                        const value = {
                            name: oHistory
                        };
                        this._oHistoryVars.push(value);
                    }
                }
            }
        }
    }

    /**
     * todo
     * @private
     */
    private _subscribeVars () {
        this.subscribeStates('cmd');
    }

    /**
     * todo
     * @param key
     * @param obj
     * @private
     */
    private async _createObject (key: string, obj: ioBroker.Object) {

        const obj_new = await this.getObjectAsync(key);
        // this.log.warn("got object " + JSON.stringify(obj_new));

        if (obj_new != null) {

            if ((obj_new.common.role != obj.common.role
                || obj_new.common.type != obj.common.type
                || (obj_new.common.unit != obj.common.unit && obj.common.unit != null)
                || obj_new.common.read != obj.common.read
                || obj_new.common.write != obj.common.write
                || obj_new.common.name != obj.common.name)
              && obj.type === 'state'
            ) {
                this.log.warn('change object ' + JSON.stringify(obj) + ' ' + JSON.stringify(obj_new));
                await this.extendObject(key, {
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
        } else {
            await this.setObjectNotExistsAsync(key, obj);
        }
    }

    /**
     * todo
     * @private
     */
    private async _checkVariables () {
        this.log.debug('init variables ');

        let key = 'cmd';
        let obj: Partial<ioBroker.Object> = {
            type: 'state',
            common: {
                name: 'ebusd command',
                type: 'string',
                role: 'text',
                read: true,
                write: true
            }
        };
        await this._createObject(key, obj as ioBroker.Object);

        key = 'cmdResult';
        obj = {
            type: 'state',
            common: {
                name: 'ebusd command result',
                type: 'string',
                role: 'text',
                read: true,
                write: false
            }
        };
        await this._createObject(key, obj as ioBroker.Object);

        this.log.debug('init common variables and ' + this._oHistoryVars.length + " history DP's");

        if (this._oHistoryVars.length > 0) {

            if (this._oHistoryVars.length > 4) {
                this.log.warn('too many history values ' + this._oHistoryVars.length + ' -> maximum is  4');
            }

            for (let n = 1; n <= this._oHistoryVars.length; n++) {

                if (this._oHistoryVars[n - 1].name.length > 0) {
                    const name = 'history value ' + n + ' as JSON ' + this._oHistoryVars[n - 1].name;
                    key = 'history.value' + n;
                    obj= {
                        type: 'state',
                        common: {
                            name: name,
                            type: 'string',
                            role: 'value',
                            unit: '',
                            read: true,
                            write: false
                        },
                        native: { location: key }
                    };
                    await this._createObject(key, obj as ioBroker.Object);
                } else {
                    this.log.warn('ignoring history value ' + n + ' (invalid name)');
                }
            }

            key = 'history.date';
            obj= {
                type: 'state',
                common: {
                    name: 'ebus history date as JSON',
                    type: 'string',
                    role: 'value',
                    unit: '',
                    read: true,
                    write: false
                },
                native: {
                    location: key
                }
            };
            await this._createObject(key, obj as ioBroker.Object);
        }
        key = 'history.error';
        obj= {
            type: 'state',
            common: {
                name: 'ebus error',
                type: 'string',
                role: 'value',
                unit: '',
                read: true,
                write: false
            },
            native: { location: key }
        };
        await this._createObject(key, obj as ioBroker.Object);
    }

    /**
     * todo
     * @param values
     * @param dates
     * @private
     */
    private async _updateHistory (values: string[][], dates: {date: string; time: string}[]) {

        if (this._oHistoryVars.length > 0) {
            // prüfen ob alle json gleich lang sind
            let NoOfDates = -1;

            const obj = await this.getStateAsync('history.date');

            if (obj && obj.val) {
                try {
                    let oEbusDates: typeof dates[] = [];
                    // this.log.debug("before " + obj.val);
                    oEbusDates = JSON.parse(obj.val as string) as typeof dates[];
                    // this.log.debug("after parse " + JSON.stringify(oEbusDates));

                    oEbusDates.push(dates);
                    // this.log.debug("after push " + JSON.stringify(oEbusDates));
                    // limit length of object...
                    if (oEbusDates.length > 200) {

                        for (let i = oEbusDates.length; i > 200; i--) {
                            // this.log.debug("delete");
                            oEbusDates.shift();
                        }
                    }
                    NoOfDates = oEbusDates.length;
                    await this.setStateAsync('history.date', { ack: true, val: JSON.stringify(oEbusDates) });
                } catch (e) {
                    this.log.error('exception in UpdateHistory part1 [' + e + ']');
                    await this.setStateAsync('history.date', { ack: true, val: '[]' });
                    NoOfDates = 0;
                }
            } else {
                this.log.warn('history.date not found, creating DP ');
                await this.setStateAsync('history.date', { ack: true, val: '[]' });
                NoOfDates = 0;
            }

            if (this._oHistoryVars.length > 0) {
                for (let ctr = 1; ctr <= this._oHistoryVars.length; ctr++) {

                    if (this._oHistoryVars[ctr - 1].name.length > 0) {
                        const ctrOkay = await this._updateHistoryValues(values, ctr, NoOfDates);

                        if (!ctrOkay) {
                            await this.setStateAsync('history.date', { ack: true, val: '[]' });
                            NoOfDates = 0;
                            this.log.warn('reset history date too');
                        }
                    } else {
                        this.log.debug('ignoring history value ' + ctr);
                    }
                }

                this.log.info('all history done');
            }
        } else {
            this.log.debug('nothing to do for history');
        }
    }

    /**
     * todo
     * @param values
     * @param ctr
     * @param curDateCtr
     * @private
     */
    private async _updateHistoryValues (values: string[][], ctr: number, curDateCtr: number) {

        let bRet = true;

        const obj = await this.getStateAsync('history.value' + ctr);

        if (obj && obj.val) {
            try {
                let oEbusValues = [];
                // this.log.debug("before " + obj.val);

                oEbusValues = JSON.parse(obj.val as string);

                // this.log.debug("after parse " + JSON.stringify(oEbusValues));

                // this.log.debug("after parse cnt " + oEbusValues.length);

                // this.log.debug("values " + ctr + ": " + JSON.stringify(values[ctr-1]));

                oEbusValues.push(values[ctr - 1]);
                // this.log.debug("after push " + JSON.stringify(oEbusValues));
                // this.log.debug("after push cnt " + oEbusValues.length);
                // limit length of object...
                if (oEbusValues.length > 200) {

                    for (let i = oEbusValues.length; i > 200; i--) {
                        // this.log.debug("delete");
                        oEbusValues.shift();
                    }
                }

                const key = 'history.value' + ctr;
                this.log.debug('update history ' + key);

                if (curDateCtr != oEbusValues.length) {
                    bRet = false;
                    await this.setStateAsync('history.value' + ctr, { ack: true, val: '[]' });
                    this.log.warn('reset history ' + key + ' because number of values different to date values');

                } else {
                    await this.setStateAsync(key, { ack: true, val: JSON.stringify(oEbusValues) });
                }

            } catch (e) {
                this.log.error('exception in UpdateHistory part2 [' + e + ']');
                await this.setStateAsync('history.value' + ctr, { ack: true, val: '[]' });
                if (curDateCtr > 0) {
                    bRet = false;
                }
            }
        } else {
            this.log.warn('history.value' + ctr + ' not found, creating DP ' + JSON.stringify(obj));
            await this.setStateAsync('history.value' + ctr, { ack: true, val: '[]' });
            if (curDateCtr > 0) {
                bRet = false;
            }
        }

        return bRet;
    }

    /**
     * todo
     * @param key
     * @param type
     * @private
     */
    private async _addObject (key: string, type: string) {
        // this.log.debug("addObject " + key);

        try {
            const obj = await this.getObjectAsync(key);

            if (obj != null) {
                // this.log.debug(" got Object " + JSON.stringify(obj));
                if (obj.common.role != 'value'
                  || obj.common.type != type) {
                    this.log.debug(' !!! need to extend for ' + key);
                    await this.extendObject(key, {
                        common: {
                            type: type,
                            role: 'value'
                        }
                    });
                }
            } else {
                this.log.warn(' !!! does not exist, creating now ' + key);

                await this.setObjectNotExistsAsync(key, {
                    type: 'state',
                    common: {
                        name: 'data',
                        type: type,
                        role: 'value',
                        unit: '',
                        read: true,
                        write: false
                    },
                    native: {
                        location: key
                    }
                } as ioBroker.SettableObject);
            }

        } catch (e) {
            this.log.error('exception in AddObject ' + '[' + e + ']');
        }
    }

    /**
     * _updateObject
     * @param key
     * @param value
     * @private
     */
    private async _updateObject (key: string, value: string) {
        try {
            if (typeof value == undefined) {
                this.log.warn('updateObject: not updated ' + key + ' value: ' + value + ' ' + typeof value);
            } else if (value == null) {
                this.log.debug('updateObject: update to null ' + key + ' value: ' + value);
                await this.setStateAsync(key, { ack: true, val: null });
            } else {
                this.log.debug('updateObject ' + key + ' : ' + value);
                await this.setStateAsync(key, { ack: true, val: value });
            }
        } catch (e) {
            this.log.error('exception in UpdateObject ' + '[' + e + ']');
        }
    }

    /**
     * _ebusdReadValues
     * @private
     */
    private async _ebusdReadValues () {

        if (this._oPolledVars.length > 0) {

            this.log.debug('to poll ctr ' + this._oPolledVars.length + ' vals:  ' + JSON.stringify(this._oPolledVars));

            try {
                const socket = new net.Socket();
                const promiseSocket = new PromiseSocket(socket);

                await promiseSocket.connect(parseInt(this.config.targetTelnetPort), this.config.targetIP);
                this.log.debug('telnet connected to poll variables ' + this.config.targetIP + ' port ' + this.config.targetTelnetPort);
                promiseSocket.setTimeout(5000);

                let retries = 0;
                for (let nCtr = 0; nCtr < this._oPolledVars.length; nCtr++) {

                    let circuit = '';
                    let params = '';
                    if (this._oPolledVars[nCtr].circuit != null && this._oPolledVars[nCtr].circuit.length > 0) {
                        circuit = '-c ' + this._oPolledVars[nCtr].circuit + ' ';
                    }
                    if (this._oPolledVars[nCtr].parameter != null && this._oPolledVars[nCtr].parameter.length > 0) {
                        params = ' ' + this._oPolledVars[nCtr].parameter;
                    }
                    let cmd = 'read -f ' + circuit + this._oPolledVars[nCtr].name + params;

                    this.log.debug('send cmd ' + cmd);

                    cmd += '\n';
                    await promiseSocket.write(cmd);

                    const data = await promiseSocket.read();

                    // received ERR: arbitration lost for YieldThisYear
                    if (data && data.includes('ERR')) {
                        this.log.warn('sent ' + cmd + ', received ' + data + ' for ' + JSON.stringify(this._oPolledVars[nCtr])
                          + ' please check ebusd logs for details!');

                        /*
                        * sent read -f YieldLastYear, received ERR: arbitration lost for {"circuit":"","name":"YieldLastYear","parameter":""}
                        * */
                        if (data.includes('arbitration lost')) {

                            retries++;
                            if (retries > this.config.maxretries) {
                                this.log.error('max retries, skip cmd ' + cmd);
                                retries = 0;
                            } else {
                                nCtr--;
                                this.log.debug('retry to send data ');
                            }
                        }
                    } else {
                        this.log.debug('received ' + data + ' for ' + JSON.stringify(this._oPolledVars[nCtr]));
                    }
                }
                promiseSocket.destroy();
                this.log.debug('telnet disonnected');

            } catch (e) {
                this.log.error('exception from tcp socket in ebusd_ReadValues ' + '[' + e + ']');
            }

        } else {
            this.log.debug('nothing to poll; skip telnet');
        }

    }

}

// telnet client to write to ebusd
// https://github.com/john30/ebusd/wiki/3.1.-TCP-client-commands
/*
telnet 192.168.3.144 8890

find -f -c broadcast outsidetemp
find -f  outsidetemp
find -f  YieldTotal

read -f YieldTotal
read LegioProtectionEnabled

read -f YieldTotal,read LegioProtectionEnabled,read -f -c broadcast outsidetemp

*/

// this function just triggers ebusd to read data; result will not be parsed; we just take the values from http result
// here we need a loop over all configured read data in admin-page

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
if (!module) {
    // or start the instance directly
    const adapter = new EbusAdapter();
    adapter.restart();
}
