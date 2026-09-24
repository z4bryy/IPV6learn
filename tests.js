/**
 * Jednotkové testy IPv6 logiky — spusť: node tests.js
 * (duplicitní implementace jen pro offline ověření; runtime používá app.js)
 */

const HEX = "0123456789abcdef";

function omitLeadingZeros(hextets) {
  return hextets.map((h) => {
    const stripped = h.replace(/^0+/, "");
    return stripped === "" ? "0" : stripped;
  });
}

function compress(hextets) {
  const short = omitLeadingZeros(hextets);
  let bestStart = -1;
  let bestLen = 0;
  let i = 0;
  while (i < 8) {
    if (short[i] === "0") {
      let j = i;
      while (j < 8 && short[j] === "0") j++;
      const len = j - i;
      if (len > bestLen) {
        bestLen = len;
        bestStart = i;
      }
      i = j;
    } else {
      i++;
    }
  }
  if (bestLen < 2) return short.join(":");
  const left = short.slice(0, bestStart).join(":");
  const right = short.slice(bestStart + bestLen).join(":");
  if (bestStart === 0 && bestStart + bestLen === 8) return "::";
  if (bestStart === 0) return "::" + right;
  if (bestStart + bestLen === 8) return left + "::";
  return left + "::" + right;
}

function normalizeAnswer(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "");
}

function checkOmit(userParts, expected) {
  return userParts.map((u, i) => normalizeAnswer(u) === expected[i]);
}

function checkCompressed(user, expected) {
  return normalizeAnswer(user) === expected;
}

const cases = [
  [["fe80", "0000", "0000", "0000", "6678", "9101", "0000", "34ab"], "fe80::6678:9101:0:34ab"],
  [["2001", "0db8", "0000", "0000", "0000", "0000", "0000", "0001"], "2001:db8::1"],
  [["0000", "0000", "0000", "0000", "0000", "0000", "0000", "0001"], "::1"],
  [["2001", "0000", "0000", "0001", "0000", "0000", "0000", "0001"], "2001:0:0:1::1"],
  [["fe80", "0000", "0000", "0001", "0000", "0000", "0000", "0001"], "fe80:0:0:1::1"],
  [["2001", "0db8", "0000", "0001", "0000", "0000", "0000", "0000"], "2001:db8:0:1::"],
  [["0000", "0000", "0000", "0000", "0000", "0000", "0000", "0000"], "::"],
  [["abcd", "ef01", "2345", "6789", "abcd", "ef01", "2345", "6789"], "abcd:ef01:2345:6789:abcd:ef01:2345:6789"],
  [["0000", "0000", "0001", "0000", "0000", "0002", "0000", "0000"], "::1:0:0:2:0:0"],
  [["aaaa", "0000", "bbbb", "0000", "0000", "cccc", "0000", "dddd"], "aaaa:0:bbbb::cccc:0:dddd"],
  [["00ab", "000c", "0000", "0000", "0001", "0000", "0000", "00ff"], "ab:c::1:0:0:ff"],
];

let failed = 0;

for (const [h, expected] of cases) {
  const got = compress(h);
  if (got !== expected) {
    failed++;
    console.error("FAIL compress", h.join(":"), "got", got, "expected", expected);
  }
}

// omit
const omitCase = omitLeadingZeros(["00ab", "0000", "0db8", "0001"]);
if (omitCase.join(":") !== "ab:0:db8:1") {
  failed++;
  console.error("FAIL omit", omitCase);
}

// normalize / check
if (!checkCompressed(" FE80::1 ", "fe80::1")) {
  failed++;
  console.error("FAIL normalize spaces/case");
}
if (checkOmit(["00ab", "0"], ["ab", "0"]).some(Boolean) !== false && checkOmit(["00ab", "0"], ["ab", "0"])[0] !== false) {
  // 00ab should NOT match ab
  if (checkOmit(["00ab", "0"], ["ab", "0"])[0] !== false) {
    failed++;
    console.error("FAIL leading zeros must be rejected");
  }
}

// leftmost equal-length zero runs
{
  const h = ["0000", "0000", "0001", "0000", "0000", "0002", "0003", "0004"];
  const c = compress(h);
  if (c !== "::1:0:0:2:3:4") {
    failed++;
    console.error("FAIL leftmost tie-break", c);
  }
}

console.log(failed === 0 ? `OK — ${cases.length + 4} assertions passed` : `${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
