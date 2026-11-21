// Preloaded into every Node process of the e2e server (via NODE_OPTIONS=--require).
// Blocks and records any outbound request to a host that is not local, so the suite can
// prove the app never contacted the real Supabase project (or any other third party).
// Only the hostname is recorded, never the URL, headers or body.
/* eslint-disable @typescript-eslint/no-require-imports -- a --require preload must be CommonJS */
const fs = require("node:fs")
const http = require("node:http")
const https = require("node:https")

const log = process.env.E2E_NETWORK_LOG
const mark = process.env.E2E_NETWORK_GUARD_MARK
const allowed = new Set(
  ["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"].concat(
    (process.env.E2E_ALLOW_HOSTS || "").split(",").map(h => h.trim()).filter(Boolean),
  ),
)

if (mark) {
  try {
    fs.appendFileSync(mark, `guard active pid=${process.pid} phase=${process.env.E2E_PHASE || "?"}\n`)
  } catch {}
}

function hostOf(input) {
  try {
    if (typeof input === "string") return new URL(input).hostname
    if (input instanceof URL) return input.hostname
    if (input && typeof input.url === "string") return new URL(input.url).hostname
    if (input && typeof input === "object") return input.hostname || (input.host || "").split(":")[0] || "localhost"
  } catch {}
  return ""
}

function check(host) {
  if (!host || allowed.has(host)) return
  if (log) {
    try {
      fs.appendFileSync(log, `${new Date().toISOString()} blocked ${host} phase=${process.env.E2E_PHASE || "?"}\n`)
    } catch {}
  }
  throw new Error(`e2e network guard: outbound request to ${host} blocked`)
}

for (const mod of [http, https]) {
  const request = mod.request
  const get = mod.get
  mod.request = function guardedRequest(input, ...rest) {
    check(hostOf(input))
    return request.call(this, input, ...rest)
  }
  mod.get = function guardedGet(input, ...rest) {
    check(hostOf(input))
    return get.call(this, input, ...rest)
  }
}

if (typeof globalThis.fetch === "function") {
  const realFetch = globalThis.fetch
  globalThis.fetch = function guardedFetch(input, init) {
    try {
      check(hostOf(input))
    } catch (err) {
      return Promise.reject(err)
    }
    return realFetch.call(this, input, init)
  }
}
