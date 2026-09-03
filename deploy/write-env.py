#!/usr/bin/env python3
"""
Turn Parameter Store JSON into the environment file systemd reads.

Reads `aws ssm get-parameters-by-path --output json` on stdin, writes
KEY='value' lines to the path given as the first argument.

This exists because the shell version parsed `--output text`, which is
tab-separated records one per line — and a value containing a newline
splits into two records. PAYMENT_PROVIDER arrived from the console with a
trailing Enter, so seven parameters read as eight settings, the eighth
being a fragment with no name, and the env file got a bare `=` line that
failed to source. Trimming afterwards could not help: the damage happened
in the parsing, before there was anything to trim.

JSON has no such ambiguity. A newline inside a value is just a character.
"""

import json
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: write-env.py <output-file>", file=sys.stderr)
        return 2

    out_path = sys.argv[1]

    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"Parameter Store did not return JSON: {exc}", file=sys.stderr)
        return 1

    params = payload.get("Parameters", [])
    if not params:
        print("No parameters found.", file=sys.stderr)
        return 1

    lines = []
    for p in sorted(params, key=lambda x: x["Name"]):
        key = p["Name"].rsplit("/", 1)[-1]

        # Trim what a paste into the console form brings with it. An Enter
        # key at the end is invisible in the form and invisible in the
        # listing afterwards, and no setting here ever wants surrounding
        # whitespace.
        value = p["Value"].strip()

        if not key:
            print(f"A parameter has no name after its path: {p['Name']!r}", file=sys.stderr)
            return 1

        # Refuse rather than escape. This file is read by both bash and
        # systemd, which do not agree on quoting, so a value needing an
        # escape has no single correct spelling. No key, URL or address
        # contains a quote or a newline; if one ever does, stopping loudly
        # beats writing a file that fails to parse somewhere else.
        if "'" in value or "\n" in value or "\r" in value:
            print(
                f"{key} contains a quote or a line break, which cannot be "
                f"written safely. Fix it in Parameter Store.",
                file=sys.stderr,
            )
            return 1

        lines.append(f"{key}='{value}'")

    with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines) + "\n")

    print(len(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
