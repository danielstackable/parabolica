"use strict";
/**********************************************************************
 *  bubble-to-astro-sync.ts  — PREBUILT HTML for SITE + PROVIDERS + PROGRAMS
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
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function safeJsonLd(obj) {
    return JSON.stringify(obj)
        .replace(/</g, "\\u003C").replace(/>/g, "\\u003E").replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
        .replace(/<\/script/gi, "<\\/script>");
}
/* Footer (shared) */
function renderFooter() {
    const year = new Date().getFullYear();
    return `
<footer>
  <p style="font-size: 0.9em; color: #777;">
    © ${year} InterFrontera Ltd. (UK). This site is not affiliated with JASSO, MEXT, or any official Japanese agency.
    All program data is sourced from public university websites and linked back to the original source where available.
    <br>
    Questions or corrections? Email us at <a href="mailto:admin@interfrontera.com">admin@interfrontera.com</a>
  </p>
</footer>`;
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
        return (await fetchJSON(`${API_BASE}/Stack_CanonicalDomain/${id}`)).response.Domain;
    }
    catch {
        return null;
    }
}
async function fetchLanguage(id) { try {
    return (await fetchJSON(`${API_BASE}/Stack_Language/${id}`)).response;
}
catch {
    return null;
} }
async function fetchInstance(id) { try {
    return (await fetchJSON(`${API_BASE}/Stack_ProgramInstance/${id}`)).response;
}
catch {
    return null;
} }
async function fetchOffer(id) { try {
    return (await fetchJSON(`${API_BASE}/Stack_Offer/${id}`)).response;
}
catch {
    return null;
} }
async function fetchCurrency(id) { try {
    return (await fetchJSON(`${API_BASE}/Currency/${id}`)).response;
}
catch {
    return null;
} }
async function fetchOccupation(id) { try {
    return (await fetchJSON(`${API_BASE}/Stack_Occupation/${id}`)).response;
}
catch {
    return null;
} }
async function fetchSubjectOf(id) { try {
    return (await fetchJSON(`${API_BASE}/Stack_subjectOf/${id}`)).response;
}
catch {
    return null;
} }
/* 4. Helpers */
function isBubbleIdLike(s) { return /\d{10,}x[0-9a-z]+/i.test(s); }
function getCurrencyCode(cur) {
    if (!cur)
        return undefined;
    if (typeof cur === "string") {
        if (/^[A-Z]{3}$/.test(cur))
            return cur;
        if (isBubbleIdLike(cur))
            return undefined;
        return cur;
    }
    return cur.Code || cur.Name || cur.Country || undefined;
}
function currencyFromOffer(offer) { return offer.Offer_priceCurrency ?? offer.Offer_PriceCurrency; }
function setCurrencyOnOffer(offer, v) { offer.Offer_priceCurrency = v; offer.Offer_PriceCurrency = v; }
/* 5. Renderers — STATIC HTML */
function renderProgramPage(program) {
    const provider = program.Program_provider;
    const languages = (program.Program_inLanguage ?? []).map(l => (typeof l === "string" ? l : l.Language_name ?? `[${l._id}]`)).filter(Boolean).join(", ");
    const occupations = (program.Program_occupationalCategory ?? []).map(o => (typeof o === "string" ? o : o.Occupation_name ?? `[${o._id}]`)).filter(Boolean).join(", ");
    const subjectofs = (program.Program_subjectOf ?? []).map(o => (typeof o === "string" ? `[${o}]` : o.Provider_subjectOfURL ?? `[${o._id}]`)).join(", ");
    const canonicalDomains = (provider.Provider_CanonicalDomainEN ?? []).map(d => (typeof d === "string" ? d : d.Domain ?? `[${d._id}]`)).join(", ");
    const prerequisites = (program.Program_educationalProgramPrerequisites ?? []).map(p => `<li>${escapeHtml(p)}</li>`).join("\n");
    const disciplines = (program.Program_discipline ?? []).map(d => `<li>${escapeHtml(d)}</li>`).join("\n");
    const sameAses = (program.Program_mainEntityOfPage_sameAs ?? []).map(d => `<li>${escapeHtml(d)}</li>`).join("\n");
    const instanceLis = (program.Program_CourseInstance ?? []).map(ci => (typeof ci === "string" ? `<li>[${escapeHtml(ci)}]</li>` : `<li>${escapeHtml(ci.Program_courseInstance_courseMode || `[${ci._id}]`)}</li>`)).join("\n");
    const domain = (provider?.Provider_CanonicalDomainEN ?? []).map(d => (typeof d === "string" ? d : d.Domain)).find(Boolean);
    const canonicalUrl = domain ? `https://${domain}/${provider?.Provider_slug}/${program.Program_slug}/` : `/${provider?.Provider_slug}/${program.Program_slug}/`;
    const offersLis = (program.Program_offer ?? []).map((o) => {
        if (typeof o === "string")
            return `<li>[Offer ${escapeHtml(o)}]</li>`;
        const name = o.Offer_name?.trim();
        const desc = o.Offer_description?.trim();
        const price = o.Offer_price != null && o.Offer_price !== "" ? String(o.Offer_price) : "";
        const currencyCode = getCurrencyCode(currencyFromOffer(o));
        const priceBlock = price && currencyCode ? `${price} ${currencyCode}` : (price || currencyCode || "");
        const valid = o.Offer_validThrough ? ` (valid through ${escapeHtml(o.Offer_validThrough)})` : "";
        const parts = [name, desc, priceBlock].filter(Boolean).map(escapeHtml);
        return `<li>${parts.join(" — ")}${valid}</li>`;
    }).join("\n");
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
        "offers": (program.Program_offer ?? []).map(o => typeof o === "string" ? { "@type": "Offer", "@id": o } : ({
            "@type": "Offer",
            "name": o.Offer_name || undefined,
            "description": o.Offer_description || undefined,
            "price": o.Offer_price ?? undefined,
            "priceCurrency": getCurrencyCode(currencyFromOffer(o)),
            "validThrough": o.Offer_validThrough || undefined
        }))
    };
    const jsonLd = safeJsonLd(JSON.parse(JSON.stringify(schema)));
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(program.Program_name)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="${canonicalUrl}" />
    <script type="application/ld+json">${jsonLd}</script>
  </head>
  <body>
    <h1>${escapeHtml(program.Program_name)}</h1>
    <p>${escapeHtml(program.Program_description)}</p>

    <p><strong>Disciplines:</strong></p>
    <ul>${disciplines || "<li>None listed</li>"}</ul>

    <p><strong>Slug:</strong> ${escapeHtml(program.Program_slug)}</p>
    <p><strong>Credential:</strong> ${escapeHtml(program.Program_educationalCredentialAwarded)}</p>
    <p><strong>Level:</strong> ${escapeHtml(program.Program_educationalLevel)}</p>
    <p><strong>Mode:</strong> ${escapeHtml(program.Program_educationalProgramMode)}</p>
    <p><strong>Program Type:</strong> ${escapeHtml(program.Program_programType)}</p>
    <p><strong>Time to Complete:</strong> ${escapeHtml(program.Program_timeToComplete)}</p>

    <p><strong>Educational Prerequisites:</strong></p>
    <ul>${prerequisites || "<li>None listed</li>"}</ul>

    <p><strong>Languages:</strong> ${escapeHtml(languages)}</p>
    <p><strong>Occupational Categories:</strong> ${escapeHtml(occupations)}</p>
    <p><strong>Program URL:</strong> <a href="${escapeHtml(program.Program_url)}">${escapeHtml(program.Program_url)}</a></p>

    <p><strong>sameAs(URL):</strong></p>
    <ul>${sameAses || "<li>None listed</li>"}</ul>

    <p><strong>subjectOf:</strong> ${escapeHtml(subjectofs)}</p>

    <p><strong>Instances:</strong></p>
    <ul>${instanceLis || "<li>None listed</li>"}</ul>

    <p><strong>Offers:</strong></p>
    <ul>${offersLis || "<li>None listed</li>"}</ul>

    <hr />
    <h2>Provider: <a href="/${escapeHtml(provider.Provider_slug)}/">${escapeHtml(provider.Provider_name)}</a></h2>
    <p>${escapeHtml(provider.Provider_description ?? "")}</p>
    <p><strong>Slug:</strong> ${escapeHtml(provider.Provider_slug)}</p>
    <p><strong>Canonical Domains:</strong> ${escapeHtml(canonicalDomains)}</p>

    ${renderFooter()}
  </body>
