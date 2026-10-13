const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function inr(value: number) {
  return money.format(value);
}

export function offPercent(price: number, mrp: number) {
  if (mrp <= price) return 0;
  return Math.round((1 - price / mrp) * 100);
}
