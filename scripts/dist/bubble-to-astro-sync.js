"use strict";
/**********************************************************************
 *  bubble-to-astro-sync.ts
 *********************************************************************/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_fetch_1 = __importDefault(require("node-fetch"));
dotenv_1.default.config({ path: node_path_1.default.resolve(__dirname, "../.env") });
const ROOT = node_path_1.default.resolve(__dirname, "../..");
const API_BASE = process.env.BUBBLE_BASE_URL ?? (() => {
    throw new Error("BUBBLE_BASE_URL is not defined");
})();
/* 2. Utilities */
function ensureDir(dir) {
    if (!node_fs_1.default.existsSync(dir))
        node_fs_1.default.mkdirSync(dir, { recursive: true });
}
function writeFile(relPath, contents) {
    const absPath = node_path_1.default.join(ROOT, relPath);
    ensureDir(node_path_1.default.dirname(absPath));
    node_fs_1.default.writeFileSync(absPath, contents, "utf8");
    console.log(`✅ Wrote: ${absPath}`);
}
async function fetchJSON(url) {
    const res = await (0, node_fetch_1.default)(url);
    const text = await res.text();
    if (!res.ok)
        throw new Error(`${url} → ${res.status} — ${text.slice(0, 200)}`);
    return JSON.parse(text);
}
/* 3. Bubble Fetchers */
async function fetchAllPrograms() {
    const data = await fetchJSON(`${API_BASE}/Stack_Program?limit=1000`);
    return data.response.results;
}
async function fetchAllProviders() {
    const data = await fetchJSON(`${API_BASE}/Stack_Provider?limit=1000`);
    return data.response.results;
}
async function fetchCanonicalDomain(id) {
    try {
        const data = await fetchJSON(`${API_BASE}/Stack_CanonicalDomain/${id}`);
        return data.response.Domain;
    }
    catch {
        return null;
    }
}
async function fetchLanguage(id) {
    try {
        const data = await fetchJSON(`${API_BASE}/Stack_Language/${id}`);
        return data.response;
    }
    catch {
        return null;
    }
}
async function fetchInstance(id) {
    try {
        const data = await fetchJSON(`${API_BASE}/Stack_ProgramInstance/${id}`);
        return data.response;
    }
    catch {
        return null;
    }
}
async function fetchOffer(id) {
    try {
        const data = await fetchJSON(`${API_BASE}/Stack_Offer/${id}`);
        return data.response;
    }
    catch {
        return null;
    }
}
async function fetchOccupation(id) {
    try {
        const data = await fetchJSON(`${API_BASE}/Stack_Occupation/${id}`);
        return data.response;
    }
    catch {
        return null;
    }
}
async function fetchSubjectOf(id) {
    try {
        const data = await fetchJSON(`${API_BASE}/Stack_subjectOf/${id}`);
        return data.response;
    }
    catch {
        return null;
    }
}
/* 4. Renderers */
function renderProgramPage(program) {
    const provider = program.Program_provider;
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
        if (typeof ci === "string")
            return `<li>[${ci}]</li>`;
        const mode = ci.Program_courseInstance_courseMode || `[${ci._id}]`;
        return `<li>${mode}</li>`;
    })
        .join("\n");
    // ✅ Build absolute canonical URL
    const domain = (provider?.Provider_CanonicalDomainEN ?? [])
        .map(d => typeof d === "string" ? d : d.Domain)
        .find(Boolean);
    const canonicalUrl = domain
        ? `https://${domain}/${provider?.Provider_slug}/${program.Program_slug}/`
        : `/${provider?.Provider_slug}/${program.Program_slug}/`;
    const offers = (program.Program_offer ?? [])
        .map(l => (typeof l === "string" ? `[${l}]` : l.Offer_description ?? `[${l._id}]`))
        .join(", ");
    return `---
/* ⚠️ AUTO-GENERATED — DO NOT EDIT BY HAND. */
const program = ${JSON.stringify(program, null, 2)};
const provider = program.Program_provider;
const canonicalUrl = "${canonicalUrl}"; // ✅ inject the absolute URL here

// JSON-LD schema builder (runs inside Astro)
const schema = {
  "@context": "https://schema.org",
  "@type": "EducationalOccupationalProgram",
  "@id": canonicalUrl,                // ← add
  "mainEntityOfPage": canonicalUrl,   // ← add
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
      : { "@type": "Offer", "description": o.Offer_description }
  )
};

// strip undefined keys so the JSON-LD is clean
const clean = (obj) => JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? undefined : v)));
---
<!DOCTYPE html>
<html>
   <head>
    <meta charset="utf-8" />
    <title>{program.Program_name}</title>
    <link rel="canonical" href="${canonicalUrl}" />
    <script type="application/ld+json">
      {JSON.stringify(clean(schema))}
    </script>
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
    <p><strong>sameAs(URL):</strong> </p>
    <ul>
        ${sameAses || "<li>None listed</li>"}
    </ul>
    <p><strong>subjectOf:</strong> ${subjectofs}</p>

    <p><strong>Instances:</strong> </p>
      <ul>
        ${instanceLis || "<li>None listed</li>"}
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
function renderIndexPage(programs, providers, domain) {
    return `---
