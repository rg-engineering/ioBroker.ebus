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
    Tooltip,
    Button
    
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
    import DeleteIcon from '@mui/icons-material/Delete';

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


export default function QueriedDPSettings(props: SettingsProps): React.JSX.Element {

    console.log("QueriedDPSettings render " + JSON.stringify(props.native));

    // Fügt einen neuen HistoryDP hinzu
    const addPolledDP = useCallback(() => {
        const newDPs = Array.isArray(props.native.PolledDPs) ? [...props.native.PolledDPs] : [];
        newDPs.push({
            active: true,
            circuit: '',
            parameter: '',
            name: ''
        }); // Passe das Objekt ggf. an das erwartete Schema an
        props.changeNative({ ...props.native, PolledDPs: newDPs });
    }, [props.native, props.changeNative]);

    // Aktualisiert einen bestehenden PolledDP
    const updatePolledDP = useCallback((index: number, updatedDP: any) => {
        const newDPs = Array.isArray(props.native.PolledDPs) ? [...props.native.PolledDPs] : [];
        if (index >= 0 && index < newDPs.length) {
            newDPs[index] = updatedDP;
            props.changeNative({ ...props.native, PolledDPs: newDPs });
        }
    }, [props.native, props.changeNative]);

    // Entfernt einen PolledDP
    const removePolledDP = useCallback((index: number) => {
        const newDPs = Array.isArray(props.native.PolledDPs) ? [...props.native.PolledDPs] : [];
        if (index >= 0 && index < newDPs.length) {
            newDPs.splice(index, 1);
            props.changeNative({ ...props.native, PolledDPs: newDPs });
        }
    }, [props.native, props.changeNative]);


    const FindParameters = async (): Promise<void> => {
        console.log("FindParameters pressed");

        const instance = 'ebus.' + props.instance;
        const result = await props.socket.sendTo(instance, 'findParams', props.native.Circuit4Find);

        try {
            const status = (result) ? result : '';

            console.log("FindParameters result todo: " + JSON.stringify(status));
        } catch (err) {
            console.error('Error command findParams result:', err);
        }
    }

    const handleCircuit4Find = (event: React.ChangeEvent<HTMLInputElement>): void => {
        props.changeNative({ ...props.native, Circuit4Find: event.target.value });
    }

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
                    label={I18n.t('hint_ebusd_polled')}
                    value={I18n.t('hint_ebusd_polled')}
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

                <Box>
                    <TextField
                        style={{ marginBottom: 16 }}
                        id='Circuit4Find'
                        label={I18n.t('Circuit4Find')}
                        variant="standard"
                        value={props.native.Circuit4Find}
                        onChange={handleCircuit4Find}
                        sx={{ mb: 2, maxWidth: '30%' }}


                    />

                    <Button
                        id='btn_findParamters'
                        onClick={() => FindParameters()}
                        variant="contained"
                        sx={{ flexShrink: 0 }}
                    >
                        {I18n.t('find parameter')}
                    </Button>
                </Box>

                <DP_table
                    settingName={I18n.t('queried datapoints')}
                    settings={props.native.PolledDPs}
                    socket={props.socket}
                    theme={props.theme}
                    themeName={props.themeName}
                    themeType={props.themeType}
                    onAdd={addPolledDP}
                    onUpdate={updatePolledDP}
                    onRemove={removePolledDP}
                    addButtonTooltip={I18n.t('add a new polled datapoint')}
                >

                </DP_table>

            </Box>
        </Box>
    );

}
