// Single catalog of every upstream registry reginfo.lt reads from. This is the
// one place that names sources, their official home, their licence and whether
// they're live in the report today — report-format.ts's PANEL_SOURCES reads
// from this list so the two can never drift apart.

export type DataSourceStatus = "live" | "map" | "search" | "not-integrated";

/** How the data reaches the site: the "(pasiekiama per …)" of the credit line. */
export type DataAccess = "api" | "map-service" | "file" | "web-page";

export type Licence = {
  /** Completes "Duomenys platinami …": "pagal CC BY 4.0 licenciją". */
  phrase: string;
  url: string;
  /** Where the publisher states the licence for this data. */
  statedAt: string;
};

export type DataSource = {
  /** Matches a report panel key (report-format.ts CATEGORIES) when status is "live". */
  panelKey?: string;
  name: string;
  publisher: string;
  api: string;
  url: string;
  access?: DataAccess;
  /** Left out where the publisher states no licence; the credit line says so. */
  licence?: Licence;
  licenceNote?: string;
  /** Replaces the usual "processed and adapted" sentence where the data is shown as received. */
  processing?: string;
  coverage: string;
  updateFrequency: string;
  status: DataSourceStatus;
  caveat?: string;
};

const CC_BY_4 = { phrase: "pagal CC BY 4.0 licenciją", url: "https://creativecommons.org/licenses/by/4.0/deed.lt" };
const ODBL = { phrase: "pagal ODbL 1.0 licenciją", url: "https://opendatacommons.org/licenses/odbl/1-0/" };
const dataGovLt = (id: number) => ({ ...CC_BY_4, statedAt: `https://data.gov.lt/datasets/${id}/` });

const SHOWN_AS_RECEIVED = "Žemėlapio vaizdas rodomas nepakeistas.";

