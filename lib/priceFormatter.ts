/**
 * Format price to display with dots separator
 * Example: 1200000 -> "1.200.000 $"
 */
export function formatPrice(price: number): string {
  return price
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    .concat(" $");
}

/**
 * Parse price string to number
 * Removes dots and $ sign
 * Example: "1.200.000$" -> 1200000
 */
export function parsePrice(priceStr: string): number {
  return parseInt(priceStr.replace(/\./g, "").replace("$", ""), 10) || 0;
}
