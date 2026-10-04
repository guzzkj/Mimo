// Leitor mínimo de ZIP (só o necessário para o COTAHIST da B3): lê o diretório
// central e descomprime a primeira entrada com DecompressionStream, que existe
// tanto no Workers quanto no Node 18+.

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

/** Bytes da primeira entrada do ZIP (método 0 = sem compressão, 8 = deflate). */
export async function unzipFirstEntry(zip: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  // o EOCD fica nos últimos 22 bytes + comentário (até 64 KiB)
  for (let i = zip.byteLength - 22; i >= Math.max(0, zip.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ZIP inválido: fim do diretório central não encontrado.");
  const central = view.getUint32(eocd + 16, true);
  if (view.getUint32(central, true) !== CENTRAL_SIG) throw new Error("ZIP inválido: diretório central corrompido.");
  const method = view.getUint16(central + 10, true);
  const compressedSize = view.getUint32(central + 20, true);
  const local = view.getUint32(central + 42, true);
  if (view.getUint32(local, true) !== LOCAL_SIG) throw new Error("ZIP inválido: cabeçalho local corrompido.");
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const data = zip.subarray(start, start + compressedSize);
  if (method === 0) return data;
  if (method !== 8) throw new Error(`ZIP com compressão não suportada (${method}).`);
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
