import { describe, applyDiscount } from './services/orders';
import type { Order } from './models/order';

const order: Order = { id: 'A1', total: '10', items: [] };
const discounted: number = applyDiscount(order, 0.1);
const label: number = describe(order);

console.log(discounted, label);
