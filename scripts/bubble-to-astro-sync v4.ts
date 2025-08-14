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
  const provider = program.Program_provider;
  const providerLinks =
    Array.isArray(provider.Provider_sameAs)
      ? provider.Provider_sameAs.map((link: string) => `<li><a href="${link}" target="_blank">${link}</a></li>`).join("")
      : "";

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
    <p><strong>Languages:</strong> {program.Program_inLanguage?.join(', ')}</p>
    <p><strong>Occupational Categories:</strong> {program.Program_occupationalCategory?.join(', ')}</p>
    <p><strong>Program URL:</strong> <a href="{program.Program_url}">{program.Program_url}</a></p>
    <hr />
    <h2>Provider: {provider.Provider_name}</h2>
    <p>{provider.Provider_description}</p>
    <p><strong>URL:</strong> <a href="{provider.Provider_url}">{provider.Provider_url}</a></p>
    <p><strong>Location:</strong> {provider.Provider_streetAddress}, {provider.Provider_addressLocality}</p>
    <p><strong>Marketing:</strong> {provider.Provider_MarketingCopy}</p>
    <p><strong>Links:</strong></p>
    <ul>${providerLinks}</ul>
    <img src="{provider.Provider_logo}" alt="Logo" width="150" />
    <img src="{provider.Provider_photo}" alt="Photo" width="300" />
  </body>
</html>`;
}

function renderIndexPage(programs: StackProgram[], providers: StackProvider[], domain: string): string {
  return `---
---
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>${domain} - Programs and Providers</title></head>
  <body>
    <h1>Programs at ${domain}</h1>
    <ul>
      ${programs.map(p => {
        const provider = p.Program_provider as StackProvider;
        return `<li><h2>${p.Program_name}</h2><p><strong>Provider:</strong> ${provider.Provider_name}</p><p><a href="/${provider.Provider_slug}/${p.Program_slug}/">View Program</a></p></li>`;
      }).join('\n')}
    </ul>
    <hr />
    <h1>Providers for ${domain}</h1>
    <ul>
      ${providers.map(p => `<li><h2>${p.Provider_name}</h2><p><a href="/${p.Provider_slug}/">Visit Page</a></p></li>`).join('\n')}
    </ul>
  </body>
</html>`;
}

/* 5. Main */
(async () => {
  const allowedDomains = ["study-in--japan.com", "study-in--london.com"];
  const programs = await fetchAllPrograms();
  const allProviders = await fetchAllProviders();

  const byDomain: Record<string, StackProgram[]> = {};
  const domainProviders: Record<string, StackProvider[]> = {};

  for (const program of programs) {
    const providerId = typeof program.Program_provider === "string" ? program.Program_provider : program.Program_provider._id;
    const provider = await fetchProvider(providerId);
    if (!provider) continue;
    program.Program_provider = provider;

    const canonicalDomains: string[] = [];
    for (const entry of provider.Provider_CanonicalDomainEN ?? []) {
      if (typeof entry === "string") {
        const domain = await fetchCanonicalDomain(entry);
        if (domain) canonicalDomains.push(domain);
      } else if (entry.Domain) {
        canonicalDomains.push(entry.Domain);
      }
    }

    const matchedDomains = canonicalDomains.filter(d => allowedDomains.includes(d));
    if (matchedDomains.length === 0) continue;

    for (const domain of matchedDomains) {
      if (!byDomain[domain]) byDomain[domain] = [];
      byDomain[domain].push(program);

      const projectPath = domain.includes("japan") ? "study-in--japan" : domain.includes("london") ? "study-in--london" : null;
      if (!projectPath) continue;

      const relPath = path.join("projects", projectPath, "src/pages", provider.Provider_slug, program.Program_slug, "index.astro");
      writeFile(relPath, renderProgramPage(program));
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
    for (const domain of canonicalDomains) {
      if (!allowedDomains.includes(domain)) continue;
      if (!domainProviders[domain]) domainProviders[domain] = [];
      domainProviders[domain].push(provider);
    }
  }

  for (const domain of allowedDomains) {
    const domainPrograms = byDomain[domain] ?? [];
    const providers = domainProviders[domain] ?? [];

    const projectPath = domain.includes("japan") ? "study-in--japan" : domain.includes("london") ? "study-in--london" : null;
    if (!projectPath) continue;

    const indexPath = path.join("projects", projectPath, "src/pages/index.astro");
    writeFile(indexPath, renderIndexPage(domainPrograms, providers, domain));
  }

  console.log("✅ Sync completed for allowed domains.");
})();
