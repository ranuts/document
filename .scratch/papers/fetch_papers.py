#!/usr/bin/env python3
"""
Resolve the DOI of every paper in jobs.json and download an openly available PDF.

Strategy per paper
  1. Resolve/verify DOI + metadata (OpenAlex -> Crossref -> Europe PMC -> Semantic Scholar).
  2. Collect candidate PDF URLs (Unpaywall, OpenAlex, Europe PMC, Semantic Scholar,
     publisher-specific URL patterns, citation_pdf_url meta tag on the landing page).
  3. Download candidates until one validates as a real PDF.
  4. Fallback A: Europe PMC JATS full text -> HTML -> PDF (headless Chrome).
  5. Fallback B: open-access landing page -> PDF (headless Chrome).
  6. Fallback C: abstract/metadata record page -> PDF, clearly marked as abstract only.

Never bypasses paywalls: only URLs that the publisher/repository itself exposes
to the public are used.
"""
import difflib
import html as htmlmod
import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUTDIR = os.path.join(REPO, "papers")
MIN_PDF_BYTES = 12 * 1024
MAILTO = "paper-fetch@example.org"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")
LOG = []


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    LOG.append(line)


# ---------------------------------------------------------------- HTTP helpers
def http(url, timeout=60, headers=None, method="GET", retries=2):
    """Return (status, bytes, final_url, error)."""
    hdrs = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    hdrs.update(headers or {})
    err = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=hdrs, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return getattr(r, "status", 200), r.read(), r.geturl(), None
        except urllib.error.HTTPError as e:
            return e.code, b"", url, f"HTTP {e.code}"
        except Exception as e:  # noqa: BLE001
            err = f"{type(e).__name__}: {e}"
            if attempt < retries:
                time.sleep(2 + attempt * 3)
    return None, b"", url, err


def get_json(url, timeout=45):
    st, data, final, err = http(url, timeout=timeout, headers={"Accept": "application/json"})
    if not data:
        return None, err or f"status={st}"
    try:
        return json.loads(data.decode("utf-8", "replace")), None
    except Exception as e:  # noqa: BLE001
        return None, f"json error: {e}"


# --------------------------------------------------------------- text handling
def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", s.lower()).strip()


def ratio(a, b):
    return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()


def descore(t):
    """Strip markup descenders from a dotted field name for printing."""
    return t


