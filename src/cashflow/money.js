const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function normalizeCurrency(value) {
  const currency = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("A valid three-letter ISO currency code is required.");
  }
  return currency;
}

function exponentFor(currency) {
  return ZERO_DECIMAL_CURRENCIES.has(normalizeCurrency(currency)) ? 0 : 2;
}

/** Convert Stripe's integer minor-unit amount to an exact decimal string. */
export function stripeMinorToMajor(amount, currency) {
  const exponent = exponentFor(currency);
  let minor;
  try {
    minor = BigInt(String(amount));
  } catch {
    throw new Error("Stripe amount must be an integer minor-unit value.");
  }

  const sign = minor < 0n ? "-" : "";
  const absolute = minor < 0n ? -minor : minor;
  if (exponent === 0) return sign + absolute.toString();

  const digits = absolute.toString().padStart(exponent + 1, "0");
  return sign + digits.slice(0, -exponent) + "." + digits.slice(-exponent);
}

/** Convert a positive decimal payout amount to Stripe's integer minor units. */
export function stripeMajorToMinor(amount, currency) {
  const exponent = exponentFor(currency);
  const text = amount !== null && typeof amount === "object" && typeof amount.toString === "function"
    ? amount.toString()
    : String(amount);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match || match[1] === "-") {
    throw new Error("Payout amount must be a positive decimal value.");
  }

  const fraction = match[3] ?? "";
  if (fraction.length > exponent && /[1-9]/.test(fraction.slice(exponent))) {
    throw new Error("Payout amount has more precision than " + normalizeCurrency(currency) + " supports.");
  }

  const normalizedFraction = fraction.slice(0, exponent).padEnd(exponent, "0");
  const minor = BigInt(match[2]) * (10n ** BigInt(exponent)) + BigInt(normalizedFraction || "0");
  if (minor <= 0n) throw new Error("Payout amount must be greater than zero.");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Payout amount exceeds the supported provider limit.");
  }
  return Number(minor);
}
