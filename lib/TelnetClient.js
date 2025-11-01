/* eslint-disable prefer-template */
const net = require("net");

class TelnetClient {

    constructor() {
        this.socket = new net.Socket();
        this.connected = false;

        // Fehlerbehandlung
        this.socket.on("error", (err) => {
            console.error("Socket Error:", err);
        });
    }

    async connect(host, port) {
        if (this.connected) {
            return;
        }
        await new Promise((resolve, reject) => {
            this.socket.connect(port, host, () => {
                this.connected = true;
                resolve();
            });
            this.socket.once("error", reject);
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
                } else {
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
            const onData = (data) => {
                clearTimeout(timer);
                this.socket.removeListener("error", onError);
                resolve(data.toString());
            };

            const onError = (err) => {
                clearTimeout(timer);
                this.socket.removeListener("data", onData);
                reject(err);
            };

            const timer = setTimeout(() => {
                this.socket.removeListener("data", onData);
                this.socket.removeListener("error", onError);
                reject(new Error("Read timeout"));
            }, timeoutMs);

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

module.exports = TelnetClient;