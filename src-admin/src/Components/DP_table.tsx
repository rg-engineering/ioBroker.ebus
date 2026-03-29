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

export type SettingDP = { active: boolean; circuit: string; name: string; parameter: string };

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
};


export default function SettingActorsTable(props: Props): React.JSX.Element {
    const { settingName, settings, onAdd, onUpdate, onRemove, addButtonTooltip } = props;


    const colCount = 5;



    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 500 }}>{settingName}:</div>
                <Tooltip title={addButtonTooltip ?? I18n.t('add new device')}>
                    <IconButton size="small" onClick={onAdd}>
                        <AddIcon />
                    </IconButton>
                </Tooltip>
            </div>

            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>{I18n.t('active')}</TableCell>
                        <TableCell>{I18n.t('circuit')}</TableCell>
                        <TableCell>{I18n.t('name')}</TableCell>
                        <TableCell>{I18n.t('parameter')}</TableCell>
                       
                    </TableRow>
                </TableHead>
                <TableBody>
                    {settings.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={colCount} style={{ fontStyle: 'italic' }}>{I18n.t('nothing configured')}</TableCell>
                        </TableRow>
                    ) : settings.map((t, idx) => (
                        <TableRow key={idx}>
                            <TableCell>
                                <Checkbox
                                    checked={!!t.active}
                                    onChange={(e) => onUpdate(idx, 'active', e.target.checked)}
                                />

                                
                            </TableCell>
                            <TableCell>
                                <TextField
                                    fullWidth
                                    value={t.name}
                                    onChange={(e) => onUpdate(idx, 'name', e.target.value)}
                                    variant="standard"
                                    placeholder={I18n.t('name')}
                                />
                            </TableCell>

                            <TableCell>
                                <TextField
                                    fullWidth
                                    value={t.circuit}
                                    onChange={(e) => onUpdate(idx, 'circuit', e.target.value)}
                                    variant="standard"
                                    placeholder={I18n.t('circuit')}
                                />
                            </TableCell>

                            <TableCell>
                                <TextField
                                    fullWidth
                                    value={t.parameter}
                                    onChange={(e) => onUpdate(idx, 'parameter', e.target.value)}
                                    variant="standard"
                                    placeholder={I18n.t('parameter')}
                                />
                            </TableCell>

                            
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}