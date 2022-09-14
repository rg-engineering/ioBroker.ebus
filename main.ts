/*
 * ebus adapter für iobroker
 *
 * Created: 15.09.2016 21:31:28
 *  Author: Rene
*/

import { Adapter, AdapterOptions } from '@iobroker/adapter-core';
import axios from 'axios';
// @ts-ignore
import net from 'net';
import { PromiseSocket } from 'promise-socket';

interface IEbusMessageDefinition {
    writable: boolean;
    types: string[];
    circuit: string;
    name: string;
    comment: string;
    masterAddress: string;
    destinationAddresses: string[];
    commandBytes: string;
    id: string;
    fields: {
        field: string;
        part: string;
        type: string;
        values: {
            [key: string]: string;
        };
        unit: string;
        comment: string;
    }[];
}

interface IEbusDataPoint {
    // circuit is optional, ebus can guess sometimes
    circuit?: string;
    name: string;
    // parameters are optional
    parameter?: string;
    // field is optional
    field?: string;
}

enum IoBrokerCommonTypesEnum {
    NUMBER ='number',
    STRING='string',
    BOOLEAN='boolean',
    ARRAY= 'array',
    OBJECT= 'object',
    MIXED= 'mixed',
    FILE= 'file'
}

enum IoBrokerObjectTypesEnum {
    STATE= 'state',
    CHANNEL= 'channel',
    DEVICE= 'device',
    FOLDER= 'folder',
    ENUM='enum',
    ADAPTER= 'adapter',
    CONFIG='config',
    GROUP= 'group',
    HOST= 'host',
    INSTANCE= 'instance',
    META= 'meta',
    SCRIPT= 'script',
    USER='user',
    CHART='chart',

}

interface IEbusAdapterConfig extends ioBroker.AdapterConfig{
    allowWrites: boolean;
    useBoolean4Onoff: boolean;
    readInterval: string;
    maxRetries: number;
    targetIP: string;
    targetHTTPPort: string;
    targetTelnetPort: string;
    PolledDPs?: IEbusDataPoint[];
    polledValues?: string;
    HistoryDPs?: IEbusDataPoint[];
    HistoryValues?: string;
}

class EbusAdapter extends Adapter {
    public config: IEbusAdapterConfig;

    private _intervalId?: NodeJS.Timer;

    private _pollingDataPoints: IEbusDataPoint[] = [];

    private _historyDataPoints: IEbusDataPoint[] = [];

    private _ebusdMinVersion = [ 22, 3 ];

    private _ebusdVersion = [ 0, 0 ];

    private _ebusdUpdateVersion = [ 0, 0 ];

