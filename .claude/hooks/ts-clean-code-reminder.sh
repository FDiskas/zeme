#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit): once per session, remind Claude to load the
# TypeScript clean-code skills before the first .ts/.tsx edit.
input=$(cat)
file=$(jq -r '.tool_input.file_path // empty' <<<"$input")
session=$(jq -r '.session_id // "unknown"' <<<"$input")

[[ "$file" =~ \.(ts|tsx|mts|cts)$ ]] || exit 0

marker="${TMPDIR:-/tmp}/claude-ts-clean-code-${session}"
[[ -e "$marker" ]] && exit 0
touch "$marker"

skills="typescript-clean-code, boy-scout"
[[ "$file" =~ \.(test|spec)\.[cm]?tsx?$ ]] && skills="$skills, clean-tests"

jq -n --arg s "$skills" '{hookSpecificOutput: {hookEventName: "PreToolUse",
  additionalContext: ("TypeScript edit detected. If not yet loaded this session, invoke these skills via the Skill tool before editing: " + $s + ". Pull in clean-names / clean-functions / clean-comments / clean-general as the change calls for.")}}'
