// Amounts are always integer minor units (e.g. cents). These helpers format for
// display only — never store the formatted value.

export function formatMoney(minorUnits: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(minorUnits / 100);
  } catch {
    // Unknown currency code — fall back to a plain decimal.
    return `${(minorUnits / 100).toFixed(2)} ${currency}`;
  }
}
