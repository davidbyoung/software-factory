"""Check every relative link between the factory's pages resolves, anchors included."""
import re, sys, os, glob
root = sys.argv[1]
pages = [os.path.join(root, "README.md")] + sorted(glob.glob(os.path.join(root, "docs", "**", "*.md"), recursive=True))

def slug(text):
    # Emphasis marks go, as in the rendered heading GitHub slugs; an
    # underscore inside a word, as in FACTORY_BOARD_TOKEN, stays.
    text = re.sub(r"[`*]|(?<!\w)_|_(?!\w)", "", text).strip().lower()
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[^\w\- ]", "", text)
    return text.replace(" ", "-")

def anchors(path):
    out, seen = set(), {}
    in_code = False
    for line in open(path):
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        m = re.match(r"^#+ (.*)", line)
        if m and not in_code:
            s = slug(m.group(1))
            n = seen.get(s, 0)
            out.add(s if n == 0 else f"{s}-{n}")
            seen[s] = n + 1
    return out

bad = []
for page in pages:
    text = open(page).read()
    for m in re.finditer(r"\]\(([^)\s]+)\)", text):
        target = m.group(1)
        if re.match(r"^(https?:|mailto:)", target):
            continue
        path, _, anchor = target.partition("#")
        dest = os.path.normpath(os.path.join(os.path.dirname(page), path)) if path else page
        if not os.path.exists(dest):
            bad.append(f"{os.path.relpath(page, root)}: {target}: no such file")
            continue
        if anchor and dest.endswith(".md") and anchor not in anchors(dest):
            bad.append(f"{os.path.relpath(page, root)}: {target}: no such heading")
print("\n".join(bad) if bad else "every link resolves")
sys.exit(1 if bad else 0)
