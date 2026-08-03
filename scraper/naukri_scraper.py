"""
Weekly Naukri scraper for CityFit.

Runs OUTSIDE the web app (GitHub Actions or any machine with Chrome), collects
fresh listings with Selenium, cleans them the same way the historical
all_data.xlsx was cleaned, and POSTs them to the app's ingest endpoint.

Usage:
    export INGEST_URL="https://<your-app-domain>/api/public/ingest-jobs"
    export INGEST_TOKEN="<same value stored as the app's INGEST_TOKEN secret>"
    python naukri_scraper.py
"""

from __future__ import annotations

import os
import re
import sys
import time
import json
import urllib.request
from dataclasses import dataclass, asdict, field

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# (search keyword, category label stored in the database)
SEARCHES = [
    ("data-analyst", "Data & Analytics"),
    ("data-scientist", "Data & Analytics"),
    ("data-engineer", "Data & Analytics"),
    ("software-developer", "Software Engineering"),
    ("frontend-developer", "Software Engineering"),
    ("backend-developer", "Software Engineering"),
    ("devops-engineer", "Infrastructure"),
    ("business-analyst", "Business & Product"),
    ("product-manager", "Business & Product"),
    ("machine-learning-engineer", "AI & ML"),
]

PAGES_PER_SEARCH = int(os.environ.get("PAGES_PER_SEARCH", "6"))

TIER_1 = {
    "Bengaluru",
    "Mumbai",
    "Delhi",
    "Hyderabad",
    "Chennai",
    "Pune",
    "Kolkata",
    "Gurugram",
    "Noida",
}
TIER_2 = {
    "Ahmedabad",
    "Jaipur",
    "Indore",
    "Chandigarh",
    "Coimbatore",
    "Kochi",
    "Nagpur",
    "Bhubaneswar",
    "Lucknow",
    "Vadodara",
    "Mysuru",
    "Thiruvananthapuram",
    "Visakhapatnam",
}

CITY_ALIASES = {
    "bangalore": "Bengaluru",
    "bengaluru": "Bengaluru",
    "new delhi": "Delhi",
    "delhi ncr": "Delhi",
    "gurgaon": "Gurugram",
    "bombay": "Mumbai",
    "calcutta": "Kolkata",
    "madras": "Chennai",
    "trivandrum": "Thiruvananthapuram",
    "cochin": "Kochi",
    "mysore": "Mysuru",
    "vizag": "Visakhapatnam",
    "pune city": "Pune",
}


@dataclass
class Job:
    category: str | None = None
    company: str | None = None
    job_title: str | None = None
    role: str | None = None
    job_description: str | None = None
    location: str | None = None
    work_mode: str | None = None
    skills: str | None = None
    key_skills: str | None = None
    work_type: str | None = None
    keyword: str | None = None
    one_liner: str | None = None
    min_experience: float | None = None
    max_experience: float | None = None
    tier: str | None = None
    external_id: str | None = None


def build_driver() -> webdriver.Chrome:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1440,2200")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument(
        "user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(60)
    return driver


def clean_city(raw: str | None) -> str | None:
    if not raw:
        return None
    # Naukri often returns "Hybrid - Bengaluru, Pune" or "Remote"
    first = re.split(r"[,/|]", raw)[0]
    first = re.sub(r"(?i)\b(hybrid|remote|work from home|wfo|onsite)\b", "", first)
    first = re.sub(r"[-–()]", " ", first).strip()
    if not first:
        return None
    key = first.lower().strip()
    city = CITY_ALIASES.get(key, first.title())
    return city[:120]


def work_mode_from(raw: str | None, description: str | None) -> str | None:
    blob = f"{raw or ''} {description or ''}".lower()
    if "work from home" in blob or "remote" in blob:
        return "Remote"
    if "hybrid" in blob:
        return "Hybrid"
    if raw:
        return "On-site"
    return None


def tier_for(city: str | None) -> str | None:
    if not city:
        return None
    if city in TIER_1:
        return "Tier 1"
    if city in TIER_2:
        return "Tier 2"
    return "Tier 3"


def parse_experience(raw: str | None) -> tuple[float | None, float | None]:
    if not raw:
        return None, None
    nums = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", raw)]
    if not nums:
        return None, None
    if len(nums) == 1:
        return nums[0], nums[0]
    return min(nums[:2]), max(nums[:2])


