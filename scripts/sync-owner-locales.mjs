/**
 * One-off / maintenance: merge owner dashboard + listing translations into
 * sr, hr, bs, sq, it, es from en + cnr sources.
 */
import fs from 'node:fs'
import path from 'node:path'
import { FEAT_ES, FEAT_IT, FEAT_SQ } from './owner-feat-langs.mjs'

const root = path.resolve(import.meta.dirname, '..')
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'))

const en = readJson('src/locales/en.json')
const cnr = readJson('src/locales/cnr.json')

const ownerSr = structuredClone(cnr.owner)
const ownerBs = structuredClone(cnr.owner)

const ownerHr = structuredClone(cnr.owner)
Object.assign(ownerHr, {
  pageTitle: 'Sučelje vlasnika',
  sidebarAria: 'Navigacija za vlasnike',
  welcome: 'Dobrodošli, {{name}}!',
  lead: 'Upravljajte oglasima po kategorijama. Kategorije koje niste platili ovdje se ne prikazuju.',
})
Object.assign(ownerHr.listing, {
  structure: 'Raspored',
  municipality: 'Općina',
  bathrooms: 'Broj kupaonica',
  featHeating: 'Grijanje',
  featFurniture: 'Namještaj',
  centerOnCity: 'Centriraj na grad',
  mapNoMarker: 'Kliknite „Centriraj na grad“ ili uklonite marker pa ponovno postavite.',
  str: { ...ownerHr.listing.str, so4p: 'Četverosoban+' },
})

const ownerIt = structuredClone(en.owner)
Object.assign(ownerIt, {
  pageTitle: 'Pannello proprietario',
  sidebarAria: 'Navigazione proprietario',
  welcome: 'Benvenuto, {{name}}!',
  lead: 'Gestisci gli annunci per categoria. Le categorie non acquistate non sono mostrate qui.',
})
Object.assign(ownerIt.listing, {
  modalTitle: 'Annuncio: nuova struttura (Alloggio)',
  tabBasic: 'Dati principali',
  tabOwners: 'Proprietari',
  tabImages: 'Immagini',
  tabMap: 'Mappa',
  propertyType: 'Tipo di immobile',
  structure: 'Disposizione',
  municipality: 'Comune',
  district: 'Zona',
  payment: 'Metodo di pagamento',
  payBank: 'Bonifico',
  featFurniture: 'Arredi',
  mapHint:
    "Dopo aver scelto paese e città, la mappa si centra sulla città; sposta poi il pin sulla posizione esatta. (Mappa: OpenStreetMap; link Google Maps sotto.)",
  centerOnCity: 'Centra sulla città',
  mapNoMarker: 'Fai clic su «Centra sulla città» o rimuovi il pin e impostalo di nuovo.',
})
Object.assign(ownerIt.listing, FEAT_IT)

const ownerEs = structuredClone(en.owner)
Object.assign(ownerEs, {
  pageTitle: 'Panel del propietario',
  sidebarAria: 'Navegación del propietario',
  welcome: '¡Bienvenido, {{name}}!',
  lead: 'Gestiona tus anuncios por categoría. Las categorías no pagadas no aparecen aquí.',
})
Object.assign(ownerEs.listing, {
  modalTitle: 'Anuncio: nueva propiedad (Alojamiento)',
  tabBasic: 'Datos básicos',
  tabOwners: 'Propietarios',
  tabImages: 'Imágenes',
  tabMap: 'Mapa',
  propertyType: 'Tipo de inmueble',
  structure: 'Distribución',
  municipality: 'Municipio',
  district: 'Barrio / zona',
  payment: 'Forma de pago',
  payBank: 'Transferencia bancaria',
  featFurniture: 'Mobiliario',
  mapHint:
    'Tras elegir país y ciudad, el mapa se centra en la ciudad; mueve el pin al punto exacto. (Mapa: OpenStreetMap; enlace a Google Maps abajo.)',
  centerOnCity: 'Centrar en la ciudad',
  mapNoMarker: 'Pulsa “Centrar en la ciudad” o quita el pin y vuelve a colocarlo.',
})
Object.assign(ownerEs.listing, FEAT_ES)

const ownerSq = structuredClone(en.owner)
Object.assign(ownerSq, {
  pageTitle: 'Paneli i pronarit',
  sidebarAria: 'Navigimi për pronarët',
  welcome: 'Mirë se vini, {{name}}!',
  lead: 'Menaxhoni shpalljet sipas kategorisë. Kategoritë e papaguara nuk shfaqen këtu.',
})
Object.assign(ownerSq.listing, {
  modalTitle: 'Shpallje: pronë e re (Akomodim)',
  tabBasic: 'Të dhëna bazë',
  tabOwners: 'Pronarët',
  tabImages: 'Foto',
  tabMap: 'Harta',
  propertyType: 'Lloji i pronës',
  structure: 'Struktura / dispozicioni',
  municipality: 'Bashkia / njësia',
  district: 'Lagjja',
  payment: 'Mënyra e pagesës',
  payBank: 'Transfertë bankare',
  featHeating: 'Ngrohja',
  featFurniture: 'Mobilimi',
  featEquipment: 'Pajisjet',
  featRules: 'Rregulla / Extra',
  mapHint:
    'Pasi të zgjidhni vendin dhe qytetin, harta qendron te qyteti; lëvizni pinin në vendin e saktë. (Harta: OpenStreetMap; lidhja për Google Maps më poshtë.)',
  centerOnCity: 'Qendro te qyteti',
  mapNoMarker: 'Klikoni «Qendro te qyteti» ose hiqni pinin dhe vendoseni përsëri.',
})
Object.assign(ownerSq.listing, FEAT_SQ)

const navExtra = {
  hr: { ownerDashboard: 'Sučelje vlasnika', logout: 'Odjava' },
  sr: { ownerDashboard: 'Panel vlasnika', logout: 'Odjavi se' },
  bs: { ownerDashboard: 'Panel vlasnika', logout: 'Odjava' },
  it: { ownerDashboard: 'Area proprietario', logout: 'Esci' },
  es: { ownerDashboard: 'Panel del propietario', logout: 'Cerrar sesión' },
  sq: { ownerDashboard: 'Paneli i pronarit', logout: 'Dilni' },
}

const owners = {
  hr: ownerHr,
  sr: ownerSr,
  bs: ownerBs,
  it: ownerIt,
  es: ownerEs,
  sq: ownerSq,
}

for (const lang of ['hr', 'sr', 'bs', 'it', 'es', 'sq']) {
  const p = path.join(root, `src/locales/${lang}.json`)
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  j.nav = { ...j.nav, ...navExtra[lang] }
  j.owner = owners[lang]
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8')
  console.log('updated', lang)
}
