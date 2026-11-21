// Builds and serves the app in MOCK mode for Playwright. Never talks to the real Supabase.
//
// 1. Every variable named in the repo's .env* files is set to "" in the child environment.
//    @next/env only fills keys that are undefined in process.env, so "" is never overridden
//    by .env, and the app treats an empty NEXT_PUBLIC_SUPABASE_URL as "not configured" (mock
//    catalogue, mock auth).
// 2. The build goes to .next-e2e (NEXT_DIST_DIR), so the real .next build is never replaced.
// 3. Before serving, the build output is scanned for the real Supabase hostname (read from
//    .env, never printed). If it is found, the server refuses to start.
// 4. Every Node process runs e2e/support/network-guard.cjs, which blocks and records any
//    request to a non-local host. Google Fonts is allowed during the build only (next/font
//    downloads and self-hosts the fonts); at runtime nothing external is allowed.
//
// Usage: node e2e/server.mjs   (PORT, E2E_SKIP_BUILD=1 to reuse an existing .next-e2e build)
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const port = process.env.PORT || "3123"
const distDir = ".next-e2e"
const distPath = path.join(root, distDir)
const guard = path.join(root, "e2e/support/network-guard.cjs")
const networkLog = path.join(distPath, "network-guard.log")
const guardMark = path.join(distPath, "network-guard.mark")

/** Names (never values) of every variable defined in .env-style files at the repo root. */
function envNames() {
  const names = new Set()
  for (const file of fs.readdirSync(root)) {
    if (!/^\.env/.test(file) || file === ".env.local.example") continue
    for (const line of fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)
      if (m) names.add(m[1])
    }
  }
  return names
}

/** Hostname of the real Supabase project from .env, used only to scan the build. */
function realSupabaseHost() {
  for (const file of fs.readdirSync(root)) {
    if (!/^\.env/.test(file) || file === ".env.local.example") continue
    for (const line of fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^"'\s]+)/)
      if (m) {
        try {
          return new URL(m[1]).hostname
        } catch {}
      }
    }
  }
  return null
}

const blank = new Set([
  ...envNames(),
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYSTACK_SECRET_KEY",
  "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY",
  "RESEND_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
])
const baseEnv = { ...process.env }
for (const name of blank) baseEnv[name] = ""
Object.assign(baseEnv, {
  NEXT_DIST_DIR: distDir,
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  E2E_NETWORK_LOG: networkLog,
  E2E_NETWORK_GUARD_MARK: guardMark,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${JSON.stringify(guard)}`.trim(),
})

const nextBin = path.join(root, "node_modules/next/dist/bin/next")
const skipBuild = process.env.E2E_SKIP_BUILD === "1" && fs.existsSync(path.join(distPath, "BUILD_ID"))

if (!skipBuild) {
  fs.rmSync(distPath, { recursive: true, force: true })
  // `next build` with a custom distDir rewrites these tracked files to point at .next-e2e.
  // Snapshot them and put them back so running the suite never dirties the repo.
  const tracked = ["next-env.d.ts", "tsconfig.json"].map(f => path.join(root, f))
  const snapshot = new Map(tracked.filter(f => fs.existsSync(f)).map(f => [f, fs.readFileSync(f, "utf8")]))
  const build = spawnSync(process.execPath, [nextBin, "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...baseEnv, E2E_PHASE: "build", E2E_ALLOW_HOSTS: "fonts.googleapis.com,fonts.gstatic.com" },
  })
  for (const [file, contents] of snapshot) {
    if (fs.readFileSync(file, "utf8") !== contents) fs.writeFileSync(file, contents)
  }
  if (build.status !== 0) {
    console.error("[e2e] build failed")
    process.exit(build.status ?? 1)
  }
}

// Refuse to serve a build that has the real project baked in.
const host = realSupabaseHost()
if (host) {
  const hits = []
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== "cache") walk(p)
      } else if (/\.(js|html|json|rsc|body|meta|css|txt)$/.test(entry.name) && !entry.name.startsWith("network-guard")) {
        if (fs.readFileSync(p, "utf8").includes(host)) hits.push(path.relative(root, p))
      }
    }
  }
  walk(distPath)
  if (hits.length) {
    console.error(`[e2e] refusing to start: the real Supabase host appears in ${hits.length} build file(s), e.g. ${hits[0]}`)
    process.exit(1)
  }
  console.log("[e2e] mock mode verified: real Supabase host not present in the build output")
} else {
  console.log("[e2e] no NEXT_PUBLIC_SUPABASE_URL in .env files; nothing to scan for")
}

// Runtime: nothing external is allowed.
const server = spawn(process.execPath, [nextBin, "start", "-p", port], {
  cwd: root,
  stdio: "inherit",
  env: { ...baseEnv, E2E_PHASE: "start", E2E_ALLOW_HOSTS: "" },
})
const stop = () => server.kill("SIGTERM")
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
server.on("exit", code => process.exit(code ?? 0))
