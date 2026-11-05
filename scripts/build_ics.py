#!/usr/bin/env python3
"""sync.json から TIM の予定を iCalendar(.ics) に書き出す。

iPhone の「照会するカレンダー」や Google カレンダーの「URL で追加」に登録すると、
TIM の予定がそのカレンダーに出る（TIM → カレンダーの一方向）。
TimeTree はそのカレンダーを「外部カレンダー」として表示できる。

使い方: python3 scripts/build_ics.py [sync.json] [出力先.ics]
GitHub Actions（.github/workflows/pages.yml）が公開のたびに実行する。
"""
import json
import sys
from datetime import date, datetime, timedelta, timezone

SRC = sys.argv[1] if len(sys.argv) > 1 else "sync.json"
OUT = sys.argv[2] if len(sys.argv) > 2 else "tim.ics"
DOMAIN = "takuha-tree.tim"

# app-core.js の CAT と同じ名前
CAT = {"fix": "絶対", "kai": "青柳の会", "apo": "アポ", "biz": "ビジネス",
       "work": "仕事", "play": "遊び", "meal": "ごはん", "free": "フリー"}


def esc(s):
    return (str(s).replace("\\", "\\\\").replace(";", "\\;")
            .replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n"))


def fold(line):
    """RFC 5545: 1行は75オクテットまで。UTF-8 の文字の途中では切らない。"""
    out, cur, size = [], "", 0
    for ch in line:
        n = len(ch.encode("utf-8"))
        limit = 75 if not out else 74  # 2行目以降は先頭の空白1つ分を引く
        if size + n > limit:
            out.append(cur)
            cur, size = ch, n
        else:
            cur += ch
            size += n
    out.append(cur)
    return "\r\n ".join(out)


def main():
    d = json.load(open(SRC, encoding="utf-8"))
    deleted = set(d.get("deleted") or [])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    L = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//takuha//TIM//JA",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:TIM",
        "X-WR-TIMEZONE:Asia/Tokyo",
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
        "BEGIN:VTIMEZONE",
        "TZID:Asia/Tokyo",
        "BEGIN:STANDARD",
        "DTSTART:19700101T000000",
        "TZOFFSETFROM:+0900",
        "TZOFFSETTO:+0900",
        "TZNAME:JST",
        "END:STANDARD",
        "END:VTIMEZONE",
    ]
    n_ev = n_rg = 0

    # 時刻つきの予定（gt＝日本時間の0時からの分・dur＝分）
    for day, items in sorted((d.get("events") or {}).items()):
        try:
            base = datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            continue
        for e in items:
            if e.get("id") in deleted:
                continue
            st = base + timedelta(minutes=int(e.get("gt") or 0))
            en = st + timedelta(minutes=int(e.get("dur") or 60))
            L += [
                "BEGIN:VEVENT",
                f"UID:{e['id']}@{DOMAIN}",
                f"DTSTAMP:{stamp}",
                f"DTSTART;TZID=Asia/Tokyo:{st:%Y%m%dT%H%M%S}",
                f"DTEND;TZID=Asia/Tokyo:{en:%Y%m%dT%H%M%S}",
                f"SUMMARY:{esc(e.get('title', ''))}",
                f"CATEGORIES:{esc(CAT.get(e.get('cat'), 'フリー'))}",
                "END:VEVENT",
            ]
            n_ev += 1

    # 期間の予定（start〜end は両端を含む＝終日）
    for r in d.get("ranges") or []:
        if r.get("id") in deleted:
            continue
        try:
            s = date.fromisoformat(r["start"])
            e = date.fromisoformat(r.get("end") or r["start"])
        except (KeyError, ValueError):
            continue
        L += [
            "BEGIN:VEVENT",
            f"UID:{r['id']}@{DOMAIN}",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{s:%Y%m%d}",
            f"DTEND;VALUE=DATE:{e + timedelta(days=1):%Y%m%d}",
            f"SUMMARY:{esc(r.get('title', ''))}",
            f"CATEGORIES:{esc(CAT.get(r.get('cat'), 'フリー'))}",
            "TRANSP:TRANSPARENT",
            "END:VEVENT",
        ]
        n_rg += 1

    L.append("END:VCALENDAR")
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        f.write("\r\n".join(fold(x) for x in L) + "\r\n")
    print(f"{OUT}: 時刻つき {n_ev} 件・期間 {n_rg} 件")


if __name__ == "__main__":
    main()
