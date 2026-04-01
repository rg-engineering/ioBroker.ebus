// This file extends the AdapterConfig type from "@types/iobroker"






// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {

            targetIP: string,
            useBoolean4Onoff: boolean,
            DisableTimeUpdateCheck: boolean,
            History4Vis2: boolean,


            targetHTTPPort: number,
            targetTelnetPort: number,
            readInterval: number,
            parseTimeout: number,
            maxretries: number,

            HTTPparameter: HTTPparameter[],

            PolledDPs: polledDP[],
            Circuit4Find: string,

            HistoryDPs: historyDP[],
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};