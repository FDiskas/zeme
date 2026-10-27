import { Link } from "react-router-dom";
import { DocPage, DocSection } from "./DocPage";

// Where a reader confirms what the report shows. Each line names what to check
// there, so the list reads as a to-do, not a link farm.
const OFFICIAL_CHANNELS = [
  {
    what: "Nuosavybė, sklypo ir pastatų registro duomenys, kadastro byla",
    where: "VĮ Registrų centras",
    url: "https://www.registrucentras.lt",
  },
  {
    what: "Specialiosios žemės naudojimo sąlygos ir servitutai",
    where: "VĮ Registrų centras, SŽNS registras",
    url: "https://www.registrucentras.lt/p/1553",
  },
  {
    what: "Sklypo ribos, žemės paskirtis ir jos keitimas",
    where: "Nacionalinė žemės tarnyba",
    url: "https://www.nzt.lt",
  },
  {
    what: "Teritorijų planavimo dokumentai ir reglamentai",
    where: "Teritorijų planavimo dokumentų registras",
    url: "https://planuojustatau.lt",
  },
  {
    what: "Statybos leidimai ir projektai",
    where: "Infostatyba",
    url: "https://infostatyba.planuojustatau.lt",
  },
  {
    what: "Kultūros paveldo objektai ir jų apsaugos zonos",
    where: "Kultūros vertybių registras",
    url: "https://kvr.kpd.lt",
  },
];