export const DATA_SOURCES: DataSource[] = [
  {
    panelKey: "osp-parcel-summary",
    name: "Nekilnojamojo turto registras (VDA / OSP)",
    publisher: "Lietuvos statistikos departamentas (OSP)",
    api: "OSP · ntr_sklypai",
    url: "https://osp-sdg.stat.gov.lt",
    access: "api",
    licence: dataGovLt(2831),
    coverage: "Sklypo registro suvestinė: seniūnija, savivaldybė, pastatų ir adresų skaičius.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "biip-boundary",
    name: "BĮIP: sklypų ribos ir paskirtis",
    publisher: "VĮ Registrų centras",
    api: "biip.lt · boundaries",
    url: "https://boundaries.biip.lt",
    access: "api",
    licence: { ...CC_BY_4, statedAt: "https://github.com/govlt/national-boundaries-api#license" },
    coverage: "Sklypo ribos, plotas, unikalus numeris, paskirtis, statusas.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "biip-addresses",
    name: "BĮIP: adresų registras",
    publisher: "VĮ Registrų centras",
    api: "biip.lt · addresses",
    url: "https://boundaries.biip.lt",
    access: "api",
    licence: { ...CC_BY_4, statedAt: "https://github.com/govlt/national-boundaries-api#license" },
    coverage: "Adresų taškai ir patalpos, susietos su sklypu.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "grpk-buildings",
    name: "Georeferencinio pagrindo kadastras (GRPK)",
    publisher: "Nacionalinė žemės tarnyba",
    api: "geoportal.lt · GRPK",
    url: "https://www.geoportal.lt",
    access: "api",
    licence: dataGovLt(1302),
    coverage: "Pastatų kontūrai ir plotai, papildyti BĮIP/OSP adresais.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "ssva-built-up",
    name: "Pastatų bendrojo ploto ir sklypo santykis",
    publisher: "Statybos sektoriaus vystymo agentūra (SSVA)",
    api: "ArcGIS Online · Pastatų_bendrojo_ploto_ir_sklypo_santykis",
    url: "https://atviri-duomenys-pi-ssva.hub.arcgis.com",
    access: "api",
    coverage:
      "Esamas sklypo užstatymo tankis (kiek sklypo užima pastatai ir stogais dengti statiniai) " +
      "ir intensyvumas (pastatų bendrasis plotas, padalytas iš sklypo ploto).",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
    caveat: "Rodikliai orientaciniai. Oficialius užstatymo duomenis nurodo kadastro byla ir NT registras.",
  },
  {
    panelKey: "pdbis-building-data",
    name: "Pastatų duomenų bankas (PDBIS)",
    publisher: "Lietuvos statistikos departamentas (OSP)",
    api: "OSP · pastatai_geo",
    url: "https://osp-sdg.stat.gov.lt",
    access: "api",
    coverage: "Valdomų daugiabučių butų skaičius, aukštai, būklė, renovacija.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "energy-certificates",
    name: "Pastatų energinio naudingumo sertifikatai",
    publisher: "Statybos sektoriaus vystymo agentūra (SSVA)",
    api: "data.gov.lt · ssva/pen_sertifikatai",
    url: "https://data.gov.lt/datasets/2366/",
    access: "api",
    licence: dataGovLt(2366),
    coverage: "Pastato energinio naudingumo klasė (A++–G), sertifikato galiojimas, sertifikuotas plotas ir šildymo šaltiniai.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
    caveat:
      "Sertifikatai siejami su sklypu pagal pastato adresą, nes atviruose duomenyse nėra pastato numerio. " +
      "Sertifikatas privalomas naujiems, parduodamiems ir nuomojamiems pastatams, todėl senesni namai jo dažnai neturi.",
  },
  {
    panelKey: "geoportal-constraints",
    name: "Saugomų teritorijų kadastras (VSTT)",
    publisher: "Valstybinė saugomų teritorijų tarnyba",
    api: "OSP · vstt_stvk",
    url: "https://osp-sdg.stat.gov.lt",
    access: "api",
    licence: dataGovLt(789),
    coverage: "Draustiniai, parkai, rezervatai, buveinių ir paukščių apsaugos teritorijos.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "kvr-heritage",
    name: "Kultūros vertybių registras (KVR)",
    publisher: "Kultūros paveldo departamentas",
    api: "OSP · KPD / kvr",
    url: "https://osp-sdg.stat.gov.lt",
    access: "api",
    licence: dataGovLt(2192),
    licenceNote: "geoportal.lt šios paslaugos aprašyme nurodyta: „Tik nekomercinis naudojimas“.",
    coverage: "Kultūros paveldo objektai, jų apsaugos zonos ir statusas.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "asgr-regulations",
    name: "Teritorijų planavimo dokumentų registras (TPDR)",
    publisher: "VĮ Registrų centras",
    api: "planuojustatau.lt · ASGR",
    url: "https://planuojustatau.lt",
    access: "api",
    licence: dataGovLt(3747),
    coverage: "Galiojantys planavimo reglamentai: aukštis, tankis, paskirtis, funkcinė zona.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "szns-restrictions",
    name: "Specialiosios žemės naudojimo sąlygos (SŽNS)",
    publisher: "VĮ Registrų centras",
    api: "geoportal.lt · rc_szns",
    url: "https://www.registrucentras.lt/p/1553",
    access: "map-service",
    coverage:
      "Sklypui taikomos sąlygos: inžinerinių tinklų, kelių, vandens telkinių, saugomų teritorijų, " +
      "kultūros paveldo ir kitų objektų apsaugos zonos, su nuoroda į sąlygų aprašą.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu; registras atnaujinamas bent kartą per savaitę.",
    status: "live",
    caveat:
      "Viešai VĮ Registrų centras pateikia tik zonos tipą ir unikalų numerį, be ribų. " +
      "Todėl nurodome, kokios sąlygos taikomos, bet ne kokią sklypo dalį zona užima. " +
      "Servitutai šiame registre nekaupiami.",
  },
  {
    panelKey: "osp-building-permits",
    name: "Infostatyba: statybos leidimai",
    publisher: "Valstybinė teritorijų planavimo ir statybos inspekcija (VTPSI)",
    api: "OSP · infostatyba_duomenys",
    url: "https://infostatyba.planuojustatau.lt",
    access: "api",
    coverage: "Statybos leidimai, pranešimai ir statinių projektų dokumentai.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "osp-pollution-risks",
    name: "Potencialūs taršos židiniai",
    publisher: "Lietuvos geologijos tarnyba",
    api: "OSP · potencialus_tarsos_zidiniai",
    url: "https://osp-sdg.stat.gov.lt",
    access: "api",
    licence: dataGovLt(1330),
    coverage: "Žinomi taršos židiniai ir jų aplinkosauginė būklė.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "rc-masvert",
    name: "Registrų centras: masinis vertinimas",
    publisher: "VĮ Registrų centras",
    api: "registrucentras.lt · masvert",
    url: "https://www.registrucentras.lt",
    access: "web-page",
    coverage: "Vidutinė rinkos vertė, apskaičiuota masinio vertinimo modeliu.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "forest-cutting-permits",
    name: "Miško kirtimo leidimai ir biržės",
    publisher: "Valstybinė miškų tarnyba (VMT) / ALIS",
    api: "lkmp.alisas.lt · lkmp-data.geojson",
    url: "https://atvira.amvmt.lt",
    access: "file",
    coverage:
      "Miško kirtimo leidimai ir kirtimo biržės (kirtimo rūšis, plotas, medžiai, galiojimo laikas), " +
      "sutapatinti su sklypu tiesiogiai (privatūs sklypai) arba pagal ribų sutapimą (valstybinis miškas).",
    updateFrequency: "Šaltinis atnaujinamas kasdien; talpykla serveryje atnaujinama kas ~20 val.",
    status: "live",
  },
  {
    panelKey: "nearby-services",
    name: "Ugdymo ir gydymo įstaigos",
    publisher: "Informatikos ir ryšių departamentas (IRD); Lietuvos statistikos departamentas (OSP)",
    api: "maps.ird.lt · NVZRGIS/UGDYMOISTAIGOS; OSP · Gydymo_įstaigos",
    url: "https://maps.ird.lt",
    access: "api",
    coverage:
      "Artimiausios veikiančios bendrojo ugdymo mokyklos, darželiai ir gydymo įstaigos; " +
      "atstumas skaičiuojamas tiesia linija nuo sklypo centro.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
    caveat:
      "Gydymo įstaigų sąrašas paskutinį kartą atnaujintas 2022 m., todėl naujesnių įstaigų jame gali nebūti.",
  },
  {
    panelKey: "crime-stats",
    name: "Nusikalstamų veikų žinybinis ir Administracinių nusižengimų registrai",
    publisher: "Informatikos ir ryšių departamentas prie VRM (IRD)",
    api: "maps.ird.lt · NVZRGIS/Gardeles, ANRGIS/Gardeles",
    url: "https://maps.ird.lt",
    access: "api",
    coverage:
      "Užregistruotos nusikalstamos veikos (visos, vagystės, nusikaltimai gyvybei ir sveikatai) ir " +
      "viešosios tvarkos pažeidimai 1×1 km kvadrate, kuriame yra sklypas, palyginti su 5×5 km apylinkių vidurkiu.",
    updateFrequency: "Šaltinis atnaujinamas kas pusmetį; tikrinama kiekvienos ataskaitos metu.",
    status: "live",
    caveat:
      "Skaičiuojama vieta, kur veika užregistruota, ne kur gyvena jos dalyviai. Mažiau nei 20 veikų per metus " +
      "1 km² plote laikoma mažu nusikalstamumu.",
  },
  {
    panelKey: "flood-risk",
    name: "Potvynių grėsmės ir rizikos žemėlapiai",
    publisher: "Lietuvos Respublikos aplinkos ministerija",
    api: "ArcGIS Online · Rizika FeatureServer",
    url: "https://potvyniai.aplinka.lt",
    access: "api",
    licenceNote: "Atitinkami potvynių duomenų rinkiniai data.gov.lt skelbiami pagal CC BY-ND 4.0 licenciją.",
    processing: "Tikrinama tik, ar sklypas kertasi su rizikos gardele; pačių duomenų nekeičiame.",
    coverage: "Ar sklypas kertasi su upių ar priekrantės potvynių rizikos žemėlapio 100×100 m gardelėmis.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
    caveat:
      "Rodo tik sutapimą su rizikos gardele, ne tikslias užliejimo ribas ar tikimybę; jas reikia tikrinti oficialiame žemėlapyje.",
  },
  {
    panelKey: "census-households",
    name: "2021 m. gyventojų ir būstų surašymas",
    publisher: "Lietuvos statistikos departamentas (OSP)",
    api: "OSP · CENSUS2021_HOUSEHOLDS_GRID1000",
    url: "https://osp.stat.gov.lt",
    access: "api",
    licence: dataGovLt(3051),
    coverage:
      "Namų ūkių skaičius, šeimų su vaikais ir vieno asmens namų ūkių dalis 1×1 km kvadrate, " +
      "palyginti su Lietuvos vidurkiu.",
    updateFrequency: "Surašymas vyksta kas 10 metų; naujausi duomenys: 2021 m.",
    status: "live",
    caveat: "Kai kvadrate mažiau nei 20 namų ūkių, procentai ir palyginimas nerodomi.",
  },
  {
    panelKey: "broadband",
    name: "Fiksuotojo ryšio tinklų išvystymas",
    publisher: "Ryšių reguliavimo tarnyba (RRT)",
    api: "data.gov.lt · rrt/interneto_technologiju_rusys_pastatuose",
    url: "https://data.gov.lt",
    access: "api",
    licence: dataGovLt(3835),
    coverage:
      "Kiek pastatų 1×1 km kvadrate turi šviesolaidinį, DSL, kabelinės televizijos ar fiksuotą belaidį interneto ryšį.",
    updateFrequency: "Operatoriai duomenis teikia kartą per metus; tikrinama kiekvienos ataskaitos metu.",
    status: "live",
    caveat: "Rodo, kas yra apylinkėse, o ne konkrečiame pastate. Ar ryšys pasiekia sklypą, reikia teirautis operatoriaus.",
  },
  {
    name: "OpenStreetMap žemėlapis",
    publisher: "OpenStreetMap bendraautoriai",
    api: "tile.openstreetmap.org",
    url: "https://www.openstreetmap.org/copyright",
    access: "map-service",
    licence: { ...ODBL, statedAt: "https://www.openstreetmap.org/copyright" },
    processing: SHOWN_AS_RECEIVED,
    coverage: "Žemėlapio pagrindas: gatvės, pastatai, vandenys ir vietovardžiai.",
    updateFrequency: "Šaltinis atnaujinamas nuolat.",
    status: "map",
  },
  {
    name: "Nacionalinis ortofotografinis žemėlapis (ORT10LT)",
    publisher: "Nacionalinė žemės tarnyba",
    api: "geoportal.lt · NZT/ORT10LT",
    url: "https://www.geoportal.lt",
    access: "map-service",
    processing: SHOWN_AS_RECEIVED,
    coverage: "Aerofotonuotraukos nuo 1995 m., rodomos pasirinkus „Ortofoto“.",
    updateFrequency: "Nuotraukų metų sąrašas tikrinamas kartą per parą.",
    status: "map",
  },
  {
    name: "Esri World Imagery",
    publisher: "Esri",
    api: "server.arcgisonline.com · World_Imagery",
    url: "https://www.esri.com/en-us/legal/terms/full-master-agreement",
    access: "map-service",
    licence: {
      phrase: "pagal Esri naudojimo sąlygas",
      url: "https://www.esri.com/en-us/legal/terms/full-master-agreement",
      statedAt: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9",
    },
    processing: SHOWN_AS_RECEIVED,
    coverage: "Palydovinės nuotraukos, rodomos atitolinus žemėlapį ir kol įkeliamas nacionalinis ortofoto.",
    updateFrequency: "Šaltinis atnaujinamas nereguliariai.",
    status: "map",
  },
  {
    name: "Judriojo ryšio tinklų aprėptis",
    publisher: "Ryšių reguliavimo tarnyba (RRT)",
    api: "geoportal.lt · RRT_duomenys",
    url: "https://www.rrt.lt/judriojo-rysio-tinklu-tiketinos-aprepties-zonos/",
    access: "map-service",
    processing: SHOWN_AS_RECEIVED,
    coverage: "5G, LTE ir GSM tinklų tikėtina aprėptis pagal operatorių, rodoma žemėlapio sluoksnyje „5G“.",
    updateFrequency: "Tikrinama kiekvieno žemėlapio peržiūros metu.",
    status: "map",
    caveat: "Tai tikėtina aprėptis, apskaičiuota operatorių modeliais, ne išmatuotas ryšys konkrečioje vietoje.",
  },
  {
    name: "Nominatim adresų paieška",
    publisher: "OpenStreetMap Foundation",
    api: "nominatim.openstreetmap.org",
    url: "https://nominatim.org",
    access: "api",
    licence: { ...ODBL, statedAt: "https://www.openstreetmap.org/copyright" },
    coverage: "Randa adresą ar vietovardį, kai jį įvedate paieškoje.",
    updateFrequency: "Užklausiama paieškos metu.",
    status: "search",
  },
  {
    name: "Butų pirkimo sandoriai gardelėse",
    publisher: "Lietuvos statistikos departamentas (OSP)",
    api: "OSP · butu_pirkimas_gardelese_geo",
    url: "https://osp-sdg.stat.gov.lt",
    coverage: "Butų pirkimo sandorių skaičius ir kainos 1×1 km kvadratuose.",
    updateFrequency: "Netaikoma",
    status: "not-integrated",
    caveat:
      "Rinkinyje visoje Lietuvoje 2024 m. buvo tik apie 500 sandorių, nors rinkoje per metus parduodama dešimtys tūkstančių butų. " +
      "Tai ne rinkos kainos, todėl neįtraukta, kad neklaidintų. Rinkos vertę rodo Registrų centro masinis vertinimas.",
  },
  {
    name: "Įžuvinimai (žuvų išleidimo įvykiai)",
    publisher: "Aplinkos ministerija (BĮIP žuvinimo modulis)",
    api: "zuvinimas.biip.lt",
    url: "https://zuvinimas.biip.lt",
    coverage: "Žuvinimo įvykiai konkrečiuose vandens telkiniuose.",
    updateFrequency: "Netaikoma",
    status: "not-integrated",
    caveat:
      "Šių įrašų viešo API neradome: BĮIP žuvinimo sistema reikalauja prisijungimo " +
      "žetono. Vienintelis viešai atsisiunčiamas duomuo: statinės metinės ataskaitos " +
      "(2020-2022 m.), kurios neapima konkrečių vandens telkinių prie sklypo, todėl į " +
      "ataskaitą kol kas neįtraukta.",
  },
  {
    name: "Dirvožemis ir našumo balas",
    publisher: "Žemės ūkio duomenų centras (geoportal.lt)",
    api: "geoportal.lt · Dirv_DR10LT, Dirv_vert_DR10LT",
    url: "https://www.geoportal.lt",
    coverage:
      "Dirvožemio tipai ir granuliometrinė sudėtis, žemės našumo balas ir jo vidurkiai " +
      "kadastro vietovėje, seniūnijoje, savivaldybėje ir Lietuvoje.",
    updateFrequency: "Netaikoma",
    status: "not-integrated",
    caveat:
      "Duomenys atviri, bet skelbiami tik kaip dideli atsisiunčiami failai (vien našumo balo – 6,7 GB), " +
      "kuriuos pirmiausia reikia apdoroti savo serveryje. Tiesioginę geoportal.lt dirvožemio paslaugą " +
      "kitose svetainėse naudoti draudžiama be leidimo, todėl į ataskaitą kol kas neįtraukta.",
  },
  {
    name: "Melioracija (sausinimo sistemos ir jų būklė)",
    publisher: "Žemės ūkio duomenų centras (geoportal.lt)",
    api: "geoportal.lt · MEL_DR10LT",
    url: "https://www.geoportal.lt",
    coverage:
      "Nusausinta žemė, melioracijos projektai ir sistemų būklės problemos " +
      "(užmirkimas, neveikiantis drenažas, pasiūlymai remontuoti ar rekonstruoti).",
    updateFrequency: "Netaikoma",
    status: "not-integrated",
    caveat:
      "Duomenys atviri, bet skelbiami tik kaip atsisiunčiamas failas, kurį reikia iš anksto apdoroti " +
      "savo serveryje. Planuojama įtraukti kartu su dirvožemio duomenimis.",
  },
];

const ACCESS_PHRASE: Record<DataAccess, string> = {
  api: "pasiekiama per API",
  "map-service": "pasiekiama per žemėlapio paslaugą",
  file: "atsisiunčiama kaip viešas duomenų failas",
  "web-page": "pasiekiama per viešą svetainę",
};

/** "Rinkinys (pasiekiama per API)": the head of a source's credit line. */
export function creditHead(source: DataSource): string {
  return source.access ? `${source.name} (${ACCESS_PHRASE[source.access]})` : source.name;
}

export const ADAPTED = "Originalūs duomenys buvo apdoroti ir pritaikyti šios sistemos poreikiams.";
