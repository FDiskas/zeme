// Single catalog of every upstream registry reginfo.lt reads from. This is the
// one place that names sources, their official home, and whether they're live
// in the report today — report-format.ts's PANEL_SOURCES reads from this list
// so the two can never drift apart.

export type DataSourceStatus = "live" | "not-integrated";

export type DataSource = {
  /** Matches a report panel key (report-format.ts CATEGORIES) when status is "live". */
  panelKey?: string;
  name: string;
  publisher: string;
  api: string;
  url: string;
  coverage: string;
  updateFrequency: string;
  status: DataSourceStatus;
  caveat?: string;
};

export const DATA_SOURCES: DataSource[] = [
  {
    panelKey: "osp-parcel-summary",
    name: "Nekilnojamojo turto registras (VDA / OSP)",
    publisher: "Lietuvos statistikos departamentas (OSP)",
    api: "OSP · ntr_sklypai",
    url: "https://osp-sdg.stat.gov.lt",
    coverage: "Sklypo registro suvestinė: seniūnija, savivaldybė, pastatų ir adresų skaičius.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "biip-boundary",
    name: "BĮIP – sklypų ribos ir paskirtis",
    publisher: "VĮ Registrų centras",
    api: "biip.lt · boundaries",
    url: "https://boundaries.biip.lt",
    coverage: "Sklypo ribos, plotas, unikalus numeris, paskirtis, statusas.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "biip-addresses",
    name: "BĮIP – adresų registras",
    publisher: "VĮ Registrų centras",
    api: "biip.lt · addresses",
    url: "https://boundaries.biip.lt",
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
    coverage: "Pastatų kontūrai ir plotai, papildyti BĮIP/OSP adresais.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "pdbis-building-data",
    name: "Pastatų duomenų bankas (PDBIS)",
    publisher: "Lietuvos statistikos departamentas (OSP)",
    api: "OSP · pastatai_geo",
    url: "https://osp-sdg.stat.gov.lt",
    coverage: "Valdomų daugiabučių butų skaičius, aukštai, būklė, renovacija.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "geoportal-constraints",
    name: "Saugomų teritorijų kadastras (VSTT)",
    publisher: "Valstybinė saugomų teritorijų tarnyba",
    api: "OSP · vstt_stvk",
    url: "https://osp-sdg.stat.gov.lt",
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
    coverage: "Servitutai ir naudojimo apribojimai (elektros linijos, vandentiekiai ir pan.).",
    updateFrequency: "—",
    status: "live",
    caveat:
      "Duomenų ištrauka viešai neprieinama — VĮ Registrų centras riboja šio registro " +
      "užklausas. Rodomas tik žemėlapio vaizdas ir nuoroda kreiptis dėl prieigos.",
  },
  {
    panelKey: "osp-building-permits",
    name: "Infostatyba – statybos leidimai",
    publisher: "Valstybinė teritorijų planavimo ir statybos inspekcija (VTPSI)",
    api: "OSP · infostatyba_duomenys",
    url: "https://infostatyba.planuojustatau.lt",
    coverage: "Statybos leidimai, pranešimai ir statinių projektų dokumentai.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "osp-pollution-risks",
    name: "Potencialūs taršos židiniai",
    publisher: "Aplinkos apsaugos agentūra",
    api: "OSP · potencialus_tarsos_zidiniai",
    url: "https://osp-sdg.stat.gov.lt",
    coverage: "Žinomi taršos židiniai ir jų aplinkosauginė būklė.",
    updateFrequency: "Tikrinama tiesiogiai kiekvienos ataskaitos metu.",
    status: "live",
  },
  {
    panelKey: "rc-masvert",
    name: "Registrų centras – masinis vertinimas",
    publisher: "VĮ Registrų centras",
    api: "registrucentras.lt · masvert",
    url: "https://www.registrucentras.lt",
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
    coverage:
      "Miško kirtimo leidimai ir kirtimo biržės (kirtimo rūšis, plotas, medžiai, galiojimo laikas), " +
      "sutapatinti su sklypu tiesiogiai (privatūs sklypai) arba pagal ribų sutapimą (valstybinis miškas).",
    updateFrequency: "Šaltinis atnaujinamas kasdien; talpykla serveryje atnaujinama kas ~20 val.",
    status: "live",
  },
  {
    name: "Įžuvinimai (žuvų išleidimo įvykiai)",
    publisher: "Aplinkos ministerija (BĮIP žuvinimo modulis)",
    api: "zuvinimas.biip.lt",
    url: "https://zuvinimas.biip.lt",
    coverage: "Žuvinimo įvykiai konkrečiuose vandens telkiniuose.",
    updateFrequency: "—",
    status: "not-integrated",
    caveat:
      "Šių įrašų viešo API neradome — BĮIP žuvinimo sistema reikalauja prisijungimo " +
      "žetono. Vienintelis viešai atsisiunčiamas duomuo — statinės metinės ataskaitos " +
      "(2020–2022 m.), kurios neapima konkrečių vandens telkinių prie sklypo, todėl į " +
      "ataskaitą kol kas neįtraukta.",
  },
];
