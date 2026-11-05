interface Product {
  id: number;
  name: string;
}

export function findProduct(products: Product[], id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function productName(product: Product | undefined): string {
  return product.name;
}
