/*
 * Configuração do app. Normalmente só a linha "api" precisa ser preenchida
 * (o link de convite também leva o endereço da API, então pode até ficar vazia).
 */
window.RUMO_CONFIG = {
  // Endereço /exec da implantação do Apps Script (Implantar → Gerenciar implantações)
  api: 'https://brunomathias8-droid.github.io/rumo/',
  // Mapa: estilo vetorial gratuito (OpenFreeMap). Se sair do ar, troque por outro estilo MapLibre.
  estiloMapa: 'https://tiles.openfreemap.org/styles/liberty',
  maplibreJs: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  maplibreCss: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  sortableJs: 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.3/Sortable.min.js',
  intervaloSincSeg: 30
};
