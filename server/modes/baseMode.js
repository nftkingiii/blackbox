const symbols = ["@", "#", "$", "%", "&", "+", "*", "!", ")", "("];

export function normalize(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9$]/g, "");
}

export function exactMatch(guess, answer) {
  return normalize(guess) === normalize(answer);
}

export function fuzzyMatch(guess, answer) {
  return levenshtein(normalize(guess), normalize(answer)) <= 1;
}

export function maskWord(answer, style = "symbol-heavy", revealRatio = 0.35) {
  const chars = String(answer).split("");
  const revealCount = Math.max(1, Math.ceil(chars.filter((char) => /[a-z0-9]/i.test(char)).length * revealRatio));
  const visible = new Set();

  if (style === "soft") visible.add(0);
  if (style === "caps-symbol") visible.add(chars.length - 1);

  for (let i = 0; visible.size < revealCount && i < chars.length * 3; i += 1) {
    const index = deterministicIndex(answer, i, chars.length);
    if (/[a-z0-9]/i.test(chars[index])) visible.add(index);
  }

  return chars.map((char, index) => {
    if (!/[a-z0-9]/i.test(char)) return char;
    return visible.has(index) ? char : symbols[deterministicIndex(answer, index + 13, symbols.length)];
  }).join("");
}

function deterministicIndex(seed, offset, max) {
  let value = 0;
  for (const char of String(seed)) value = (value * 31 + char.charCodeAt(0) + offset) % 9973;
  return value % max;
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}
