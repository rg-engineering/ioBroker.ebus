/*global systemDictionary:true */
'use strict';

systemDictionary = {
    "ebus_adapter_settings":
    {
        "en": "ebus adapter settings",
        "de": "ebus Adaptereinstellungen",
        "ru": "настройки адаптера ebus",
        "pt": "Configurações do adaptador ebus",
        "nl": "ebus-adapterinstellingen",
        "fr": "Paramètres de l'adaptateur ebus",
        "it": "impostazioni dell'adattatore ebus",
        "es": "configuración del adaptador ebus",
        "pl": "ustawienia adaptera ebus"
    },

    "target_IP":
    {
        "en": "target IP",
        "de": "Ziel-IP",
        "ru": "целевой IP-адрес",
        "pt": "IP alvo",
        "nl": "doel-IP",
        "fr": "cible IP",
        "it": "IP di destinazione",
        "es": "IP objetivo",
        "pl": "docelowy adres IP"
    },
    "target_HTTPPort":
    {
        "en": "target HTTP Port to read data",
        "de": "target HTTP Port zum Lesen von Daten",
        "ru": "целевой HTTP-порт для чтения данных",
        "pt": "porta HTTP de destino para ler dados",
        "nl": "doel HTTP-poort om gegevens te lezen",
        "fr": "Port HTTP cible pour lire les données",
        "it": "Porta HTTP di destinazione per leggere i dati",
        "es": "target HTTP Port para leer datos",
        "pl": "docelowy port HTTP do odczytu danych"
    },
    "target_TelnetPort":
    {
        "en": "target telnet Port to write data",
        "de": "target telnet Port zum Schreiben von Daten",
        "ru": "целевой порт telnet для записи данных",
        "pt": "destino telnet porta para escrever dados",
        "nl": "doel telnet-poort om gegevens te schrijven",
        "fr": "Port telnet cible pour écrire des données",
        "it": "Porta telnet target per scrivere dati",
        "es": "target telnet Port para escribir datos",
        "pl": "docelowy port telnet do zapisu danych"
    },
    "hint_arduino":
    {
        "en": "for arduino interface you need arduino, ethernet shield, ebus adapter and our arduino software. Details see URL to do",
        "de": "für das Arduino Interface benötigen sie einen Arduino, Ethernet Shield, ebus Adapter und unsere Arduino Software. Details siehe: URL to do",
        "ru": "для интерфейса arduino вам нужны arduino, ethernet-экран, адаптер ebus и наше программное обеспечение arduino. Подробности см .:URL to do",
        "pt": "Para a interface arduino você precisa de arduino, ethernet shield, adaptador ebus e nosso software arduino. Detalhes:URL to do",
        "nl": "voor arduino-interface heeft u arduino, ethernet shield, ebus-adapter en onze arduino-software nodig. Details zien:URL to do",
        "fr": "Pour l'interface arduino, vous avez besoin d'arduino, d'un shield ethernet, d'un adaptateur ebus et de notre logiciel arduino. Détails voir:URL to do",
        "it": "per l'interfaccia arduino hai bisogno di arduino, schermo ethernet, adattatore ebus e il nostro software arduino. Dettagli vedi:URL to do",
        "es": "para la interfaz arduino necesitas arduino, escudo ethernet, adaptador ebus y nuestro software arduino. Los detalles ven:URL to do",
        "pl": "do interfejsu arduino potrzebujesz arduino, ekran ethernetowy, adapter ebus i nasze oprogramowanie arduino. Szczegóły patrz:URL to do"
    },
    "hint_ebusd":
    {
        "en": "for ebusd interface you need a running ebusd incl. all necessary configurations. This adapter uses HTML to read data from ebusd and TCP to write to ebusd",
        "de": "Für ebusd interface benötigen Sie einen running ebusd incl. alle notwendigen Konfigurationen. Dieser Adapter verwendet HTML, um Daten von ebusd und TCP zu lesen, um auf ebusd zu schreiben",
        "ru": "для интерфейса ebusd вам необходимо запустить ebusd, вкл. все необходимые конфигурации. Этот адаптер использует HTML для чтения данных из ebusd и TCP для записи в ebusd",
        "pt": "Para a interface ebusd, você precisa de um ebusd executado. todas as configurações necessárias. Este adaptador usa HTML para ler dados de ebusd e TCP para escrever em ebusd",
        "nl": "voor ebusd-interface heeft u een lopende ebusd nodig. alle noodzakelijke configuraties. Deze adapter gebruikt HTML om gegevens van ebusd en TCP te lezen om naar ebusd te schrijven",
        "fr": "Pour l'interface ebusd, vous avez besoin d'un ebusd en cours d'exécution. toutes les configurations nécessaires. Cet adaptateur utilise le HTML pour lire les données d'ebusd et TCP pour écrire sur ebusd",
        "it": "per l'interfaccia ebusd hai bisogno di un ebusd in esecuzione incl. tutte le configurazioni necessarie Questo adattatore utilizza l'HTML per leggere i dati da ebusd e TCP per scrivere su ebusd",
        "es": "para la interfaz ebusd necesita un ebusd eb todas las configuraciones necesarias. Este adaptador usa HTML para leer datos de ebusd y TCP para escribir en ebusd",
        "pl": "do interfejsu ebusd potrzebny jest działający ebusd w tym. wszystkie niezbędne konfiguracje. Ten adapter używa HTML do odczytu danych z ebusd i TCP w celu zapisania do ebusd"
    },

    "hint_ebusd_polled":
    {
        "en": "comma seperated list of all datapoint names which should be polled from adapter. Do not add datapoint which are already polled from ebusd. This list should include onle those which are not updated from ebusd itself",
        "de": "Komma getrennte Liste aller Datenpunktnamen, die vom Adapter abgefragt werden sollen. Fügen Sie keine Datenpunkte hinzu, die bereits von ebusd abgefragt wurden. Diese Liste sollte diejenigen enthalten, die nicht von ebusd selbst aktualisiert wurden",
        "ru": "разделенный запятыми список всех имен данных, которые должны быть опрошены из адаптера. Не добавляйте datapoint, которые уже опрошены с ebusd. Этот список должен включать только те, которые не обновляются с самого ebusd",
        "pt": "lista separada por vírgulas de todos os nomes de pontos de dados que devem ser consultados a partir do adaptador. Não adicione o datapoint que já foi consultado pelo ebusd. Esta lista deve incluir onle aqueles que não são atualizados da própria ebusd",
        "nl": "een door komma's gescheiden lijst met alle datapuntnamen die uit de adapter moeten worden gepolld. Voeg geen datapunten toe die al gepold zijn vanuit ebusd. Deze lijst moet alleen die bevatten die niet zijn bijgewerkt vanuit ebusd zelf",
        "fr": "liste séparée par des virgules de tous les noms de point de données qui doivent être interrogés à partir de l'adaptateur. N'ajoutez pas de point de données déjà interrogé depuis ebusd. Cette liste devrait inclure ceux qui ne sont pas mis à jour depuis ebusd lui-même",
        "it": "elenco separato da virgole di tutti i nomi dei punti dati che devono essere interrogati dall'adattatore. Non aggiungere datapoint che sono già stati interrogati da ebusd. Questo elenco dovrebbe includere quelli che non sono aggiornati da ebusd stesso",
        "es": "una lista separada por comas de todos los nombres de punto de datos que deben sondearse desde el adaptador. No agregue puntos de datos que ya están sondeados desde ebusd. Esta lista debe incluir onle aquellos que no se actualizan desde ebusd",
        "pl": "rozdzielana przecinkami lista wszystkich nazw punktów danych, które powinny być pobierane z adaptera. Nie dodawaj punktów danych, które są już odpytywane z ebusd. Ta lista powinna zawierać te, które nie są aktualizowane od samego ebusd"
    },
    "hint_ebusd_history":
    {
        "en": "comma seperated list of all datapoint names which should be used with ebus history widget.If datapoint is in the list then it appears in json - data with timestamp and value and can be used in ebus history widget",
        "de": "Komma getrennte Liste aller Datenpunktnamen, die mit ebus history widget verwendet werden sollen. Wenn sich der Datenpunkt in der Liste befindet, wird er in json-data mit Zeitstempel und Wert angezeigt und kann in ebus history widget verwendet werden",
        "ru": "разделенный запятыми список всех имен данных, которые должны использоваться с виджетами истории ebus. Если datapoint находится в списке, то он появляется в json-данных с меткой времени и значением и может использоваться в виджетах истории ebus",
        "pt": "lista separada por vírgulas de todos os nomes de pontos de dados que devem ser usados ​​com o widget de histórico do ebus. Se o ponto de dados estiver na lista, ele aparecerá em json-data com timestamp e valor e pode ser usado no widget de histórico do ebus",
        "nl": "een door komma's gescheiden lijst van alle datapuntnamen die met de ebus-geschiedeniswidget moeten worden gebruikt. Als datapunt in de lijst staat, verschijnt het in json-data met tijdstempel en waarde en kan het worden gebruikt in de ebus-geschiedeniswidget",
        "fr": "liste séparée par des virgules de tous les noms de point de données qui doivent être utilisés avec le widget d'historique ebus. Si le point de donnée est dans la liste, il apparaît dans json-data avec horodatage et valeur et peut être utilisé dans le widget de l'historique ebus",
        "it": "elenco separato da virgola di tutti i nomi dei punti dati che dovrebbero essere utilizzati con il widget della cronologia ebus. Se il datapoint è presente nell'elenco, viene visualizzato in json-data con data / ora e valore e può essere utilizzato nel widget della cronologia ebus",
        "es": "una lista separada por comas de todos los nombres de punto de datos que se deben usar con el widget de historial de ebus. Si el punto de datos está en la lista, aparece en json-data con indicación de fecha y hora y valor y se puede usar en el widget de historia ebus.",
        "pl": "rozdzielana przecinkami lista wszystkich nazw punktów danych, które powinny być używane z widżetem historii ebus. Jeśli data jest na liście, pojawia się w json-data ze znacznikiem czasowym i wartością i może być użyta w widżecie historii ebus"
    },
    "ListOfAllPolledValues":
    {
        "en": "comma separated list of polled datapoints",
        "de": "Komma-getrennte Liste von abgefragten Datenpunkten",
        "ru": "разделенный запятыми список опрошенных точек данных",
        "pt": "lista separada por vírgulas de pontos de dados polidos",
        "nl": "door komma's gescheiden lijst van polled datapunten",
        "fr": "liste séparée par des virgules des points de données interrogés",
        "it": "elenco separato da virgole di punti di dati sottoposti a polling",
        "es": "lista separada por comas de puntos de datos sondeados",
        "pl": "rozdzielana przecinkami lista odpytanych punktów danych"
    },
    "ListOfAllHistoryValues":
    {
        "en": "comma separated list of datapoints for ebus history widget",
        "de": "Komma getrennte Liste von Datenpunkten für ebus history widget",
        "ru": "список точек данных для электронного журнала ebus с разделителями-запятыми",
        "pt": "lista separada por vírgulas de pontos de dados para o widget história do ebus",
        "nl": "door komma's gescheiden lijst met datapunten voor ebus-geschiedeniswidget",
        "fr": "liste des points de données séparés par des virgules pour le widget d'historique ebus",
        "it": "elenco separato da virgole di punti dati per il widget della cronologia ebus",
        "es": "lista de puntos de datos separados por comas para el widget de historial ebus",
        "pl": "rozdzielana przecinkami lista punktów danych dla widgetu historii ebus"
    },
    "interface_type":
    {
        "en": "type of interface",
        "de": "Art der Schnittstelle",
        "ru": "тип интерфейса",
        "pt": "tipo de interface",
        "nl": "type interface",
        "fr": "type d'interface",
        "it": "tipo di interfaccia",
        "es": "tipo de interfaz",
        "pl": "typ interfejsu"
    }

};