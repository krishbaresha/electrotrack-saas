import json
from pathlib import Path

def safe_read(p):
    try:
        raw = Path(p).read_bytes()
        for enc in ("utf-8-sig", "utf-8", "utf-16", "latin-1"):
            try:
                return raw.decode(enc)
            except:
                pass
    except:
        pass
    return ""

files = [
    r"D:\Tech-Bill\.serena\project.local.yml",
    r"D:\Tech-Bill\.serena\project.yml",
    r"D:\Tech-Bill\ARCHITECTURE.md",
    r"D:\Tech-Bill\MD files\ARCHITECTURE.md",
    r"D:\Tech-Bill\MD files\PLAN.md",
    r"D:\Tech-Bill\MD files\guide.md",
    r"D:\Tech-Bill\MD files\techbill-deployment-guide.md",
    r"D:\Tech-Bill\MOBILE_APP_ARCHITECTURE.md",
    r"D:\Tech-Bill\PLAN.md",
    r"D:\Tech-Bill\README.md",
    r"D:\Tech-Bill\Tech-Bill-app\Appss\MOBILE_MVP.md",
    r"D:\Tech-Bill\Tech-Bill-app\Appss\MOBILE_PRD.md",
    r"D:\Tech-Bill\Tech-Bill-app\README.md",
    r"D:\Tech-Bill\WORK_SUMMARY.md",
    r"D:\Tech-Bill\guide.md",
    r"D:\Tech-Bill\techbill-deployment-guide.md",
    r"D:\Tech-Bill\techbill-api\README.md",
    r"D:\Tech-Bill\techbill-api\pnpm-workspace.yaml",
]

for f in files:
    content = safe_read(f)
    print(f"=== {f} ===")
    print(content[:800])
    print()
