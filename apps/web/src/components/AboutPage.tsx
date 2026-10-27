import { Link } from "react-router-dom";
import { DATA_SOURCES } from "../lib/data-sources";
import { DocPage, DocSection } from "./DocPage";
import { CheckIcon, CloseIcon, WarningIcon } from "./icons";

const DOES = [
  "Surenkame viešai skelbiamus duomenis tiesiai iš valstybės registrų ir informacinių sistemų.",
  "Parodome juos vienoje vietoje: žemėlapyje, sklypo kortelėje ir PDF ataskaitoje.",
  "Prie kiekvieno įrašo nurodome, iš kurio registro jis gautas ir kada patikrintas.",
  "Techniškai suvienodiname formą: lietuviški pavadinimai, vienodi matavimo vienetai ir datos.",
];

const DOES_NOT = [
  "Nekeičiame registrų reikšmių ir neperrašome jų turinio.",
  "Nevertiname turto ir nepatariame, ar sklypą pirkti.",
  "Neišduodame oficialių pažymų ar registrų išrašų.",
  "Neatstovaujame jokiai valstybės institucijai.",
];

const live = DATA_SOURCES.filter((source) => source.status === "live").length;

export function AboutPage() {
  return (
    <DocPage
      title="Apie projektą"
      lead="Reginfo.lt surenka viešus Lietuvos registrų duomenis apie žemės sklypą ir jo aplinką ir parodo juos vienoje vietoje, kad nereikėtų jų ieškoti dešimtyje skirtingų svetainių."
    >
      <DocSection title="Kas tai">
        <p>
          Įvedate adresą, unikalų ar kadastrinį numerį arba spustelėjate sklypą žemėlapyje. Sistema tuo metu
          kreipiasi į viešus duomenų šaltinius (šiuo metu jų {live}): sklypo ribas, pastatus, saugomas teritorijas,
          kultūros paveldą, planavimo reglamentus, statybos leidimus, aplinką ir kitus. Atsakymus surenka į vieną
          ataskaitą.
        </p>
        <p>Naudotis nemokama ir nereikia registruotis.</p>
      </DocSection>

      <DocSection title="Ką darome ir ko nedarome">
        <ul className="grid gap-3">
          {DOES.map((line) => (
            <li key={line} className="flex gap-3">
              <CheckIcon className="mt-1 h-5 w-5 shrink-0 text-green" />
              {line}
            </li>
          ))}
        </ul>
        <ul className="grid gap-3">
          {DOES_NOT.map((line) => (
            <li key={line} className="flex gap-3">
              <CloseIcon className="mt-1 h-5 w-5 shrink-0 text-warn" />
              {line}
            </li>
          ))}
        </ul>
        <p>
          Kai kurie rodikliai apskaičiuojami iš šaltinio duomenų, pavyzdžiui, atstumas iki mokyklos tiesia linija
          ar palyginimas su apylinkių vidurkiu. Prie tokio rodiklio visada parašyta, kaip jis gautas.
        </p>
      </DocSection>

      <DocSection title="Tai nėra oficialus dokumentas">
        <p className="flex gap-3">
          <WarningIcon className="mt-1 h-5 w-5 shrink-0 text-warn" />
          <span>
            Ataskaita yra pažintinė ir neturi teisinės galios. Registrų duomenys gali būti pasenę, neišsamūs ar
            klaidingi, o mūsų sutapatinimas su sklypu gali suklysti. Prieš pirkdami, parduodami, statydami ar
            pasirašydami sutartį, duomenis pasitikrinkite oficialiais kanalais: Registrų centre, savivaldybėje,
            pas notarą ar atsakingoje institucijoje.
          </span>
        </p>
        <p>
          Plačiau: <Link to="/naudojimosi-taisykles" className="link">Naudojimosi taisyklės</Link>.
        </p>
      </DocSection>

      <DocSection title="Duomenų šaltiniai">
        <p>
          Visi duomenys yra vieši ir priklauso juos tvarkančioms institucijoms. Kiekvieno šaltinio pavadinimas,
          tvarkytojas, licencija ir atnaujinimo dažnis surašyti{" "}
          <Link to="/duomenu-saltiniai" className="link">duomenų šaltinių puslapyje</Link>.
        </p>
      </DocSection>

      <DocSection title="Atviras kodas">
        <p>
          Projekto programos kodas viešas, todėl kiekvienas gali patikrinti, kaip duomenys gaunami ir rodomi.
          Pastebėję klaidą ar netikslumą, praneškite{" "}
          <a href="https://github.com/FDiskas/zeme/issues" target="_blank" rel="noreferrer" className="link">
            GitHub
          </a>
          .
        </p>
      </DocSection>
    </DocPage>
  );
}
