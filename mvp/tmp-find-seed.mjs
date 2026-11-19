const M = 1664525;
const INC = 1013904223;
const MOD = 4294967296;
const threshold = 3435973837;

function next(seed) {
  return (Math.trunc(seed) * M + INC) >>> 0;
}

const found = [];
for (let s = 0; s < 500000 && found.length < 8; s += 1) {
  const n = next(s);
  if (n >= threshold) found.push({ seed: s, next: n, roll: n / MOD });
}

console.log(JSON.stringify({
  win: { next: next(1), roll: next(1) / MOD },
  old: { next: next(3027450565), roll: next(3027450565) / MOD },
  found,
}, null, 2));
