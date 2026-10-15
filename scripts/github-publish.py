"""GitHub Pages administration; credentials stay in process memory via Git Credential Manager."""
import argparse
import json
import os
import subprocess
import urllib.request
import urllib.error

OWNER = "lgqdaxia"
REPO = "chomp-atlas"

def api(method, path, data=None):
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0", GCM_INTERACTIVE="never")
    result = subprocess.run(["git", "credential", "fill"], input="protocol=https\nhost=github.com\nusername=lgqdaxia\n\n", text=True, capture_output=True, env=env, check=True)
    fields = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    token = fields.get("password")
    if not token:
        raise SystemExit("No GitHub credential is available through Git Credential Manager.")
    request = urllib.request.Request("https://api.github.com" + path, method=method,
        data=None if data is None else json.dumps(data).encode(),
        headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Chomp-Atlas-publisher"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        try:
            message = json.loads(error.read()).get("message", str(error.code))
        except Exception:
            message = str(error.code)
        raise RuntimeError(f"GitHub {method} {path}: {error.code} {message}") from None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["check", "create", "pages", "status"])
    args = parser.parse_args()
    if args.action == "check":
        user = api("GET", "/user")
        print(json.dumps({"login": user["login"], "matches_expected_owner": user["login"] == OWNER}))
    elif args.action == "create":
        try:
            repo = api("GET", f"/repos/{OWNER}/{REPO}")
            print(json.dumps({"url": repo["html_url"], "created": False, "default_branch": repo["default_branch"]}))
        except RuntimeError as error:
            if ": 404 " not in str(error):
                raise
            repo = api("POST", "/user/repos", {"name": REPO, "description": "Chomp局面图谱 / An evidence-backed atlas of infinite Chomp positions, moves and proofs", "private": False, "auto_init": False, "has_issues": True, "has_wiki": False})
            print(json.dumps({"url": repo["html_url"], "created": True}))
    elif args.action == "pages":
        try:
            current = api("GET", f"/repos/{OWNER}/{REPO}/pages")
            if current.get("build_type") != "workflow":
                current = api("PUT", f"/repos/{OWNER}/{REPO}/pages", {"build_type": "workflow"})
        except RuntimeError as error:
            if ": 404 " not in str(error):
                raise
            current = api("POST", f"/repos/{OWNER}/{REPO}/pages", {"build_type": "workflow"})
        print(json.dumps({"url": current.get("html_url"), "build_type": current.get("build_type"), "status": current.get("status")}))
    else:
        runs = api("GET", f"/repos/{OWNER}/{REPO}/actions/runs?per_page=3")
        print(json.dumps([{k: run.get(k) for k in ["id", "head_sha", "status", "conclusion", "html_url"]} for run in runs.get("workflow_runs", [])]))

if __name__ == "__main__":
    main()
