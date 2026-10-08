/**
 * Minimal word-level diff (no dependencies). Tokenizes on words/whitespace so
 * spacing is preserved, then aligns with LCS and emits same/add/del tokens.
 * Used by the logbook revision compare view.
 */

export interface DiffToken {
  text: string;
  type: "same" | "add" | "del";
}

function tokenize(s: string): string[] {
  return s.match(/\S+|\s+/g) ?? [];
}

export function diffWords(oldText: string | null | undefined, newText: string | null | undefined): DiffToken[] {
  const a = tokenize(oldText ?? "");
  const b = tokenize(newText ?? "");
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];
  if (n === 0) return [{ text: b.join(""), type: "add" }];
  if (m === 0) return [{ text: a.join(""), type: "del" }];

  // LCS lengths, row-compressed DP.
  const prev = new Array<number>(m + 1).fill(0);
  const curr = new Array<number>(m + 1).fill(0);
  // Keep full table only for backtrack when inputs are modest; otherwise fall back
  // to a cheap prefix/suffix trim + block diff.
  const cells = (n + 1) * (m + 1);
  if (cells > 4_000_000) {
    return blockDiff(a, b);
  }
  const table: Uint32Array = new Uint32Array(cells);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      table[i * (m + 1) + j] =
        a[i - 1] === b[j - 1]
          ? table[(i - 1) * (m + 1) + (j - 1)] + 1
          : Math.max(table[(i - 1) * (m + 1) + j], table[i * (m + 1) + (j - 1)]);
    }
    void prev;
    void curr;
  }
  const tokens: DiffToken[] = [];
  let i = n;
  let j = m;
  const rev: DiffToken[] = [];
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      rev.push({ text: a[i - 1], type: "same" });
      i--;
      j--;
    } else if (table[(i - 1) * (m + 1) + j] > table[i * (m + 1) + (j - 1)]) {
      rev.push({ text: a[i - 1], type: "del" });
      i--;
    } else {
      rev.push({ text: b[j - 1], type: "add" });
      j--;
    }
  }
  while (i > 0) rev.push({ text: a[--i], type: "del" });
  while (j > 0) rev.push({ text: b[--j], type: "add" });
  rev.reverse();
  // Merge adjacent same-type tokens for compact rendering.
  for (const t of rev) {
    const last = tokens[tokens.length - 1];
    if (last && last.type === t.type) last.text += t.text;
    else tokens.push({ ...t });
  }
  return tokens;
}

/** Fallback for huge inputs: trim common prefix/suffix, diff the middle as one block. */
function blockDiff(a: string[], b: string[]): DiffToken[] {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let sa = a.length - 1;
  let sb = b.length - 1;
  while (sa >= p && sb >= p && a[sa] === b[sb]) {
    sa--;
    sb--;
  }
  const tokens: DiffToken[] = [];
  if (p > 0) tokens.push({ text: a.slice(0, p).join(""), type: "same" });
  if (sa >= p) tokens.push({ text: a.slice(p, sa + 1).join(""), type: "del" });
  if (sb >= p) tokens.push({ text: b.slice(p, sb + 1).join(""), type: "add" });
  if (sa < a.length - 1) tokens.push({ text: a.slice(sa + 1).join(""), type: "same" });
  return tokens;
}

/** True when the two texts are identical (ignoring null/undefined). */
export function textsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "") === (b ?? "");
}
