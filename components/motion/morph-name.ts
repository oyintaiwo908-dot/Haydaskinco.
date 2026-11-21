/** Shared view-transition name for a product image (card → PDP gallery). */
export function productMorphName(id: string) {
  return `product-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}
