import { mensagemDeErro } from "./api";

// Falhas de gravação que acontecem fora de um componente (ajustes, acertos,
// plano, avisos). A tela aberta mostra cada uma num toast (useToasts); sem
// tela ouvindo, a falha vai só para o console.

type Ouvinte = (mensagem: string) => void;
const ouvintes = new Set<Ouvinte>();

export function avisarFalha(mensagem: string, erro?: unknown) {
  if (erro !== undefined) console.warn(`[mimo] ${mensagem}`, erro);
  const texto = erro === undefined ? mensagem : `${mensagem} ${mensagemDeErro(erro)}`;
  ouvintes.forEach((f) => f(texto));
}

export function assinarFalhas(f: Ouvinte) {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}
