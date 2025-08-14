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
  Program_mainEntityOfPage_sameAs: string[];
  Program_discipline: string[];
  Program_educationalProgramPrerequisites: string[];
  Program_inLanguage: (StackLanguage | string)[];
  Program_occupationalCategory: (StackOccupation | string)[];
  Program_subjectOf: (StackSubjectOf | string)[];
  Program_CourseInstance: (StackProgramInstance | string)[];
  Program_offer: (StackProgramOffer | string)[];
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

interface StackSubjectOf {
  _id: string;
  Provider_subjectOfURL: string;
}

interface StackProgramInstance {
  _id: string;
  Program_courseInstance_courseMode: string;
}

interface StackProgramOffer {
  _id: string;
  Offer_description: string;
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

async function fetchInstance(id: string): Promise<StackProgramInstance | null> {
  try {
    const data = await fetchJSON<{ response: StackProgramInstance }>(
      `${API_BASE}/Stack_ProgramInstance/${id}`
    );
    return data.response;
  } catch {
    return null;
  }
}

async function fetchOffer(id: string): Promise<StackProgramOffer | null> {
  try {
    const data = await fetchJSON<{ response: StackProgramOffer }>(
      `${API_BASE}/Stack_Offer/${id}`
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

async function fetchSubjectOf(id: string): Promise<StackSubjectOf | null> {
  try {
    const data = await fetchJSON<{ response: StackSubjectOf }>(
      `${API_BASE}/Stack_subjectOf/${id}`
    );
    return data.response;
  } catch {
    return null;
  }
}

/* 4. Renderers */
function renderProgramPage(program: StackProgram): string {
  const provider = program.Program_provider as StackProvider;

  const languages = (program.Program_inLanguage ?? [])
    .map(l => typeof l === "string" ? `[${l}]` : l.Language_name ?? `[${l._id}]`)
    .join(", ");

  const occupations = (program.Program_occupationalCategory ?? [])
    .map(o => typeof o === "string" ? `[${o}]` : o.Occupation_name ?? `[${o._id}]`)
    .join(", ");

  const subjectofs = (program.Program_subjectOf ?? [])
    .map(o => typeof o === "string" ? `[${o}]` : o.Provider_subjectOfURL ?? `[${o._id}]`)
    .join(", ");

  const canonicalDomains = (provider.Provider_CanonicalDomainEN ?? [])
    .map((d) => typeof d === "string" ? d : d.Domain ?? `[${d._id}]`)
    .join(", ");

  const prerequisites = (program.Program_educationalProgramPrerequisites ?? [])
    .map((p) => `<li>${p}</li>`)
    .join("\n");  

  const disciplines = (program.Program_discipline ?? [])
    .map((d) => `<li>${d}</li>`)
    .join("\n");

  const sameAses = (program.Program_mainEntityOfPage_sameAs ?? [])
    .map((d) => `<li>${d}</li>`)
    .join("\n");

  const instances = (program.Program_CourseInstance ?? [])
    .map(l => typeof l === "string" ? `[${l}]` : l.Program_courseInstance_courseMode ?? `[${l._id}]`)
    .join(", ");

  const offers = (program.Program_offer ?? [])
    .map(l => typeof l === "string" ? `[${l}]` : l.Offer_description ?? `[${l._id}]`)
    .join(", ");

  //console.log(`📘 Disciplines for ${program.Program_name}:`, program.Program_discipline);

  //console.log(`📘 Prerequisites for ${program.Program_name}:`, program.Program_educationalProgramPrerequisites);


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
    <p><strong>Disciplines:</strong></p>
      <ul>
        ${disciplines || "<li>None listed</li>"}
      </ul>
    <p><strong>Slug:</strong> {program.Program_slug}</p>
    <p><strong>Credential:</strong> {program.Program_educationalCredentialAwarded}</p>
    <p><strong>Level:</strong> {program.Program_educationalLevel}</p>
    <p><strong>Mode:</strong> {program.Program_educationalProgramMode}</p>
    <p><strong>Program Type:</strong> {program.Program_programType}</p>
    <p><strong>Time to Complete:</strong> {program.Program_timeToComplete}</p>
    <p><strong>Educational Prerequisites:</strong></p>
      <ul>
        ${prerequisites || "<li>None listed</li>"}
      </ul>
    <p><strong>Languages:</strong> ${languages}</p>
    <p><strong>Occupational Categories:</strong> ${occupations}</p>
    <p><strong>Program URL:</strong> <a href="{program.Program_url}">{program.Program_url}</a></p>
    <p><strong>sameAs(URL):</strong> </p>
    <ul>
        ${sameAses || "<li>None listed</li>"}
    </ul>
    <p><strong>subjectOf:</strong> ${subjectofs}</p>

    <p><strong>Instances:</strong> </p>
    <ul>
        ${instances || "<li>None listed</li>"}
    </ul>

    <p><strong>Offers:</strong> </p>
    <ul>
        ${offers || "<li>None listed</li>"}
    </ul>

    <hr />
    <h2>Provider: <a href="/${provider.Provider_slug}/">${provider.Provider_name}</a></h2>
    <p>{provider.Provider_description}</p>
    <p><strong>Slug:</strong> {provider.Provider_slug}</p>
    <p><strong>Canonical Domains:</strong> ${canonicalDomains}</p>
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

     // Hydrate subjectofs
    program.Program_subjectOf = await Promise.all(
      (program.Program_subjectOf ?? []).map(async (entry) => {
        if (typeof entry === "string") {
          const sub = await fetchSubjectOf(entry);
          return sub ?? entry;
        }
        return entry;
      })
    );

    // Hydrate provider canonical domains
    provider.Provider_CanonicalDomainEN = await Promise.all(
      (provider.Provider_CanonicalDomainEN ?? []).map(async (entry) => {
        if (typeof entry === "string") {
          const full = await fetchCanonicalDomain(entry);
          return full ? { _id: entry, Domain: full } : entry;
        }
        return entry;
      })
    );

    // Hydrate course instances
    program.Program_CourseInstance = await Promise.all(
      (program.Program_CourseInstance ?? []).map(async entry => {
        if (typeof entry === "string") {
          const inst = await fetchInstance(entry);
          return inst ?? entry;
        }
        return entry;
      })
    );

// Hydrate offers
    program.Program_offer = await Promise.all(
      (program.Program_offer ?? []).map(async entry => {
        if (typeof entry === "string") {
          const off = await fetchOffer(entry);
          return off ?? entry;
        }
        return entry;
      })
    );


    const canonicalDomains: string[] = (provider.Provider_CanonicalDomainEN ?? [])
      .map((entry) => typeof entry === "string" ? `[${entry}]` : entry.Domain ?? `[${entry._id}]`);

    const matched = canonicalDomains.filter((d) => allowedDomains.includes(d));
    for (const domain of matched) {
      if (!byDomain[domain]) byDomain[domain] = [];
      byDomain[domain].push(program);
    }
  }

  for (const provider of allProviders) {
    // Hydrate provider canonical domains
    provider.Provider_CanonicalDomainEN = await Promise.all(
      (provider.Provider_CanonicalDomainEN ?? []).map(async (entry) => {
        if (typeof entry === "string") {
          const full = await fetchCanonicalDomain(entry);
          return full ? { _id: entry, Domain: full } : entry;
        }
        return entry;
      })
    );

    const canonicalDomains: string[] = (provider.Provider_CanonicalDomainEN ?? [])
      .map((entry) => typeof entry === "string" ? `[${entry}]` : entry.Domain ?? `[${entry._id}]`);

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