---
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>${domain}</title></head>
  <body>
    <h1>Programs</h1>
    <ul>
      ${programs.map((p) => {
        const provider = p.Program_provider;
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
    const byDomain = {};
    const providersByDomain = {};
    for (const program of programs) {
        const provider = allProviders.find((p) => p._id === (typeof program.Program_provider === "string" ? program.Program_provider : program.Program_provider._id));
        if (!provider)
            continue;
        program.Program_provider = provider;
        // Hydrate languages
        program.Program_inLanguage = await Promise.all((program.Program_inLanguage ?? []).map(async (entry) => {
            if (typeof entry === "string") {
                const lang = await fetchLanguage(entry);
                return lang ?? entry;
            }
            return entry;
        }));
        // Hydrate occupations
        program.Program_occupationalCategory = await Promise.all((program.Program_occupationalCategory ?? []).map(async (entry) => {
            if (typeof entry === "string") {
                const occ = await fetchOccupation(entry);
                return occ ?? entry;
            }
            return entry;
        }));
        // Hydrate subjectofs
        program.Program_subjectOf = await Promise.all((program.Program_subjectOf ?? []).map(async (entry) => {
            if (typeof entry === "string") {
                const sub = await fetchSubjectOf(entry);
                return sub ?? entry;
            }
            return entry;
        }));
        // Hydrate provider canonical domains
        provider.Provider_CanonicalDomainEN = await Promise.all((provider.Provider_CanonicalDomainEN ?? []).map(async (entry) => {
            if (typeof entry === "string") {
                const full = await fetchCanonicalDomain(entry);
                return full ? { _id: entry, Domain: full } : entry;
            }
            return entry;
        }));
        // Hydrate course instances
        program.Program_CourseInstance = await Promise.all((program.Program_CourseInstance ?? []).map(async (entry) => {
            if (typeof entry === "string") {
                const inst = await fetchInstance(entry);
                if (!inst)
                    console.warn(`⚠️ ProgramInstance not found: ${entry}`);
                return inst ?? entry;
            }
            return entry;
        }));
        // Hydrate offers
        program.Program_offer = await Promise.all((program.Program_offer ?? []).map(async (entry) => {
            if (typeof entry === "string") {
                const off = await fetchOffer(entry);
                return off ?? entry;
            }
            return entry;
        }));
        const canonicalDomains = (provider.Provider_CanonicalDomainEN ?? [])
            .map((entry) => typeof entry === "string" ? `[${entry}]` : entry.Domain ?? `[${entry._id}]`);
        const matched = canonicalDomains.filter((d) => allowedDomains.includes(d));
        for (const domain of matched) {
            if (!byDomain[domain])
                byDomain[domain] = [];
            byDomain[domain].push(program);
        }
    }
    for (const provider of allProviders) {
        // Hydrate provider canonical domains
        provider.Provider_CanonicalDomainEN = await Promise.all((provider.Provider_CanonicalDomainEN ?? []).map(async (entry) => {
            if (typeof entry === "string") {
                const full = await fetchCanonicalDomain(entry);
                return full ? { _id: entry, Domain: full } : entry;
            }
            return entry;
        }));
        const canonicalDomains = (provider.Provider_CanonicalDomainEN ?? [])
            .map((entry) => typeof entry === "string" ? `[${entry}]` : entry.Domain ?? `[${entry._id}]`);
        const matched = canonicalDomains.filter((d) => allowedDomains.includes(d));
        for (const domain of matched) {
            if (!providersByDomain[domain])
                providersByDomain[domain] = [];
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
        if (!projectPath)
            continue;
        for (const program of programsForDomain) {
            const provider = program.Program_provider;
            const relPath = node_path_1.default.join("projects", projectPath, "src/pages", provider.Provider_slug, program.Program_slug, "index.astro");
            writeFile(relPath, renderProgramPage(program));
        }
        const indexPath = node_path_1.default.join("projects", projectPath, "src/pages/index.astro");
        writeFile(indexPath, renderIndexPage(programsForDomain, providersForDomain, domain));
    }
    console.log("✅ Sync complete");
})();
