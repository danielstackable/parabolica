/**********************************************************************
 *  bubble-to-astro-sync.ts
 *********************************************************************/

import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import fetch from "node-fetch";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Force root to be parabolica/
const ROOT = path.resolve(__dirname, "../..");

const API_BASE = process.env.BUBBLE_BASE_URL ?? (() => {
  throw new Error("BUBBLE_BASE_URL is not defined");
})();

/* 1. Types */
interface StackProgram {
  _id: string;
  Program_slug: string;
  Program_name: string;
  Program_description: string;
  Program_educationalCredentialAwarded: string;
  Program_educationalLevel: string;
  Program_educationalProgramMode: string;
  Program_programType: string;
  Program_url: string;
  Program_timeToComplete: string;
  Program_provider: StackProvider | string;
  Program_inLanguage: string[];
  Program_occupationalCategory: string[];
}

interface StackProvider {
  _id: string;
  Provider_name: string;
  Provider_slug: string;
  Provider_CanonicalDomainEN: (string | StackCanonicalDomain)[];
}

interface StackCanonicalDomain {
  _id: string;
  Domain: string;
}

/* 2. Utilities */
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(relPath: string, contents: string) {
  const absPath = path.join(ROOT, relPath);
  ensureDir(path.dirname(absPath));
  fs.writeFileSync(absPath, contents, "utf8");
  console.log(`✅ Wrote: ${absPath}`);
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} → ${res.status} — ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/* 3. Bubble Fetchers */
async function fetchAllPrograms(): Promise<StackProgram[]> {
  const data = await fetchJSON<{ response: { results: StackProgram[] } }>(
    `${API_BASE}/Stack_Program?limit=1000`
  );
  return data.response.results;
}

async function fetchProvider(id?: string): Promise<StackProvider | null> {
  if (!id) return null;
  try {
    const data = await fetchJSON<{ response: StackProvider }>(`${API_BASE}/Stack_Provider/${id}`);
    return data.response;
  } catch {
    return null;
  }
}

async function fetchCanonicalDomain(id: string): Promise<string | null> {
  try {
    const data = await fetchJSON<{ response: StackCanonicalDomain }>(
      `${API_BASE}/Stack_CanonicalDomain/${id}`
    );
    return data.response.Domain;
  } catch {
    return null;
  }
}

/* 4. Renderers */
function renderProgramPage(program: any): string {
  return `---
const program = ${JSON.stringify(program, null, 2)};
---
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>{program.Program_name}</title></head>
  <body><h1>{program.Program_name}</h1><p>{program.Program_description}</p></body>
</html>`;
}

function renderIndexPage(programs: StackProgram[], domain: string): string {
  return `---
---
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>Programs at ${domain}</title></head>
  <body>
    <h1>Programs</h1>
    <ul>
      ${programs
        .map(
          (p) =>
            `<li><a href="/${
              typeof p.Program_provider === "object" ? p.Program_provider.Provider_slug : p.Program_provider
            }/${p.Program_slug}/">${p.Program_name}</a></li>`
        )
        .join("\n")}
    </ul>
  </body>
</html>`;
}

/* 5. Main */
(async () => {
  const allowedDomains = ["study-in--japan.com", "study-in--london.com"];
  const programs = await fetchAllPrograms();
  console.log(`📦 Fetched ${programs.length} programs`);
  const byDomain: Record<string, StackProgram[]> = {};

  for (const program of programs) {
    const providerId =
      typeof program.Program_provider === "string"
        ? program.Program_provider
        : program.Program_provider._id;

    const provider = await fetchProvider(providerId);
    if (!provider) {
      console.warn(`⚠️ No provider found for program ${program._id}`);
      continue;
    }
    program.Program_provider = provider; // ✅ This fixes your issue

    console.log(`🔍 Program ${program._id} → Provider ${provider.Provider_name} (${provider.Provider_slug})`);

    const canonicalDomains: string[] = [];
    for (const entry of provider.Provider_CanonicalDomainEN ?? []) {
      if (typeof entry === "string") {
        const domain = await fetchCanonicalDomain(entry);
        if (domain) canonicalDomains.push(domain);
      } else if (entry.Domain) {
        canonicalDomains.push(entry.Domain);
      }
    }

    console.log(`🌐 Canonical domains: ${canonicalDomains.join(", ")}`);
    const matchedDomains = canonicalDomains.filter((d) => allowedDomains.includes(d));
    console.log(`✅ Matched domains: ${matchedDomains.join(", ")}`);

    if (matchedDomains.length === 0) {
      console.warn(`⚠️ Skipping provider ${provider._id} — no allowed domains`);
      continue;
    }

    for (const domain of matchedDomains) {
      if (!byDomain[domain]) byDomain[domain] = [];
      byDomain[domain].push(program);

      const projectPath = domain.includes("japan")
        ? "study-in--japan"
        : domain.includes("london")
        ? "study-in--london"
        : null;

      if (!projectPath) continue;

      const relPath = path.join(
        "projects",
        projectPath,
        "src/pages",
        provider.Provider_slug,
        program.Program_slug,
        "index.astro"
      );
      console.log(`📍 Will write program page to: ${path.join(ROOT, relPath)}`);
      writeFile(relPath, renderProgramPage(program));
    }
  }

  for (const [domain, domainPrograms] of Object.entries(byDomain)) {
    const projectPath = domain.includes("japan")
      ? "study-in--japan"
      : domain.includes("london")
      ? "study-in--london"
      : null;
    if (!projectPath) continue;

    const indexPath = path.join("projects", projectPath, "src/pages/index.astro");
    console.log(`📍 Will write index page to: ${path.join(ROOT, indexPath)}`);
    writeFile(indexPath, renderIndexPage(domainPrograms, domain));
  }

  console.log("✅ Sync completed for allowed domains:", allowedDomains);
})();
