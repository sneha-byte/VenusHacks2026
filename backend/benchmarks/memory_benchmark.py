"""Compare browser memory for N concurrent users under two designs:

  separate : one Chromium process tree per user (what you'd get by launching a browser per session)
  shared   : one Chromium, one isolated BrowserContext per user (what SessionService does)

Each user gets its own page loaded with the same URL. After the pages settle we sum
memory over every Chromium process the run started, repeat a few times, and report
the median.

Metric: PSS on Linux (shared pages split fairly between processes, so totals aren't
double-counted). Elsewhere psutil has no PSS, so USS (memory unique to each process)
is used; it slightly understates the shared design's cost, so treat it as a rough number.

Usage (from backend/):
    python benchmarks/memory_benchmark.py                  # built-in test page, 5 users
    python benchmarks/memory_benchmark.py --users 10 --runs 5
    python benchmarks/memory_benchmark.py --url https://www.dmv.ca.gov/portal/
"""

import argparse
import asyncio
import http.server
import statistics
import sys
import threading
from contextlib import contextmanager

import psutil
from playwright.async_api import async_playwright

SETTLE_SECONDS = 3
LAUNCH_ARGS: dict = {"headless": True}

# A form-heavy page roughly like the government/medical forms Browzen targets.
TEST_PAGE = """<!doctype html><html><head><title>Benchmark form</title>
<style>body{font-family:sans-serif} fieldset{margin:8px} .row{display:flex;gap:8px}</style></head>
<body><h1>Application form</h1><form>""" + "".join(
	f"""<fieldset><legend>Section {i}</legend><div class=row>
	<label>Name <input name=n{i}></label><label>Date <input type=date name=d{i}></label>
	<select name=s{i}>{''.join(f'<option>Option {j}</option>' for j in range(20))}</select>
	<textarea name=t{i}>Lorem ipsum dolor sit amet</textarea></div></fieldset>"""
	for i in range(60)
) + """</form><script>
const data = Array.from({length: 20000}, (_, i) => ({i, s: 'row ' + i}));
document.title += ' (' + data.length + ' rows)';
</script></body></html>"""


@contextmanager
def serve_test_page():
	class Handler(http.server.BaseHTTPRequestHandler):
		def do_GET(self):
			body = TEST_PAGE.encode()
			self.send_response(200)
			self.send_header("Content-Type", "text/html")
			self.send_header("Content-Length", str(len(body)))
			self.end_headers()
			self.wfile.write(body)

		def log_message(self, *args):
			pass

	server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
	thread = threading.Thread(target=server.serve_forever, daemon=True)
	thread.start()
	try:
		yield f"http://127.0.0.1:{server.server_address[1]}/"
	finally:
		server.shutdown()


def _metric_name() -> str:
	return "PSS" if sys.platform.startswith("linux") else "USS"


def browser_memory_mb() -> float:
	"""Sum memory over all browser processes started by this Python process."""
	total = 0
	for proc in psutil.Process().children(recursive=True):
		try:
			info = proc.memory_full_info()
		except (psutil.NoSuchProcess, psutil.AccessDenied):
			continue
		total += getattr(info, "pss", None) or info.uss
	return total / (1024 * 1024)


async def run_separate(pw, users: int, url: str) -> float:
	browsers = []
	try:
		for _ in range(users):
			browser = await pw.chromium.launch(**LAUNCH_ARGS)
			context = await browser.new_context(viewport={"width": 1280, "height": 720})
			page = await context.new_page()
			await page.goto(url, wait_until="load", timeout=60_000)
			browsers.append(browser)
		await asyncio.sleep(SETTLE_SECONDS)
		return browser_memory_mb()
	finally:
		for browser in browsers:
			await browser.close()


async def run_shared(pw, users: int, url: str) -> float:
	browser = await pw.chromium.launch(**LAUNCH_ARGS)
	try:
		for _ in range(users):
			context = await browser.new_context(viewport={"width": 1280, "height": 720})
			page = await context.new_page()
			await page.goto(url, wait_until="load", timeout=60_000)
		await asyncio.sleep(SETTLE_SECONDS)
		return browser_memory_mb()
	finally:
		await browser.close()


async def main(users: int, runs: int, url: str | None) -> None:
	with serve_test_page() as local_url:
		target = url or local_url
		async with async_playwright() as pw:
			results = {"separate": [], "shared": []}
			for run in range(1, runs + 1):
				# Alternate order so neither design always runs on a "warmer" machine.
				order = ["separate", "shared"] if run % 2 else ["shared", "separate"]
				for design in order:
					fn = run_separate if design == "separate" else run_shared
					mb = await fn(pw, users, target)
					results[design].append(mb)
					print(f"run {run}  {design:<8} {mb:8.1f} MB")
					await asyncio.sleep(1)

	sep = statistics.median(results["separate"])
	shr = statistics.median(results["shared"])
	saved = (1 - shr / sep) * 100
	print()
	print(f"users={users}  runs={runs}  metric={_metric_name()}  page={'built-in test form' if not url else url}")
	print(f"separate browsers : {sep:8.1f} MB  ({sep / users:.1f} MB/user)")
	print(f"shared + contexts : {shr:8.1f} MB  ({shr / users:.1f} MB/user)")
	print(f"reduction         : {saved:.0f}%")


if __name__ == "__main__":
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--users", type=int, default=5, help="concurrent user sessions (default 5)")
	parser.add_argument("--runs", type=int, default=3, help="repetitions; the median is reported (default 3)")
	parser.add_argument("--url", help="page to load in every session (default: built-in test form)")
	parser.add_argument("--executable-path", help="use this Chromium binary instead of Playwright's download")
	args = parser.parse_args()
	if args.executable_path:
		LAUNCH_ARGS["executable_path"] = args.executable_path
	asyncio.run(main(args.users, args.runs, args.url))
