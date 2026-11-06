interface CartLine {
  productId: number;
  quantity: number;
}

export function addLine(lines: CartLine[], productId: number): CartLine[] {
  return [...lines, { productId, quantity: 1, gift: true }];
}

export function totalQuantity(lines: CartLine[]): number {
  return lines.reduce((acc, line) => acc + line.qty, 0);
}

export const emptyCart: CartLine[] = null;
