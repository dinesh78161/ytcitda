// Official ITDA Paderu Division (Alluri Sitha Ramaraju District) Route Plan Data
// Includes 11 Mandals, catchment PHCs, and official tribal habitations.

export interface HabitationItem {
  nameEn: string;
  nameTe?: string;
  phc?: string;
}

export interface MandalInfo {
  id: string;
  nameEn: string;
  nameTe: string;
  phcs: string[];
  habitations: HabitationItem[];
}

export const ASR_MANDALS: MandalInfo[] = [
  {
    "id": "paderu",
    "nameEn": "Paderu",
    "nameTe": "పాడేరు",
    "phcs": [
      "Edulapalem",
      "Minumuluru"
    ],
    "habitations": [
      {
        "nameEn": "Aluguru",
        "nameTe": "Aluguru",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Antilova",
        "nameTe": "Antilova",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Arlada",
        "nameTe": "Arlada",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Bandarothuputtu",
        "nameTe": "Bandarothuputtu",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Bangarumetta",
        "nameTe": "Bangarumetta",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Chemalapalli",
        "nameTe": "Chemalapalli",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Chinthalaveedhi",
        "nameTe": "Chinthalaveedhi",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Chodipilli",
        "nameTe": "Chodipilli",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "D.gonduru",
        "nameTe": "D.gonduru",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "D.modhaputtu",
        "nameTe": "D.modhaputtu",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Dallapalli",
        "nameTe": "Dallapalli",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Devapuram",
        "nameTe": "Devapuram",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Doddipalli",
        "nameTe": "Doddipalli",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Dokuluru",
        "nameTe": "Dokuluru",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Dummaputtu",
        "nameTe": "Dummaputtu",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Eradapalli",
        "nameTe": "Eradapalli",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "G. Colony",
        "nameTe": "G. Colony",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "G.munchingiputtu",
        "nameTe": "G.munchingiputtu",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Gondeli",
        "nameTe": "Gondeli",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Guthulaputtu",
        "nameTe": "Guthulaputtu",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Inada",
        "nameTe": "Inada",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Jangadapalli",
        "nameTe": "Jangadapalli",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Kakki",
        "nameTe": "Kakki",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Kandulapalem",
        "nameTe": "Kandulapalem",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Kinchuru",
        "nameTe": "Kinchuru",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Kotha Paderu",
        "nameTe": "Kotha Paderu",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Kothavalasa",
        "nameTe": "Kothavalasa",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Lagisapalli",
        "nameTe": "Lagisapalli",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Lingaputtu",
        "nameTe": "Lingaputtu",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Locheliputtu",
        "nameTe": "Locheliputtu",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Lolangapadu",
        "nameTe": "Lolangapadu",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Modhapalli",
        "nameTe": "Modhapalli",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Neruduvalasa",
        "nameTe": "Neruduvalasa",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Obarthi",
        "nameTe": "Obarthi",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Onuru",
        "nameTe": "Onuru",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Pedapolem",
        "nameTe": "Pedapolem",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Ramuluaputtu",
        "nameTe": "Ramuluaputtu",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Rayapalem",
        "nameTe": "Rayapalem",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Salugu",
        "nameTe": "Salugu",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Sappiputtu",
        "nameTe": "Sappiputtu",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Taragam",
        "nameTe": "Taragam",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Thumpada",
        "nameTe": "Thumpada",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Thumpalapalem",
        "nameTe": "Thumpalapalem",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Vanajaparthi",
        "nameTe": "Vanajaparthi",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Vanthadapalli",
        "nameTe": "Vanthadapalli",
        "phc": "Minumuluru"
      },
      {
        "nameEn": "Vantlamamidi",
        "nameTe": "Vantlamamidi",
        "phc": "Edulapalem"
      },
      {
        "nameEn": "Y Solamalu",
        "nameTe": "Y Solamalu",
        "phc": "Minumuluru"
      }
    ]
  },
  {
    "id": "araku_valley",
    "nameEn": "Araku Valley",
    "nameTe": "అరకు లోయ",
    "phcs": [
      "Gannela",
      "Madagada",
      "Sunkarametta"
    ],
    "habitations": [
      {
        "nameEn": "Aadari",
        "nameTe": "Aadari",
        "phc": "Gannela"
      },
      {
        "nameEn": "Baski",
        "nameTe": "Baski",
        "phc": "Madagada"
      },
      {
        "nameEn": "Bondam",
        "nameTe": "Bondam",
        "phc": "Sunkarametta"
      },
      {
        "nameEn": "C-colony",
        "nameTe": "C-colony",
        "phc": "Gannela"
      },
      {
        "nameEn": "Chinalabudu",
        "nameTe": "Chinalabudu",
        "phc": "Gannela"
      },
      {
        "nameEn": "Chompi",
        "nameTe": "Chompi",
        "phc": "Madagada"
      },
      {
        "nameEn": "Dorraguda",
        "nameTe": "Dorraguda",
        "phc": "Madagada"
      },
      {
        "nameEn": "Gangudi",
        "nameTe": "Gangudi",
        "phc": "Madagada"
      },
      {
        "nameEn": "Gannela",
        "nameTe": "Gannela",
        "phc": "Gannela"
      },
      {
        "nameEn": "Girliguda",
        "nameTe": "Girliguda",
        "phc": "Madagada"
      },
      {
        "nameEn": "Hattaguda",
        "nameTe": "Hattaguda",
        "phc": "Madagada"
      },
      {
        "nameEn": "Iragai",
        "nameTe": "Iragai",
        "phc": "Gannela"
      },
      {
        "nameEn": "Kodipunjuvalasa",
        "nameTe": "Kodipunjuvalasa",
        "phc": "Madagada"
      },
      {
        "nameEn": "Korraguda",
        "nameTe": "Korraguda",
        "phc": "Madagada"
      },
      {
        "nameEn": "Kothaballuguda",
        "nameTe": "Kothaballuguda",
        "phc": "Sunkarametta"
      },
      {
        "nameEn": "Kothavalasa",
        "nameTe": "Kothavalasa",
        "phc": "Madagada"
      },
      {
        "nameEn": "Limbaguda",
        "nameTe": "Limbaguda",
        "phc": "Sunkarametta"
      },
      {
        "nameEn": "Lotheru",
        "nameTe": "Lotheru",
        "phc": "Gannela"
      },
      {
        "nameEn": "Madagada  (dalapathiguda)",
        "nameTe": "Madagada  (dalapathiguda)",
        "phc": "Madagada"
      },
      {
        "nameEn": "Madagada II",
        "nameTe": "Madagada II",
        "phc": "Madagada"
      },
      {
        "nameEn": "Madala",
        "nameTe": "Madala",
        "phc": "Gannela"
      },
      {
        "nameEn": "Madala(borriguda)",
        "nameTe": "Madala(borriguda)",
        "phc": "Gannela"
      },
      {
        "nameEn": "Malisingaram",
        "nameTe": "Malisingaram",
        "phc": "Gannela"
      },
      {
        "nameEn": "Padmapuram",
        "nameTe": "Padmapuram",
        "phc": "Madagada"
      },
      {
        "nameEn": "Padmapuram II",
        "nameTe": "Padmapuram II",
        "phc": "Madagada"
      },
      {
        "nameEn": "Pedalabudu I",
        "nameTe": "Pedalabudu I",
        "phc": "Sunkarametta"
      },
      {
        "nameEn": "Pedalabudu II",
        "nameTe": "Pedalabudu II",
        "phc": "Gannela"
      },
      {
        "nameEn": "Pedalabudu III",
        "nameTe": "Pedalabudu III",
        "phc": "Madagada"
      },
      {
        "nameEn": "Ranajilda",
        "nameTe": "Ranajilda",
        "phc": "Madagada"
      },
      {
        "nameEn": "Rega",
        "nameTe": "Rega",
        "phc": "Sunkarametta"
      },
      {
        "nameEn": "S.bonduguda",
        "nameTe": "S.bonduguda",
        "phc": "Madagada"
      },
      {
        "nameEn": "Sarbaugda",
        "nameTe": "Sarbaugda",
        "phc": "Madagada"
      },
      {
        "nameEn": "Simliguda",
        "nameTe": "Simliguda",
        "phc": "Sunkarametta"
      },
      {
        "nameEn": "Srigam",
        "nameTe": "Srigam",
        "phc": "Madagada"
      },
      {
        "nameEn": "Sunkarmetta",
        "nameTe": "Sunkarmetta",
        "phc": "Sunkarametta"
      },
      {
        "nameEn": "Urumulu",
        "nameTe": "Urumulu",
        "phc": "Gannela"
      },
      {
        "nameEn": "Varra",
        "nameTe": "Varra",
        "phc": "Madagada"
      }
    ]
  },
  {
    "id": "ananthagiri",
    "nameEn": "Ananthagiri",
    "nameTe": "అనంతగిరి",
    "phcs": [
      "Anantagiri",
      "Bheemavaram",
      "Lungaparthi",
      "Pinakota"
    ],
    "habitations": [
      {
        "nameEn": "Bheempolu",
        "nameTe": "Bheempolu",
        "phc": "Bheemavaram"
      },
      {
        "nameEn": "Bheempolu(seethapadu)",
        "nameTe": "Bheempolu(seethapadu)",
        "phc": "Bheemavaram"
      },
      {
        "nameEn": "Borra",
        "nameTe": "Borra",
        "phc": "Anantagiri"
      },
      {
        "nameEn": "Borra(konapuram)",
        "nameTe": "Borra(konapuram)",
        "phc": "Anantagiri"
      },
      {
        "nameEn": "Chilakalagedda",
        "nameTe": "Chilakalagedda",
        "phc": "Bheemavaram"
      },
      {
        "nameEn": "Chilakalagedda(dabbalapadu)",
        "nameTe": "Chilakalagedda(dabbalapadu)",
        "phc": "Bheemavaram"
      },
      {
        "nameEn": "Gumma",
        "nameTe": "Gumma",
        "phc": "Lungaparthi"
      },
      {
        "nameEn": "Gumma(ethammavalasa)",
        "nameTe": "Gumma(ethammavalasa)",
        "phc": "Lungaparthi"
      },
      {
        "nameEn": "Gummakota",
        "nameTe": "Gummakota",
        "phc": "Bheemavaram"
      },
      {
        "nameEn": "Gummakota(gotalapadu)",
        "nameTe": "Gummakota(gotalapadu)",
        "phc": "Bheemavaram"
      },
      {
        "nameEn": "Kasipatnam",
        "nameTe": "Kasipatnam",
        "phc": "Anantagiri"
      },
      {
        "nameEn": "Kivarla",
        "nameTe": "Kivarla",
        "phc": "Pinakota"
      },
      {
        "nameEn": "Kivarla(tanakavalasa)",
        "nameTe": "Kivarla(tanakavalasa)",
        "phc": "Pinakota"
      },
      {
        "nameEn": "Kondibha",
        "nameTe": "Kondibha",
        "phc": "Anantagiri"
      },
      {
        "nameEn": "Kondibha(sada)",
        "nameTe": "Kondibha(sada)",
        "phc": "Anantagiri"
      },
      {
        "nameEn": "Kothuru",
        "nameTe": "Kothuru",
        "phc": "Anantagiri"
      },
      {
        "nameEn": "Lungaparthi(mettavalasa)",
        "nameTe": "Lungaparthi(mettavalasa)",
        "phc": "Lungaparthi"
      },
      {
        "nameEn": "N R Puram",
        "nameTe": "N R Puram",
        "phc": "Bheemavaram"
      },
      {
        "nameEn": "NR Puram(d.kotaparthi)",
        "nameTe": "NR Puram(d.kotaparthi)",
        "phc": "Bheemavaram"
      },
      {
        "nameEn": "Pedabidda",
        "nameTe": "Pedabidda",
        "phc": "Lungaparthi"
      },
      {
        "nameEn": "Pedakota",
        "nameTe": "Pedakota",
        "phc": "Pinakota"
      },
      {
        "nameEn": "Pedakota(sata Kamba)",
        "nameTe": "Pedakota(sata Kamba)",
        "phc": "Pinakota"
      },
      {
        "nameEn": "Pynampadu",
        "nameTe": "Pynampadu",
        "phc": "Lungaparthi"
      },
      {
        "nameEn": "Pynampadu(banguda)",
        "nameTe": "Pynampadu(banguda)",
        "phc": "Lungaparthi"
      },
      {
        "nameEn": "Rompali(rj Puram)",
        "nameTe": "Rompali(rj Puram)",
        "phc": "Bheemavaram"
      },
      {
        "nameEn": "Rompalli",
        "nameTe": "Rompalli",
        "phc": "Bheemavaram"
      },
      {
        "nameEn": "Tokuru",
        "nameTe": "Tokuru",
        "phc": "Anantagiri"
      },
      {
        "nameEn": "Tokuru(jakaravalasa)",
        "nameTe": "Tokuru(jakaravalasa)",
        "phc": "Anantagiri"
      },
      {
        "nameEn": "Valasi",
        "nameTe": "Valasi",
        "phc": "Lungaparthi"
      },
      {
        "nameEn": "Valasi(kumbarthi)",
        "nameTe": "Valasi(kumbarthi)",
        "phc": "Lungaparthi"
      },
      {
        "nameEn": "Yeguva Sobha",
        "nameTe": "Yeguva Sobha",
        "phc": "Anantagiri"
      },
      {
        "nameEn": "Yeguvasobha",
        "nameTe": "Yeguvasobha",
        "phc": "Anantagiri"
      },
      {
        "nameEn": "Zeenabadu",
        "nameTe": "Zeenabadu",
        "phc": "Pinakota"
      },
      {
        "nameEn": "Zeenabadu(sarya)",
        "nameTe": "Zeenabadu(sarya)",
        "phc": "Pinakota"
      }
    ]
  },
  {
    "id": "dumbriguda",
    "nameEn": "Dumbriguda",
    "nameTe": "డుంబ్రిగుడ",
    "phcs": [
      "Dumbriguda",
      "Killoguda"
    ],
    "habitations": [
      {
        "nameEn": "AC Nagar",
        "nameTe": "AC Nagar",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Arama",
        "nameTe": "Arama",
        "phc": "Dumbriguda"
      },
      {
        "nameEn": "Baliyaguda",
        "nameTe": "Baliyaguda",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Balluguda",
        "nameTe": "Balluguda",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Beddapadu",
        "nameTe": "Beddapadu",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Bonduda",
        "nameTe": "Bonduda",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Busivalasa",
        "nameTe": "Busivalasa",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Demuduvalasa",
        "nameTe": "Demuduvalasa",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Dokiripadu",
        "nameTe": "Dokiripadu",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Gasaba",
        "nameTe": "Gasaba",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Gedelabanda",
        "nameTe": "Gedelabanda",
        "phc": "Dumbriguda"
      },
      {
        "nameEn": "Gondivalasa",
        "nameTe": "Gondivalasa",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Gorapur",
        "nameTe": "Gorapur",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Guntagannela",
        "nameTe": "Guntagannela",
        "phc": "Dumbriguda"
      },
      {
        "nameEn": "Guntaseema",
        "nameTe": "Guntaseema",
        "phc": "Dumbriguda"
      },
      {
        "nameEn": "Kandrum",
        "nameTe": "Kandrum",
        "phc": "Dumbriguda"
      },
      {
        "nameEn": "Kinchumanda",
        "nameTe": "Kinchumanda",
        "phc": "Dumbriguda"
      },
      {
        "nameEn": "Kithalangi",
        "nameTe": "Kithalangi",
        "phc": "Dumbriguda"
      },
      {
        "nameEn": "Kollaput",
        "nameTe": "Kollaput",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Koronjuguda",
        "nameTe": "Koronjuguda",
        "phc": "Dumbriguda"
      },
      {
        "nameEn": "Korra",
        "nameTe": "Korra",
        "phc": "Dumbriguda"
      },
      {
        "nameEn": "Korrai",
        "nameTe": "Korrai",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Kuridi",
        "nameTe": "Kuridi",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Malivalasa",
        "nameTe": "Malivalasa",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Manjuguda",
        "nameTe": "Manjuguda",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Moriyaguda",
        "nameTe": "Moriyaguda",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Morriguda",
        "nameTe": "Morriguda",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Neredavalasa",
        "nameTe": "Neredavalasa",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Pedduru",
        "nameTe": "Pedduru",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Pothangi",
        "nameTe": "Pothangi",
        "phc": "Dumbriguda"
      },
      {
        "nameEn": "Sagara",
        "nameTe": "Sagara",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Sharath Nagar",
        "nameTe": "Sharath Nagar",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Similiguda",
        "nameTe": "Similiguda",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Sovva",
        "nameTe": "Sovva",
        "phc": "Killoguda"
      },
      {
        "nameEn": "Sunnammetta",
        "nameTe": "Sunnammetta",
        "phc": "Killoguda"
      }
    ]
  },
  {
    "id": "hukumpeta",
    "nameEn": "Hukumpeta",
    "nameTe": "హుకుంపేట",
    "phcs": [
      "Hukumpeta",
      "Uppa"
    ],
    "habitations": [
      {
        "nameEn": "Bakuru",
        "nameTe": "Bakuru",
        "phc": "Uppa"
      },
      {
        "nameEn": "Bheemavaram",
        "nameTe": "Bheemavaram",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Boorja",
        "nameTe": "Boorja",
        "phc": "Uppa"
      },
      {
        "nameEn": "Durgam",
        "nameTe": "Durgam",
        "phc": "Uppa"
      },
      {
        "nameEn": "Gadikinchumanda",
        "nameTe": "Gadikinchumanda",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Ganneruputtu",
        "nameTe": "Ganneruputtu",
        "phc": "Uppa"
      },
      {
        "nameEn": "Gasarapalli",
        "nameTe": "Gasarapalli",
        "phc": "Uppa"
      },
      {
        "nameEn": "Gattum",
        "nameTe": "Gattum",
        "phc": "Uppa"
      },
      {
        "nameEn": "Guda",
        "nameTe": "Guda",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Jarrakonda",
        "nameTe": "Jarrakonda",
        "phc": "Uppa"
      },
      {
        "nameEn": "Kotnapalli",
        "nameTe": "Kotnapalli",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Mattam",
        "nameTe": "Mattam",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Matyapuram",
        "nameTe": "Matyapuram",
        "phc": "Uppa"
      },
      {
        "nameEn": "Mottujoru",
        "nameTe": "Mottujoru",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Muliyaputtu",
        "nameTe": "Muliyaputtu",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Olda",
        "nameTe": "Olda",
        "phc": "Uppa"
      },
      {
        "nameEn": "Pathakota",
        "nameTe": "Pathakota",
        "phc": "Uppa"
      },
      {
        "nameEn": "Pattem",
        "nameTe": "Pattem",
        "phc": "Uppa"
      },
      {
        "nameEn": "Rangaseela",
        "nameTe": "Rangaseela",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Rapa",
        "nameTe": "Rapa",
        "phc": "Uppa"
      },
      {
        "nameEn": "Santhari",
        "nameTe": "Santhari",
        "phc": "Uppa"
      },
      {
        "nameEn": "Santhari(kuthangi)",
        "nameTe": "Santhari(kuthangi)",
        "phc": "Uppa"
      },
      {
        "nameEn": "Sobha Kota",
        "nameTe": "Sobha Kota",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Sukuru",
        "nameTe": "Sukuru",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Thadigiri",
        "nameTe": "Thadigiri",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Thadiputtu",
        "nameTe": "Thadiputtu",
        "phc": "Hukumpeta"
      },
      {
        "nameEn": "Theegalavalasa",
        "nameTe": "Theegalavalasa",
        "phc": "Hukumpeta"
      }
    ]
  },
  {
    "id": "pedabayalu",
    "nameEn": "Pedabayalu",
    "nameTe": "పెదబయలు",
    "phcs": [
      "Gomangi",
      "Pedabayalu",
      "Rudakota"
    ],
    "habitations": [
      {
        "nameEn": "(rudakota)koravangi",
        "nameTe": "(rudakota)koravangi",
        "phc": "Rudakota"
      },
      {
        "nameEn": "Adugulaputt",
        "nameTe": "Adugulaputt",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Adugulaputtu",
        "nameTe": "Adugulaputtu",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Aradakota",
        "nameTe": "Aradakota",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Aradakota(ukkurbha)",
        "nameTe": "Aradakota(ukkurbha)",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Aradakota(vanabangi)",
        "nameTe": "Aradakota(vanabangi)",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Babusala",
        "nameTe": "Babusala",
        "phc": "Rudakota"
      },
      {
        "nameEn": "Ballapurai",
        "nameTe": "Ballapurai",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Boithili",
        "nameTe": "Boithili",
        "phc": "Gomangi"
      },
      {
        "nameEn": "Bondapalli",
        "nameTe": "Bondapalli",
        "phc": "Gomangi"
      },
      {
        "nameEn": "Borranerodu",
        "nameTe": "Borranerodu",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Bungaput",
        "nameTe": "Bungaput",
        "phc": "Rudakota"
      },
      {
        "nameEn": "Busiput",
        "nameTe": "Busiput",
        "phc": "Rudakota"
      },
      {
        "nameEn": "E Kumada",
        "nameTe": "E Kumada",
        "phc": "Rudakota"
      },
      {
        "nameEn": "Gadepalli(kimudupalli)",
        "nameTe": "Gadepalli(kimudupalli)",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Gamparai",
        "nameTe": "Gamparai",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Ginnelakota",
        "nameTe": "Ginnelakota",
        "phc": "Rudakota"
      },
      {
        "nameEn": "Gomngi(karugonda)",
        "nameTe": "Gomngi(karugonda)",
        "phc": "Gomangi"
      },
      {
        "nameEn": "Injari",
        "nameTe": "Injari",
        "phc": "Gomangi"
      },
      {
        "nameEn": "Jamiguda",
        "nameTe": "Jamiguda",
        "phc": "Rudakota"
      },
      {
        "nameEn": "Kimudupalli",
        "nameTe": "Kimudupalli",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Kimudupalli(pulugondhi)",
        "nameTe": "Kimudupalli(pulugondhi)",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Kindalam",
        "nameTe": "Kindalam",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Kulluba",
        "nameTe": "Kulluba",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Kunthurla",
        "nameTe": "Kunthurla",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Kunthurla(boitheli Lanka)",
        "nameTe": "Kunthurla(boitheli Lanka)",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Lingeti",
        "nameTe": "Lingeti",
        "phc": "Gomangi"
      },
      {
        "nameEn": "P. Kodapalli",
        "nameTe": "P. Kodapalli",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Pareeda(peddaputtu)",
        "nameTe": "Pareeda(peddaputtu)",
        "phc": "Rudakota"
      },
      {
        "nameEn": "Parreda",
        "nameTe": "Parreda",
        "phc": "Rudakota"
      },
      {
        "nameEn": "Pedakodepalli(merakachintha)",
        "nameTe": "Pedakodepalli(merakachintha)",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Ranguloya(bondapalli)",
        "nameTe": "Ranguloya(bondapalli)",
        "phc": "Gomangi"
      },
      {
        "nameEn": "Seekari",
        "nameTe": "Seekari",
        "phc": "Pedabayalu"
      },
      {
        "nameEn": "Seethagunta",
        "nameTe": "Seethagunta",
        "phc": "Pedabayalu"
      }
    ]
  },
  {
    "id": "munchingi_puttu",
    "nameEn": "Munchingi Puttu",
    "nameTe": "ముంచింగిపుట్టు",
    "phcs": [
      "Kilagada",
      "Labburu"
    ],
    "habitations": [
      {
        "nameEn": "Antabongu",
        "nameTe": "Antabongu",
        "phc": "Labburu"
      },
      {
        "nameEn": "Bangarumetta",
        "nameTe": "Bangarumetta",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Barada",
        "nameTe": "Barada",
        "phc": "Labburu"
      },
      {
        "nameEn": "Birreguda",
        "nameTe": "Birreguda",
        "phc": "Labburu"
      },
      {
        "nameEn": "Darela",
        "nameTe": "Darela",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Deemguda",
        "nameTe": "Deemguda",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Dhodiputtu",
        "nameTe": "Dhodiputtu",
        "phc": "Labburu"
      },
      {
        "nameEn": "Jarjula",
        "nameTe": "Jarjula",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Jarrela",
        "nameTe": "Jarrela",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Jolaputtu",
        "nameTe": "Jolaputtu",
        "phc": "Labburu"
      },
      {
        "nameEn": "Karimikaput",
        "nameTe": "Karimikaput",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Kinchaiput",
        "nameTe": "Kinchaiput",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Lakshmipuram",
        "nameTe": "Lakshmipuram",
        "phc": "Labburu"
      },
      {
        "nameEn": "Makavaram",
        "nameTe": "Makavaram",
        "phc": "Labburu"
      },
      {
        "nameEn": "Panasa",
        "nameTe": "Panasa",
        "phc": "Labburu"
      },
      {
        "nameEn": "Panasaputtu",
        "nameTe": "Panasaputtu",
        "phc": "Labburu"
      },
      {
        "nameEn": "Pedaguda",
        "nameTe": "Pedaguda",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Pedathamingula",
        "nameTe": "Pedathamingula",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Ramula",
        "nameTe": "Ramula",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Saradhi",
        "nameTe": "Saradhi",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Sujanakota",
        "nameTe": "Sujanakota",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Thallabuthota",
        "nameTe": "Thallabuthota",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Vanabhasingi",
        "nameTe": "Vanabhasingi",
        "phc": "Kilagada"
      },
      {
        "nameEn": "Vanugumma",
        "nameTe": "Vanugumma",
        "phc": "Labburu"
      },
      {
        "nameEn": "Yenugurai",
        "nameTe": "Yenugurai",
        "phc": "Kilagada"
      }
    ]
  },
  {
    "id": "g_madugula",
    "nameEn": "G. Madugula",
    "nameTe": "జి. మడుగుల",
    "phcs": [
      "G.madugula",
      "Gemmili"
    ],
    "habitations": [
      {
        "nameEn": "Aragadapalli",
        "nameTe": "Aragadapalli",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Balamanusanka",
        "nameTe": "Balamanusanka",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Ballipeta",
        "nameTe": "Ballipeta",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Bheeram",
        "nameTe": "Bheeram",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Bodagondi",
        "nameTe": "Bodagondi",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Borrathadi",
        "nameTe": "Borrathadi",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Chepalli",
        "nameTe": "Chepalli",
        "phc": "G.madugula"
      },
      {
        "nameEn": "G.m.kotturu",
        "nameTe": "G.m.kotturu",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Gaddarayi",
        "nameTe": "Gaddarayi",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Gaduthuru",
        "nameTe": "Gaduthuru",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Gandhinagar",
        "nameTe": "Gandhinagar",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Gondhipadu",
        "nameTe": "Gondhipadu",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Jalamputtu",
        "nameTe": "Jalamputtu",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Jerrai",
        "nameTe": "Jerrai",
        "phc": "Gemmili"
      },
      {
        "nameEn": "K.kodapalli",
        "nameTe": "K.kodapalli",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Kimudupalli",
        "nameTe": "Kimudupalli",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Korapalli",
        "nameTe": "Korapalli",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Kottapalli",
        "nameTe": "Kottapalli",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Kulupadu",
        "nameTe": "Kulupadu",
        "phc": "Gemmili"
      },
      {
        "nameEn": "M.nittaputtu",
        "nameTe": "M.nittaputtu",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Madhuramamidi",
        "nameTe": "Madhuramamidi",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Metlapadu",
        "nameTe": "Metlapadu",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Nittamamidi",
        "nameTe": "Nittamamidi",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Nurmathi",
        "nameTe": "Nurmathi",
        "phc": "G.madugula"
      },
      {
        "nameEn": "P.p.palem",
        "nameTe": "P.p.palem",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Pairumamidi",
        "nameTe": "Pairumamidi",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Palamamidi",
        "nameTe": "Palamamidi",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Pedalochali",
        "nameTe": "Pedalochali",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Pedaluvvasingi",
        "nameTe": "Pedaluvvasingi",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Pinalochali",
        "nameTe": "Pinalochali",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Puttadigondi",
        "nameTe": "Puttadigondi",
        "phc": "Gemmili"
      },
      {
        "nameEn": "S.pedabayulu",
        "nameTe": "S.pedabayulu",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Sadeku",
        "nameTe": "Sadeku",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Sampanghipadu",
        "nameTe": "Sampanghipadu",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Sanguloya",
        "nameTe": "Sanguloya",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Singarbha",
        "nameTe": "Singarbha",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Solabham",
        "nameTe": "Solabham",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Tasarabayalu",
        "nameTe": "Tasarabayalu",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Tiyyamamidi",
        "nameTe": "Tiyyamamidi",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Urumu",
        "nameTe": "Urumu",
        "phc": "G.madugula"
      },
      {
        "nameEn": "V.kodapalli",
        "nameTe": "V.kodapalli",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Vakapalli",
        "nameTe": "Vakapalli",
        "phc": "G.madugula"
      },
      {
        "nameEn": "Vanbarangipadu",
        "nameTe": "Vanbarangipadu",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Vanthala",
        "nameTe": "Vanthala",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Vasamamidi",
        "nameTe": "Vasamamidi",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Vattivegasa",
        "nameTe": "Vattivegasa",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Vennalakota",
        "nameTe": "Vennalakota",
        "phc": "Gemmili"
      },
      {
        "nameEn": "Yeduchavallu",
        "nameTe": "Yeduchavallu",
        "phc": "G.madugula"
      }
    ]
  },
  {
    "id": "chintapalle",
    "nameEn": "Chintapalle",
    "nameTe": "చింతపల్లి",
    "phcs": [
      "Jerrilla",
      "Korukonda",
      "Lambasingi",
      "Lothugedda",
      "R.v.nagar",
      "Tajangi"
    ],
    "habitations": [
      {
        "nameEn": "Anjali Sanivaram",
        "nameTe": "Anjali Sanivaram",
        "phc": "Tajangi"
      },
      {
        "nameEn": "Annavaram",
        "nameTe": "Annavaram",
        "phc": "Lothugedda"
      },
      {
        "nameEn": "Bayalukinchangi",
        "nameTe": "Bayalukinchangi",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Bennavaram",
        "nameTe": "Bennavaram",
        "phc": "Lothugedda"
      },
      {
        "nameEn": "Bhemanapalli",
        "nameTe": "Bhemanapalli",
        "phc": "Korukonda"
      },
      {
        "nameEn": "Busilikota",
        "nameTe": "Busilikota",
        "phc": "Tajangi"
      },
      {
        "nameEn": "Chinnakothuru",
        "nameTe": "Chinnakothuru",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Chinnbarada",
        "nameTe": "Chinnbarada",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Chinthapalli 1",
        "nameTe": "Chinthapalli 1",
        "phc": "R.v.nagar"
      },
      {
        "nameEn": "Chinthapalli 2",
        "nameTe": "Chinthapalli 2",
        "phc": "R.v.nagar"
      },
      {
        "nameEn": "Chinthapalli 3",
        "nameTe": "Chinthapalli 3",
        "phc": "R.v.nagar"
      },
      {
        "nameEn": "Chitralaguppa Rajupakalu",
        "nameTe": "Chitralaguppa Rajupakalu",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Chotapadu",
        "nameTe": "Chotapadu",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Chowdapalli 1",
        "nameTe": "Chowdapalli 1",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Daily Nagar",
        "nameTe": "Daily Nagar",
        "phc": "R.v.nagar"
      },
      {
        "nameEn": "Gadaparai",
        "nameTe": "Gadaparai",
        "phc": "R.v.nagar"
      },
      {
        "nameEn": "Gondipakalu",
        "nameTe": "Gondipakalu",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Jajulapalem",
        "nameTe": "Jajulapalem",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Junction Krishnapuram",
        "nameTe": "Junction Krishnapuram",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Kandhulagadhi",
        "nameTe": "Kandhulagadhi",
        "phc": "R.v.nagar"
      },
      {
        "nameEn": "Kitumula",
        "nameTe": "Kitumula",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Kommangi",
        "nameTe": "Kommangi",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Kondavanchula",
        "nameTe": "Kondavanchula",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Kotha Veedhi",
        "nameTe": "Kotha Veedhi",
        "phc": "R.v.nagar"
      },
      {
        "nameEn": "Kottapalem",
        "nameTe": "Kottapalem",
        "phc": "Tajangi"
      },
      {
        "nameEn": "Kottapalem-2",
        "nameTe": "Kottapalem-2",
        "phc": "Tajangi"
      },
      {
        "nameEn": "Kudumasari",
        "nameTe": "Kudumasari",
        "phc": "Korukonda"
      },
      {
        "nameEn": "Labbangi",
        "nameTe": "Labbangi",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Madigunta",
        "nameTe": "Madigunta",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Mailukuluveedhi",
        "nameTe": "Mailukuluveedhi",
        "phc": "R.v.nagar"
      },
      {
        "nameEn": "Pasuvulabandha",
        "nameTe": "Pasuvulabandha",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Pedabarada",
        "nameTe": "Pedabarada",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Pentapadu",
        "nameTe": "Pentapadu",
        "phc": "R.v.nagar"
      },
      {
        "nameEn": "Rallagedda",
        "nameTe": "Rallagedda",
        "phc": "Korukonda"
      },
      {
        "nameEn": "Rowrinthada Chellai",
        "nameTe": "Rowrinthada Chellai",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Sammagiri",
        "nameTe": "Sammagiri",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Satyavaram",
        "nameTe": "Satyavaram",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Siripuram",
        "nameTe": "Siripuram",
        "phc": "Lambasingi"
      },
      {
        "nameEn": "Tajangi-2",
        "nameTe": "Tajangi-2",
        "phc": "Tajangi"
      },
      {
        "nameEn": "Tamangula",
        "nameTe": "Tamangula",
        "phc": "Lothugedda"
      },
      {
        "nameEn": "Tammangula",
        "nameTe": "Tammangula",
        "phc": "Lothugedda"
      },
      {
        "nameEn": "Vanjari 1",
        "nameTe": "Vanjari 1",
        "phc": "Tajangi"
      },
      {
        "nameEn": "Yerrabommalu",
        "nameTe": "Yerrabommalu",
        "phc": "Lambasingi"
      }
    ]
  },
  {
    "id": "gk_veedhi",
    "nameEn": "G.K. Veedhi",
    "nameTe": "గూడెం కొత్త వీధి",
    "phcs": [
      "Darakonda",
      "G K Veedhi",
      "G.k. Veedhi",
      "GK Veedhi",
      "Jerrilla",
      "Mangampadu",
      "Pedavalasa",
      "Pedhavalasa",
      "Saparla",
      "Sileru"
    ],
    "habitations": [
      {
        "nameEn": "A Darakonda",
        "nameTe": "A Darakonda",
        "phc": "Saparla"
      },
      {
        "nameEn": "Bandhaveedhi",
        "nameTe": "Bandhaveedhi",
        "phc": "Pedavalasa"
      },
      {
        "nameEn": "Chaparathipalem",
        "nameTe": "Chaparathipalem",
        "phc": "Pedavalasa"
      },
      {
        "nameEn": "D. Gangavaram",
        "nameTe": "D. Gangavaram",
        "phc": "Sileru"
      },
      {
        "nameEn": "Damanapalli",
        "nameTe": "Damanapalli",
        "phc": "G.k. Veedhi"
      },
      {
        "nameEn": "Darakonda",
        "nameTe": "Darakonda",
        "phc": "Darakonda"
      },
      {
        "nameEn": "Devarapalli",
        "nameTe": "Devarapalli",
        "phc": "G K Veedhi"
      },
      {
        "nameEn": "Ducharipalem",
        "nameTe": "Ducharipalem",
        "phc": "G.k. Veedhi"
      },
      {
        "nameEn": "Dupilivada",
        "nameTe": "Dupilivada",
        "phc": "Sileru"
      },
      {
        "nameEn": "Dupiliwada",
        "nameTe": "Dupiliwada",
        "phc": "Sileru"
      },
      {
        "nameEn": "Ebulam",
        "nameTe": "Ebulam",
        "phc": "G.k. Veedhi"
      },
      {
        "nameEn": "Galikonda",
        "nameTe": "Galikonda",
        "phc": "Saparla"
      },
      {
        "nameEn": "Gangavaram",
        "nameTe": "Gangavaram",
        "phc": "Darakonda"
      },
      {
        "nameEn": "Gumirevulu",
        "nameTe": "Gumirevulu",
        "phc": "Darakonda"
      },
      {
        "nameEn": "K.kodisingi",
        "nameTe": "K.kodisingi",
        "phc": "Pedhavalasa"
      },
      {
        "nameEn": "Kadugula",
        "nameTe": "Kadugula",
        "phc": "GK Veedhi"
      },
      {
        "nameEn": "Katupalli",
        "nameTe": "Katupalli",
        "phc": "G.k. Veedhi"
      },
      {
        "nameEn": "Kngapakalu",
        "nameTe": "Kngapakalu",
        "phc": "Darakonda"
      },
      {
        "nameEn": "Kodisingi",
        "nameTe": "Kodisingi",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Kondapalli",
        "nameTe": "Kondapalli",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Lakavarapeta",
        "nameTe": "Lakavarapeta",
        "phc": "Pedavalasa"
      },
      {
        "nameEn": "Madem",
        "nameTe": "Madem",
        "phc": "GK Veedhi"
      },
      {
        "nameEn": "Mangampadu",
        "nameTe": "Mangampadu",
        "phc": "Mangampadu"
      },
      {
        "nameEn": "Mondigedda",
        "nameTe": "Mondigedda",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Nelajratha",
        "nameTe": "Nelajratha",
        "phc": "Darakonda"
      },
      {
        "nameEn": "Neralabandha",
        "nameTe": "Neralabandha",
        "phc": "Pedavalasa"
      },
      {
        "nameEn": "Nimalapalem",
        "nameTe": "Nimalapalem",
        "phc": "Pedavalasa"
      },
      {
        "nameEn": "Oobapalem",
        "nameTe": "Oobapalem",
        "phc": "G.k. Veedhi"
      },
      {
        "nameEn": "Pedhajadumuru",
        "nameTe": "Pedhajadumuru",
        "phc": "Pedhavalasa"
      },
      {
        "nameEn": "Ralagedda",
        "nameTe": "Ralagedda",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Ramageda",
        "nameTe": "Ramageda",
        "phc": "G K Veedhi"
      },
      {
        "nameEn": "Rampula",
        "nameTe": "Rampula",
        "phc": "Pedavalasa"
      },
      {
        "nameEn": "Rinthada1",
        "nameTe": "Rinthada1",
        "phc": "G.k. Veedhi"
      },
      {
        "nameEn": "Sankada",
        "nameTe": "Sankada",
        "phc": "Pedavalasa"
      },
      {
        "nameEn": "Saparala",
        "nameTe": "Saparala",
        "phc": "Saparla"
      },
      {
        "nameEn": "Sileru",
        "nameTe": "Sileru",
        "phc": "Sileru"
      },
      {
        "nameEn": "Siribala",
        "nameTe": "Siribala",
        "phc": "Jerrilla"
      },
      {
        "nameEn": "Vanchula",
        "nameTe": "Vanchula",
        "phc": "Jerrilla"
      }
    ]
  },
  {
    "id": "koyyuru",
    "nameEn": "Koyyuru",
    "nameTe": "కొయ్యూరు",
    "phcs": [
      "Downuru",
      "Kantaram",
      "R.j. Palem",
      "U. Cheedipalem"
    ],
    "habitations": [
      {
        "nameEn": "Adakula",
        "nameTe": "Adakula",
        "phc": "Kantaram"
      },
      {
        "nameEn": "Adakula(kinchili)",
        "nameTe": "Adakula(kinchili)",
        "phc": "Kantaram"
      },
      {
        "nameEn": "Adakula(rongali Kotturu)",
        "nameTe": "Adakula(rongali Kotturu)",
        "phc": "Kantaram"
      },
      {
        "nameEn": "Bakuluru",
        "nameTe": "Bakuluru",
        "phc": "Kantaram"
      },
      {
        "nameEn": "Bangarampeta 1 (anthada)",
        "nameTe": "Bangarampeta 1 (anthada)",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Bangarampeta 2",
        "nameTe": "Bangarampeta 2",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Budaralla",
        "nameTe": "Budaralla",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Budaralla(chowdipalli)",
        "nameTe": "Budaralla(chowdipalli)",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Budaralla(palarevvalu)",
        "nameTe": "Budaralla(palarevvalu)",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Cheedipalem",
        "nameTe": "Cheedipalem",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Chittimpadu",
        "nameTe": "Chittimpadu",
        "phc": "Downuru"
      },
      {
        "nameEn": "Chittimpadu(gopavaram)",
        "nameTe": "Chittimpadu(gopavaram)",
        "phc": "Downuru"
      },
      {
        "nameEn": "Chittimpadu(konda Santha)",
        "nameTe": "Chittimpadu(konda Santha)",
        "phc": "Downuru"
      },
      {
        "nameEn": "Chittimpadu(mallavaram)",
        "nameTe": "Chittimpadu(mallavaram)",
        "phc": "Downuru"
      },
      {
        "nameEn": "Kommika",
        "nameTe": "Kommika",
        "phc": "Kantaram"
      },
      {
        "nameEn": "Kommika(degalapalem)",
        "nameTe": "Kommika(degalapalem)",
        "phc": "Kantaram"
      },
      {
        "nameEn": "Kondagokiri",
        "nameTe": "Kondagokiri",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Koyyuru",
        "nameTe": "Koyyuru",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "M. Makavaram",
        "nameTe": "M. Makavaram",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "M.makavaram(chinthalapudi)",
        "nameTe": "M.makavaram(chinthalapudi)",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "M.makavaram(ginjarthi)",
        "nameTe": "M.makavaram(ginjarthi)",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Mampa",
        "nameTe": "Mampa",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Mampa(k.gangavaram)",
        "nameTe": "Mampa(k.gangavaram)",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Marrivada",
        "nameTe": "Marrivada",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Marrivada(doddavaram)",
        "nameTe": "Marrivada(doddavaram)",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Nadimpalem",
        "nameTe": "Nadimpalem",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Palakagidi",
        "nameTe": "Palakagidi",
        "phc": "U. Cheedipalem"
      },
      {
        "nameEn": "R.j. Palem(jogimpeta)",
        "nameTe": "R.j. Palem(jogimpeta)",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Ravanapalli",
        "nameTe": "Ravanapalli",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Revallu",
        "nameTe": "Revallu",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Revallu(r.kantaram)",
        "nameTe": "Revallu(r.kantaram)",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Sarabannapalem 1",
        "nameTe": "Sarabannapalem 1",
        "phc": "R.j. Palem"
      },
      {
        "nameEn": "Sarabannapalem 2 (velagalapalem)",
        "nameTe": "Sarabannapalem 2 (velagalapalem)",
        "phc": "R.j. Palem"
      }
    ]
  }
];
