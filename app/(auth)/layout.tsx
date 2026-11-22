export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // The (auth) group holds the admin sign-in and sign-up pages: same pre-revamp admin look.
  return <div className="admin-theme bg-background">{children}</div>
}
