/* Estrae un `const NOME = [ ... ];` letterale da un file sorgente (bracket
   matching, non un parser JS completo) e lo valuta come array JS reale.
   Usato una tantum per portare i dati seed delle app sorelle nel DB senza
   ritrascriverli a mano. Funziona solo su letterali statici (no chiamate a
   funzione dentro l'array). */
import fs from "fs";

function extractArrayLiteral(source: string, constName: string): string {
  const marker = `const ${constName} = `;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Non trovato: ${constName}`);
  let i = start + marker.length;
  if (source[i] !== "[") throw new Error(`${constName} non è un letterale array`);
  let depth = 0;
  let inString: string | null = null;
  let escaped = false;
  let j = i;
  for (; j < source.length; j++) {
    const c = source[j];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inString = c; continue; }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) { j++; break; }
    }
  }
  return source.slice(i, j);
}

export function extractSeed(filePath: string, constName: string): unknown[] {
  const source = fs.readFileSync(filePath, "utf8");
  const literal = extractArrayLiteral(source, constName);
  // eslint-disable-next-line no-new-func
  return new Function(`return ${literal};`)() as unknown[];
}
