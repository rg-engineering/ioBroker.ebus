"use strict";
/*
 * ebus adapter für iobroker
 *
 * Created: 15.09.2016 21:31:28
 *  Author: Rene
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_core_1 = require("@iobroker/adapter-core");
const axios_1 = __importDefault(require("axios"));
// @ts-ignore
const net_1 = __importDefault(require("net"));
const promise_socket_1 = require("promise-socket");
var IoBrokerCommonTypesEnum;
(function (IoBrokerCommonTypesEnum) {
    IoBrokerCommonTypesEnum["NUMBER"] = "number";
    IoBrokerCommonTypesEnum["STRING"] = "string";
    IoBrokerCommonTypesEnum["BOOLEAN"] = "boolean";
    IoBrokerCommonTypesEnum["ARRAY"] = "array";
    IoBrokerCommonTypesEnum["OBJECT"] = "object";
    IoBrokerCommonTypesEnum["MIXED"] = "mixed";
    IoBrokerCommonTypesEnum["FILE"] = "file";
})(IoBrokerCommonTypesEnum || (IoBrokerCommonTypesEnum = {}));
var IoBrokerObjectTypesEnum;
(function (IoBrokerObjectTypesEnum) {
    IoBrokerObjectTypesEnum["STATE"] = "state";
    IoBrokerObjectTypesEnum["CHANNEL"] = "channel";
    IoBrokerObjectTypesEnum["DEVICE"] = "device";
    IoBrokerObjectTypesEnum["FOLDER"] = "folder";
    IoBrokerObjectTypesEnum["ENUM"] = "enum";
    IoBrokerObjectTypesEnum["ADAPTER"] = "adapter";
    IoBrokerObjectTypesEnum["CONFIG"] = "config";
    IoBrokerObjectTypesEnum["GROUP"] = "group";
    IoBrokerObjectTypesEnum["HOST"] = "host";
    IoBrokerObjectTypesEnum["INSTANCE"] = "instance";
    IoBrokerObjectTypesEnum["META"] = "meta";
    IoBrokerObjectTypesEnum["SCRIPT"] = "script";
    IoBrokerObjectTypesEnum["USER"] = "user";
    IoBrokerObjectTypesEnum["CHART"] = "chart";
})(IoBrokerObjectTypesEnum || (IoBrokerObjectTypesEnum = {}));
class EbusAdapter extends adapter_core_1.Adapter {
    /**
     * The constructor
     * @param options
     */
    constructor(options) {
        options = Object.assign({ options }, {
            name: 'ebus'
        });
        super(options);
        this._pollingDataPoints = [];
        this._historyDataPoints = [];
        this._ebusdMinVersion = [22, 3];
        this._ebusdVersion = [0, 0];
        this._ebusdUpdateVersion = [0, 0];
        this._initialized = false;
        this.config = Object.assign({ allowWrites: false, targetTelnetPort: '8888', maxRetries: 5, readInterval: '5', targetHTTPPort: '8889', targetIP: '127.0.0.1', useBoolean4Onoff: false }, super.config);
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
    _destroy(callback) {
        var _a;
        this.log.info('cleaned everything up...');
        clearInterval(this._intervalId);
        (_a = this._socket) === null || _a === void 0 ? void 0 : _a.destroy();
        callback();
    }
    /**
     * start the adapter
     * @private
     */
    _main() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._initialized) {
                this.log.warn('_main was called twice?? should not happen');
                return;
            }
            this._initialized = true;
            this.log.debug('start with interface ebusd ');
            yield this._initializeObjects();
            yield this._ebusInitializeSocket();
            this._preparePolledDataPoints();
            this._prepareHistoryDataPoints();
            yield this._ebusPollDataPoints();
            this._subscribeStates(['cmd']);
            if (this.config.allowWrites) {
                this._subscribeStates(['*']);
            }
            let readInterval = 5;
            if (parseInt(this.config.readInterval) > 0) {
                readInterval = parseInt(this.config.readInterval);
            }
            this.log.debug('read every  ' + readInterval + ' minutes');
            this._intervalId = setInterval(this._doPeriodic.bind(this), readInterval * 60 * 1000);
            void this._doPeriodic();
        });
    }
    /**
     * stuff we do on the interval
     * @private
     */
    _doPeriodic() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug('starting ... ');
            yield this._ebusPollDataPoints();
            yield this._ebusGetData();
        });
    }
    /**
     * handle change of a state
     * @param id
     * @param state
     * @private
     */
    _handleStateChange(id, state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (state && !state.ack) {
                this.log.debug('handle state change ' + id);
                const ids = id.split('.');
                if (ids[2] === 'cmd') {
                    yield this._handleCommandChange(state);
                }
                else {
                    const object = yield this._getObject(id);
                    if (object && object.common.write) {
                        yield this._eBusUpdateDataPoint(id, state, object);
                    }
                    else {
                        this.log.warn('unhandled state change ' + id + ' state: ' + JSON.stringify(state));
                    }
                }
            }
        });
    }
    /**
     * send command to eBus using telnet
     * @private
     */
    _handleCommandChange(state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!state) {
                state = yield this._getState('cmd');
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
                                const data = yield this._ebusSend(command);
                                if (data === null || data === void 0 ? void 0 : data.includes('ERR')) {
                                    this.log.warn('sent ' + command + ', received ' + data + ' please check ebusd logs for details!');
                                }
                                else {
                                    this.log.debug('received ' + data);
                                }
                                received.push(data);
                            }
                            yield this.setStateAsync('cmdResult', { ack: true, val: JSON.stringify(received) });
                        }
                        else {
                            this.log.warn('no commands in list ' + state.val + ' ' + JSON.stringify(commands));
                        }
                        yield this.setStateAsync('cmd', { ack: true, val: '' });
                    }
                    catch (e) {
                        this.log.error('exception from tcp socket' + '[' + e + ']');
                    }
                }
            }
            else {
                this.log.debug('object cmd not found ' + JSON.stringify(state));
            }
        });
    }
    /**
     * check compatibility
     * @private
     */
    _versionCheck() {
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
    _preparePolledDataPoints() {
        var _a, _b;
        if ((_b = (_a = this === null || this === void 0 ? void 0 : this.config) === null || _a === void 0 ? void 0 : _a.PolledDPs) === null || _b === void 0 ? void 0 : _b.length) {
            this.log.debug('use new object list for polled vars');
            this._pollingDataPoints = this.config.PolledDPs;
        }
    }
    /**
     * _prepareHistoryDataPoints
     * @private
     */
    _prepareHistoryDataPoints() {
        var _a, _b;
        if ((_b = (_a = this === null || this === void 0 ? void 0 : this.config) === null || _a === void 0 ? void 0 : _a.HistoryDPs) === null || _b === void 0 ? void 0 : _b.length) {
            this.log.debug('use new object list for history vars');
            this._historyDataPoints = this.config.HistoryDPs;
        }
    }
    /**
     * _subscribeStates
     * @private
     */
    _subscribeStates(states) {
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
    _createObject(key, obj) {
        return __awaiter(this, void 0, void 0, function* () {
            const obj_new = yield this.getObjectAsync(key);
            // this.log.warn("got object " + JSON.stringify(obj_new));
            if (obj_new != null) {
                if ((obj_new.common.role != obj.common.role
                    || obj_new.common.type != obj.common.type
                    || (obj_new.common.unit != obj.common.unit && obj.common.unit != null)
                    || obj_new.common.read != obj.common.read
                    || obj_new.common.write != obj.common.write
                    || obj_new.common.name != obj.common.name)
                    && obj.type === 'state') {
                    this.log.warn('change object ' + JSON.stringify(obj) + ' ' + JSON.stringify(obj_new));
                    yield this.extendObject(key, {
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
            }
            else {
                yield this.setObjectNotExistsAsync(key, obj);
            }
        });
    }
    /**
     * _initializeObjects
     * @private
     */
    _initializeObjects() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug('init variables ');
            let key = 'cmd';
            let obj = {
                type: 'state',
                common: {
                    name: 'ebusd command',
                    type: 'string',
                    role: 'text',
                    read: true,
                    write: true
                }
            };
            yield this._createObject(key, obj);
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
            yield this._createObject(key, obj);
            this.log.debug('init common variables and ' + this._historyDataPoints.length + " history DP's");
            if (this._historyDataPoints.length > 0) {
                if (this._historyDataPoints.length > 4) {
                    this.log.warn('too many history values ' + this._historyDataPoints.length + ' -> maximum is  4');
                }
                for (let n = 1; n <= this._historyDataPoints.length; n++) {
                    if (this._historyDataPoints[n - 1].name.length > 0) {
                        const name = 'history value ' + n + ' as JSON ' + this._historyDataPoints[n - 1].name;
                        key = 'history.value' + n;
                        obj = {
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
                        yield this._createObject(key, obj);
                    }
                    else {
                        this.log.warn('ignoring history value ' + n + ' (invalid name)');
                    }
                }
                key = 'history.date';
                obj = {
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
                yield this._createObject(key, obj);
            }
            key = 'history.error';
            obj = {
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
            yield this._createObject(key, obj);
        });
    }
    /**
     * _updateHistory
     * @deprecated
     * @param values
     * @param dates
     * @private
     */
    _updateHistory(values, dates) {
        return __awaiter(this, void 0, void 0, function* () {
            // todo removeme
            if (this._historyDataPoints.length > 0) {
                // prüfen ob alle json gleich lang sind
                let newHistoryStateDatesLength = -1;
                const historyStateDates = yield this.getStateAsync('history.date');
                if (historyStateDates && historyStateDates.val) {
                    try {
                        let newHistoryStateDates = [];
                        // this.log.debug("before " + obj.val);
                        newHistoryStateDates = JSON.parse(historyStateDates.val);
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
                        yield this.setStateAsync('history.date', { ack: true, val: JSON.stringify(newHistoryStateDates) });
                    }
                    catch (e) {
                        this.log.error('exception in UpdateHistory part1 [' + e + ']');
                        yield this.setStateAsync('history.date', { ack: true, val: '[]' });
                        newHistoryStateDatesLength = 0;
                    }
                }
                else {
                    this.log.warn('history.date not found, creating DP ');
                    yield this.setStateAsync('history.date', { ack: true, val: '[]' });
                    newHistoryStateDatesLength = 0;
                }
                if (this._historyDataPoints.length > 0) {
                    let index = 0;
                    for (const historyDataPoint of this._historyDataPoints) {
                        if (historyDataPoint.name) {
                            const historyValueChanged = yield this._updateHistoryValue(values, index, newHistoryStateDatesLength);
                            if (historyValueChanged) {
                                yield this.setStateAsync('history.date', { ack: true, val: '[]' });
                                newHistoryStateDatesLength = 0;
                                this.log.warn('reset history date too');
                            }
                        }
                        else {
                            this.log.debug('ignoring history value ' + index);
                        }
                        index++;
                    }
                    this.log.info('all history done');
                }
            }
            else {
                this.log.debug('nothing to do for history');
            }
        });
    }
    /**
     * _updateHistoryValue
     * @deprecated
     * @param values
     * @param index
     * @param numberOfDates
     * @private
     */
    _updateHistoryValue(values, index, numberOfDates) {
        return __awaiter(this, void 0, void 0, function* () {
            let historyValueReset = false;
            const key = 'history.value' + index;
            const historyState = yield this.getStateAsync(key);
            if (historyState && historyState.val) {
                try {
                    let newHistoryStateValues = [];
                    // this.log.debug("before " + historyState.val);
                    newHistoryStateValues = JSON.parse(historyState.val);
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
                    }
                    else {
                        yield this.setStateAsync(key, { ack: true, val: JSON.stringify(newHistoryStateValues) });
                    }
                }
                catch (e) {
                    this.log.error('exception in UpdateHistory part2 [' + e + ']');
                    if (numberOfDates > 0) {
                        historyValueReset = true;
                    }
                }
            }
            else {
                this.log.warn('history.value' + index + ' not found, creating DP ' + JSON.stringify(historyState));
                if (numberOfDates > 0) {
                    historyValueReset = true;
                }
            }
            if (historyValueReset) {
                yield this.setStateAsync(key, { ack: true, val: '[]' });
            }
            return historyValueReset;
        });
    }
    /**
     * remove forbidden characters
     * @param key
     * @private
     */
    _sanatizeKey(key) {
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
    _syncObject(key, objectCommonType, objectType = 'state', extendObject = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            key = this._sanatizeKey(key);
            try {
                const existingObject = yield this.getObjectAsync(key);
                if (existingObject) {
                    // this.log.debug(" got Object " + JSON.stringify(existingObject));
                    if (existingObject.common.role != 'value'
                        || existingObject.common.type != objectCommonType) {
                        // either objectCommonType or role does not match existing object, updating..
                        this.log.debug(' !!! need to extend for ' + key);
                        yield this.extendObject(key, {
                            common: {
                                type: objectCommonType,
                                role: 'value'
                            }
                        });
                    }
                }
                else {
                    this.log.warn(' !!! does not exist, creating now ' + key);
                    yield this.setObjectNotExistsAsync(key, Object.assign(Object.assign({}, extendObject), { type: objectType, common: Object.assign({ name: 'data', type: objectCommonType, role: 'value', unit: '', read: true, write: false }, extendObject.common), native: {
                            location: key
                        } }));
                }
            }
            catch (e) {
                this.log.error('exception in AddObject ' + '[' + e + ']');
            }
        });
    }
    /**
     * _updateState
     * @param key
     * @param value
     * @private
     */
    _updateState(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            key = this._sanatizeKey(key);
            try {
                if (typeof value == undefined) {
                    this.log.warn('updateObject: not updated ' + key + ' value: ' + value + ' ' + typeof value);
                }
                else if (value == null) {
                    this.log.debug('updateObject: update to null ' + key + ' value: ' + value);
                    yield this.setStateAsync(key, { ack: true, val: null });
                }
                else {
                    this.log.debug('updateObject ' + key + ' : ' + value);
                    yield this.setStateAsync(key, { ack: true, val: value });
                }
            }
            catch (e) {
                this.log.error('exception in UpdateObject ' + '[' + e + ']');
            }
        });
    }
    /**
     * _getObject
     * @param key
     * @private
     */
    _getObject(key) {
        return __awaiter(this, void 0, void 0, function* () {
            key = this._sanatizeKey(key);
            return this.getObjectAsync(key);
        });
    }
    /**
     * _getState
     * @param key
     * @private
     */
    _getState(key) {
        return __awaiter(this, void 0, void 0, function* () {
            key = this._sanatizeKey(key);
            return this.getStateAsync(key);
        });
    }
    /**
     * _ebusParseDefinition
     * @param definition
     * @private
     */
    _ebusParseDefinition(definition) {
        var _a;
        const parts = definition.split(',');
        const messageParts = parts.slice(0, 8);
        const fieldParts = parts.slice(8);
        const messageHeaders = [
            {
                name: 'types',
                parse: (cell) => cell.split(';'),
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
                parse: (cell) => cell.split(';')
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
                parse: (cell) => {
                    const pairs = cell.split(';');
                    const values = {};
                    for (const pair of pairs) {
                        const [key, value] = pair.split('=');
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
        const message = {
            writable: false
        };
        for (const [index, messageHeader] of messageHeaders.entries()) {
            // @ts-ignore
            message[messageHeader.name] = messageHeader.parse ? messageHeader.parse(messageParts[index]) : messageParts[index];
        }
        const fields = [];
        let field = {};
        for (const [index, fieldPart] of fieldParts.entries()) {
            const fieldHeader = fieldHeaders[(index) % fieldHeaders.length];
            field[fieldHeader.name] = fieldHeader.parse ? fieldHeader.parse(fieldPart) : fieldPart;
            if (index > 0 && (index + 1) % fieldHeaders.length === 0) {
                fields.push(Object.assign({}, field));
                field = {};
            }
        }
        message.fields = fields;
        if ((_a = message === null || message === void 0 ? void 0 : message.types) === null || _a === void 0 ? void 0 : _a.length) {
            for (const type of message.types) {
                if (type.startsWith('w')) {
                    message.writable = true;
                }
            }
        }
        else {
            return undefined;
        }
        return message;
    }
    /**
     * create socket with ebus telnet port
     * @private
     */
    _ebusInitializeSocket() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._socket) {
                return this._socket;
            }
            const socket = new net_1.default.Socket();
            this._socket = new promise_socket_1.PromiseSocket(socket);
            yield this._socket.connect(parseInt(this.config.targetTelnetPort), this.config.targetIP);
            this.log.debug('telnet connected');
            return this._socket;
        });
    }
    /**
     * send command to ebus using socket
     * @param command
     * @private
     */
    _ebusSend(command) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const socket = yield this._ebusInitializeSocket();
            yield socket.write(command + '\n');
            const response = yield socket.read();
            return (_a = response === null || response === void 0 ? void 0 : response.toString()) !== null && _a !== void 0 ? _a : '';
        });
    }
    /**
     * _ebusCreateNewObject
     * @param key
     * @param messageName
     * @param message
     * @param circuit
     * @private
     */
    _ebusCreateNewObject(key, messageName, message, circuit) {
        return __awaiter(this, void 0, void 0, function* () {
            const command = `find -w -f -c ${circuit} ${messageName}`;
            const rawDefinition = yield this._ebusSend(command);
            let writable = false;
            let definition;
            if (rawDefinition && !rawDefinition.startsWith('ERR:')) {
                this.log.debug('_ebusCreateNewObject; for messageName "' + messageName + '" gor definition: ' + rawDefinition);
                definition = this._ebusParseDefinition(rawDefinition);
                if (definition === null || definition === void 0 ? void 0 : definition.writable) {
                    writable = true;
                }
            }
            yield this._syncObject(key, IoBrokerCommonTypesEnum.STRING, IoBrokerObjectTypesEnum.CHANNEL, {
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
            });
            return yield this._getObject(key);
        });
    }
    /**
     * get data from eBus
     * @private
     */
    _ebusGetData() {
        return __awaiter(this, void 0, void 0, function* () {
            // maxage=1 retrieves all data
            // def=true delivers field definitions
            const ebusHttpRequestUrl = 'http://' + this.config.targetIP + ':' + parseInt(this.config.targetHTTPPort) + '/data?def=true&maxage=1';
            this.log.debug('request data from ' + ebusHttpRequestUrl);
            try {
                const ebusResponse = yield axios_1.default.get(ebusHttpRequestUrl);
                this.log.debug('got data ' + typeof ebusResponse.data + ' ' + JSON.stringify(ebusResponse.data));
                const ebusData = ebusResponse.data;
                const nonDeviceSections = [
                    /scan\.*/,
                    'global',
                    'broadcast'
                ];
                const errors = [];
                // todo deprecate
                const historyvalues = [];
                const historydates = [];
                const historyDataPoints = this._historyDataPoints.map(historyDataPoint => 'circuit.' + historyDataPoint.circuit + '.' + historyDataPoint.name + '.fields.' + historyDataPoint.field);
                const oToday = new Date();
                historydates.push({
                    date: oToday.getDate() + '.' + (oToday.getMonth() + 1) + '.' + oToday.getFullYear(),
                    time: oToday.getHours() + ':' + oToday.getMinutes() + ':' + oToday.getSeconds()
                });
                const handleMessage = (basePath, messageName, message, circuit) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c;
                    const messagePath = [...basePath, messageName];
                    const key = messagePath.join('.');
                    let existingObject = yield this._getObject(key);
                    if (!existingObject) {
                        existingObject = yield this._ebusCreateNewObject(key, messageName, message, circuit);
                    }
                    if (message.lastup) {
                        const key = messagePath.join('.') + '.lastup';
                        yield this._syncObject(key, IoBrokerCommonTypesEnum.NUMBER);
                        yield this._updateState(key, message.lastup * 1000);
                        if (parseInt(message.lastup) > 0) {
                            // Umrechnen...
                            const lastupDate = new Date(message.lastup * 1000);
                            const today = new Date();
                            if (!['currenterror'].includes(message.name) && Math.abs(lastupDate.getTime() - today.getTime()) > 60 * 60 * 1000) {
                                const sError1 = 'no update since ' + lastupDate.toLocaleString() + ' ' + key + ' ';
                                errors.push(sError1);
                                this.log.warn(sError1);
                            }
                        }
                    }
                    if (message.fields) {
                        for (const [fieldName, field] of Object.entries(message.fields)) {
                            const stateFieldName = field.name || fieldName;
                            const fieldDef = message.fielddefs.find((fieldDef) => fieldDef.name === field.name);
                            let objectCommonType = IoBrokerCommonTypesEnum.STRING;
                            if (typeof field.value === 'number') {
                                objectCommonType = IoBrokerCommonTypesEnum.NUMBER;
                            }
                            const objectType = IoBrokerObjectTypesEnum.STATE;
                            const extendObject = {};
                            // find -f -c 430 Hc1OPMode
                            extendObject.common = {
                                // passive means it can be set, but only be the device itself
                                // "passive:true" could be a value that is set periodically by a thermostat
                                // So that it will be overwritten again, even after you set it
                                // this is why we set write only to true if passive is false and the fields are writable
                                write: ((_c = (_b = (_a = existingObject === null || existingObject === void 0 ? void 0 : existingObject.common) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b[this.name + '.' + this.instance]) === null || _c === void 0 ? void 0 : _c.write) && !message.passive,
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
                                    const states = {};
                                    for (const value of Object.values(fieldDef.values)) {
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
                            yield this._syncObject(key, objectCommonType, objectType, extendObject);
                            yield this._updateState(key, field.value);
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
                });
                for (const sectionName in ebusData) {
                    const basePath = [];
                    if (!nonDeviceSections.some(ignoreSection => sectionName.match(ignoreSection))) {
                        // i'm a circuit
                        basePath.push('circuit');
                        basePath.push(sectionName);
                        const key = basePath.join('.');
                        yield this._syncObject(key, IoBrokerCommonTypesEnum.STRING, IoBrokerObjectTypesEnum.DEVICE, {
                            common: {
                                custom: {
                                    name: sectionName,
                                    [this.name + '.' + this.instance]: {
                                        circuitName: sectionName
                                    }
                                }
                            }
                        });
                        if (ebusData[sectionName].messages) {
                            for (const [messageName, message] of Object.entries(ebusData[sectionName].messages)) {
                                yield handleMessage(basePath, messageName, message, sectionName);
                            }
                        }
                    }
                    else if (sectionName === 'broadcast') {
                        // i'm broadcast
                        basePath.push('broadcast');
                        if (ebusData[sectionName].messages) {
                            for (const [messageName, message] of Object.entries(ebusData[sectionName].messages)) {
                                yield handleMessage(basePath, messageName, message, sectionName);
                            }
                        }
                    }
                    else if (sectionName === 'global') {
                        // i'm global
                        basePath.push('global');
                        for (const [keyName, value] of Object.entries(ebusData[sectionName])) {
                            const messagePath = [...basePath, keyName];
                            const key = messagePath.join('.');
                            yield this._syncObject(key, (typeof value === 'number' ? IoBrokerCommonTypesEnum.NUMBER : IoBrokerCommonTypesEnum.STRING));
                            yield this._updateState(key, value);
                            if (keyName === 'updatecheck' && value) {
                                const version = value.match(/v(\d*\.\d)/s)[1];
                                const versionInfo = version.split('.');
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
                yield this._updateHistory(historyvalues, historydates);
                yield this._updateState('history.error', errors.join('\n'));
                this.log.info('all _ebusGetData done');
            }
            catch (e) {
                this.log.error('exception in _ebusGetData [' + e + ']');
                yield this._updateState('history.error', 'exception in _ebusGetData');
            }
        });
    }
    /**
     * _ebusRetrieveDataPoint
     * @param dataPoint
     * @param retries
     * @private
     */
    _ebusRetrieveDataPoint(dataPoint, retries = 0) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const data = yield this._ebusSend(command);
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
                    }
                    else {
                        this.log.debug('retry to send data ');
                        yield this._ebusRetrieveDataPoint(dataPoint, retries);
                    }
                }
            }
            else {
                this.log.debug('received ' + data + ' for ' + JSON.stringify(dataPoint));
            }
        });
    }
    /**
     * write changes to ebus device
     * @param key
     * @param state
     * @param object
     * @private
     */
    _eBusUpdateDataPoint(key, state, object) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug('stateChanged; ' + key + ' to: ' + JSON.stringify(state));
            const messageKey = key.split('.').slice(0, -2).join('.');
            const messageObject = yield this.getObjectAsync(messageKey);
            this.log.debug('stateChanged; for messageKey: ' + messageKey + ' we got this object: ' + JSON.stringify(messageObject));
            if (((_a = messageObject === null || messageObject === void 0 ? void 0 : messageObject.common) === null || _a === void 0 ? void 0 : _a.name) === ((_d = (_c = (_b = object === null || object === void 0 ? void 0 : object.common) === null || _b === void 0 ? void 0 : _b.custom) === null || _c === void 0 ? void 0 : _c[this.name + '.' + this.instance]) === null || _d === void 0 ? void 0 : _d.name)) {
                // cool
                const adapterData = (_f = (_e = messageObject === null || messageObject === void 0 ? void 0 : messageObject.common) === null || _e === void 0 ? void 0 : _e.custom) === null || _f === void 0 ? void 0 : _f[this.name + '.' + this.instance];
                if (adapterData === null || adapterData === void 0 ? void 0 : adapterData.fieldDefs) {
                    const fieldStates = yield this.getStatesAsync(messageKey + '.fields.*');
                    this.log.debug('stateChanged; for messageKey: ' + messageKey + ' we got this fields: ' + JSON.stringify(fieldStates));
                    const writeValues = [];
                    for (const field of adapterData.fieldDefs) {
                        const fieldState = fieldStates[messageKey + '.' + field.name];
                        if (fieldState) {
                            writeValues.push(fieldState.val);
                        }
                        else {
                            this.log.error('stateChanged; field "' + field.name + '" not found in states, cant build complete command! exiting ' + key);
                            // todo handle errors better
                            return 'ERR: fieldConfig broken';
                        }
                    }
                    if (writeValues.length === adapterData.fieldDefs.length) {
                        // just to make sure
                        const writeValue = writeValues.join(';');
                        const command = `write -c ${adapterData.circuitName} ${adapterData.messageName} ${writeValue}`;
                        const result = yield this._ebusSend(command);
                        this.log.info('stateChanged; ok updated ' + key + ' using this command: ' + command + ' got response: ' + result);
                        // set ack =  true
                        yield this._updateState(key, state.val);
                        return 'OK: ' + result;
                    }
                }
            }
            else {
                // what?
                this.log.error('stateChanged; dont know what to do ' + key);
            }
        });
    }
    /**
     * _ebusPollDataPoints
     * @private
     */
    _ebusPollDataPoints() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._pollingDataPoints.length > 0) {
                this.log.debug('datapoints to poll: ' + this._pollingDataPoints.length + ' vals:  ' + JSON.stringify(this._pollingDataPoints));
                try {
                    for (const dataPoint of this._pollingDataPoints) {
                        yield this._ebusRetrieveDataPoint(dataPoint);
                    }
                }
                catch (e) {
                    this.log.error('exception from tcp socket in ebusd_ReadValues ' + '[' + e + ']');
                }
            }
            else {
                this.log.debug('nothing to poll; skip telnet');
            }
        });
    }
}
// If started as allInOne/compact mode => return function to create instance
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new EbusAdapter(options);
}
else {
    // otherwise start the instance directly
    (() => new EbusAdapter())();
}