</html>`;
}
function renderProviderPage(provider, programsForProvider, domain) {
    const canonicalUrl = `https://${domain}/${provider.Provider_slug}/`;
    const programLis = programsForProvider.map(p => `<li><a href="/${provider.Provider_slug}/${p.Program_slug}/">${escapeHtml(p.Program_name)}</a></li>`).join("\n") || "<li>No programs listed</li>";
    const sameAs = (provider.Provider_sameAs ?? []).map(u => `<li>${escapeHtml(u)}</li>`).join("\n") || "";
    const schema = {
        "@context": "https://schema.org",
        "@type": "CollegeOrUniversity",
        "@id": canonicalUrl,
        "name": provider.Provider_name,
        "url": provider.Provider_url || canonicalUrl,
        "description": provider.Provider_description || undefined,
        "address": {
            "@type": "PostalAddress",
            "addressLocality": provider.Provider_addressLocality || undefined,
            "postalCode": provider.Provider_postalCode || undefined,
            "streetAddress": provider.Provider_streetAddress || undefined
        },
        "sameAs": provider.Provider_sameAs && provider.Provider_sameAs.length ? provider.Provider_sameAs : undefined
    };
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": `${provider.Provider_name} Programs`,
        "itemListElement": programsForProvider.map((p, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "url": `${canonicalUrl}${p.Program_slug}/`,
            "name": p.Program_name,
            "item": {
                "@type": "EducationalOccupationalProgram",
                "name": p.Program_name,
                "url": `${canonicalUrl}${p.Program_slug}/`
            }
        }))
    };
    const jsonLd = safeJsonLd([schema, itemListSchema]);
    const canonicalDomains = (provider.Provider_CanonicalDomainEN ?? [])
        .map(d => (typeof d === "string" ? d : d.Domain ?? `[${d._id}]`))
        .join(", ");
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(provider.Provider_name)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="${canonicalUrl}" />
    <script type="application/ld+json">${jsonLd}</script>
  </head>
  <body>
    <h1>${escapeHtml(provider.Provider_name)}</h1>
    ${provider.Provider_description ? `<p>${escapeHtml(provider.Provider_description)}</p>` : ""}
    ${provider.Provider_MarketingCopy ? `<p>${escapeHtml(provider.Provider_MarketingCopy)}</p>` : ""}

    <p><strong>Canonical Domains:</strong> ${escapeHtml(canonicalDomains)}</p>

    ${sameAs ? `<p><strong>sameAs:</strong></p><ul>${sameAs}</ul>` : ""}

    <h2>Programs</h2>
    <ul>
