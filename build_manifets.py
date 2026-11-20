# build_manifest.py: run before every upload
import json, os
root = "static/images"
manifest = {
    os.path.relpath(d, root).replace("\\", "/"): sorted(
        f"images/{os.path.relpath(d, root).replace(os.sep, '/')}/{f}"
        for f in files if f.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")))
    for d, _, files in os.walk(root)
}
json.dump(manifest, open("static/images/manifest.json", "w"), indent=1)