def strip_tags(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return htmlmod.unescape(re.sub(r"\s+", " ", s)).strip()


def safe_filename(title, maxlen=150):
    t = title.replace("/", "-").replace("\\", "-")
    t = re.sub(r'[<>:"|?*\x00-\x1f]', "", t)
    t = re.sub(r"\s+", " ", t).strip().rstrip(".")
    if len(t) > maxlen:
        t = t[:maxlen].rsplit(" ", 1)[0]
    return t


# ------------------------------------------------------------- DOI resolution
def clean_title(t):
    t = re.sub(r"\s*[-–—]\s*(A systematic review|A review|A bibliometric.*)$", "", t, flags=re.I)
    return t.strip()


def openalex_by_doi(doi):
    d, err = get_json(f"https://api.openalex.org/works/doi:{urllib.parse.quote(doi)}?mailto={MAILTO}")
    return d, err


def openalex_search(title):
    q = urllib.parse.quote(clean_title(title))
    d, err = get_json(f"https://api.openalex.org/works?search={q}&per-page=5&mailto={MAILTO}")
    if not d:
        return None, err
    best, best_r = None, 0.0
    for w in d.get("results", []):
        r = ratio(w.get("display_name") or "", title)
        if r > best_r:
            best, best_r = w, r
    return (best, best_r) if best else (None, 0.0)


def epmc_search(query, result_type="core", page_size=5):
    url = ("https://www.ebi.ac.uk/europepmc/webservices/rest/search?"
           + urllib.parse.urlencode({"query": query, "format": "json",
                                     "resultType": result_type, "pageSize": page_size}))
    d, err = get_json(url)
    if not d:
        return [], err
    return d.get("resultList", {}).get("result", []), None


def epmc_by_doi(doi):
    res, err = epmc_search(f'DOI:"{doi}"')
    return (res[0] if res else None), err


def epmc_by_title(title):
    res, err = epmc_search(f'TITLE:"{clean_title(title)}"')
    if not res:
        res, err = epmc_search(clean_title(title))
    best, best_r = None, 0.0
    for r in res:
        r_ = ratio(r.get("title", ""), title)
        if r_ > best_r:
            best, best_r = r, r_
    return (best, best_r) if best else (None, 0.0)


def crossref_by_doi(doi):
    d, err = get_json(f"https://api.crossref.org/works/{urllib.parse.quote(doi)}?mailto={MAILTO}")
    return (d.get("message") if d else None), err


def crossref_search(title):
    url = ("https://api.crossref.org/works?"
           + urllib.parse.urlencode({"query.bibliographic": clean_title(title),
                                     "rows": "5", "mailto": MAILTO}))
    d, err = get_json(url)
    if not d:
        return None, 0.0, err
    best, best_r = None, 0.0
    for w in d.get("message", {}).get("items", []):
        t = (w.get("title") or [""])[0]
        r = ratio(t, title)
        if r > best_r:
            best, best_r = w, r
    return best, best_r, None


def s2_search(title):
    url = ("https://api.semanticscholar.org/graph/v1/paper/search?"
           + urllib.parse.urlencode({"query": clean_title(title), "limit": "5",
                                     "fields": "title,externalIds,openAccessPdf,year,venue,abstract"}))
    d, err = get_json(url)
    if not d:
        return None, 0.0, err
    best, best_r = None, 0.0
    for w in d.get("data", []):
        r = ratio(w.get("title") or "", title)
        if r > best_r:
            best, best_r = w, r
    return best, best_r, None


def s2_by_doi(doi):
    url = ("https://api.semanticscholar.org/graph/v1/paper/DOI:"
           + urllib.parse.quote(doi)
           + "?fields=title,externalIds,openAccessPdf,year,venue,abstract")
    d, err = get_json(url)
    return d, err


# ---------------------------------------------------------------- PDF helpers
def looks_like_pdf(data):
    if not data or len(data) < MIN_PDF_BYTES:
        return False
    head = data[:1024].lstrip()
    if not head.startswith(b"%PDF"):
        return False
    if b"/Encrypt" in data[:4096] and b"/Type /Page" not in data:
        return False
    return True


def pdf_pages(data):
    return len(re.findall(rb"/Type\s*/Page[^s]", data))


def chrome_bin():
    for c in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        p = shutil.which(c)
        if p:
            return p
    return None


def url_to_pdf(url, out_path):
    chrome = chrome_bin()
    if not chrome:
        return False, "chrome not found"
    cmd = [chrome, "--headless=new", "--no-sandbox", "--disable-gpu",
           "--no-pdf-header-footer", "--virtual-time-budget=15000",
           f"--print-to-pdf={out_path}", url]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=240)
    except Exception as e:  # noqa: BLE001
        return False, str(e)
    ok = os.path.exists(out_path) and os.path.getsize(out_path) > MIN_PDF_BYTES
    return ok, "" if ok else (r.stderr or b"")[-300:].decode("utf-8", "replace")


def html_to_pdf(html_text, out_path, base_url=None):
    chrome = chrome_bin()
    if not chrome:
        return False, "chrome not found"
    tmp_html = out_path + ".html"
    with open(tmp_html, "w", encoding="utf-8") as fh:
        fh.write(html_text)
    cmd = [chrome, "--headless=new", "--no-sandbox", "--disable-gpu",
           "--no-pdf-header-footer", "--virtual-time-budget=8000",
           f"--print-to-pdf={out_path}", "file://" + os.path.abspath(tmp_html)]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=180)
    except Exception as e:  # noqa: BLE001
        return False, str(e)
    ok = os.path.exists(out_path) and os.path.getsize(out_path) > MIN_PDF_BYTES
    if not ok:
        return False, (r.stderr or b"")[-400:].decode("utf-8", "replace")
    return True, ""


def compress_pdf(path, limit_mb=4.0):
    if os.path.getsize(path) <= limit_mb * 1024 * 1024:
        return
    if not shutil.which("gs"):
        return
    tmp = path + ".gs.pdf"
    cmd = ["gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5",
           "-dPDFSETTINGS=/ebook", "-dNOPAUSE", "-dQUIET", "-dBATCH",
           "-dDetectDuplicateImages=true", f"-sOutputFile={tmp}", path]
    try:
        subprocess.run(cmd, capture_output=True, timeout=300)
        if os.path.exists(tmp) and os.path.getsize(tmp) > MIN_PDF_BYTES \
                and os.path.getsize(tmp) < os.path.getsize(path):
            os.replace(tmp, path)
        elif os.path.exists(tmp):
            os.remove(tmp)
    except Exception:  # noqa: BLE001
        pass


