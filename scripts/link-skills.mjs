#!/usr/bin/env node
/**
 * Points `.claude/skills` at `.agents/skills` so Claude Code discovers the
 * vendored Medusa skills, without storing a second copy in git.
 *
 * The real files live in `.agents/skills` and are committed. `.claude/skills`
 * is gitignored and recreated locally by this script.
 *
 * Windows gets a directory junction (no admin rights needed, unlike a symlink);
 * macOS and Linux get an ordinary symlink.
 */
import { existsSync, lstatSync, rmSync, mkdirSync, symlinkSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const target = join(root, ".agents", "skills")
const link = join(root, ".claude", "skills")

if (!existsSync(target)) {
  console.error(`✗ Nothing to link: ${target} does not exist.`)
  process.exit(1)
}

mkdirSync(dirname(link), { recursive: true })

if (existsSync(link) || safeLstat(link)) {
  rmSync(link, { recursive: true, force: true })
}

symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir")
console.log(`✓ .claude/skills → .agents/skills`)

// existsSync follows the link, so a dangling one reads as absent.
function safeLstat(p) {
  try {
    return lstatSync(p)
  } catch {
    return null
  }
}
