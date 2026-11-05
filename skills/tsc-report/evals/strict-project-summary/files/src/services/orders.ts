import type { Order } from '../models/order';
import { formatPrice } from '../utils/format';
import { sum } from '../utils/math';

export function orderTotal(order: Order): number {
  return sum(order.items.map((item) => item.price * item.quantity));
}

export function describe(order: Order): string {
  const total: string = orderTotal(order);
  return `${order.id}: ${formatPrice(total, 'BRL')} (${order.customer})`;
}

export function applyDiscount(order, rate) {
  return order.total * (1 - rate);
}
