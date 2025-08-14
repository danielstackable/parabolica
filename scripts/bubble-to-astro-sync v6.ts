/**********************************************************************
 *  bubble-to-astro-sync.ts
 *********************************************************************/

import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import fetch from "node-fetch";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

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
  Program_inLanguage: (StackLanguage | string)[];
  Program_occupationalCategory: (StackOccupation | string)[];
}

interface StackProvider {
  _id: string;
  Provider_name: string;
  Provider_slug: string;
  Provider_CanonicalDomainEN: (string | StackCanonicalDomain)[];
  Provider_description?: string;
  Provider_url?: string;
  Provider_logo?: string;
  Provider_photo?: string;
  Provider_sameAs?: string[];
  Provider_addressLocality?: string;
  Provider_postalCode?: string;
  Provider_streetAddress?: string;
  Provider_MarketingCopy?: string;
}

interface StackCanonicalDomain {
  _id: string;
  Domain: string;
}

interface StackLanguage {
  _id: string;
  Language_name: string;
}

interface StackOccupation {
  _id: string;
  Occupation_name: string;
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

async function fetchAllProviders(): Promise<StackProvider[]> {
  const data = await fetchJSON<{ response: { results: StackProvider[] } }>(
    `${API_BASE}/Stack_Provider?limit=1000`
  );
  return data.response.results;
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

async function fetchLanguage(id: string): Promise<StackLanguage | null> {
  try {
    const data = await fetchJSON<{ response: StackLanguage }>(
      `${API_BASE}/Stack_Language/${id}`
    );
    return data.response;
  } catch {
    return null;
  }
}

async function fetchOccupation(id: string): Promise<StackOccupation | null> {
  try {
    const data = await fetchJSON<{ response: StackOccupation }>(
      `${API_BASE}/Stack_Occupation/${id}`
    );
    return data.response;
  } catch {
    return null;
  }
}

/* 4. Renderers */
function renderProgramPage(program: StackProgram): string {
  const provider = program.Program_provider as StackProvider;

  const languages = program.Program_inLanguage
    .map((l) => typeof l === "string" ? "[Unknown Language]" : l.Language_name)
    .join(", ");
  const occupations = program.Program_occupationalCategory
    .map((o) => typeof o === "string" ? "[Unknown Occupation]" : o.Occupation_name)
    .join(", ");

  return `---
const program = ${JSON.stringify(program, null, 2)};
const provider = program.Program_provider;
---
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>{program.Program_name}</title></head>
  <body>
    <h1>{program.Program_name}</h1>
    <p>{program.Program_description}</p>
    <p><strong>Credential:</strong> {program.Program_educationalCredentialAwarded}</p>
    <p><strong>Level:</strong> {program.Program_educationalLevel}</p>
    <p><strong>Mode:</strong> {program.Program_educationalProgramMode}</p>
    <p><strong>Program Type:</strong> {program.Program_programType}</p>
    <p><strong>Time to Complete:</strong> {program.Program_timeToComplete}</p>
    <p><strong>Languages:</strong> ${languages}</p>
    <p><strong>Occupational Categories:</strong> ${occupations}</p>
    <p><strong>Program URL:</strong> <a href="{program.Program_url}">{program.Program_url}</a></p>
    <hr />
    <h2>Provider: <a href="/${provider.Provider_slug}/">${provider.Provider_name}</a></h2>
    <p>{provider.Provider_description}</p>
  </body>
</html>`;
}

function renderIndexPage(programs: StackProgram[], providers: StackProvider[], domain: string): string {
  return `---
---
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>${domain}</title></head>
  <body>
    <h1>Programs</h1>
    <ul>
      ${programs.map((p) => {
        const provider = p.Program_provider as StackProvider;
        return `<li><a href="/${provider.Provider_slug}/${p.Program_slug}/">${p.Program_name}</a> by <a href="/${provider.Provider_slug}/">${provider.Provider_name}</a></li>`;
      }).join("\n")}
    </ul>
    <h1>Providers</h1>
    <ul>
      ${providers.map((p) => `<li><a href="/${p.Provider_slug}/">${p.Provider_name}</a></li>`).join("\n")}
    </ul>
  </body>
</html>`;
}

/* 5. Main */
(async () => {
  const allowedDomains = ["study-in--japan.com", "study-in--london.com"];
  const programs = await fetchAllPrograms();
  const allProviders = await fetchAllProviders();
  console.log(`📦 Fetched ${programs.length} programs, ${allProviders.length} providers`);

  const byDomain: Record<string, StackProgram[]> = {};
  const providersByDomain: Record<string, StackProvider[]> = {};

  for (const program of programs) {
    const provider = allProviders.find((p) => p._id === (typeof program.Program_provider === "string" ? program.Program_provider : program.Program_provider._id));
    if (!provider) continue;
    program.Program_provider = provider;

    console.log(`🔎 Program ${program._id} languages (raw):`, program.Program_inLanguage);
    console.log(`🔎 Program ${program._id} occupations (raw):`, program.Program_occupationalCategory);

    // Hydrate languages
    program.Program_inLanguage = await Promise.all(
      (program.Program_inLanguage ?? []).map(async (entry) => {
        if (typeof entry === "string") {
          const lang = await fetchLanguage(entry);
          return lang ?? entry;
        }
        return entry;
      })
    );
    console.log(`✅ Hydrated languages:`, program.Program_inLanguage);

    // Hydrate occupations
    program.Program_occupationalCategory = await Promise.all(
      (program.Program_occupationalCategory ?? []).map(async (entry) => {
        if (typeof entry === "string") {
          const occ = await fetchOccupation(entry);
          return occ ?? entry;
        }
        return entry;
      })
    );
    console.log(`✅ Hydrated occupations:`, program.Program_occupationalCategory);

    const canonicalDomains: string[] = [];
    for (const entry of provider.Provider_CanonicalDomainEN ?? []) {
      if (typeof entry === "string") {
        const domain = await fetchCanonicalDomain(entry);
        if (domain) canonicalDomains.push(domain);
      } else if (entry.Domain) {
        canonicalDomains.push(entry.Domain);
      }
    }

    const matched = canonicalDomains.filter((d) => allowedDomains.includes(d));
    for (const domain of matched) {
      if (!byDomain[domain]) byDomain[domain] = [];
      byDomain[domain].push(program);
    }
  }

  for (const provider of allProviders) {
    const canonicalDomains: string[] = [];
    for (const entry of provider.Provider_CanonicalDomainEN ?? []) {
      if (typeof entry === "string") {
        const domain = await fetchCanonicalDomain(entry);
        if (domain) canonicalDomains.push(domain);
      } else if (entry.Domain) {
        canonicalDomains.push(entry.Domain);
      }
    }

    const matched = canonicalDomains.filter((d) => allowedDomains.includes(d));
    for (const domain of matched) {
      if (!providersByDomain[domain]) providersByDomain[domain] = [];
      providersByDomain[domain].push(provider);
    }
  }

  for (const domain of allowedDomains) {
    const programsForDomain = byDomain[domain] ?? [];
    const providersForDomain = providersByDomain[domain] ?? [];
    const projectPath = domain.includes("japan")
      ? "study-in--japan"
      : domain.includes("london")
      ? "study-in--london"
      : null;
    if (!projectPath) continue;

    for (const program of programsForDomain) {
      const provider = program.Program_provider as StackProvider;
      const relPath = path.join(
        "projects",
        projectPath,
        "src/pages",
        provider.Provider_slug,
        program.Program_slug,
        "index.astro"
      );
      writeFile(relPath, renderProgramPage(program));
    }

    const indexPath = path.join("projects", projectPath, "src/pages/index.astro");
    writeFile(indexPath, renderIndexPage(programsForDomain, providersForDomain, domain));
  }

  console.log("✅ Sync complete");
})();
