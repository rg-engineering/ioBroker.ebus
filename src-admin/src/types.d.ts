/* eslint-disable prettier/prettier */
//ist das gleiche interface wie in adapter-config.d.ts



interface HTTPparameter {
    active: boolean,
    name: string,
    value: string
}




export interface ebusAdapterConfig extends ioBroker.AdapterConfig {
    /** Configuration of the adapter */

    
    targetIP: string,
    useBoolean4Onoff: boolean,
    DisableTimeUpdateCheck: boolean,
    History4Vis2: boolean,


    targetHTTPPort: number,
    targetTelnetPort: number,
    readInterval: number,
    parseTimeout: number,
    maxretries: number,

    HTTPparameter: HTTPparameter[]
  

    
}