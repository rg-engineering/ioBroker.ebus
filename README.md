![Logo](admin/myhomecontrol.png)
# ioBroker.ebus
===========================
[![NPM version](https://img.shields.io/npm/v/iobroker.ebus.svg)](https://www.npmjs.com/package/iobroker.ebus)
[![Downloads](https://img.shields.io/npm/dm/iobroker.ebus.svg)](https://www.npmjs.com/package/iobroker.ebus)

[![NPM](https://nodei.co/npm/iobroker.ebus.png?downloads=true)](https://nodei.co/npm/iobroker.ebus/)

This adapter reads
- data from ebusd using html
In this case ebusd must run and must be able to send data to e.g. explorer via http://IP:port/data (http://192.168.0.123:8889/data)
Current version of ebusd incl. configuration files can be copied from https://github.com/john30/ebusd
All fields with data, lastup and from global section are parsed. All others are ignored at the moment. 
Write access to ebusd is not implemented yet.
supported ebusd-version: 3.1
- web interface of Arduino based ebus adapter. Interpretation of ebus data is done on Arduino.
details incl. Arduino software see /t.b.d./
   
Attention: ebus-history and ebus widget works only with arduino interface at the moment. Will be implemented later.

## Changelog

#### 0.4.0 
* (René) reading data from ebusd 

#### 0.3.0 
* (René) support of ebusd 
* (René) admin3 support

#### 0.2.0
* (René) add history as JSON for vis
* (René) add flot based widget to display temperatur, status and power graph

#### 0.1.0
* (René) scheduled adapter instead of deamon

#### 0.0.3
* (René) UTF8 coding

#### 0.0.2
* (René) initial release

## License
Copyright (C) <2016>  <info@rg-engineering.eu>

//

//    This program is free software: you can redistribute it and/or modify

//    it under the terms of the GNU General Public License as published by

//    the Free Software Foundation, either version 3 of the License, or

//    (at your option) any later version.

//

//    This program is distributed in the hope that it will be useful,

//    but WITHOUT ANY WARRANTY; without even the implied warranty of

//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the

//    GNU General Public License for more details.

//

//    You should have received a copy of the GNU General Public License

//    along with this program.  If not, see <http://www.gnu.org/licenses/>.




