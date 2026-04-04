"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable prefer-template */
/* eslint-disable @typescript-eslint/no-use-before-define */
const net_1 = __importDefault(require("net"));
class TelnetClient {
    socket;
    connected;
    constructor() {
        this.socket = new net_1.default.Socket();
        this.connected = false;
        this.socket.on("error", (err) => {
            console.error("Socket Error:", err);
        });
    }
    async connect(host, port) {
        if (this.connected) {
            return;
        }
        await new Promise((resolve, reject) => {
            const cleanup = () => {
                this.socket.removeListener("connect", onConnect);
                this.socket.removeListener("error", onError);
            };
            const onConnect = () => {
                this.connected = true;
                cleanup();
                resolve();
            };
            const onError = (err) => {
                cleanup();
                reject(err);
            };
            this.socket.once("connect", onConnect);
            this.socket.once("error", onError);
            this.socket.connect(port, host);
        });
    }
    async write(data) {
        if (!this.connected) {
            throw new Error("Socket not connected");
        }
        await new Promise((resolve, reject) => {
            this.socket.write(data, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    async read(timeoutMs = 4000) {
        if (!this.connected) {
            throw new Error("Socket not connected");
        }
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timer);
                this.socket.removeListener("data", onData);
                this.socket.removeListener("error", onError);
            };
            const onData = (data) => {
                cleanup();
                resolve(data.toString());
            };
            const onError = (err) => {
                cleanup();
                reject(err);
            };
            const onTimeout = () => {
                cleanup();
                reject(new Error("Read timeout"));
            };
            const timer = setTimeout(onTimeout, timeoutMs);
            this.socket.once("data", onData);
            this.socket.once("error", onError);
        });
    }
    async disconnect() {
        if (!this.connected) {
            return;
        }
        await new Promise((resolve) => {
            this.socket.end(() => {
                this.connected = false;
                resolve();
            });
        });
    }
}
exports.default = TelnetClient;
//# sourceMappingURL=TelnetClient.js.map