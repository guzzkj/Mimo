// De onde vêm os dados:
//   "api"   (padrão) -> backend real (Pages Functions + Neon), exige login;
//   "local"          -> protótipo no navegador (localStorage + exemplos), sem login.
// Use VITE_DATA_MODE=local para revisar telas/estados (?estado=) sem backend.
export const MODO_API = import.meta.env.VITE_DATA_MODE !== "local";
