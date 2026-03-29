/* eslint-disable prefer-template */
/* eslint-disable quote-props */
/* eslint-disable prettier/prettier */
import React from 'react';

import type { AdminConnection, IobTheme, ThemeName, ThemeType } from '@iobroker/adapter-react-v5';
import { type ConfigItemPanel, JsonConfigComponent } from '@iobroker/json-config';
import type { ebusAdapterConfig } from "../types";


interface SettingsProps {
    common: ioBroker.InstanceCommon;
    native: ebusAdapterConfig;
    instance: number;
    adapterName: string;
    socket: AdminConnection;
    changeNative: (native: ioBroker.AdapterConfig) => void;
    themeName: ThemeName;
    themeType: ThemeType;
    theme: IobTheme;
    systemConfig: ioBroker.SystemConfigObject;
    alive: boolean;
}


const schema: ConfigItemPanel = {
    type: 'panel',
    label: 'ebusd settings',
    items: {
        "ebusdhint": {
            "type": "staticText",
            "text": "hint_ebusd",
            "newLine": true,
            "xs": 12,
            "sm": 12,
            "md": 12,
            "lg": 12,
            "xl": 12

        },

        "dividerHdr2": {
            "newLine": true,
            "type": "header",
            "text": "ebusd configuration",
            "size": 2
        },
        "targetHTTPPort": {
            "newLine": true,
            "type": "number",
            "label": "target_HTTPPort",
            "min": 1,
            "max": 9999,
            "default": 8889,
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },
        "targetTelnetPort": {
            "newLine": true,
            "type": "number",
            "label": "target_TelnetPort",
            "min": 1,
            "max": 9999,
            "default": 8890,
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },
        "readInterval": {
            "newLine": true,
            "type": "number",
            "label": "readInterval",
            "min": 1,
            "max": 300,
            "default": 5,
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },
        "parseTimeout": {
            "newLine": true,
            "type": "number",
            "label": "parse_timeout",
            "min": 30,
            "max": 300,
            "default": 60,
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },
        "maxretries": {
            "newLine": true,
            "type": "number",
            "label": "maxretries",
            "min": 0,
            "max": 10,
            "default": 3,
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },


        "dividerHdr3": {
            "newLine": true,
            "type": "header",
            "text": "optional HTTP parameter configuration",
            "size": 2
        },

        "ebusdhint2": {
            "type": "staticText",
            "text": "hint_ebusd2",
            "newLine": true,
            "xs": 12,
            "sm": 12,
            "md": 12,
            "lg": 12,
            "xl": 12

        },
        "staticLink2ebusd": {
            "type": "staticLink",
            "text": "details of HTTP paramter on ebusd wiki",
            "href": "https://github.com/john30/ebusd/wiki/3.2.-HTTP-client",
            "icon": "info",
            "newLine": true,
            "xs": 12,
            "sm": 12,
            "md": 6,
            "lg": 4,
            "xl": 4
        },


        "HTTPparameter": {
            "type": "table",
            "newLine": true,
            "xs": 12,
            "sm": 12,
            "md": 12,
            "lg": 12,
            "xl": 12,
            "label": "optional HTTP parameter",
            "showSecondAddAt": 5,
            "noDelete": true,

            "items": [
                {
                    "type": "checkbox",
                    "attr": "active",
                    "width": "5% ",
                    "title": "active",
                    "tooltip": "enable parameter",
                    "filter": false,
                    "sort": false,
                    "default": false
                },
                {
                    "type": "text",
                    "attr": "name",
                    "width": "20% ",
                    "title": "name",
                    "tooltip": "optional parameter name",
                    "filter": false,
                    "sort": false,
                    "readOnly": true,
                    "default": ""
                },
                {
                    "type": "text",
                    "attr": "value",
                    "width": "20% ",
                    "title": "value",
                    "tooltip": "optional parameter value",
                    "filter": false,
                    "sort": false,
                    "readOnly": false,
                    "default": ""
                }
            ]
        }

    }
}


export default function ebusdSettings(props: SettingsProps): React.JSX.Element {


    console.log("settings: " + JSON.stringify(props.native));

    return (
        <div style={{ width: 'calc(100% - 8px)', minHeight: '100%' }}>
            <JsonConfigComponent
                common={props.common}
                socket={props.socket}
                themeName={props.themeName}
                themeType={props.themeType}
                adapterName="heatingcontrol"
                instance={props.instance || 0}
                isFloatComma={props.systemConfig.common.isFloatComma}
                dateFormat={props.systemConfig.common.dateFormat}
                schema={schema}
                onChange={(params): void => {

                    console.log("ebusdSettings onChange params: " + JSON.stringify(params));

                    const native: ebusAdapterConfig = JSON.parse(JSON.stringify(props.native));
                    //console.log("MainSettings onChange native: " + JSON.stringify(native));


                    native.targetHTTPPort = params.targetHTTPPort;
                    native.targetTelnetPort = params.targetTelnetPort;
                    native.readInterval = params.readInterval;
                    native.parseTimeout = params.parseTimeout;
                    native.maxretries = params.maxretries;

                    native.HTTPparameter = params.HTTPparameter;




                    props.changeNative(native);
                }}
                //data={props.native.params}
                data={props.native}
                onError={() => { }}
                theme={props.theme}
                withoutSaveButtons
            />
        </div>
    );
}