${programLis}
    </ul>

    ${renderFooter()}
  </body>
</html>`;
}
function renderIndexPage(programs, providers, domain) {
    const siteUrl = `https://${domain}/`;
    const BING_VERIFY = { "study-in--japan.com": "052EF10DBD33B0E77EB728844239AD59" };
    const bingMeta = BING_VERIFY[domain] ? `<meta name="msvalidate.01" content="${BING_VERIFY[domain]}" />` : "";
    const programItemsHtml = programs.map(p => {
        const prov = p.Program_provider;
        return `<li><a href="/${prov.Provider_slug}/${p.Program_slug}/">${escapeHtml(p.Program_name)}</a> by <a href="/${prov.Provider_slug}/">${escapeHtml(prov.Provider_name)}</a></li>`;
    }).join('\n');
    const providerItemsHtml = providers.map(prov => `<li><a href="/${prov.Provider_slug}/">${escapeHtml(prov.Provider_name)}</a></li>`).join('\n');
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
                provider: { "@type": "CollegeOrUniversity", name: prov.Provider_name, url: `${siteUrl}${prov.Provider_slug}/` }
            }
        };
    });
    const providerList = providers.map((prov, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteUrl}${prov.Provider_slug}/`,
        name: prov.Provider_name,
        item: { "@type": "CollegeOrUniversity", name: prov.Provider_name, url: `${siteUrl}${prov.Provider_slug}/` }
    }));
    const schema = [
        { "@context": "https://schema.org", "@type": "WebSite", url: siteUrl, name: domain,
            potentialAction: { "@type": "SearchAction", target: `${siteUrl}?q={search_term_string}`, "query-input": "required name=search_term_string" } },
        { "@context": "https://schema.org", "@type": "ItemList", name: "Programs", itemListElement: programList },
        { "@context": "https://schema.org", "@type": "ItemList", name: "Providers", itemListElement: providerList }
    ];
    const safe = safeJsonLd(schema);
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    ${bingMeta}
    <title>${escapeHtml(domain)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="${siteUrl}" />
    <script type="application/ld+json">${safe}</script>
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

    ${renderFooter()}
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
        // Hydrate program fields
        program.Program_inLanguage = await Promise.all((program.Program_inLanguage ?? []).map(async (e) => typeof e === "string" ? (await fetchLanguage(e)) ?? e : e));
        program.Program_occupationalCategory = await Promise.all((program.Program_occupationalCategory ?? []).map(async (e) => typeof e === "string" ? (await fetchOccupation(e)) ?? e : e));
        program.Program_subjectOf = await Promise.all((program.Program_subjectOf ?? []).map(async (e) => typeof e === "string" ? (await fetchSubjectOf(e)) ?? e : e));
        program.Program_CourseInstance = await Promise.all((program.Program_CourseInstance ?? []).map(async (e) => typeof e === "string" ? (await fetchInstance(e)) ?? e : e));
        // Hydrate provider canonical domains (for this provider)
        provider.Provider_CanonicalDomainEN = await Promise.all((provider.Provider_CanonicalDomainEN ?? []).map(async (e) => {
            if (typeof e === "string") {
                const full = await fetchCanonicalDomain(e);
                return full ? { _id: e, Domain: full } : e;
            }
            return e;
        }));
        // Hydrate offers + currency
        program.Program_offer = await Promise.all((program.Program_offer ?? []).map(async (entry) => {
            const offer = typeof entry === "string" ? await fetchOffer(entry) : entry;
            if (!offer)
                return entry;
            const rawCur = currencyFromOffer(offer);
            if (rawCur && typeof rawCur === "string") {
                if (/^[A-Z]{3}$/.test(rawCur)) {
                    setCurrencyOnOffer(offer, rawCur);
                }
                else if (isBubbleIdLike(rawCur)) {
                    const currencyObj = await fetchCurrency(rawCur);
                    setCurrencyOnOffer(offer, currencyObj ?? rawCur);
                    if (currencyObj)
                        console.log(`💱 Hydrated currency for offer ${offer._id}: ${currencyObj.Code ?? currencyObj.Name ?? currencyObj.Country ?? currencyObj._id}`);
                    else
                        console.warn(`⚠️ Currency not found for id: ${rawCur} (offer ${offer._id})`);
                }
                else {
                    setCurrencyOnOffer(offer, rawCur);
                }
            }
            else if (rawCur && typeof rawCur === "object") {
                setCurrencyOnOffer(offer, rawCur);
            }
            return offer;
        }));
        const canonicalDomains = (provider.Provider_CanonicalDomainEN ?? [])
            .map((e) => typeof e === "string" ? `[${e}]` : e.Domain ?? `[${e._id}]`);
        const matched = canonicalDomains.filter((d) => allowedDomains.includes(d));
        for (const domain of matched) {
            if (!byDomain[domain])
                byDomain[domain] = [];
            byDomain[domain].push(program);
        }
    }
    // Providers grouped per domain (for provider pages)
    for (const provider of allProviders) {
        provider.Provider_CanonicalDomainEN = await Promise.all((provider.Provider_CanonicalDomainEN ?? []).map(async (e) => {
            if (typeof e === "string") {
                const full = await fetchCanonicalDomain(e);
                return full ? { _id: e, Domain: full } : e;
            }
            return e;
        }));
        const canonicalDomains = (provider.Provider_CanonicalDomainEN ?? [])
            .map((e) => typeof e === "string" ? `[${e}]` : e.Domain ?? `[${e._id}]`);
        const matched = canonicalDomains.filter((d) => allowedDomains.includes(d));
        for (const domain of matched) {
            if (!providersByDomain[domain])
                providersByDomain[domain] = [];
            providersByDomain[domain].push(provider);
        }
    }
    // ✍️ Write HTML (site index + provider pages + program pages)
    for (const domain of allowedDomains) {
        const programsForDomain = byDomain[domain] ?? [];
        const providersForDomain = providersByDomain[domain] ?? [];
        const projectPath = domain.includes("japan") ? "study-in--japan" :
            domain.includes("london") ? "study-in--london" : null;
        if (!projectPath)
            continue;
        // Site index
        writeFile(node_path_1.default.join("projects", projectPath, "public", "index.html"), renderIndexPage(programsForDomain, providersForDomain, domain));
        // Group programs by provider
        const byProviderSlug = new Map();
        for (const p of programsForDomain) {
            const prov = p.Program_provider;
            const arr = byProviderSlug.get(prov.Provider_slug) ?? [];
            arr.push(p);
            byProviderSlug.set(prov.Provider_slug, arr);
        }
        // Provider pages + program pages
        for (const provider of providersForDomain) {
            const provPrograms = byProviderSlug.get(provider.Provider_slug) ?? [];
            // Provider index
            writeFile(node_path_1.default.join("projects", projectPath, "public", provider.Provider_slug, "index.html"), renderProviderPage(provider, provPrograms, domain));
            // Programs for this provider
            for (const program of provPrograms) {
                writeFile(node_path_1.default.join("projects", projectPath, "public", provider.Provider_slug, program.Program_slug, "index.html"), renderProgramPage(program));
            }
        }
    }
    console.log("✅ Prebuilt HTML sync complete (site index + providers + programs)");
})();