# ------------------------------------------------------- JATS XML -> HTML -> PDF
def jats_to_html(xml_bytes, fallback_title):
    try:
        root = ET.fromstring(xml_bytes)
    except Exception as e:  # noqa: BLE001
        return None, f"xml parse: {e}"
    for el in root.iter():
        if isinstance(el.tag, str) and "}" in el.tag:
            el.tag = el.tag.split("}", 1)[1]

    def inline(el):
        parts = [el.text or ""]
        for ch in el:
            tag = ch.tag
            inner = inline(ch)
            if tag in ("italic", "i"):
                parts.append(f"<i>{inner}</i>")
            elif tag in ("bold", "b"):
                parts.append(f"<b>{inner}</b>")
            elif tag == "sup":
                parts.append(f"<sup>{inner}</sup>")
            elif tag == "sub":
                parts.append(f"<sub>{inner}</sub>")
            elif tag in ("xref", "ext-link"):
                parts.append(f"<sup>[{inner}]</sup>")
            else:
                parts.append(inner)
            parts.append(ch.tail or "")
        return "".join(parts)

    def render(el, depth=0):
        out = []
        for ch in el:
            tag = ch.tag
            if tag in ("title",):
                lvl = min(2 + depth, 4)
                out.append(f"<h{lvl}>{inline(ch)}</h{lvl}>")
            elif tag == "p":
                out.append(f"<p>{inline(ch)}</p>")
            elif tag in ("sec", "sect"):
                out.append(render(ch, depth + 1))
            elif tag == "abstract":
                out.append("<h2>Abstract</h2>")
                out.append(render(ch, depth))
            elif tag in ("fig", "table-wrap", "graphic", "supplementary-material"):
                cap = ch.find("caption")
                if cap is not None:
                    out.append(f"<p><i>{inline(cap)}</i></p>")
            elif tag in ("list",):
                out.append("<ul>" + "".join(f"<li>{inline(li)}</li>" for li in ch) + "</ul>")
            elif tag in ("body", "back", "front", "article", "article-meta"):
                out.append(render(ch, depth))
        return "\n".join(x for x in out if x)

    body = root.find(".//body")
    title_el = root.find(".//article-title")
    title = "".join(title_el.itertext()).strip() if title_el is not None else fallback_title
    meta = root.find(".//journal-title")
    journal = "".join(meta.itertext()).strip() if meta is not None else ""
    inner = render(body if body is not None else root)
    if len(strip_tags(inner)) < 3000:
        return None, "jats body too small"
    doc = wrap_html(title, journal, inner)
    return doc, ""


