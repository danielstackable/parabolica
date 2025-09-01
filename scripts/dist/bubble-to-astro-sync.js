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
async function fetchCurrency(id) {
    try {
        // Datatype name is exactly "Currency"
        const data = await fetchJSON(`${API_BASE}/Currency/${id}`);
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
/* 4. Helpers */
function isBubbleIdLike(s) {
    // Bubble IDs typically look like "1700163105998x876875505638910000"
    return /\d{10,}x[0-9a-z]+/i.test(s);
}
function getCurrencyCode(cur) {
    if (!cur)
        return undefined;
    if (typeof cur === "string") {
        // If it's an all-caps 3-letter code (ISO), use it; if it looks like an ID, drop it.
        if (/^[A-Z]{3}$/.test(cur))
            return cur;
        if (isBubbleIdLike(cur))
            return undefined;
        return cur; // fallback (e.g., "Usd" or custom text)
    }
    // Prefer proper code, fall back to other fields (better than leaking ids)
    return cur.Code || cur.Name || cur.Country || undefined;
}
function currencyFromOffer(offer) {
    // normalize: prefer the lower-cased field, but accept either
    return offer.Offer_priceCurrency ?? offer.Offer_PriceCurrency;
}
function setCurrencyOnOffer(offer, v) {
    // keep canonical field populated; also mirror to the alt field to avoid surprises
    offer.Offer_priceCurrency = v;
    offer.Offer_PriceCurrency = v;
}
/* 5. Renderers */
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
        .map(d => (typeof d === "string" ? d : d.Domain))
        .find(Boolean);
    const canonicalUrl = domain
        ? `https://${domain}/${provider?.Provider_slug}/${program.Program_slug}/`
        : `/${provider?.Provider_slug}/${program.Program_slug}/`;
    // Offers — detailed list items with hydrated currency
    const offersLis = (program.Program_offer ?? []).map(o => {
        if (typeof o === "string") {
            return `<li>[Offer ${o}]</li>`;
        }
        const desc = o.Offer_description ?? "";
        const price = o.Offer_price !== undefined && o.Offer_price !== null && o.Offer_price !== ""
            ? `${o.Offer_price}`
            : "";
        const currencyCode = getCurrencyCode(currencyFromOffer(o));
        const priceBlock = price && currencyCode ? `${price} ${currencyCode}` : price || currencyCode || "";
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
          // DO NOT output Bubble IDs: only an ISO-like code or sensible text
          "priceCurrency": (() => {
            const cur = ${currencyFromOffer.toString()}(o);
            if (!cur) return undefined;
            if (typeof cur === "string") {
              if (/^[A-Z]{3}$/.test(cur)) return cur;
              if (${isBubbleIdLike.toString()}(cur)) return undefined;
              return cur;
            }
            return cur.Code || cur.Name || cur.Country || undefined;
          })(),
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
function renderIndexPage(programs, providers, domain) {
    const siteUrl = `https://${domain}/`;
    // 🔐 Bing verification codes (make sure the domain key matches exactly)
    const BING_VERIFY = {
        "study-in--japan.com": "052EF10DBD33B0E77EB728844239AD59",
        // "study-in--london.com": "PUT_YOURS_HERE"
    };
    const bingMeta = BING_VERIFY[domain]
        ? `<meta name="msvalidate.01" content="${BING_VERIFY[domain]}" />`
        : "";
    // Build HTML lists (avoid nested template strings)
    const programItemsHtml = programs.map(p => {
        const prov = p.Program_provider;
        return '<li><a href="/' + prov.Provider_slug + '/' + p.Program_slug + '/">' +
            p.Program_name +
            '</a> by <a href="/' + prov.Provider_slug + '/">' + prov.Provider_name + '</a></li>';
    }).join('\n');
    const providerItemsHtml = providers.map(prov => {
        return '<li><a href="/' + prov.Provider_slug + '/">' + prov.Provider_name + '</a></li>';
    }).join('\n');
    // JSON-LD (WebSite + ItemLists)
    const programList = programs.map((p, i) => {
        const prov = p.Program_provider;
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
/* 6. Main */
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
        // Hydrate offers, including Currency
        program.Program_offer = await Promise.all((program.Program_offer ?? []).map(async (entry) => {
            const offer = typeof entry === "string" ? await fetchOffer(entry) : entry;
            if (!offer)
                return entry;
            // Normalize source field (Offer_priceCurrency vs Offer_PriceCurrency)
            const rawCur = currencyFromOffer(offer);
            if (rawCur && typeof rawCur === "string") {
                if (/^[A-Z]{3}$/.test(rawCur)) {
                    // It's already a currency code like "JPY"
                    setCurrencyOnOffer(offer, rawCur);
                }
                else if (isBubbleIdLike(rawCur)) {
                    // Looks like a Bubble ID → fetch Currency object
                    const currencyObj = await fetchCurrency(rawCur);
                    if (currencyObj) {
                        setCurrencyOnOffer(offer, currencyObj);
                        console.log(`💱 Hydrated currency for offer ${offer._id}: ${currencyObj.Code ?? currencyObj.Name ?? currencyObj.Country ?? currencyObj._id}`);
                    }
                    else {
                        console.warn(`⚠️ Currency not found for id: ${rawCur} (offer ${offer._id})`);
                        // Keep original string but rendering/JSON-LD will avoid leaking IDs.
                        setCurrencyOnOffer(offer, rawCur);
                    }
                }
                else {
                    // Some other string (e.g., "Yen") — keep as-is
                    setCurrencyOnOffer(offer, rawCur);
                }
            }
            else if (rawCur && typeof rawCur === "object") {
                // Already hydrated
                setCurrencyOnOffer(offer, rawCur);
            }
            return offer;
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
