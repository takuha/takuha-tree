#!/usr/bin/env python3
"""音声入力(Siriショートカット→GitHub Actions repository_dispatch)からTIMの予定を自動登録する。
Claude APIでテキストを解析し、sync.jsonに追記してpush。結果はntfyで本人に通知する。"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNC_PATH = os.path.join(REPO_DIR, "sync.json")
NTFY_TOPIC = "takuha-aichan-3fcb886f2fa7"

CAT_KEYS = {
    "apo": "アポ・人との約束",
    "biz": "ビジネス案件(内園くん協業・証券口座代理店・エコウォーター等の不定期案件)",
    "work": "仕事全般",
    "study": "勉強・自習",
    "talk": "会話",
    "play": "遊び・旅行",
    "ai": "AI作業",
    "film": "撮影編集",
    "sns": "発信",
    "train": "トレーニング",
    "meal": "ごはん",
    "free": "フリー・特に分類不要なもの",
    "self": "内省",
}


def notify(title, message, priority="default"):
    try:
        req = urllib.request.Request(
            f"https://ntfy.sh/{NTFY_TOPIC}",
            data=message.encode("utf-8"),
            headers={
                "Title": title.encode("utf-8"),
                "Priority": priority,
            },
            method="POST",
        )
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        print(f"ntfy通知失敗: {e}", file=sys.stderr)


def call_claude(text, now_iso):
    api_key = os.environ["ANTHROPIC_API_KEY"]
    system = f"""あなたはTAKUHAさんの音声入力からスケジュール項目を抽出するアシスタントです。
現在日時（日本時間）: {now_iso}
TAKUHAさんは現在日本(大阪)にいます。話される時刻は特に断りがなければ日本時間です。

カテゴリ一覧（このキーのどれかを選ぶ、不明なら"free"）:
{json.dumps(CAT_KEYS, ensure_ascii=False, indent=2)}

音声認識テキストから、追加すべき予定を抽出してJSONのみで返してください。前置き・説明・コードフェンスは一切不要。
1件の日時指定イベントは type:"event"、複数日にまたがる期間は type:"range"。
複数件言及されていれば複数返してよい。抽出できる内容が無ければitemsを空配列にする。

スキーマ:
{{
  "items": [
    {{"type":"event","date":"YYYY-MM-DD","time":"HH:MM","dur_min":60,"title":"...","cat":"..."}},
    {{"type":"range","start":"YYYY-MM-DD","end":"YYYY-MM-DD","title":"...","cat":"..."}}
  ]
}}
timeが不明な場合は"09:00"、dur_minが不明な場合は60を使う。titleは簡潔な日本語で。"""

    body = json.dumps(
        {
            "model": "claude-sonnet-5",
            "max_tokens": 1024,
            "system": system,
            "messages": [{"role": "user", "content": text}],
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.load(resp)
    raw = data["content"][0]["text"].strip()
    raw = re.sub(r"^```(json)?|```$", "", raw, flags=re.MULTILINE).strip()
    return json.loads(raw)


def jp_time_to_gt(hhmm):
    h, m = map(int, hhmm.split(":"))
    jp_min = h * 60 + m
    return ((jp_min - 900) % 1440 + 1440) % 1440


def run_git(args, check=True):
    return subprocess.run(["git", *args], cwd=REPO_DIR, check=check)


def main():
    text = os.environ["INPUT_TEXT"]
    now_iso = os.environ.get("INPUT_NOW", "")

    with open(SYNC_PATH, encoding="utf-8") as f:
        db = json.load(f)

    try:
        parsed = call_claude(text, now_iso)
    except Exception as e:
        notify(
            "⚠️ TIM音声予定：解析失敗",
            f"「{text}」を自動登録できませんでした。手動で確認してください。\n{e}",
            priority="high",
        )
        raise

    items = parsed.get("items", [])
    stamp = str(int(time.time()))[-6:]
    added_lines = []

    for idx, item in enumerate(items):
        cat = item.get("cat") if item.get("cat") in CAT_KEYS else "free"
        title = item.get("title") or text
        if item.get("type") == "range" and item.get("start") and item.get("end"):
            rid = f"r{item['start'].replace('-', '')}-voice{stamp}{idx}"
            db.setdefault("ranges", []).append(
                {
                    "id": rid,
                    "start": item["start"],
                    "end": item["end"],
                    "title": title,
                    "cat": cat,
                }
            )
            added_lines.append(f"[期間] {item['start']}〜{item['end']} {title}")
        else:
            date = item.get("date")
            if not date:
                continue
            time_str = item.get("time") or "09:00"
            dur = int(item.get("dur_min") or 60)
            gt = jp_time_to_gt(time_str)
            eid = f"e{date.replace('-', '')}-voice{stamp}{idx}"
            db.setdefault("events", {}).setdefault(date, []).append(
                {"id": eid, "title": title, "gt": gt, "dur": dur, "cat": cat}
            )
            added_lines.append(f"[{date} {time_str}] {title}")

    if not added_lines:
        notify(
            "🎙️ TIM音声予定：抽出なし",
            f"「{text}」から予定を抽出できませんでした。言い直すか手動で追加してください。",
        )
        return

    with open(SYNC_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
        f.write("\n")

    run_git(["config", "user.name", "aichan-voice-bot"])
    run_git(["config", "user.email", "actions@users.noreply.github.com"])
    run_git(["add", "sync.json"])
    run_git(["commit", "-m", f"🎙️ 音声予定追加: {text[:40]}"])

    pushed = False
    for _ in range(3):
        push = run_git(["push", "origin", "HEAD:main"], check=False)
        if push.returncode == 0:
            pushed = True
            break
        run_git(["pull", "--rebase", "origin", "main"])

    if not pushed:
        notify(
            "⚠️ TIM音声予定：push失敗",
            f"「{text}」の登録に失敗（push）。手動確認してください。",
            priority="high",
        )
        sys.exit(1)

    notify("✅ TIMに予定を追加", "\n".join(added_lines) + f"\n\n元の音声テキスト: {text}")


if __name__ == "__main__":
    main()