def wrap_html(title, subtitle, body_html, notice=""):
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>{htmlmod.escape(title)}</title>
<style>
@page {{ margin: 18mm 16mm; }}
body {{ font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.45; color:#111; }}
h1 {{ font-size: 17pt; line-height:1.25; margin:0 0 4pt 0; }}
h2 {{ font-size: 13pt; margin:16pt 0 4pt 0; }}
h3 {{ font-size: 11.5pt; margin:12pt 0 3pt 0; }}
h4 {{ font-size: 10.5pt; margin:10pt 0 3pt 0; font-style:italic; }}
.sub {{ color:#444; font-size:10pt; margin-bottom:12pt; }}
.notice {{ background:#fff6d5; border:1px solid #e0c766; padding:7pt 9pt; font-size:9.5pt; margin:10pt 0; }}
sup {{ font-size:8pt; }} ul {{ margin:4pt 0 8pt 16pt; }} li {{ margin-bottom:3pt; }}
p {{ margin: 0 0 6pt 0; text-align: justify; }}
</style></head><body>
<h1>{htmlmod.escape(title)}</h1>
<div class="sub">{htmlmod.escape(subtitle or '')}</div>
{notice}
{body_html}
</body></html>"""


# ------------------------------------------------------------- candidate URLs
def publisher_candidates(doi, landing):
    out = []
    low = (doi or "").lower()

    def add(url, source, **kw):
        if url and url not in [c["url"] for c in out]:
            out.append({"url": url, "source": source, **kw})

    if low.startswith("10.3390") and landing:
        add(landing.rstrip("/") + "/pdf", "mdpi-pattern")
    if low.startswith("10.3389") and landing:
        base = re.sub(r"/(full|pdf|abstract)$", "", landing.rstrip("/"))
        add(base + "/pdf", "frontiers-pattern")
    if low.startswith("10.1038"):
        suffix = low.split("10.1038/", 1)[1]
        add(f"https://www.nature.com/articles/{suffix}.pdf", "nature-pattern")
    if low.startswith("10.1002"):
        add(f"https://onlinelibrary.wiley.com/doi/pdfdirect/{doi}?download=true", "wiley-pattern")
    if low.startswith(("10.1007", "10.1186")):
        add(f"https://link.springer.com/content/pdf/{doi}.pdf", "springer-pattern")
    if low.startswith("10.1186") and landing:
        host = urllib.parse.urlparse(landing).netloc
        if host.endswith("biomedcentral.com"):
            add(f"https://{host}/counter/pdf/{doi}.pdf", "bmc-pattern")
    if low.startswith("10.1080"):
        add(f"https://www.tandfonline.com/doi/pdf/{doi}?needAccess=true", "tandf-pattern")
    if low.startswith("10.1016"):
        add(f"https://www.sciencedirect.com/science/article/pii/", "skip-sciencedirect")  # placeholder, removed below
        out[:] = [c for c in out if c["source"] != "skip-sciencedirect"]
    return out


def candidates_from_landing_html(landing_url):
    out = []
    st, data, final, err = http(landing_url, timeout=45)
    if not data:
        return out, err or f"status={st}"
    txt = data.decode("utf-8", "replace")
    meta = re.search(r'<meta[^>]+name=["\']citation_pdf_url["\'][^>]+content=["\']([^"\']+)', txt, re.I)
    if meta:
        out.append((htmlmod.unescape(meta.group(1)), "citation_pdf_url"))
    for m in re.finditer(r'href=["\']([^"\']+\.pdf(?:\?[^"\']*)?)["\']', txt, re.I):
        u = htmlmod.unescape(m.group(1))
        if u.startswith("//"):
            u = "https:" + u
        elif u.startswith("/"):
            p = urllib.parse.urlparse(landing_url)
            u = f"{p.scheme}://{p.netloc}{u}"
        if u.startswith("http"):
            out.append((u, "landing-regex"))
    return out[:6], None


def landing_html_is_fulltext(txt):
    low = txt.lower()
    markers = ["<section", "abstract", "references", "introduction"]
    text_len = len(strip_tags(txt))
    return text_len > 12000 and sum(m in low for m in markers) >= 3


# ------------------------------------------------------------------ main flow
def process(job):
    n = job["n"]
    title = job["title"]
    rec = {"n": n, "title_given": title, "journal": job.get("journal"),
           "year": job.get("year"), "ref": job.get("ref"), "doi": job.get("doi"),
           "status": "unresolved", "file": None, "source_url": None,
           "license": None, "match_score": None, "notes": []}

    # ---- 1. DOI + metadata
    oa = cr = ep = s2 = None
    doi = job.get("doi")
    if doi:
        oa, err = openalex_by_doi(doi)
        if not oa:
            rec["notes"].append(f"openalex doi lookup failed: {err}")
        cr, err = crossref_by_doi(doi)
        if not cr:
            rec["notes"].append(f"crossref doi lookup failed: {err}")
        ep, _ = epmc_by_doi(doi)
    else:
        oa, score = openalex_search(title)
        if oa and score >= 0.80:
            doi = (oa.get("doi") or "").replace("https://doi.org/", "")
            rec["match_score"] = round(score, 3)
            rec["notes"].append("doi resolved via OpenAlex title search")
        else:
            ep, score = epmc_by_title(title)
            if ep and score >= 0.80:
                doi = ep.get("doi")
                rec["match_score"] = round(score, 3)
                rec["notes"].append("doi resolved via Europe PMC title search")
            else:
                cr_w, cr_score, _ = crossref_search(title)
                if cr_w and cr_score >= 0.80:
                    doi = cr_w.get("DOI")
                    cr = cr_w
                    rec["match_score"] = round(cr_score, 3)
                    rec["notes"].append("doi resolved via Crossref title search")
                else:
                    s2w, s2_score, _ = s2_search(title)
                    if s2w and s2_score >= 0.85:
                        ids = s2w.get("externalIds") or {}
                        doi = ids.get("DOI")
                        s2 = s2w
                        rec["match_score"] = round(s2_score, 3)
                        rec["notes"].append("doi resolved via Semantic Scholar title search")
                    else:
                        rec["notes"].append(f"DOI unresolved (oa={score if oa else 0:.2f})")
                        rec["doi"] = None
                        return finish(rec, job)
    rec["doi"] = doi

    # verify resolved title against the given title
    resolved_title = None
    for src in (oa, cr, ep, s2):
        if not src:
            continue
        t = src.get("display_name") or src.get("title") or ""
        if isinstance(t, list):
            t = t[0] if t else ""
        if t:
            resolved_title = t
            break
    if resolved_title and job.get("doi"):
        r = ratio(resolved_title, title)
        rec["match_score"] = round(r, 3)
        if r < 0.72:
            rec["notes"].append(f"title mismatch vs resolved record: '{resolved_title[:90]}'")

    # landing pages
    landings = []
    if oa:
        for loc in ([oa.get("best_oa_location")] if oa.get("best_oa_location") else []) + (oa.get("locations") or []):
            if not loc:
                continue
            for key in ("landing_page_url", "pdf_url"):
                u = loc.get(key)
                if u and u not in landings:
                    landings.append(u)
    if cr:
        u = cr.get("URL")
        if u and u not in landings:
            landings.append(u)
    if ep:
        u = ep.get("fullTextUrlList")
    if not landings:
        landings.append(f"https://doi.org/{doi}")

    # ---- 2. candidate PDF urls
    cands = []

    def add(url, source, **kw):
        if not url:
            return
        if any(c["url"] == url for c in cands):
            return
        cands.append({"url": url, "source": source, **kw})

    # publisher patterns first (fastest + most reliable)
    for land in landings[:4]:
        for c in publisher_candidates(doi, land):
            add(c["url"], c["source"])

    # unpaywall
    up, err = get_json(f"https://api.unpaywall.org/v2/{urllib.parse.quote(doi)}?email={MAILTO}")
    if up:
        rec["is_oa"] = up.get("is_oa")
        best = up.get("best_oa_location") or {}
        add(best.get("url_for_pdf"), "unpaywall-best",
            license=best.get("license"), version=best.get("version"),
            host=best.get("host_type"))
        for loc in up.get("oa_locations") or []:
            add(loc.get("url_for_pdf"), "unpaywall",
                license=loc.get("license"), version=loc.get("version"),
                host=loc.get("host_type"))
            add(loc.get("url"), "unpaywall-url")
    else:
        rec["notes"].append(f"unpaywall failed: {err}")

    # openalex pdf urls
    if oa:
        for loc in ([oa.get("best_oa_location")] if oa.get("best_oa_location") else []) + (oa.get("locations") or []):
            if loc:
                add(loc.get("pdf_url"), "openalex", license=loc.get("license"), version=loc.get("version"))

    # europe pmc
    if ep:
        rec["pmcid"] = ep.get("pmcid")
        rec["pmid"] = ep.get("pmid")
        ftl = (ep.get("fullTextUrlList") or {}).get("fullTextUrl") or []
        for u in ftl:
            add(u.get("url"), f"epmc-{u.get('site')}", license=u.get("documentStyle"))
        if ep.get("pmcid"):
            pmcid = ep["pmcid"]
            add(f"https://europepmc.org/articles/{pmcid}?pdf=render", "epmc-render")
            add(f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextPDF", "epmc-api-pdf")
            add(f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/pdf/", "pmc-pdf")

    # semantic scholar
    if not s2 and doi:
        s2, err = s2_by_doi(doi)
        if not s2:
            rec["notes"].append(f"semanticscholar failed: {err}")
    if s2:
        add((s2.get("openAccessPdf") or {}).get("url"), "semanticscholar")
        rec["s2_abstract"] = s2.get("abstract")

    # landing page scrape (citation_pdf_url)
    for land in landings[:3]:
        found, err = candidates_from_landing_html(land)
        for u, src in found:
            add(u, src)
        if found:
            break

    # ---- 3. try downloads
    for c in cands:
        u = c["url"]
        if not u or not u.startswith("http"):
            continue
        st, data, final, err = http(u, timeout=90)
        if looks_like_pdf(data):
            rec.update({"status": "downloaded", "source_url": u, "source": c["source"],
                        "license": c.get("license"), "bytes": len(data),
                        "pdf_pages": pdf_pages(data)})
            rec["_pdf"] = data
            return finish(rec, job)
        rec["notes"].append(f"candidate failed ({c['source']}): {err or 'not a pdf ' + str(st)}")
        # if the candidate URL pointed at an HTML page, remember it for html fallback
        if data and final and "text/html" in (c.get("source") or ""):
            pass

    # ---- 4. fallback: Europe PMC JATS full text
    if ep and ep.get("pmcid"):
        pmcid = ep["pmcid"]
        st, data, final, err = http(f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML")
        if data and data.lstrip().startswith(b"<"):
            doc, jerr = jats_to_html(data, title)
            if doc:
                ok, herr = html_to_pdf(doc, "/tmp/_jats.pdf")
                if ok:
                    with open("/tmp/_jats.pdf", "rb") as fh:
                        rec["_pdf"] = fh.read()
                    rec.update({"status": "html-fulltext", "source_url":
                                f"https://europepmc.org/article/MED/{ep.get('pmid') or pmcid}",
                                "source": "europepmc-jats", "bytes": len(rec["_pdf"]),
                                "pdf_pages": pdf_pages(rec["_pdf"])})
                    return finish(rec, job)
            rec["notes"].append(f"jats conversion failed: {jerr}")

    # ---- 5. fallback: open access landing page -> pdf
    if rec.get("is_oa") or (up and up.get("is_oa")):
        for land in landings[:3]:
            st, data, final, err = http(land, timeout=60)
            if data:
                txt = data.decode("utf-8", "replace")
                if landing_html_is_fulltext(txt):
                    ok, herr = url_to_pdf(land, "/tmp/_land.pdf")
                    if not ok:
                        m = re.search(r"<title[^>]*>(.*?)</title>", txt, re.S | re.I)
                        doc = wrap_html(title, m.group(1).strip() if m else "",
                                        f"<p><b>Source:</b> {land}</p>" + txt)
                        ok, herr = html_to_pdf(doc, "/tmp/_land.pdf")
                    if ok:
                        with open("/tmp/_land.pdf", "rb") as fh:
                            rec["_pdf"] = fh.read()
                        rec.update({"status": "html-fulltext", "source_url": land,
                                    "source": "landing-html", "bytes": len(rec["_pdf"]),
                                    "pdf_pages": pdf_pages(rec["_pdf"])})
                        return finish(rec, job)

    # ---- 6. last resort: abstract record
    abstract = None
    for src in (cr, oa, ep, s2):
        if not src:
            continue
        a = src.get("abstract")
        if isinstance(a, str) and len(a) > 200:
            abstract = a
            break
        if isinstance(a, dict) and a.get("abstract_inverted_index") is None:
            pass
    if not abstract and oa and oa.get("abstract_inverted_index"):
        idx = oa["abstract_inverted_index"]
        positions = sorted((p, w) for w, ps in idx.items() for p in ps)
        abstract = " ".join(w for _, w in positions)
    if not abstract and ep:
        abstract = ep.get("abstractText")

    authors = ""
    if cr and cr.get("author"):
        authors = ", ".join(
            (f"{a.get('family','')} {a.get('given','')}".strip()) for a in cr["author"][:12])
    elif ep:
        authors = ep.get("authorString", "")

    body = []
    body.append(f"<p><b>Journal:</b> {htmlmod.escape(str((cr or {}).get('container-title', [job.get('journal')])[0] if cr else job.get('journal') or ''))}</p>")
    body.append(f"<p><b>Year:</b> {htmlmod.escape(str(job.get('year') or (oa or {}).get('publication_year') or ''))}</p>")
    body.append(f"<p><b>Citation as given:</b> {htmlmod.escape(job.get('ref') or '')}</p>")
    body.append(f"<p><b>DOI:</b> {htmlmod.escape(doi or '-')} &nbsp;|&nbsp; "
                f"<b>Link:</b> {htmlmod.escape(landings[0] if landings else '')}</p>")
    if authors:
        body.append(f"<p><b>Authors:</b> {htmlmod.escape(authors)}</p>")
    note = ('<div class="notice"><b>Abstract record only.</b> No openly available full-text PDF was found '
            'for this paper (it appears to be behind a paywall or not deposited in an open repository). '
            'This file contains the bibliographic record and the abstract. '
            'Access the publisher version via the DOI above, e.g. through your institution.</div>')
    if abstract:
        abs_html = htmlmod.escape(strip_tags(abstract))
        body.append("<h2>Abstract</h2><p>" + abs_html + "</p>")
    else:
        body.append("<p><i>No abstract available in the queried sources.</i></p>")
    doc = wrap_html(title, f"{job.get('journal') or ''} {job.get('year') or ''}", "\n".join(body), note)
    if html_to_pdf(doc, "/tmp/_abs.pdf"):
        with open("/tmp/_abs.pdf", "rb") as fh:
            rec["_pdf"] = fh.read()
        rec.update({"status": "abstract-only",
                    "source_url": landings[0] if landings else (f"https://doi.org/{doi}" if doi else None),
                    "source": "abstract-record", "bytes": len(rec["_pdf"])})
    else:
        rec["notes"].append("abstract pdf generation failed")
    return finish(rec, job)


def finish(rec, job):
    pdf = rec.pop("_pdf", None)
    if pdf:
        fname = safe_filename(job["title"]) + ".pdf"
        path = os.path.join(OUTDIR, f"{job['n']:02d} - {fname}")
        os.makedirs(OUTDIR, exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(pdf)
        compress_pdf(path)
        rec["file"] = os.path.relpath(path, REPO)
        rec["bytes"] = os.path.getsize(path)
    rec["notes"] = rec["notes"][:14]
    return rec


def main():
    only = None
    if len(sys.argv) > 1 and sys.argv[1] not in ("all",):
        only = {int(x) for x in sys.argv[1].split(",")}
    jobs = json.load(open(os.path.join(HERE, "jobs.json"), encoding="utf-8"))
    os.makedirs(OUTDIR, exist_ok=True)
    results = []
    for job in jobs:
        if only and job["n"] not in only:
            continue
        log(f"--- [{job['n']:02d}/{len(jobs)}] {job['title'][:80]}")
        try:
            rec = process(job)
        except Exception as e:  # noqa: BLE001
            import traceback
            traceback.print_exc()
            rec = {"n": job["n"], "title_given": job["title"], "status": "error",
                   "notes": [f"exception: {e}"], "doi": job.get("doi"), "file": None}
        log(f"    -> {rec['status']} | {rec.get('file')} | {rec.get('source_url')}")
        if rec.get("notes"):
            for nt in rec["notes"][-4:]:
                log(f"       note: {nt}")
        results.append(rec)
        with open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8") as fh:
            json.dump(results, fh, indent=1, ensure_ascii=False)

    # ---- report
    ok = [r for r in results if r["status"] in ("downloaded", "html-fulltext")]
    abs_only = [r for r in results if r["status"] == "abstract-only"]
    bad = [r for r in results if r["status"] in ("unresolved", "error")]
    lines = ["# Paper download report", "",
             f"- total processed: **{len(results)}**",
             f"- open-access full text: **{len(ok)}**",
             f"- abstract record only: **{len(abs_only)}**",
             f"- unresolved/error: **{len(bad)}**", "",
             "| # | Title | Status | Source | File |", "|---|-------|--------|--------|------|"]
    for r in results:
        lines.append(f"| {r['n']} | {r['title_given'][:70]} | {r['status']} | "
                     f"{(r.get('source') or '-')} | {os.path.basename(r.get('file') or '-')} |")
    lines += ["", "## Details", ""]
    for r in results:
        lines.append(f"### {r['n']}. {r['title_given']}")
        lines.append(f"- status: `{r['status']}` | doi: `{r.get('doi')}` | match: {r.get('match_score')}")
        lines.append(f"- file: `{r.get('file')}` ({r.get('bytes')} bytes, {r.get('pdf_pages') or '?'} pages)")
        lines.append(f"- source: {r.get('source_url')}")
        if r.get("notes"):
            lines.append("- notes: " + "; ".join(r["notes"]))
        lines.append("")
    with open(os.path.join(HERE, "REPORT.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    with open(os.path.join(HERE, "fetch.log"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(LOG))
    log(f"SUMMARY ok={len(ok)} abstract={len(abs_only)} bad={len(bad)}")


if __name__ == "__main__":
    main()
