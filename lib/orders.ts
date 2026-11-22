export type OrderStatus = "pending" | "processing" | "shipped" | "fulfilled" | "cancelled" | "refunded"
export type PaymentStatus = "paid" | "pending" | "failed" | "refunded"
export type PaymentMethod = "card" | "bank_transfer" | "ussd" | "mobile_money"

export type OrderItem = {
  productId: string
  name: string
  image: string
  category: string
  price: number
  quantity: number
}

export type ShippingAddress = {
  firstName: string
  lastName: string
  address: string
  apartment?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
}

export type Order = {
  id: string
  reference: string          // Paystack reference (placeholder)
  customer: {
    id: string
    name: string
    email: string
    initials: string
  }
  items: OrderItem[]
  shippingAddress: ShippingAddress
  shippingMethod: "standard" | "express"
  shippingCost: number
  subtotal: number
  tax: number
  total: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  notes?: string
  createdAt: string
  updatedAt: string
}

/** Mock dates are relative to now, so local mock mode always has recent and older orders. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export const orders: Order[] = [
  {
    id: "ORD-8842",
    reference: "PSK-ref-aa12bb34",
    customer: { id: "u1", name: "Sophie Laurent", email: "sophie@example.com", initials: "SL" },
    items: [
      { productId: "radiance-serum", name: "Radiance Renewal Serum", image: "/product-serum.png", category: "Serums", price: 128, quantity: 1 },
      { productId: "velvet-cream", name: "Velvet Hydration Cream", image: "/product-cream.png", category: "Moisturizers", price: 94, quantity: 1 },
    ],
    shippingAddress: { firstName: "Sophie", lastName: "Laurent", address: "12 Rue de Rivoli", city: "Paris", state: "Île-de-France", zip: "75001", country: "France", phone: "+33 6 12 34 56 78" },
    shippingMethod: "express",
    shippingCost: 18,
    subtotal: 222,
    tax: 17.76,
    total: 257.76,
    status: "fulfilled",
    paymentStatus: "paid",
    paymentMethod: "card",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(0.2),
  },
  {
    id: "ORD-8841",
    reference: "PSK-ref-cc56dd78",
    customer: { id: "u2", name: "Mia Chen", email: "mia.chen@example.com", initials: "MC" },
    items: [
      { productId: "gold-oil", name: "Gold Infusion Face Oil", image: "/product-oil.png", category: "Oils", price: 156, quantity: 1 },
    ],
    shippingAddress: { firstName: "Mia", lastName: "Chen", address: "88 Orchard Road", city: "Singapore", state: "Central Region", zip: "238840", country: "Singapore" },
    shippingMethod: "standard",
    shippingCost: 0,
    subtotal: 156,
    tax: 12.48,
    total: 168.48,
    status: "processing",
    paymentStatus: "paid",
    paymentMethod: "bank_transfer",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: "ORD-8840",
    reference: "PSK-ref-ee90ff12",
    customer: { id: "u3", name: "Emma Williams", email: "emma.w@example.com", initials: "EW" },
    items: [
      { productId: "velvet-cream", name: "Velvet Hydration Cream", image: "/product-cream.png", category: "Moisturizers", price: 94, quantity: 2 },
    ],
    shippingAddress: { firstName: "Emma", lastName: "Williams", address: "44 Baker Street", city: "London", state: "England", zip: "W1U 7AL", country: "United Kingdom", phone: "+44 7700 900123" },
    shippingMethod: "express",
    shippingCost: 18,
    subtotal: 188,
    tax: 15.04,
    total: 221.04,
    status: "shipped",
    paymentStatus: "paid",
    paymentMethod: "card",
    notes: "Please leave with neighbour if not home.",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2.4),
  },
  {
    id: "ORD-8839",
    reference: "PSK-ref-gg34hh56",
    customer: { id: "u4", name: "Isabelle Dupont", email: "isabelle@example.com", initials: "ID" },
    items: [
      { productId: "eye-concentrate", name: "Illuminating Eye Concentrate", image: "/product-eye.png", category: "Eye Care", price: 112, quantity: 1 },
    ],
    shippingAddress: { firstName: "Isabelle", lastName: "Dupont", address: "7 Avenue Montaigne", city: "Paris", state: "Île-de-France", zip: "75008", country: "France" },
    shippingMethod: "standard",
    shippingCost: 0,
    subtotal: 112,
    tax: 8.96,
    total: 120.96,
    status: "shipped",
    paymentStatus: "paid",
    paymentMethod: "mobile_money",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(4),
  },
  {
    id: "ORD-8838",
    reference: "PSK-ref-ii78jj90",
    customer: { id: "u5", name: "Olivia Park", email: "olivia.park@example.com", initials: "OP" },
    items: [
      { productId: "lavender-toner", name: "Lavender Calm Toner", image: "/product-toner.png", category: "Toners", price: 68, quantity: 1 },
    ],
    shippingAddress: { firstName: "Olivia", lastName: "Park", address: "120 Collins Street", city: "Melbourne", state: "Victoria", zip: "3000", country: "Australia" },
    shippingMethod: "standard",
    shippingCost: 0,
    subtotal: 68,
    tax: 5.44,
    total: 73.44,
    status: "processing",
    paymentStatus: "paid",
    paymentMethod: "card",
    createdAt: daysAgo(12),
    updatedAt: daysAgo(12),
  },
  {
    id: "ORD-8837",
    reference: "PSK-ref-kk12ll34",
    customer: { id: "u7", name: "Aisha Diallo", email: "aisha@example.com", initials: "AD" },
    items: [
      { productId: "radiance-serum", name: "Radiance Renewal Serum", image: "/product-serum.png", category: "Serums", price: 128, quantity: 1 },
      { productId: "gentle-cleanser", name: "Gentle Resurfacing Cleanser", image: "/product-cleanser.png", category: "Cleansers", price: 56, quantity: 1 },
    ],
    shippingAddress: { firstName: "Aisha", lastName: "Diallo", address: "15 Victoria Island", city: "Lagos", state: "Lagos State", zip: "101241", country: "Nigeria", phone: "+234 801 234 5678" },
    shippingMethod: "express",
    shippingCost: 18,
    subtotal: 184,
    tax: 14.72,
    total: 216.72,
    status: "fulfilled",
    paymentStatus: "paid",
    paymentMethod: "bank_transfer",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(18),
  },
  {
    id: "ORD-8836",
    reference: "PSK-ref-mm56nn78",
    customer: { id: "u8", name: "Luna Torres", email: "luna.torres@example.com", initials: "LT" },
    items: [
      { productId: "gold-oil", name: "Gold Infusion Face Oil", image: "/product-oil.png", category: "Oils", price: 156, quantity: 1 },
      { productId: "lavender-toner", name: "Lavender Calm Toner", image: "/product-toner.png", category: "Toners", price: 68, quantity: 1 },
    ],
    shippingAddress: { firstName: "Luna", lastName: "Torres", address: "Calle Gran Vía 28", city: "Madrid", state: "Community of Madrid", zip: "28013", country: "Spain" },
    shippingMethod: "standard",
    shippingCost: 0,
    subtotal: 224,
    tax: 17.92,
    total: 241.92,
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "card",
    createdAt: daysAgo(0.5),
    updatedAt: daysAgo(0.5),
  },
  {
    id: "ORD-8835",
    reference: "PSK-ref-oo90pp12",
    customer: { id: "u10", name: "Fatima Al-Hassan", email: "fatima@example.com", initials: "FA" },
    items: [
      { productId: "radiance-serum", name: "Radiance Renewal Serum", image: "/product-serum.png", category: "Serums", price: 128, quantity: 1 },
    ],
    shippingAddress: { firstName: "Fatima", lastName: "Al-Hassan", address: "Al Olaya District", city: "Riyadh", state: "Riyadh Region", zip: "12213", country: "Saudi Arabia" },
    shippingMethod: "express",
    shippingCost: 18,
    subtotal: 128,
    tax: 10.24,
    total: 156.24,
    status: "cancelled",
    paymentStatus: "refunded",
    paymentMethod: "card",
    notes: "Customer requested cancellation before dispatch.",
    createdAt: daysAgo(35),
    updatedAt: daysAgo(34.8),
  },
]

export function getOrder(id: string) {
  return orders.find((o) => o.id === id)
}

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:    { label: "Pending",    color: "text-gray-500",   bg: "bg-gray-50",          border: "border-gray-200" },
  processing: { label: "Processing", color: "text-blue-700",          bg: "bg-blue-50",          border: "border-blue-200" },
  shipped:    { label: "Shipped",    color: "text-purple-700",        bg: "bg-purple-50",        border: "border-purple-200" },
  fulfilled:  { label: "Fulfilled",  color: "text-green-700",         bg: "bg-green-50",         border: "border-green-200" },
  cancelled:  { label: "Cancelled",  color: "text-muted-foreground",  bg: "bg-muted",            border: "border-border" },
  refunded:   { label: "Refunded",   color: "text-destructive",       bg: "bg-destructive/10",   border: "border-destructive/20" },
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; color: string }> = {
  paid:     { label: "Paid",     color: "text-green-700" },
  pending:  { label: "Pending",  color: "text-gold" },
  failed:   { label: "Failed",   color: "text-destructive" },
  refunded: { label: "Refunded", color: "text-muted-foreground" },
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card:           "Card",
  bank_transfer:  "Bank Transfer",
  ussd:           "USSD",
  mobile_money:   "Mobile Money",
}
