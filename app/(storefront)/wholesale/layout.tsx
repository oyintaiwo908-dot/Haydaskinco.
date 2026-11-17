import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Wholesale Skincare Nigeria | HAYDA SKINCo.",
  description:
    "Buy authentic skincare in bulk from HAYDA SKINCo. CeraVe, The Ordinary, La Roche-Posay, Korean brands and more, with tiered wholesale pricing and nationwide delivery across Nigeria.",
  alternates: { canonical: "/wholesale" },
}

export default function WholesaleLayout({ children }: { children: React.ReactNode }) {
  return children
}