def clean_text(value: str | None, limit: int = 4000) -> str | None:
    if not value:
        return None
    value = re.sub(r"\s+", " ", value).strip()
    return value[:limit] or None


def scrape_search(driver: webdriver.Chrome, keyword: str, category: str) -> list[Job]:
    jobs: list[Job] = []
    for page in range(1, PAGES_PER_SEARCH + 1):
        url = (
            f"https://www.naukri.com/{keyword}-jobs-{page}"
            if page > 1
            else f"https://www.naukri.com/{keyword}-jobs"
        )
        try:
            driver.get(url)
            WebDriverWait(driver, 25).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "div.srp-jobtuple-wrapper, article.jobTuple")
                )
            )
        except Exception as exc:  # noqa: BLE001
            print(f"  ! {keyword} page {page}: {exc}", file=sys.stderr)
            continue

        # Lazy-loaded cards: nudge the page so every tuple renders.
        for _ in range(3):
            driver.execute_script("window.scrollBy(0, document.body.scrollHeight/3);")
            time.sleep(0.6)

        cards = driver.find_elements(
            By.CSS_SELECTOR, "div.srp-jobtuple-wrapper, article.jobTuple"
        )
        for card in cards:

            def text(selector: str) -> str | None:
                try:
                    return card.find_element(By.CSS_SELECTOR, selector).text
                except Exception:  # noqa: BLE001
                    return None

            title = clean_text(text("a.title"), 400)
            if not title:
                continue

            try:
                link = (
                    card.find_element(By.CSS_SELECTOR, "a.title").get_attribute("href")
                    or ""
                )
            except Exception:  # noqa: BLE001
                link = ""
            external_id = None
            match = re.search(r"-(\d{6,})\b", link)
            if match:
                external_id = match.group(1)

            skills = [
                clean_text(el.text, 60)
                for el in card.find_elements(
                    By.CSS_SELECTOR, "ul.tags-gt li, li.dot-gt"
                )
            ]
            skills = [s for s in skills if s]

            raw_location = text("span.locWdth, span.loc")
            city = clean_city(raw_location)
            description = clean_text(text("span.job-desc, div.job-description"), 4000)
            min_exp, max_exp = parse_experience(text("span.expwdth, span.exp"))

            jobs.append(
                Job(
                    category=category,
                    company=clean_text(text("a.comp-name, a.subTitle"), 300),
                    job_title=title,
                    role=title,
                    job_description=description,
                    location=city,
                    work_mode=work_mode_from(raw_location, description),
                    skills=", ".join(skills)[:2000] or None,
                    key_skills=", ".join(skills[:6])[:2000] or None,
                    work_type="Full Time",
                    keyword=keyword,
                    one_liner=clean_text(description, 300) if description else None,
                    min_experience=min_exp,
                    max_experience=max_exp,
                    tier=tier_for(city),
                    external_id=external_id,
                )
            )
        time.sleep(1.5)
    return jobs


def dedupe(jobs: list[Job]) -> list[Job]:
    seen: set[tuple] = set()
    unique: list[Job] = []
    for job in jobs:
        key = (
            (job.company or "").lower(),
            (job.job_title or "").lower(),
            (job.location or "").lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(job)
    return unique


def push(jobs: list[Job]) -> None:
    url = os.environ["INGEST_URL"]
    token = os.environ["INGEST_TOKEN"]
    for start in range(0, len(jobs), 500):
        chunk = [asdict(job) for job in jobs[start : start + 500]]
        request = urllib.request.Request(
            url,
            data=json.dumps({"jobs": chunk}).encode(),
            headers={"Content-Type": "application/json", "x-ingest-token": token},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=180) as response:
            print(f"  -> ingest {start}: {response.read().decode()[:200]}")


def main() -> int:
    driver = build_driver()
    collected: list[Job] = []
    try:
        for keyword, category in SEARCHES:
            print(f"Scraping {keyword} ...")
            found = scrape_search(driver, keyword, category)
            print(f"  {len(found)} listings")
            collected.extend(found)
    finally:
        driver.quit()

    jobs = dedupe([job for job in collected if job.job_title and job.company])
    print(f"Total unique listings: {len(jobs)}")
    if not jobs:
        print("Nothing scraped; not calling ingest.", file=sys.stderr)
        return 1
    push(jobs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
