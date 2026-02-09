import json
from pathlib import Path

ROOT = Path("webview-ui/src/i18n/locales")
KEY = "MULTIPLE_CONCURRENT_TASKS"
ANCHOR = "MULTIPLE_NATIVE_TOOL_CALLS"


def detect_indent(text: str):
    if "\n\t" in text:
        return "\t"
    return 2


def dump_json(data, indent):
    return json.dumps(data, ensure_ascii=False, indent=indent) + "\n"


def insert_after(d: dict, key: str, value, anchor: str) -> dict:
    if key in d:
        return d
    new_data = {}
    inserted = False
    for k, v in d.items():
        new_data[k] = v
        if k == anchor:
            new_data[key] = value
            inserted = True
    if not inserted:
        new_data[key] = value
    return new_data


def main():
    en_settings = ROOT / "en" / "settings.json"
    en_data = json.loads(en_settings.read_text(encoding="utf-8"))
    en_experimental = en_data.get("experimental", {})
    if KEY not in en_experimental:
        raise SystemExit(f"Missing {KEY} in en settings")
    en_value = en_experimental[KEY]

    for locale_dir in ROOT.iterdir():
        if not locale_dir.is_dir():
            continue
        path = locale_dir / "settings.json"
        if not path.exists():
            continue
        original_text = path.read_text(encoding="utf-8")
        data = json.loads(original_text)
        experimental = data.get("experimental")
        if not isinstance(experimental, dict):
            experimental = {}
        if KEY in experimental:
            continue
        data["experimental"] = insert_after(experimental, KEY, en_value, ANCHOR)
        new_text = dump_json(data, detect_indent(original_text))
        if new_text != original_text:
            path.write_text(new_text, encoding="utf-8")
            print(f"updated: {path}")

    print("done")


if __name__ == "__main__":
    main()