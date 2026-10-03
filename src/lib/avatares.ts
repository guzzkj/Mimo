import { useAjustes } from "./ajustes";

// Avatares do gato (Configurações > Perfil). O índice fica em ajustes.avatar;
// é da pessoa, então vale no Solo e no Duo, no painel, nas metas e nos avisos.

/** [cor, tabby (rajado), rótulo] */
export const AVATARES: [string, boolean, string][] = [
  ["#4e9e79", false, "Verde"],
  ["#e2a24f", true, "Âmbar rajado"],
  ["#6f5cf0", false, "Roxo"],
  ["#8a90a0", false, "Cinza"],
  ["#d98a5f", true, "Laranja rajado"],
  ["#3a4050", false, "Grafite"],
];

export interface AvatarGato { cor: string; tabby: boolean; label: string }

/** Cor e listras do avatar escolhido; índice inválido cai no verde padrão. */
export const avatarDe = (i: number): AvatarGato => {
  const [cor, tabby, label] = AVATARES[i] ?? AVATARES[0];
  return { cor, tabby, label };
};

/** Gato da própria pessoa, já reativo a Configurações > Perfil. */
export const useAvatar = () => avatarDe(useAjustes("solo").avatar);
