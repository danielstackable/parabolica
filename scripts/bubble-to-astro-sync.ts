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
  /** Relation back to the Program (id or hydrated object) */
  Offer_program?: string | StackProgram;
  /** Price value as number or text (Bubble may return numeric text) */
  Offer_price?: number | string;
  /** e.g. "USD", "JPY", "CHF" */
  Offer_priceCurrency?: string;
  /** ISO 8601 date string e.g. "2025-12-31" */
  Offer_validThrough?: string;
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
    .map(l => (typeof l === "string" ? `[${l}]` : l.Language_name ?? `[${l._id}]`))
    .join(", ");

  const occupations = (program.Program_occupationalCategory ?? [])
    .map(o => (typeof o === "string" ? `[${o}]` : o.Occupation_name ?? `[${o._id}]`))
    .join(", ");

  const subjectofs = (program.Program_subjectOf ?? [])
    .map(o => (typeof o === "string" ? `[${o}]` : o.Provider_subjectOfURL ?? `[${o._id}]`))
    .join(", ");

  const canonicalDomains = (provider.Provider_CanonicalDomainEN ?? [])
    .map(d => (typeof d === "string" ? d : d.Domain ?? `[${d._id}]`))
    .join(", ");

  const prerequisites = (program.Program_educationalProgramPrerequisites ?? [])
    .map(p => `<li>${p}</li>`)
    .join("\n");

  const disciplines = (program.Program_discipline ?? [])
    .map(d => `<li>${d}</li>`)
    .join("\n");

  const sameAses = (program.Program_mainEntityOfPage_sameAs ?? [])
    .map(d => `<li>${d}</li>`)
    .join("\n");

  const instanceLis = (program.Program_CourseInstance ?? [])
    .map(ci => {
      if (typeof ci === "string") return `<li>[${ci}]</li>`;
      const mode = ci.Program_courseInstance_courseMode || `[${ci._id}]`;
      return `<li>${mode}</li>`;
    })
    .join("\n");

  // ✅ Build absolute canonical URL
  const domain = (provider?.Provider_CanonicalDomainEN ?? [])
    .map(d => (typeof d === "string" ? d : d.Domain))
    .find(Boolean);

  const canonicalUrl = domain
    ? `https://${domain}/${provider?.Provider_slug}/${program.Program_slug}/`
    : `/${provider?.Provider_slug}/${program.Program_slug}/`;

  // Offers — render detailed list items
  const offersLis = (program.Program_offer ?? []).map(o => {
    if (typeof o === "string") {
      return `<li>[Offer ${o}]</li>`;
    }
    const desc = o.Offer_description ?? "";
    const price =
      o.Offer_price !== undefined && o.Offer_price !== null && o.Offer_price !== ""
        ? `${o.Offer_price}`
        : "";
    const currency = o.Offer_priceCurrency ? `${o.Offer_priceCurrency}` : "";
    const priceBlock =
      price && currency ? `${price} ${currency}` : price || currency || "";
    const valid = o.Offer_validThrough ? ` (valid through ${o.Offer_validThrough})` : "";
    return `<li>${[desc, priceBlock].filter(Boolean).join(" — ")}${valid}</li>`;
  }).join("\n");

  return `---
/* ⚠️ AUTO-GENERATED — DO NOT EDIT BY HAND. */
const program = ${JSON.stringify(program, null, 2)};
const provider = program.Program_provider;
const canonicalUrl = "${canonicalUrl}";

// JSON-LD schema builder (runs inside Astro)
const schema = {
  "@context": "https://schema.org",
  "@type": "EducationalOccupationalProgram",
  "@id": canonicalUrl,
  "mainEntityOfPage": canonicalUrl,
  "name": program.Program_name,
  "description": program.Program_description,
  "programType": program.Program_programType || undefined,
  "timeToComplete": program.Program_timeToComplete || undefined,
  "educationalCredentialAwarded": program.Program_educationalCredentialAwarded || undefined,
  "educationalLevel": program.Program_educationalLevel || undefined,
  "educationalProgramMode": program.Program_educationalProgramMode || undefined,
  "inLanguage": (program.Program_inLanguage ?? []).map(l => typeof l === "string" ? l : l.Language_name).filter(Boolean),
  "occupationalCategory": (program.Program_occupationalCategory ?? []).map(o => typeof o === "string" ? o : o.Occupation_name).filter(Boolean),
  "sameAs": program.Program_mainEntityOfPage_sameAs ?? [],
  "url": program.Program_url || undefined,
  "provider": {
    "@type": "CollegeOrUniversity",
    "name": provider?.Provider_name,
    "url": provider?.Provider_url || undefined,
    "description": provider?.Provider_description || undefined,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": provider?.Provider_addressLocality || undefined,
      "postalCode": provider?.Provider_postalCode || undefined,
      "streetAddress": provider?.Provider_streetAddress || undefined
    }
  },
  "offers": (program.Program_offer ?? []).map(o => 
    typeof o === "string"
      ? { "@type": "Offer", "@id": o }
      : {
          "@type": "Offer",
          "description": o.Offer_description || undefined,
          "price": o.Offer_price ?? undefined,
          "priceCurrency": o.Offer_priceCurrency || undefined,
          "validThrough": o.Offer_validThrough || undefined
        }
  )
};

// strip undefined keys so the JSON-LD is clean
const clean = (obj) => JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? undefined : v)));

// ✅ SAFELY SERIALIZE JSON-LD FOR INLINE SCRIPT
const jsonLdObj = clean(schema);
const jsonLd = JSON.stringify(jsonLdObj)
  .replace(/</g, '\\u003C')
  .replace(/>/g, '\\u003E')
  .replace(/&/g, '\\u0026')
  .replace(/\\u2028/g, '\\\\u2028')
  .replace(/\\u2029/g, '\\\\u2029')
  .replace(/<\\/script/gi, '<\\\\/script');
---
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>{program.Program_name}</title>
    <link rel="canonical" href="${canonicalUrl}" />
    <script type="application/ld+json" set:html={jsonLd}></script>
  </head>
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
    <p><strong>sameAs(URL):</strong></p>
    <ul>
      ${sameAses || "<li>None listed</li>"}
    </ul>
    <p><strong>subjectOf:</strong> ${subjectofs}</p>

    <p><strong>Instances:</strong></p>
    <ul>
      ${instanceLis || "<li>None listed</li>"}
    </ul>

    <p><strong>Offers:</strong></p>
    <ul>
      ${offersLis || "<li>None listed</li>"}
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
  const siteUrl = `https://${domain}/`;

  // 🔐 Bing verification codes (make sure the domain key matches exactly)
  const BING_VERIFY: Record<string, string> = {
    "study-in--japan.com": "052EF10DBD33B0E77EB728844239AD59",
    // "study-in--london.com": "PUT_YOURS_HERE"
  };
  const bingMeta = BING_VERIFY[domain]
    ? `<meta name="msvalidate.01" content="${BING_VERIFY[domain]}" />`
    : "";

  // Build HTML lists (avoid nested template strings)
  const programItemsHtml = programs.map(p => {
    const prov = p.Program_provider as StackProvider;
    return '<li><a href="/' + prov.Provider_slug + '/' + p.Program_slug + '/">' +
           p.Program_name +
           '</a> by <a href="/' + prov.Provider_slug + '/">' + prov.Provider_name + '</a></li>';
  }).join('\n');

  const providerItemsHtml = providers.map(prov => {
    return '<li><a href="/' + prov.Provider_slug + '/">' + prov.Provider_name + '</a></li>';
  }).join('\n');

  // JSON-LD (WebSite + ItemLists)
  const programList = programs.map((p, i) => {
    const prov = p.Program_provider as StackProvider;
    return {
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}${prov.Provider_slug}/${p.Program_slug}/`,
      name: p.Program_name,
      item: {
        "@type": "EducationalOccupationalProgram",
        name: p.Program_name,
        provider: {
          "@type": "CollegeOrUniversity",
          name: prov.Provider_name,
          url: `${siteUrl}${prov.Provider_slug}/`
        }
      }
    };
  });

  const providerList = providers.map((prov, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `${siteUrl}${prov.Provider_slug}/`,
    name: prov.Provider_name,
    item: {
      "@type": "CollegeOrUniversity",
      name: prov.Provider_name,
      url: `${siteUrl}${prov.Provider_slug}/`
    }
  }));

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      url: siteUrl,
      name: domain,
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Programs",
      itemListElement: programList
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Providers",
      itemListElement: providerList
    }
  ];

  const safeJsonLd = JSON.stringify(schema)
    .replace(/</g, "\\u003C").replace(/>/g, "\\u003E").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
    .replace(/<\/script/gi, "<\\\\/script>");

  return `---
const siteUrl = "${siteUrl}";
const domain = "${domain}";
const jsonLd = ${JSON.stringify(safeJsonLd)};
---
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    ${bingMeta}
    <title>{domain}</title>
    <link rel="canonical" href="{siteUrl}" />
    <script type="application/ld+json" set:html={jsonLd}></script>
  </head>
  <body>
    <h1>Programs</h1>
    <ul>
${programItemsHtml}
    </ul>
    <h1>Providers</h1>
    <ul>
${providerItemsHtml}
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
      (program.Program_CourseInstance ?? []).map(async (entry) => {
        if (typeof entry === "string") {
          const inst = await fetchInstance(entry);
          if (!inst) console.warn(`⚠️ ProgramInstance not found: ${entry}`);
          return inst ?? entry;
        }
        return entry;
      })
    );

    // Hydrate offers (now includes price, currency, validThrough, etc.)
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
