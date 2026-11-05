export interface Order {
  id: string;
  total: number;
  items: OrderItem[];
}

export interface OrderItem {
  sku: string;
  quantity: number;
  price: number;
}
