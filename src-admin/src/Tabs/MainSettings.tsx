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
    label: 'main settings',
    items: {
        "icontest": {
            "type": "staticImage",
            "src": "ebus.png",
            "newLine": true,
            "xs": 12,
            "sm": 3,
            "md": 3,
            "lg": 1.2,
            "xl": 1.2
        },

        "InstallUpdatehdr": {
            "type": "header",
            "text": "Update hint ebusd",
            "size": 2
        },


        "currentversiontxt": {
            "type": "staticText",
            "newLine": true,
            "text": "current installed version",
            "xs": 12,
            "sm": 2,
            "md": 2,
            "lg": 2,
            "xl": 2
        },

        "currentversion": {
            "type": "textSendTo",
            "label": "current istalled ebusd version",
            "command": "checkCurrentVersion",
            "jsonData": "{\"test\": \"aaa\", \"test2\": \"bbb\" }",
            "alsoDependsOn": ["checkCurrentVersion"],
            "xs": 12,
            "sm": 12,
            "md": 6,
            "lg": 4,
            "xl": 4

        },


        "installableversiontxt": {
            "type": "staticText",
            "newLine": true,
            "text": "available version",
            "xs": 12,
            "sm": 2,
            "md": 2,
            "lg": 2,
            "xl": 2
        },
        "installableversion": {
            "type": "textSendTo",
            "label": "available version",
            "command": "checkInstallableversion",
            "jsonData": "{\"test\": \"aaa\", \"test2\": \"bbb\" }",
            "alsoDependsOn": ["checkInstallableversion"],
            "xs": 12,
            "sm": 12,
            "md": 6,
            "lg": 4,
            "xl": 4

        },



        "supportedversiontxt": {
            "type": "staticText",
            "newLine": true,
            "text": "supported version",
            "xs": 12,
            "sm": 2,
            "md": 2,
            "lg": 2,
            "xl": 2
        },
        "supportedversion": {
            "type": "textSendTo",
            "label": "supported version",
            "command": "checkSupportedVersion",
            "jsonData": "{\"test\": \"aaa\", \"test2\": \"bbb\" }",
            "alsoDependsOn": ["checkSupportedversion"],
            "xs": 12,
            "sm": 12,
            "md": 6,
            "lg": 4,
            "xl": 4

        },



        //just a link
        "EbusReadme": {
            "type": "staticLink",
            "text": "link to ebusd wiki with installation instruction",
            "href": "https://github.com/john30/ebusd/wiki/1.-Build-and-install",
            "button": true,
            "icon": "info",
            "newLine": true,
            "xs": 12,
            "sm": 12,
            "md": 6,
            "lg": 4,
            "xl": 4
        },
        //für debian based systeme
        /*
        "ebusdhintinstallUpdate": {
          "type": "staticText",
          "text": "hint_ebusd_installupdate",
          "newLine": true,
          "xs": 12,
          "sm": 12,
          "md": 12,
          "lg": 12,
          "xl": 12
        } ,
        */
        /* "Install": {
          "type": "sendTo",
         "command": "Install",
          "label": "InstallBtn",
          "tooltip": "InstallBtnHint",
          "newLine": true,
          "xs": 12,
          "sm": 12,
          "md": 12,
          "lg": 12,
          "xl": 12
        },
        "Update": {
          "type": "sendTo",
          "command": "Update",
          "label": "UpdateBtn",
          "tooltip": "UpdateBtnHint",
          "newLine": true,
          "xs": 12,
          "sm": 12,
          "md": 12,
          "lg": 12,
          "xl": 12
        }
  */




        "dividerHdr1": {
            "newLine": true,
            "type": "header",
            "text": "configuration",
            "size": 2
        },

        "targetIP": {
            "type": "text",
            "label": "target_IP",
            "help": "IP of system where ebusd runs",
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },
        "useBoolean4Onoff": {
            "newLine": true,
            "type": "checkbox",
            "label": "useBoolean4Onoff",
            "help": "useBoolean4Onoff_help",
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },
        "DisableTimeUpdateCheck": {
            "newLine": true,
            "type": "checkbox",
            "label": "DisableTimeUpdateCheck",
            "help": "DisableTimeUpdateCheckHelp",
            "default": false,
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },
        "History4Vis2": {
            "newLine": true,
            "type": "checkbox",
            "label": "History4Vis2",
            "help": "History4Vis2_help",
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        }
    }
}


export default function MainSettings(props: SettingsProps): React.JSX.Element {


    console.log("settings: " + JSON.stringify(props.native));

    return (
        <div style={{ width: 'calc(100% - 8px)', minHeight: '100%' }}>
            <JsonConfigComponent
                common={props.common}
                socket={props.socket}
                themeName={props.themeName}
                themeType={props.themeType}
                adapterName="ebus"
                instance={props.instance || 0}
                isFloatComma={props.systemConfig.common.isFloatComma}
                dateFormat={props.systemConfig.common.dateFormat}
                schema={schema}
                onChange={(params): void => {

                    console.log("MainSettings onChange params: " + JSON.stringify(params));

                    const native: ebusAdapterConfig = JSON.parse(JSON.stringify(props.native));
                    //console.log("MainSettings onChange native: " + JSON.stringify(native));

                    native.targetIP = params.targetIP;
                    native.useBoolean4Onoff = params.useBoolean4Onoff;
                    native.DisableTimeUpdateCheck = params.DisableTimeUpdateCheck;
                    native.History4Vis2 = params.History4Vis2;




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
