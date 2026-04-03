/* eslint-disable prefer-template */
import net from "net";

export default class TelnetClient {
    private socket: net.Socket;
    private connected: boolean;

    constructor() {
        this.socket = new net.Socket();
        this.connected = false;

        this.socket.on("error", (err: Error) => {
            console.error("Socket Error:", err);
        });
    }

    async connect(host: string, port: number): Promise<void> {
        if (this.connected) {
            return;
        }

        await new Promise<void>((resolve, reject) => {
            const onConnect = () => {
                this.connected = true;
                cleanup();
                resolve();
            };

            const onError = (err: Error) => {
                cleanup();
                reject(err);
            };

            const cleanup = () => {
                this.socket.removeListener("connect", onConnect);
                this.socket.removeListener("error", onError);
            };

            this.socket.once("connect", onConnect);
            this.socket.once("error", onError);

            this.socket.connect(port, host);
        });
    }

    async write(data: string): Promise<void> {
        if (!this.connected) {
            throw new Error("Socket not connected");
        }

        await new Promise<void>((resolve, reject) => {
            this.socket.write(data, (err?: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async read(timeoutMs = 4000): Promise<string> {
        if (!this.connected) {
            throw new Error("Socket not connected");
        }

        return new Promise<string>((resolve, reject) => {
            const onData = (data: Buffer) => {
                cleanup();
                resolve(data.toString());
            };

            const onError = (err: Error) => {
                cleanup();
                reject(err);
            };

            const onTimeout = () => {
                cleanup();
                reject(new Error("Read timeout"));
            };

            const cleanup = () => {
                clearTimeout(timer);
                this.socket.removeListener("data", onData);
                this.socket.removeListener("error", onError);
            };

            const timer = setTimeout(onTimeout, timeoutMs);

            this.socket.once("data", onData);
            this.socket.once("error", onError);
        });
    }

    async disconnect(): Promise<void> {
        if (!this.connected) return;

        await new Promise<void>((resolve) => {
            this.socket.end(() => {
                this.connected = false;
                resolve();
            });
        });
    }
}
