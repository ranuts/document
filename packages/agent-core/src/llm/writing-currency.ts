/** Recognized adjacent amount/unit literals; not a general financial parser. */
interface MoneyFact {
  amount: string;
  unit: string;
}
let units: Map<string, string> | undefined;
let unitPattern: string | undefined;
const fallbackCodes =
  'EUR USD GBP CNY JPY KRW AUD CAD CHF HKD INR RUB BRL SGD NZD TWD AED SAR SEK NOK DKK PLN ZAR MXN TRY'.split(' ');
const locales = ['en', 'zh-CN', 'ja', 'ko', 'de', 'es', 'pt'];

function vocabulary(): void {
  if (units) return;
  const candidates = new Map<string, Set<string>>();
  const add = (label: string, identity: string): void => {
    const key = label.normalize('NFC').toLowerCase();
    const identities = candidates.get(key) ?? new Set<string>();
    identities.add(identity);
    candidates.set(key, identities);
  };
  let codes = fallbackCodes;
  try {
    codes = [...new Set([...codes, ...Intl.supportedValuesOf('currency')])];
  } catch {
    /* Older hosts retain explicit common codes. */
  }
  const names: Intl.DisplayNames[] = [];
  for (const locale of locales) {
    try {
      names.push(new Intl.DisplayNames(locale, { type: 'currency', fallback: 'none' }));
    } catch {
      /* Codes remain usable without locale data. */
    }
  }
  for (const code of codes) {
    if (!/^[A-Z]{3}$/.test(code)) continue;
    add(code, code);
    for (const display of names) {
      const name = display.of(code);
      if (!name) continue;
      add(name, code);
      if (/[A-Za-z]$/.test(name)) add(name + 's', code);
    }
  }
  // Compound labels explicitly name renminbi; bare 元 remains ambiguous.
  add('元人民币', 'CNY');
  add('人民币元', 'CNY');
  // Preserve ambiguous symbols as literals, never infer a currency from them.
  for (const symbol of ['$', '£', '¥', '元', '円', '원']) add(symbol, 'literal:' + symbol);
  add('€', 'EUR');
  units = new Map(
    [...candidates]
      .filter(([, identities]) => identities.size === 1)
      .map(([label, identities]) => [label, [...identities][0]]),
  );
  const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  unitPattern = [...units.keys()]
    .sort((a, b) => b.length - a.length)
    .map((label) => {
      const identity = units!.get(label)!;
      // Codes are case-sensitive at matching time so ordinary words cannot
      // consume a number before its actual suffix currency is recognized.
      if (/^[a-z]{3}$/.test(label) && identity === label.toUpperCase()) return identity;
      return [...label]
        .map((letter) => {
          const variants = [...new Set([letter.toLowerCase(), letter.toUpperCase()])];
          return variants.length === 1 ? escape(letter) : '(?:' + variants.map(escape).join('|') + ')';
        })
        .join('');
    })
    .join('|');
}

function moneyFacts(text: string): MoneyFact[] {
  vocabulary();
  const number = '[-+−]?\\d+(?:[.,]\\d+)*';
  const unit = `(?<![A-Za-z])(?:${unitPattern})(?![A-Za-z])`;
  const pattern = new RegExp(
    `(?<before>${unit})[ \\t\\u00a0]*(?<first>${number})|(?<second>${number})[ \\t\\u00a0]*(?<after>${unit})`,
    'gu',
  );
  const normalized = text.normalize('NFC');
  return [...normalized.matchAll(pattern)].map((match) => {
    let amount = match.groups!.first ?? match.groups!.second;
    // A hyphen immediately following another digit separates a range.
    if (!match.groups!.before && /^[-+−]/.test(amount) && /\d/.test(normalized[match.index! - 1] ?? ''))
      amount = amount.slice(1);
    return { amount, unit: units!.get((match.groups!.before ?? match.groups!.after).toLowerCase())! };
  });
}

/** Keep currency attached to its amount, allowing supported localized unit names. */
export function validateWritingCurrency(
  source: string,
  output: string,
  summarize: boolean,
  numbers: (text: string) => string[],
): void {
  const sourceFacts = moneyFacts(source),
    outputFacts = moneyFacts(output);
  const key = (fact: MoneyFact): string => fact.amount + '\0' + fact.unit;
  const remaining = new Map<string, number>();
  for (const fact of sourceFacts) remaining.set(key(fact), (remaining.get(key(fact)) ?? 0) + 1);
  for (const fact of outputFacts) {
    const count = remaining.get(key(fact)) ?? 0;
    if (!count) throw new Error('agentWritingCurrencyChanged');
    remaining.set(key(fact), count - 1);
  }
  if (!summarize && [...remaining.values()].some((count) => count > 0)) throw new Error('agentWritingCurrencyChanged');
  if (summarize) {
    // Bare numbers may survive only up to their original non-money occurrences.
    // Complete omitted money facts are allowed; dropping just the unit is not.
    const bare = (text: string, facts: MoneyFact[]): Map<string, number> => {
      const counts = new Map<string, number>();
      for (const value of numbers(text)) counts.set(value, (counts.get(value) ?? 0) + 1);
      for (const fact of facts) counts.set(fact.amount, (counts.get(fact.amount) ?? 0) - 1);
      return counts;
    };
    const sourceBare = bare(source, sourceFacts);
    for (const [amount, count] of bare(output, outputFacts)) {
      if (count > (sourceBare.get(amount) ?? 0)) throw new Error('agentWritingCurrencyChanged');
    }
  }
}
