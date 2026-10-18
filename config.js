/*
 * Inställningar för den här installationen av höjdkurvor.se.
 * Lämna ett värde tomt ('') eller null för att stänga av funktionen.
 */
window.TERRANG_KONFIG = {

  // Flygfoto från Esri World Imagery. Kräver en API-nyckel från ArcGIS
  // Location Platform, och Esris villkor för den nyckeln gäller.
  esriNyckel: '',

  // Reserv om webbläsaren inte får fråga Lantmäteriets öppna katalog (STAC)
  // direkt. stac.php skickar bara vidare frågor till den öppna katalogen,
  // aldrig inloggningsuppgifter. Kräver PHP på webbhotellet.
  stacProxy: 'stac.php',

  // Reserv för geodata från andra myndigheter (Naturvårdsverket, Riksantikvarie-
  // ämbetet, Myndigheten för civilt försvar) om webbläsaren inte får fråga dem
  // direkt. geodata.php släpper bara igenom de tjänsterna. Kräver PHP.
  geodataProxy: 'geodata.php',

  // Adress till ritprogrammet cad-apa, för "Fortsätt rita i cad-apa".
  // Relativ adress fungerar när båda ligger på samma webbplats.
  cadApaUrl: '../cad-apa/',

  // ENDAST FÖR INTRANÄT eller annan miljö som bara betrodda användare når.
  // Fyller i inloggningen till Lantmäteriet åt alla som öppnar sidan.
  // Använd organisationens systemkonto, inte ett personligt konto.
  // Exempel: inloggning: { anv: 'kontoret', losen: 'hemligt' },
  inloggning: null,
};
