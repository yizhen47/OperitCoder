import json
from pathlib import Path


ROOT = Path("webview-ui/src/i18n/locales")


def detect_indent(text: str):
    if "\n\t" in text:
        return "\t"
    return 2


def dump_json(data, indent):
    return json.dumps(data, ensure_ascii=False, indent=indent) + "\n"


def update_settings(data):
    sections = data.get("sections")
    if isinstance(sections, dict):
        sections.pop("browser", None)
    auto = data.get("autoApprove")
    if isinstance(auto, dict):
        auto.pop("browser", None)
    data.pop("browser", None)
    providers = data.get("providers")
    if isinstance(providers, dict):
        custom = providers.get("customModel")
        if isinstance(custom, dict):
            custom.pop("computerUse", None)


def update_kilocode(data):
    notifications = data.get("notifications")
    if isinstance(notifications, dict):
        notifications.pop("browserAction", None)
    message_types = (
        data.get("taskTimeline", {}).get("tooltip", {}).get("messageTypes")
    )
    if isinstance(message_types, dict):
        for key in (
            "browser_action",
            "browser_action_result",
            "browser_action_launch",
        ):
            message_types.pop(key, None)


def update_chat(data):
    data.pop("browser", None)
    for key in (
        "browserAnnouncement",
        "browserAnnouncementDesc",
        "browserSession",
        "browserActionPress",
        "browserActionPressDesc",
        "browserActionHover",
        "browserActionHoverDesc",
        "browserUse",
    ):
        data.pop(key, None)


def update_prompts(data):
    tool_names = data.get("tools", {}).get("toolNames")
    if isinstance(tool_names, dict):
        tool_names.pop("browser", None)


HANDLERS = {
    "settings.json": update_settings,
    "kilocode.json": update_kilocode,
    "chat.json": update_chat,
    "prompts.json": update_prompts,
}


def main():
    for locale_dir in ROOT.iterdir():
        if not locale_dir.is_dir():
            continue
        for filename, handler in HANDLERS.items():
            path = locale_dir / filename
            if not path.exists():
                continue
            original_text = path.read_text(encoding="utf-8")
            data = json.loads(original_text)
            handler(data)
            new_text = dump_json(data, detect_indent(original_text))
            if new_text != original_text:
                path.write_text(new_text, encoding="utf-8")
                print(f"updated: {path}")

    print("done")


if __name__ == "__main__":
    main()
