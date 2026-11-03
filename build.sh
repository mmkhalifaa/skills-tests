#!/usr/bin/env bash
# Assembles src/ into the single self-contained page, index.html
set -euo pipefail
cd "$(dirname "$0")/src"
{ cat head.html body.html; echo '<script>'; cat data.js engine.js custom.js ui.js builder.js; echo '</script>'; } > ../index.html
echo "Built index.html"
