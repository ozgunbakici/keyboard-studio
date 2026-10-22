/**
 * Evaluator for VIA menu `showIf` expressions, e.g.
 *   "{id_qmk_rgb_matrix_effect} != 0 && {id_qmk_rgb_matrix_effect} != 24"
 * Supports {id} / {id.N} lookups, integers, ! ( ) == != < <= > >= && ||.
 * Written to match the semantics of VIA's pelpi library.
 */

type Token =
  | {t: 'num'; v: number}
  | {t: 'var'; id: string; index: number}
  | {t: 'op'; v: string}
  | {t: 'lp'}
  | {t: 'rp'};

const tokenize = (expr: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9]/.test(c)) {
      let j = i;
      while (j < expr.length && /[0-9]/.test(expr[j])) j++;
      tokens.push({t: 'num', v: Number.parseInt(expr.slice(i, j), 10)});
      i = j;
    } else if (c === '{') {
      const end = expr.indexOf('}', i);
      if (end === -1) throw new Error(`Kapanmamış { : ${expr}`);
      const [id, index] = expr.slice(i + 1, end).trim().split('.');
      tokens.push({t: 'var', id, index: index ? Number.parseInt(index, 10) : 0});
      i = end + 1;
    } else if (c === '(') {
      tokens.push({t: 'lp'});
      i++;
    } else if (c === ')') {
      tokens.push({t: 'rp'});
      i++;
    } else {
      const two = expr.slice(i, i + 2);
      if (['&&', '||', '==', '!=', '<=', '>='].includes(two)) {
        tokens.push({t: 'op', v: two});
        i += 2;
      } else if (['<', '>', '!'].includes(c)) {
        tokens.push({t: 'op', v: c});
        i++;
      } else {
        throw new Error(`Beklenmeyen karakter "${c}" : ${expr}`);
      }
    }
  }
  return tokens;
};

export type ValueMap = Record<string, ArrayLike<number> | undefined>;

type Value = number | boolean;

class Parser {
  private pos = 0;
  constructor(
    private tokens: Token[],
    private values: ValueMap,
  ) {}

  parse(): Value {
    const value = this.or();
    if (this.pos !== this.tokens.length) throw new Error('İfade beklenenden uzun');
    return value;
  }

  private peekOp(...ops: string[]) {
    const token = this.tokens[this.pos];
    return token?.t === 'op' && ops.includes(token.v) ? token.v : null;
  }

  private or(): Value {
    let left = this.and();
    while (this.peekOp('||')) {
      this.pos++;
      const right = this.and();
      left = left || right;
    }
    return left;
  }

  private and(): Value {
    let left = this.equality();
    while (this.peekOp('&&')) {
      this.pos++;
      const right = this.equality();
      left = left && right;
    }
    return left;
  }

  private equality(): Value {
    let left = this.comparison();
    let op: string | null;
    while ((op = this.peekOp('==', '!='))) {
      this.pos++;
      const right = this.comparison();
      // Loose comparison mirrors pelpi (booleans compare with numbers).
      left = op === '==' ? Number(left) === Number(right) : Number(left) !== Number(right);
    }
    return left;
  }

  private comparison(): Value {
    let left = this.unary();
    let op: string | null;
    while ((op = this.peekOp('<', '<=', '>', '>='))) {
      this.pos++;
      const right = Number(this.unary());
      const l = Number(left);
      left = op === '<' ? l < right : op === '<=' ? l <= right : op === '>' ? l > right : l >= right;
    }
    return left;
  }

  private unary(): Value {
    if (this.peekOp('!')) {
      this.pos++;
      return !this.unary();
    }
    return this.primary();
  }

  private primary(): Value {
    const token = this.tokens[this.pos++];
    if (!token) throw new Error('İfade eksik');
    switch (token.t) {
      case 'num':
        return token.v;
      case 'var': {
        const value = this.values[token.id];
        return value?.[token.index] ?? 0;
      }
      case 'lp': {
        const value = this.or();
        if (this.tokens[this.pos++]?.t !== 'rp') throw new Error('Parantez kapanmamış');
        return value;
      }
      default:
        throw new Error('Beklenmeyen simge');
    }
  }
}

export const evalShowIf = (expr: string, values: ValueMap): boolean => {
  try {
    return Boolean(new Parser(tokenize(expr), values).parse());
  } catch {
    // A broken expression should never hide controls.
    return true;
  }
};

/** Names referenced by an expression, e.g. ["id_qmk_rgb_matrix_effect"]. */
export const showIfDependencies = (expr: string): string[] => {
  try {
    return [...new Set(tokenize(expr).flatMap((t) => (t.t === 'var' ? [t.id] : [])))];
  } catch {
    return [];
  }
};
