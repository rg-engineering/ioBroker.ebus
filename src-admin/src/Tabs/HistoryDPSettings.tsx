/* eslint-disable prefer-template */
/* eslint-disable quote-props */
/* eslint-disable prettier/prettier */
import React, { useEffect, useState, useCallback } from 'react';
import type {
    AdminConnection,
    IobTheme,
    ThemeName,
    ThemeType
} from '@iobroker/adapter-react-v5';

import { I18n } from '@iobroker/adapter-react-v5';

import type { ebusAdapterConfig } from "../types";

import {
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Checkbox,
    FormControlLabel,
    IconButton,
    Box,
    TextField,
    TableCell,
    TableRow,
    TableHead,
    Table,
    TableBody,
    Tooltip
    
} from '@mui/material';
//import AddIcon from '@mui/icons-material/Add';
//import DeleteIcon from '@mui/icons-material/Delete';

import BoxDivider from '../Components/BoxDivider'
import DP_table from '../Components/DP_table'

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
    rooms?: Record<string, ioBroker.EnumObject>;
    functions?: Record<string, ioBroker.EnumObject>;
    alive: boolean;
    activeDPs: string[];
}

export default function HistoryDPSettings(props: SettingsProps): React.JSX.Element {

    console.log("HistoryDPSettings render " + JSON.stringify(props.native));

    // Fügt einen neuen HistoryDP hinzu
    const addHistoryDP = useCallback(() => {
        const newDPs = Array.isArray(props.native.HistoryDPs) ? [...props.native.HistoryDPs] : [];
        newDPs.push({
            name: ''
        }); // Passe das Objekt ggf. an das erwartete Schema an
        props.changeNative({ ...props.native, HistoryDPs: newDPs });
    }, [props.native, props.changeNative]);

    // Aktualisiert einen bestehenden HistoryDP
    const updateHistoryDP = useCallback((index: number, updatedDP: any) => {
        const newDPs = Array.isArray(props.native.HistoryDPs) ? [...props.native.HistoryDPs] : [];
        if (index >= 0 && index < newDPs.length) {
            newDPs[index] = updatedDP;
            props.changeNative({ ...props.native, HistoryDPs: newDPs });
        }
    }, [props.native, props.changeNative]);

    // Entfernt einen HistoryDP
    const removeHistoryDP = useCallback((index: number) => {
        const newDPs = Array.isArray(props.native.HistoryDPs) ? [...props.native.HistoryDPs] : [];
        if (index >= 0 && index < newDPs.length) {
            newDPs.splice(index, 1);
            props.changeNative({ ...props.native, HistoryDPs: newDPs });
        }
    }, [props.native, props.changeNative]);

    return (
        <Box style={{ width: 'calc(100% - 8px)', minHeight: '100%' }}>
            <Box
                style={{ margin: 10 }}
            >


                <BoxDivider
                    Name={I18n.t('datapoints')}
                    theme={props.theme}
                />

                <TextField
                    label={I18n.t('hint_ebusd_history')}
                    value={I18n.t('hint_ebusd_history')}
                    InputProps={{
                        readOnly: true,
                        disableUnderline: true,
                        style: {
                            fontSize: '0.85rem',
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                        },
                    }}
                    variant="standard"
                    fullWidth
                    InputLabelProps={{
                        shrink: false,
                        style: { display: 'none' },
                    }}
                    sx={{
                        '& .MuiInputBase-root': {
                            border: 'none',
                            fontSize: '0.85rem',
                            width: '100%',
                            background: 'transparent',
                            padding: 0,
                        },
                        '& .MuiInputBase-input': {
                            border: 'none',
                            fontSize: '0.85rem',
                            width: '100%',
                            background: 'transparent',
                            padding: 0,
                        },
                    }}
                />


                <DP_table
                    settingName={I18n.t('history DPs')}
                    settings={props.native.HistoryDPs}
                    socket={props.socket}
                    theme={props.theme}
                    themeName={props.themeName}
                    themeType={props.themeType}
                    onAdd={addHistoryDP}
                    onUpdate={updateHistoryDP}
                    onRemove={removeHistoryDP}
                    addButtonTooltip={I18n.t('add a new history datapoint')}
                >

                </DP_table>




            </Box>
        </Box>
    );

}
