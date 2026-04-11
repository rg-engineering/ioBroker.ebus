# Older changes
## 3.6.9 (2025-10-21)
* (René) update dependencies + changes based on adapter checker

## 3.6.8 (2025-10-04)
* (René) update dependencies + changes based on adapter checker

## 3.6.7 (2025-09-06)
* (René) dependencies updated and bug fix based on adapter checker

## 3.6.6 (2025-08-22)
* (René) see issue #430: bug fix

## 3.6.4 (2025-08-22)
* (René) see issue #430: for history complete datapoint names without instance (e.g. ebus.0) must be used
* (Galileo53) change some logs

## 3.6.3 (2025-06-27)
* (René) get version info for ebusd from github if locally not available
* (René) update dependencies
* (René) new testing

## 3.6.2 (2025-06-09)
* (René) (Galileo53) #419 avoid Warning and error when history list is empty

## 3.6.1 (2025-06-06)
* (René) changes suggested by adapter checker

## 3.6.0 (2025-06-06)
* (René) new supported ebusd version is 25.1
* (René) version info added in admin

## 3.5.2 (2025-02-27)
* (René) changes requested by adapter checker
* (René) dependencies updated

## 3.5.1 (2025-02-01)
* (René) translations

## 3.5.0 (2025-01-27)
* (René) catch exceptions reportet by sentry
* (René) option to disable check of last update time (see issue #391)

## 3.4.0 (2024-12-10)
* (René) migration to jsonConfig
* (René) see issue #383: add optionally parameters to HTTP call

## 3.3.8 (2024-11-24)
* (René) update dependencies
* (René) issue  #381: install widgets again

## 3.3.7 (2024-11-20)
* (René) see issue #380: support of ebusd 24.1, ATTENTION: ebusd creates datapoints with changed names, folders or in different locations
* (René) see issue #371: test with nodejs@22

## 3.3.6 (2024-08-25)
 * (René) downgrade of "promise-socket" to 7.0.0

## 3.3.5 (2024-08-24)
* (René) update dependencies
* (René) bug fixes based on adapter checker recommendation

## 3.3.4 (2024-07-12)
 * (René) bug fix after 3.3.2 update

## 3.3.3 (2024-07-12)
 * (René) downgrade of "promise-socket" to 7.0.0

## 3.3.2 (2024-07-11)
 * (René) see issue #338: due to error in ebusd json no data are parsed

## 3.3.1 (2024-05-28)
* (René) change of dependencies

## 3.3.0 (2024-05-24)
* (René) remove cron dependency
* (René) data history prepared for VIS-2: just a option here in the adapter and new widget (at this moment GeneralChart widget in vis-2-widgets-weather can be used)

## 3.2.6 (2024-02-11)
* (René) see issue #245: support ebusd 23.3
* (René) fixes reported by eslint

## 3.2.5 (2024-01-12)
* (René) dependencies updated

## 3.2.4 (2023-11-19)
* (René) revert back to flat 5.x

## 3.2.3 (2023-11-18)
* (René) dependencies updated
* (René) fix sentry reported exceptions

## 3.2.2 (2023-07-30)
* (René) dependencies updated

## 3.2.1 (2023-04-07)
* (René) dependencies updated

## 3.2.0 (2023-02-11)
* (René) **Attention** polled variables must be set as active in admin now
* (René) search available variables per circuit added in admin
* (René) DP "find" added to force read of all existing datapoints (Attention: might take a while) and update name in data point tree

## 3.1.1 (2023-01-31)
* (René) support ebusd 23.1
* (René) see issue #77: make sure that only one data request is running at the same time

## 3.1.0 (2022-12-01)
* (René) support ebusd 22.4
* (René) see issue #77: Update data point when read-cmd is used
* (René) see issue #78: remove CR, LF in answer from ebusd for DP ebus.0.cmdResult

## 3.0.7 (2022-08-20)
* (René) support ebusd 22.3

## 3.0.6 (2022-08-19)
* (René) bug fix in tooltip in wizard

## 3.0.4 (2022-08-18)
* (René) tooltip in wizard added
* (René) flot and dependencies updated
* (René) errors from ebusd are shown as warning here in adapter, details schould be checked in logs of ebusd
* (René) bug fix in widget: if less data available x axes grid point were not shown
* (René) except null as valid value from ebusd (e.g. to reset CurrentError)

## 3.0.2 (2022-04-02)
* (René) message for installation added

## 3.0.1 (2022-04-02)
* (René) read interval in admin added

## 3.0.0 (2022-04-02)
* (René) **ATTENTION** change from scheduled to daemon adapter
* (René) bent by axios replaced

## 2.5.1 (2021-12-29)
* (René) adjustable retries to send data if arbitration error appeared

## 2.5.0 (2021-12-28)
* (René) see issue #62: support ebusd 21.3

## 2.4.5 (2021-11-07)
* (René) bug fix color of labels in widget

## 2.4.4 (2021-10-30)
* (René) see issue #59: avoid endless loop
* (René) update flot to 4.2.2
* (René) bug fix missing space in command when using circuit name

## 0.8.0 (2019-02-24)
* (René) hcmode2 value 5 = EVU Sperrzeit

## 0.7.0 (2019-01-28)
* (René) add adjustable timeout

## 0.6.0 (2019-01-06)
* (René) support of compact mode

## 0.5.5 (2018-11-04)
* (René) code clean up

## 0.5.4
* (René) arduino support removed

## 0.5.3
* (René) add error information

## 0.5.2
* (René) bug fix: in vis 1.x some values are not stored

## 0.5.1
* (René) bug fix: if nothing to poll then skip telnet connection

## 0.5.0
* (René) write date over TCP to ebusd

## 0.4.2
* (René) bug fix for admin V3

## 0.4.1 
* (René) logo changed

## 0.4.0 
* (René) reading data from ebusd

## 0.3.0 
* (René) support of ebusd 
* (René) admin3 support

## 0.2.0
* (René) add history as JSON for vis
* (René) add flot based widget to display temperatur, status and power graph

## 0.1.0
* (René) scheduled adapter instead of deamon

## 0.0.3
* (René) UTF8 coding

## 0.0.2
* (René) initial release