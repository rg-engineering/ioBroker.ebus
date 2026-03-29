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

import type { AIPredictorAdapterConfig, Predictor } from "../types";

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
import AddIcon from '@mui/icons-material/Add';
    import DeleteIcon from '@mui/icons-material/Delete';

import BoxDivider from '../Components/BoxDivider'

interface SettingsProps {
    common: ioBroker.InstanceCommon;
    native: AIPredictorAdapterConfig;
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


export default function DeviceSettings(props: SettingsProps): React.JSX.Element {

    console.log("DeviceSettings render " + JSON.stringify(props.native));
    const colCount = 7;

    const [predictors, setPredictors] = React.useState<Predictor[]>(props.native.predictors ?? []);


    

    const persistData = (updated: AIPredictorAdapterConfig): void => {
        try {
            if (props.changeNative) {
                props.changeNative(updated);

                console.debug('save data:', JSON.stringify(updated));
            }
        } catch (e) {
            // Fehler still ignorieren
            console.error('Failed to persist data settings:', e);
        }
    };

    const onAdd = (): void => {
        const newEntry: Predictor = {
            active: true,
            OID: ''
        };
        const newSettings = [...predictors, newEntry];
        setPredictors(newSettings);
        const updated = ({ ...(props.native), predictors: newSettings } as AIPredictorAdapterConfig);
        persistData(updated);
        
    };

    const onRemove = (idx: number): void => {
        const newSettings = predictors.filter((_: any, i: number) => i !== idx);
        setPredictors(newSettings);
        const updated = ({ ...(props.native), predictors: newSettings } as AIPredictorAdapterConfig);
        persistData(updated);
        
    };

    const onUpdate = (idx: number, key: string, value: any): void => {
        const newSettings = predictors.map((s: any, i: number) => (i === idx ? { ...s, [key]: value } : s));
        setPredictors(newSettings);
        const updated = ({ ...(props.native), predictors: newSettings } as AIPredictorAdapterConfig);
        persistData(updated);
        
    };

    return (
        <Box style={{ width: 'calc(100% - 8px)', minHeight: '100%' }}>
            <Box
                style={{ margin: 10 }}
            >


                <BoxDivider
                    Name={I18n.t('datapoints')}
                    theme={props.theme}
                />

               


                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontWeight: 500 }}>{I18n.t('predictors')}:</div>
                        <Tooltip title={I18n.t('add new datapoint')}>
                            <IconButton size="small" onClick={onAdd}>
                                <AddIcon />
                            </IconButton>
                        </Tooltip>
                    </div>

                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{I18n.t('active')}</TableCell>
                                <TableCell>{I18n.t('OID')}</TableCell>
                                <TableCell>{I18n.t('')}</TableCell>
                                <TableCell>{I18n.t('')}</TableCell>
                                <TableCell>{I18n.t('')}</TableCell>
                                <TableCell>{I18n.t('')}</TableCell>
                                <TableCell>{I18n.t('')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {(predictors.length === 0) ? (
                                <TableRow>
                                    <TableCell colSpan={colCount} style={{ fontStyle: 'italic' }}>{I18n.t('nothing configured')}</TableCell>
                                </TableRow>
                            ) : predictors.map((t: Predictor, idx: number) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <Checkbox
                                            checked={t.active}
                                            onChange={(e) => onUpdate(idx, 'active', e.target.checked)}
                                        />

                                    </TableCell>

                                    <TableCell>
                                        <FormControl fullWidth variant="standard">
                                            <Select

                                                value={t.OID || ''}
                                                onChange={(e) => onUpdate(idx, 'OID', e.target.value)}
                                                displayEmpty
                                            >
                                                <MenuItem value="">
                                                    <em>{I18n.t('select OID')}</em>
                                                </MenuItem>
                                                {props.activeDPs.map((dp) => (
                                                    <MenuItem key={dp} value={dp}>
                                                        {dp}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        


                                    </TableCell>

                                    <TableCell>
                                        
                                    </TableCell>

                                    <TableCell>
                                        
                                    </TableCell>

                                    <TableCell>
                                        
                                    </TableCell>

                                    <TableCell>
                                        
                                    </TableCell>

                                    <TableCell>
                                        <Tooltip title={I18n.t('Delete device')}>
                                            <IconButton size="small" onClick={() => onRemove(idx)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>


            </Box>
        </Box>
    );
    
}
