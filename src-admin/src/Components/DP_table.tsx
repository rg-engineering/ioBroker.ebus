/* eslint-disable prefer-template */
/* eslint-disable quote-props */
/* eslint-disable prettier/prettier */

import React from 'react';
import {
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Checkbox,
    TextField,
    IconButton,
    Tooltip,
} from '@mui/material';

import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { I18n } from '@iobroker/adapter-react-v5';
import type { AdminConnection, IobTheme, ThemeName, ThemeType } from '@iobroker/adapter-react-v5';
//import SelectOID from './SelectOID';

import type {SettingDP } from "../types";

type Props = {
    settingName: string;
    settings: SettingDP[];
    socket: AdminConnection;
    theme: IobTheme;
    themeName: ThemeName;
    themeType: ThemeType;
    onAdd: () => void;
    onUpdate: (index: number, field: keyof SettingDP, value: any) => void;
    onRemove: (index: number) => void;
    addButtonTooltip?: string;
    useAllColumns?: boolean;
};


export default function SettingActorsTable(props: Props): React.JSX.Element {
    const { settingName, settings, onAdd, onUpdate, onRemove, addButtonTooltip, useAllColumns } = props;


    const colCount = useAllColumns ? 5 : 2;


    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 500 }}>{settingName}:</div>
                <Tooltip title={addButtonTooltip ?? I18n.t('add new datapoint')}>
                    <IconButton size="small" onClick={onAdd}>
                        <AddIcon />
                    </IconButton>
                </Tooltip>
            </div>

            <Table size="small">
                <TableHead>
                    <TableRow>
                        {useAllColumns && <TableCell>{I18n.t('active')}</TableCell>}
                        {useAllColumns && <TableCell>{I18n.t('circuit')}</TableCell>}
                        <TableCell>{I18n.t('name')}</TableCell>
                        {useAllColumns && <TableCell>{I18n.t('parameter')}</TableCell>}
                        <TableCell>{I18n.t('actions')}</TableCell>

                    </TableRow>
                </TableHead>
                <TableBody>
                    {settings.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={colCount} style={{ fontStyle: 'italic' }}>{I18n.t('nothing configured')}</TableCell>
                        </TableRow>
                    ) : settings.map((t, idx) => (
                        <TableRow key={idx}>
                            {useAllColumns && (
                                <TableCell>
                                    <Checkbox
                                        checked={!!t.active}
                                        onChange={(e) => onUpdate(idx, 'active', e.target.checked)}
                                    />


                                </TableCell>)}

                            {useAllColumns && (
                                <TableCell>
                                    <TextField
                                        fullWidth
                                        value={t.circuit}
                                        onChange={(e) => onUpdate(idx, 'circuit', e.target.value)}
                                        variant="standard"
                                        placeholder={I18n.t('circuit')}
                                    />
                                </TableCell>)}

                            <TableCell>
                                <TextField
                                    fullWidth
                                    value={t.name}
                                    onChange={(e) => onUpdate(idx, 'name', e.target.value)}
                                    variant="standard"
                                    placeholder={I18n.t('name')}
                                />
                            </TableCell>

                            {useAllColumns && (
                                <TableCell>
                                    <TextField
                                        fullWidth
                                        value={t.parameter}
                                        onChange={(e) => onUpdate(idx, 'parameter', e.target.value)}
                                        variant="standard"
                                        placeholder={I18n.t('parameter')}
                                    />
                                </TableCell>)}
                            <TableCell>
                                <Tooltip title={I18n.t('Delete datapoint')}>
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
    );
}