    private _socket?: PromiseSocket<net.Socket>;

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
            allowWrites: false,
            targetTelnetPort: '8888',
            maxRetries: 5,
            readInterval: '5',
            targetHTTPPort: '8889',
            targetIP: '127.0.0.1',
            useBoolean4Onoff: false,
            // overwrite with user config
            ...super.config
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
        this._socket?.destroy();
        callback();
    }

    /**
     * start the adapter
     * @private
     */
    private async _main () {
        this.log.debug('start with interface ebusd ');

        await this._initializeObjects();
        await this._ebusInitializeSocket();

        this._preparePolledDataPoints();
        this._prepareHistoryDataPoints();

        await this._ebusPollDataPoints();

        this._subscribeStates([ 'cmd' ]);

        if (this.config.allowWrites) {
            this._subscribeStates([ '*' ]);
        }

        let readInterval = 5;
        if (parseInt(this.config.readInterval) > 0) {
            readInterval = parseInt(this.config.readInterval);
        }
        this.log.debug('read every  ' + readInterval + ' minutes');
        this._intervalId = setInterval(this._doPeriodic.bind(this), readInterval * 60 * 1000);
        void this._doPeriodic();
    }

    /**
     * stuff we do on the interval
     * @private
     */
    private async _doPeriodic () {

        this.log.debug('starting ... ');

        await this._ebusPollDataPoints();

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
                await this._handleCommandChange(state);
            } else {
                const object = await this._getObject(id);
                if (object && object.common.write) {
                    await this._eBusUpdateDataPoint(id, state);
                } else {
                    this.log.warn('unhandled state change ' + id + ' state: ' + JSON.stringify(state));
                }
            }
        }
    }

    /**
     * send command to eBus using telnet
     * @private
     */
    private async _handleCommandChange (state?: ioBroker.State | null | undefined) {
        if (!state) {
            state = await this._getState('cmd');
        }
        if (state) {
            if (typeof state.val === 'string') {
                this.log.debug('got command(s): ' + state.val);
                try {
                    const commands = state.val.split(',');

                    if (commands.length > 0) {
                        const received = [];
                        for (const command of commands) {

                            this.log.debug('send ' + command);

                            const data = await this._ebusSend(command);

                            if (data?.includes('ERR')) {
                                this.log.warn('sent ' + command + ', received ' + data + ' please check ebusd logs for details!');
                            } else {
                                this.log.debug('received ' + data);
                            }
                            received.push(data);
                        }
                        await this.setStateAsync('cmdResult', { ack: true, val: JSON.stringify(received) });
                    } else {
                        this.log.warn('no commands in list ' + state.val + ' ' + JSON.stringify(commands));
                    }
                    await this.setStateAsync('cmd', { ack: true, val: '' });
                } catch (e) {
                    this.log.error('exception from tcp socket' + '[' + e + ']');
                }
            }
        } else {
            this.log.debug('object cmd not found ' + JSON.stringify(state));
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
     * _preparePolledDataPoints
     * @private
     */
    private _preparePolledDataPoints () {
        if (this?.config?.PolledDPs?.length) {
            this.log.debug('use new object list for polled vars');
            this._pollingDataPoints = this.config.PolledDPs;
        }
    }

    /**
     * _prepareHistoryDataPoints
     * @private
     */
    private _prepareHistoryDataPoints () {
        if (this?.config?.HistoryDPs?.length) {
            this.log.debug('use new object list for history vars');
            this._historyDataPoints = this.config.HistoryDPs;
        }
    }

    /**
     * _subscribeStates
     * @private
     */
    private _subscribeStates (states: string[]) {
        for (const state of states) {
            this.subscribeStates(state);
        }
    }

    /**
     * _createObject
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
     * _initializeObjects
     * @private
     */
    private async _initializeObjects () {
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

        this.log.debug('init common variables and ' + this._historyDataPoints.length + " history DP's");

        if (this._historyDataPoints.length > 0) {

            if (this._historyDataPoints.length > 4) {
                this.log.warn('too many history values ' + this._historyDataPoints.length + ' -> maximum is  4');
            }

            for (let n = 1; n <= this._historyDataPoints.length; n++) {

                if (this._historyDataPoints[n - 1].name.length > 0) {
                    const name = 'history value ' + n + ' as JSON ' + this._historyDataPoints[n - 1].name;
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
     * _updateHistory
     * @deprecated
     * @param values
     * @param dates
     * @private
     */
    private async _updateHistory (values: string[][], dates: {date: string; time: string}[]) {
        // todo removeme
        if (this._historyDataPoints.length > 0) {
            // prüfen ob alle json gleich lang sind
            let newHistoryStateDatesLength = -1;

            const historyStateDates = await this.getStateAsync('history.date');

            if (historyStateDates && historyStateDates.val) {
                try {
                    let newHistoryStateDates: typeof dates[] = [];
                    // this.log.debug("before " + obj.val);
                    newHistoryStateDates = JSON.parse(historyStateDates.val as string) as typeof dates[];
                    // this.log.debug("after parse " + JSON.stringify(oEbusDates));

                    newHistoryStateDates.push(dates);
                    // this.log.debug("after push " + JSON.stringify(oEbusDates));
                    // limit length of object...
                    const maxHistoryStateDates = 200;
                    if (newHistoryStateDates.length > maxHistoryStateDates) {
                        newHistoryStateDates = newHistoryStateDates.reverse();
                        newHistoryStateDates.length = maxHistoryStateDates;
                        newHistoryStateDates = newHistoryStateDates.reverse();
                    }
                    newHistoryStateDatesLength = newHistoryStateDates.length;
                    await this.setStateAsync('history.date', { ack: true, val: JSON.stringify(newHistoryStateDates) });
                } catch (e) {
                    this.log.error('exception in UpdateHistory part1 [' + e + ']');
                    await this.setStateAsync('history.date', { ack: true, val: '[]' });
                    newHistoryStateDatesLength = 0;
                }
            } else {
                this.log.warn('history.date not found, creating DP ');
                await this.setStateAsync('history.date', { ack: true, val: '[]' });
                newHistoryStateDatesLength = 0;
            }

            if (this._historyDataPoints.length > 0) {
                let index = 0;
                for (const historyDataPoint of this._historyDataPoints) {

                    if (historyDataPoint.name) {
                        const historyValueChanged = await this._updateHistoryValue(values, index, newHistoryStateDatesLength);

                        if (historyValueChanged) {
                            await this.setStateAsync('history.date', { ack: true, val: '[]' });
                            newHistoryStateDatesLength = 0;
                            this.log.warn('reset history date too');
                        }
                    } else {
                        this.log.debug('ignoring history value ' + index);
                    }
                    index++;
                }

                this.log.info('all history done');
            }
        } else {
            this.log.debug('nothing to do for history');
        }
    }

    /**
     * _updateHistoryValue
     * @deprecated
     * @param values
     * @param index
     * @param numberOfDates
     * @private
     */
    private async _updateHistoryValue (values: string[][], index: number, numberOfDates: number) {

        let historyValueReset = false;
        const key = 'history.value' + index;

        const historyState = await this.getStateAsync(key);

        if (historyState && historyState.val) {
            try {
                let newHistoryStateValues = [];
                // this.log.debug("before " + historyState.val);

                newHistoryStateValues = JSON.parse(historyState.val as string);

                // this.log.debug("after parse " + JSON.stringify(newHistoryStateValues));

                // this.log.debug("after parse cnt " + newHistoryStateValues.length);

                // this.log.debug("values " + index + ": " + JSON.stringify(values[index-1]));

                newHistoryStateValues.push(values[index - 1]);
                // this.log.debug("after push " + JSON.stringify(newHistoryStateValues));
                // this.log.debug("after push cnt " + newHistoryStateValues.length);
                // limit length of object...
                const maxHistoryStateValues = 200;
                if (newHistoryStateValues.length > maxHistoryStateValues) {
                    newHistoryStateValues = newHistoryStateValues.reverse();
                    newHistoryStateValues.length = maxHistoryStateValues;
                    newHistoryStateValues = newHistoryStateValues.reverse();
                }

                this.log.debug('update history ' + key);

                if (numberOfDates != newHistoryStateValues.length) {
                    historyValueReset = true;
                    this.log.warn('reset history ' + key + ' because number of values different to date values');
                } else {
                    await this.setStateAsync(key, { ack: true, val: JSON.stringify(newHistoryStateValues) });
                }

            } catch (e) {
                this.log.error('exception in UpdateHistory part2 [' + e + ']');
                if (numberOfDates > 0) {
                    historyValueReset = true;
                }
            }
        } else {
            this.log.warn('history.value' + index + ' not found, creating DP ' + JSON.stringify(historyState));
            if (numberOfDates > 0) {
                historyValueReset = true;
            }
        }

        if (historyValueReset) {
            await this.setStateAsync(key, { ack: true, val: '[]' });
        }

        return historyValueReset;
    }

    /**
     * remove forbidden characters
     * @param key
     * @private
     */
    private _sanatizeKey (key: string): string {
        key.replace(this.FORBIDDEN_CHARS, '__');
        return key;
    }

    /**
     * add object to iobroker collection
     * @param key
     * @param objectCommonType
     * @param objectType
     * @param extendObject
     * @private
     */
    private async _syncObject (key: string, objectCommonType: ioBroker.CommonType, objectType: ioBroker.ObjectType = 'state', extendObject: Partial<ioBroker.Object> = {}) {
        key = this._sanatizeKey(key);
        try {
            const existingObject = await this.getObjectAsync(key);

            if (existingObject) {
                // this.log.debug(" got Object " + JSON.stringify(existingObject));
                if (existingObject.common.role != 'value'
                  || existingObject.common.type != objectCommonType) {
                    // either objectCommonType or role does not match existing object, updating..
                    this.log.debug(' !!! need to extend for ' + key);
                    await this.extendObject(key, {
                        common: {
                            type: objectCommonType,
                            role: 'value'
                        }
                    });
                }
            } else {
                this.log.warn(' !!! does not exist, creating now ' + key);

                await this.setObjectNotExistsAsync(key, {
                    ...extendObject,
                    type: objectType,
                    common: {
                        name: 'data',
                        type: objectCommonType,
                        role: 'value',
                        unit: '',
                        read: true,
                        write: false,
                        ...extendObject.common
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
     * _updateState
     * @param key
     * @param value
     * @private
     */
    private async _updateState (key: string, value: string | number) {
        key = this._sanatizeKey(key);

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
     * _getObject
     * @param key
     * @private
     */
    private async _getObject (key: string) {
        key = this._sanatizeKey(key);
        return this.getObjectAsync(key);
    }

    /**
     * _getState
     * @param key
     * @private
     */
    private async _getState (key: string) {
        key = this._sanatizeKey(key);
        return this.getStateAsync(key);
    }

    /**
     * _ebusParseDefinition
     * @param definition
     * @private
     */
    private _ebusParseDefinition (definition: string): IEbusMessageDefinition | undefined {
        const parts = definition.split(',');
        const messageParts = parts.slice(0, 8);
        const fieldParts = parts.slice(8);

        const messageHeaders = [
            {
                name: 'types',
                parse: (cell: string) => cell.split(';'),
                nameDef: 'TYPE'
            },
            {
                name: 'circuit',
                nameDef: 'CIRCUIT'
            },
            {
                name: 'name',
                nameDef: 'NAME'
            },
            {
                name: 'comment',
                nameDef: 'COMMENT'
            },
            {
                name: 'masterAddress',
                nameDef: 'QQ'
            },
            {
                name: 'destinationAddresses',
                nameDef: 'ZZ',
                parse: (cell: string) => cell.split(';')
            },
            {
                name: 'commandBytes',
                nameDef: 'PBSB'
            },
            {
                name: 'id',
                nameDef: 'ID'
            }
        ];

        const fieldHeaders = [
            {
                name: 'field',
                nameDef: 'FIELD'
            },
            {
                name: 'part',
                nameDef: 'PART'
            },
            {
                name: 'type',
                nameDef: 'DATATYPE'
            },
            {
                name: 'values',
                nameDef: 'DIVIDER/VALUES',
                parse: (cell: string) => {
                    const pairs = cell.split(';');
                    const values: any = {};
                    for (const pair of pairs) {
                        const [ key, value ] = pair.split('=') as string[];
                        values[key] = value;
                    }
                    return values;
                }
            },
            {
                name: 'unit',
                nameDef: 'UNIT'
            },
            {
                name: 'comment',
                nameDef: 'COMMENT'
            }
        ];

        const message: Partial<IEbusMessageDefinition> = {
            writable: false
        };
        for (const [ index, messageHeader ] of messageHeaders.entries()) {
            // @ts-ignore
            message[messageHeader.name] = messageHeader.parse ? messageHeader.parse(messageParts[index]) : messageParts[index];
        }

        const fields = [];
        let field: any = {};
        for (const [ index, fieldPart ] of fieldParts.entries()) {
            const fieldHeader = fieldHeaders[(index)%fieldHeaders.length];
            field[fieldHeader.name] = fieldHeader.parse ? fieldHeader.parse(fieldPart) : fieldPart;
            if (index > 0 && (index+1)%fieldHeaders.length === 0) {
                fields.push({ ...field });
                field = {};
            }
        }
        message.fields = fields;

        if (message?.types?.length) {
            for (const type of message.types) {
                if (type.startsWith('w')) {
                    message.writable = true;
                }
            }
        } else {
            return undefined;
        }
        return <IEbusMessageDefinition>message;
    }

    /**
     * create socket with ebus telnet port
     * @private
     */
    private async _ebusInitializeSocket () {
        if (this._socket) {
            return this._socket;
        }
        const socket = new net.Socket();
        this._socket = new PromiseSocket(socket);

        await this._socket.connect(parseInt(this.config.targetTelnetPort), this.config.targetIP);
        this.log.debug('telnet connected');
        return this._socket;
    }

    /**
     * send command to ebus using socket
     * @param command
     * @private
     */
    private async _ebusSend (command: string): Promise<string> {
        const socket = await this._ebusInitializeSocket();
        await socket.write(command + '\n');
        const response = await socket.read();
        return response?.toString() ?? '';
    }

    /**
     * _ebusCreateNewObject
     * @param key
     * @param messageName
     * @param message
     * @param circuit
     * @private
     */
    private async _ebusCreateNewObject (key: string, messageName: string, message: any, circuit: string) {
        const command = `find -w -f -c ${circuit} ${messageName}`;
        const rawDefinition = await this._ebusSend(command);
        let writable = false;
        let definition;
        if (rawDefinition && !rawDefinition.startsWith('ERR:')) {
            this.log.debug('_ebusCreateNewObject; for messageName "'+messageName+'" gor definition: '+rawDefinition);
            definition = this._ebusParseDefinition(rawDefinition);
            if (definition?.writable) {
                writable = true;
            }
        }
        await this._syncObject(key, IoBrokerCommonTypesEnum.STRING, IoBrokerObjectTypesEnum.CHANNEL, {
            common: {
                desc: messageName,
                custom: {
                    name: messageName,
                    [this.name + '.' + this.instance]: {
                        circuitName: circuit,
                        messageName: messageName,
                        write: writable,
                        passive: message.passive,
                        fieldDefs: message.fielddefs,
                        definition: definition
                    }
                }
            }
        } as any);
        return await this._getObject(key);
    }

    /**
     * get data from eBus
     * @private
     */
    private async _ebusGetData () {
        // maxage=1 retrieves all data
        // def=true delivers field definitions
        const ebusHttpRequestUrl = 'http://' + this.config.targetIP + ':' + parseInt(this.config.targetHTTPPort) + '/data?def=true&maxage=1';
        this.log.debug('request data from ' + ebusHttpRequestUrl);

        try {
            const ebusResponse = await axios.get(ebusHttpRequestUrl);

            this.log.debug('got data ' + typeof ebusResponse.data + ' ' + JSON.stringify(ebusResponse.data));

            type EbusData = {[key: string]: any};

            const ebusData: EbusData = ebusResponse.data;

            const nonDeviceSections = [
                /scan\.*/,
                'global',
                'broadcast'
            ];

            const errors: string[] = [];

            // todo deprecate
            const historyvalues: string[][] = [];
            const historydates: {date: string; time: string}[] = [];
            const historyDataPoints = this._historyDataPoints.map(historyDataPoint => 'circuit.' + historyDataPoint.circuit + '.' + historyDataPoint.name + '.fields.' + historyDataPoint.field);
            const oToday = new Date();
            historydates.push({
                date: oToday.getDate() + '.' + (oToday.getMonth() + 1) + '.' + oToday.getFullYear(),
                time: oToday.getHours() + ':' + oToday.getMinutes() + ':' + oToday.getSeconds()
            });

            const handleMessage = async (basePath: string[], messageName: string, message: any, circuit: string) => {
                const messagePath = [ ...basePath, messageName ];
                const key = messagePath.join('.');
                let existingObject = await this._getObject(key);
                if (!existingObject) {
                    existingObject = await this._ebusCreateNewObject(key, messageName, message, circuit);
                }
                if (message.lastup) {
                    const key = messagePath.join('.') + '.lastup';
                    await this._syncObject(key, IoBrokerCommonTypesEnum.NUMBER);
                    await this._updateState(key, message.lastup*1000);
                    if (parseInt(message.lastup) > 0) {

                        // Umrechnen...
                        const lastupDate = new Date(message.lastup * 1000);
                        const today = new Date();

                        if (![ 'currenterror' ].includes(message.name) &&Math.abs(lastupDate.getTime() - today.getTime()) > 60 * 60 * 1000) {
                            const sError1 = 'no update since ' + lastupDate.toLocaleString() + ' ' + key + ' ';
                            errors.push(sError1);
                            this.log.warn(sError1);
                        }

                    }

                }
                if (message.fields) {
                    for (const [ fieldName, field ] of Object.entries(message.fields as { [key: string]: any })) {
                        const stateFieldName = field.name || fieldName;
                        const fieldDef = message.fielddefs.find((fieldDef: any) => fieldDef.name === field.name);
                        let objectCommonType = IoBrokerCommonTypesEnum.STRING;
                        if (typeof field.value === 'number') {
                            objectCommonType = IoBrokerCommonTypesEnum.NUMBER;
                        }
                        const objectType = IoBrokerObjectTypesEnum.STATE;
                        const extendObject: any = {};
                        // find -f -c 430 Hc1OPMode
                        extendObject.common = {
                            // passive means it can be set, but only be the device itself
                            // "passive:true" could be a value that is set periodically by a thermostat
                            // So that it will be overwritten again, even after you set it
                            // this is why we set write only to true if passive is false and the fields are writable
                            write: existingObject?.common?.custom?.[this.name + '.' + this.instance]?.write && !message.passive,
                            custom: {
                                [this.name + '.' + this.instance]: {
                                    passive: message.passive,
                                    zz: message.zz,
                                    id: message.id,
                                    circuitName: circuit,
                                    messageName: messageName,
                                    fieldName: fieldName,
                                    field: field
                                }
                            }
                        };
                        if (fieldDef) {
                            // message types https://github.com/john30/ebusd/wiki/4.3.-Builtin-data-types
                            if (fieldDef.type === 'IGN') {
                                continue;
                            }
                            extendObject.common.name = fieldDef.name;
                            extendObject.common.desc = fieldDef.comment;
                            extendObject.common.unit = fieldDef.unit;
                            extendObject.common.custom[this.name + '.' + this.instance].fieldDef = fieldDef;
                            if (fieldDef.values) {
                                const states: any = {};
                                for (const value of Object.values(fieldDef.values) as string[]) {
                                    states[value] = value;
                                }
                                extendObject.common.role = 'state';
                                extendObject.common.states = states;
                            }
                            if (fieldDef.name === 'onoff' && this.config.useBoolean4Onoff) {
                                objectCommonType = IoBrokerCommonTypesEnum.BOOLEAN;
                                field.value = field.value === 'on';
                            }
                        }
                        const key = messagePath.join('.') + '.fields.' + stateFieldName;
                        await this._syncObject(key, objectCommonType, objectType, extendObject);
                        await this._updateState(key, field.value);

                        // todo deprecate me
                        {
                            if (historyDataPoints.includes(key)) {
                                const index = historyDataPoints.indexOf(key);
                                const sTemp = '{"' + key + '": "' + field.value + '"}';
                                historyvalues[index] = [];
                                historyvalues[index].push(JSON.parse(sTemp));
                            }
                        }
                    }
                }
            };

            for (const sectionName in ebusData) {
                const basePath = [];
                if (!nonDeviceSections.some(ignoreSection => sectionName.match(ignoreSection))) {
                    // i'm a circuit
                    basePath.push('circuit');
                    basePath.push(sectionName);
                    const key = basePath.join('.');
                    await this._syncObject(key, IoBrokerCommonTypesEnum.STRING, IoBrokerObjectTypesEnum.DEVICE, {
                        common: {
                            custom: {
                                name: sectionName,
                                [this.name + '.' + this.instance]: {
                                    circuitName: sectionName
                                }
                            }
                        }
                    } as any);
                    if (ebusData[sectionName].messages) {
                        for (const [ messageName, message ] of Object.entries(ebusData[sectionName].messages)) {
                            await handleMessage(basePath, messageName, message, sectionName);
                        }
                    }
                } else if (sectionName === 'broadcast') {
                    // i'm broadcast
                    basePath.push('broadcast');
                    if (ebusData[sectionName].messages) {
                        for (const [ messageName, message ] of Object.entries(ebusData[sectionName].messages)) {
                            await handleMessage(basePath, messageName, message, sectionName);
                        }
                    }
                } else if (sectionName === 'global') {
                    // i'm global
                    basePath.push('global');
                    for (const [ keyName, value ] of Object.entries(ebusData[sectionName] as {[key: string]: string})) {
                        const messagePath = [ ...basePath, keyName ];
                        const key = messagePath.join('.');
                        await this._syncObject(key, (typeof value === 'number' ? IoBrokerCommonTypesEnum.NUMBER : IoBrokerCommonTypesEnum.STRING));
                        await this._updateState(key, value);
                        if (keyName === 'updatecheck' && value) {
                            const version = (value.match(/v(\d*\.\d)/s) as string[])[1];

                            const versionInfo: string[] = version.split('.');
                            if (versionInfo.length > 1) {
                                this.log.info('found ebusd update version ' + versionInfo[0] + '.' + versionInfo[1] + 'updateCheck: ' + value);

                                this._ebusdUpdateVersion[0] = parseInt(versionInfo[0]);
                                this._ebusdUpdateVersion[1] = parseInt(versionInfo[1]);

                                this._versionCheck();
                            }
                        }
                        if (keyName === 'version') {
                            const versionInfo = value.split('.');
                            if (versionInfo.length > 1) {
                                this.log.info('installed ebusd version is ' + versionInfo[0] + '.' + versionInfo[1]);

                                this._ebusdVersion[0] = parseInt(versionInfo[0]);
                                this._ebusdVersion[1] = parseInt(versionInfo[1]);

                                this._versionCheck();
                            }
                        }
                    }

                }
            }

            // todo deprecate, rather use influx or rrd
            await this._updateHistory(historyvalues, historydates);

            await this._updateState('history.error', errors.join('\n'));

            this.log.info('all _ebusGetData done');
        } catch (e) {
            this.log.error('exception in _ebusGetData [' + e + ']');

            await this._updateState('history.error', 'exception in _ebusGetData');
        }
    }

    /**
     * _ebusRetrieveDataPoint
     * @param dataPoint
     * @param retries
     * @private
     */
    private async _ebusRetrieveDataPoint (dataPoint: IEbusDataPoint, retries = 0) {
        let circuit = '';
        let params = '';
        if (dataPoint.circuit) {
            circuit = '-c ' + dataPoint.circuit + ' ';
        }
        if (dataPoint.parameter) {
            params = ' ' + dataPoint.parameter;
        }
        const command = 'read -f ' + circuit + dataPoint.name + params;

        this.log.debug('send command ' + command);

        const data = await this._ebusSend(command);
        if (data && data.includes('ERR')) {
            this.log.warn('sent ' + command + ', received ' + data + ' for ' + JSON.stringify(dataPoint)
              + ' please check ebusd logs for details!');

            /*
            * sent read -f YieldLastYear, received ERR: arbitration lost for {"circuit":"","name":"YieldLastYear","parameter":""}
            * */
            if (data.includes('arbitration lost')) {

                retries++;
                if (retries > this.config.maxRetries) {
                    this.log.error('max retries, skip dataPoint ' + dataPoint.name);
                } else {
                    this.log.debug('retry to send data ');
                    await this._ebusRetrieveDataPoint(dataPoint, retries);
                }
            }
        } else {
            this.log.debug('received ' + data + ' for ' + JSON.stringify(dataPoint));
        }
    }

    /**
     * write changes to ebus device
     * @param key
     * @param state
     * @param object
     * @private
     */
    private async _eBusUpdateDataPoint (key: string, state: ioBroker.State) {
        this.log.debug('stateChanged; ' + key + ' to: ' + JSON.stringify(state));
        const messageKey = key.split('.').slice(0, -1).join('.');
        const circuitKey = messageKey.split('.').slice(0, -1).join('.');
        const messageObject = await this.getObjectAsync(circuitKey, messageKey);
        if (messageObject?.type === 'channel') {
            // cool
            const adapterData = messageObject?.common?.custom?.[this.name + '.' + this.instance] as any;
            if (adapterData?.fieldDefs) {
                const fieldStates = await this.getStatesAsync(messageKey + '.*');
                const writeValues = [];
                for (const field of adapterData.fieldDefs) {
                    const fieldState = fieldStates[messageKey + '.' + field.name];
                    if (fieldState) {
                        writeValues.push(fieldState.val);
                    } else {
                        this.log.error('stateChanged; field "'+field.name+'" not found in states, cant build complete command! exiting ' + key);
                        // todo handle errors better
                        return 'ERR: fieldConfig broken';
                    }
                }
                if (writeValues.length === adapterData.fieldDefs.length) {
                    // just to make sure
                    const writeValue = writeValues.join(';');
                    const command = `write -c ${adapterData.circuitName} ${adapterData.messageName} ${writeValue}`;
                    const result = await this._ebusSend(command);

                    this.log.info('stateChanged; ok updated ' + key + ' using this command: ' + command + ' got response: ' + result);
                    // set ack =  true
                    await this._updateState(key, state.val as string);
                    return 'OK: ' + result;
                }
            }
        } else {
            // what?
            this.log.error('stateChanged; dont know what to do ' + key);
        }
    }

    /**
     * _ebusPollDataPoints
     * @private
     */
    private async _ebusPollDataPoints () {
        if (this._pollingDataPoints.length > 0) {

            this.log.debug('datapoints to poll: ' + this._pollingDataPoints.length + ' vals:  ' + JSON.stringify(this._pollingDataPoints));

            try {
                for (const dataPoint of this._pollingDataPoints) {
                    await this._ebusRetrieveDataPoint(dataPoint);
                }
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

// If started as allInOne/compact mode => return function to create instance
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new EbusAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new EbusAdapter())();
}
