import fs from "node:fs"
import path from "node:path"
import { test as teardown, expect } from "@playwright/test"

// Runs after every other project (see `teardown` in playwright.config.ts).
// e2e/server.mjs preloads e2e/support/network-guard.cjs into the build and the server; it records
// any request the app's Node processes tried to make to a non-local host (and blocks it).
const dist = path.join(process.cwd(), ".next-e2e")

teardown("server never contacted a non-local host, and the guard was active", () => {
  const mark = path.join(dist, "network-guard.mark")
  const log = path.join(dist, "network-guard.log")
  expect(fs.existsSync(mark), "network guard never loaded into the server").toBe(true)
  const marks = fs.readFileSync(mark, "utf8")
  expect(marks, "guard loaded into `next start`").toContain("phase=start")
  const blocked = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim() : ""
  expect(blocked, "outbound requests blocked by the network guard").toBe("")
})

teardown("dev mock server (holding + admin specs) never contacted a non-local host", () => {
  const devDist = path.join(process.cwd(), ".next-e2e-dev")
  const mark = path.join(devDist, "network-guard.mark")
  const log = path.join(devDist, "network-guard.log")
  expect(fs.existsSync(mark), "network guard never loaded into the dev server").toBe(true)
  expect(fs.readFileSync(mark, "utf8")).toContain("phase=dev")
  const blocked = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim() : ""
  expect(blocked, "outbound requests blocked by the network guard (dev)").toBe("")
})