export function TermsPage() {
  return (
    <DocPage
      title="Naudojimosi taisyklės"
      lead="Reginfo.lt yra informacinė priemonė. Ji surenka viešus registrų duomenis ir parodo juos vaizdžiai, bet nepakeičia oficialių dokumentų. Naudodamiesi svetaine sutinkate su šiomis taisyklėmis."
      updated="2026-10-27"
    >
      <DocSection id="paskirtis" title="1. Kam skirta svetainė">
        <p>
          Svetainė padeda susipažinti su žemės sklypu: jo ribomis, pastatais, galimais apribojimais ir aplinka.
          Visa informacija gaunama iš viešų Lietuvos valstybės registrų ir informacinių sistemų, kurias tvarko
          atsakingos institucijos. Reginfo.lt nėra registras ir nėra susijusi su šiomis institucijomis.
        </p>
      </DocSection>

      <DocSection id="duomenys" title="2. Duomenys nekeičiami">
        <p>
          Duomenis rodome taip, kaip juos pateikia šaltinis. Jų turinio nekeičiame, nieko neprirašome ir
          nepašaliname dėl to, kad reikšmė būtų palankesnė ar nepalankesnė.
        </p>
        <p>Apdorojimas yra tik techninis:</p>
        <ul className="grid list-disc gap-2 pl-6">
          <li>įrašai, rasti pagal vietą ar adresą, susiejami su sklypu;</li>
          <li>laukų pavadinimai išverčiami į lietuvių kalbą, suvienodinami matavimo vienetai, datos ir koordinatės;</li>
          <li>pasikartojantys ir tušti įrašai praleidžiami;</li>
          <li>
            kai kurie rodikliai apskaičiuojami, pavyzdžiui, atstumas tiesia linija ar palyginimas su vidurkiu.
            Prie jų parašyta, kaip jie gauti.
          </li>
        </ul>
        <p>
          Kiekvienas ataskaitos skyrius nurodo savo šaltinį ir duomenų datą. Visų šaltinių sąrašas ir licencijos:{" "}
          <Link to="/duomenu-saltiniai" className="link">Duomenų šaltiniai</Link>.
        </p>
      </DocSection>

      <DocSection id="neoficialu" title="3. Tai nėra oficialus dokumentas">
        <p>
          Ataskaita, žemėlapis ir PDF failas yra pažintiniai. Jie neturi teisinės galios ir negali pakeisti
          registro išrašo, kadastro bylos, pažymos ar specialisto išvados. Prieš priimdami sprendimą (pirkdami,
          parduodami, statydami, skolindamiesi ar pasirašydami sutartį), duomenis pasitikrinkite patys
          oficialiais kanalais:
        </p>
        <ul className="spec">
          {OFFICIAL_CHANNELS.map((channel) => (
            <li key={channel.url} className="grid gap-1 py-4">
              <span>{channel.what}</span>
              <a href={channel.url} target="_blank" rel="noreferrer" className="link w-fit text-sm">
                {channel.where}
              </a>
            </li>
          ))}
        </ul>
        <p>Dėl konkrečios vietos reikalavimų taip pat galite kreiptis į savivaldybę.</p>
      </DocSection>

      <DocSection id="tikslumas" title="4. Tikslumas ir aktualumas">
        <p>
          Registrų duomenys gali būti pasenę, neišsamūs ar klaidingi jau šaltinyje. Be to, šaltinis gali būti
          laikinai nepasiekiamas, o įrašų susiejimas su sklypu pagal vietą ar adresą gali suklysti.
        </p>
        <p>
          Kad nereikėtų kaskart kreiptis į registrus, sklypo ataskaita išsaugoma iki 6 mėnesių. Ataskaitos
          viršuje matyti, kada duomenys patikrinti; juos galite atnaujinti patys.
        </p>
      </DocSection>

      <DocSection id="atsakomybe" title="5. Atsakomybė">
        <p>
          Svetainė teikiama tokia, kokia yra, be jokių garantijų. Už sprendimus, priimtus remiantis joje rodoma
          informacija, atsako pats naudotojas. Svetainės kūrėjai neatsako už nuostolius, kilusius dėl šaltinių
          klaidų, duomenų netikslumų ar laikino svetainės neveikimo.
        </p>
      </DocSection>

      <DocSection id="licencijos" title="6. Licencijos ir pakartotinis naudojimas">
        <p>
          Duomenys priklauso juos tvarkančioms institucijoms ir naudojami pagal kiekvieno šaltinio licenciją ar
          naudojimo sąlygas. Jei duomenis iš šios svetainės naudojate toliau, laikykitės originalaus šaltinio
          licencijos ir nurodykite jį, ne tik Reginfo.lt.
        </p>
        <p>
          Žemėlapio pagrindas: © OpenStreetMap bendraautoriai (ODbL). Ortofoto: Nacionalinė žemės tarnyba
          (geoportal.lt) ir Esri.
        </p>
      </DocSection>

      <DocSection id="privatumas" title="7. Privatumas">
        <p>
          Registruotis nereikia, reklamos ir lankytojų sekimo slapukų nenaudojame. Neseniai peržiūrėti sklypai
          saugomi tik jūsų naršyklėje, ir juos galite ištrinti bet kada.
        </p>
        <p>
          Paieškos užklausa (adresas, numeris ar koordinatės) siunčiama mūsų serveriui, o iš jo į duomenų
          šaltinius. Adresų paieška naudoja OpenStreetMap Nominatim paslaugą. Serveryje išsaugomos tik sklypų
          ataskaitos, sudarytos iš viešų registrų duomenų.
        </p>
      </DocSection>

      <DocSection id="klaidos" title="8. Klaidos ir pasiūlymai">
        <p>
          Pastebėję netikslumą, pirmiausia patikrinkite jį oficialiame šaltinyje: jei klaida yra ten, ją
          ištaisyti gali tik registrą tvarkanti institucija. Jei klaida atsirado mūsų pusėje, praneškite{" "}
          <a href="https://github.com/FDiskas/zeme/issues" target="_blank" rel="noreferrer" className="link">
            GitHub
          </a>
          .
        </p>
      </DocSection>

      <DocSection id="keitimai" title="9. Taisyklių keitimas">
        <p>
          Taisyklės gali būti keičiamos, pavyzdžiui, atsiradus naujiems duomenų šaltiniams. Galioja šiame
          puslapyje paskelbta versija; jos data nurodyta puslapio viršuje.
        </p>
      </DocSection>
    </DocPage>
  );
}
