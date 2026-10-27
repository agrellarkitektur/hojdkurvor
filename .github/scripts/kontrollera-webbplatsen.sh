#!/usr/bin/env bash
# Jämför filerna på webbplatsen med dem som skulle laddas upp (mappen ut/).
# Filer som saknas eller skiljer sig laddas upp igen med curl, och sedan
# kontrolleras de en gång till. Avslutar med fel om något fortfarande inte stämmer.
#
# Används av publicera.yml efter FTP-uppladdningen. Miljövariabler:
#   SIDA          webbadressen till appen, med / på slutet
#   FTP_SERVER, FTP_USERNAME, FTP_PASSWORD
#   FTP_DIR       mappen på servern, med / i början och på slutet
#
# PHP-filer körs på servern och .htaccess visas inte, så de går inte att jämföra
# över webben; de kontrolleras bara genom att sidan svarar.

set -uo pipefail
cd ut || exit 1

tmp=$(mktemp)
kontroll="kontroll=${GITHUB_RUN_ID:-$(date +%s)}"

# Webbplatsen måste svara innan något jämförs.
kod=$(curl -s -o /dev/null -w '%{http_code}' -H 'Cache-Control: no-cache' "${SIDA}index.html?${kontroll}")
if [ "$kod" = "000" ]; then
  echo "::warning::Webbplatsen ${SIDA} gick inte att nå från GitHub. Filerna är inte kontrollerade."
  exit 0
fi
if [ "$kod" = "500" ] && [ -f .htaccess ]; then
  # Webbhotellet godtar inte .htaccess: ta bort den så att sidan fungerar igen.
  curl -sS --ssl-reqd -k --user "${FTP_USERNAME}:${FTP_PASSWORD}" \
    "ftp://${FTP_SERVER}/" -Q "DELE ${FTP_DIR}.htaccess" -o /dev/null || true
  echo "::error::Webbplatsen svarade 500 med den nya .htaccess, som nu är borttagen från servern. Ta bort den ur repot eller ändra den."
  exit 1
fi

jamfor() {
  avvikande=()
  while IFS= read -r -d '' f; do
    f=${f#./}
    case "$f" in *.php|.htaccess|.ftp-deploy-sync-state*) continue ;; esac
    if ! curl -sf -H 'Cache-Control: no-cache' "${SIDA}${f}?${kontroll}" -o "$tmp" || ! cmp -s "$tmp" "$f"; then
      avvikande+=("$f")
    fi
  done < <(find . -type f -print0 | sort -z)
}

jamfor
if [ ${#avvikande[@]} -eq 0 ]; then
  echo "::notice::Alla filer på ${SIDA} stämmer med repot."
  exit 0
fi

echo "::warning::${#avvikande[@]} filer saknades eller var gamla på webbplatsen och laddas upp igen: ${avvikande[*]}"
for f in "${avvikande[@]}"; do
  curl -sS --ssl-reqd -k --ftp-create-dirs --user "${FTP_USERNAME}:${FTP_PASSWORD}" \
    -T "$f" "ftp://${FTP_SERVER}/%2F${FTP_DIR#/}${f}" || echo "::error::Kunde inte ladda upp $f"
done

sleep 3
jamfor
if [ ${#avvikande[@]} -ne 0 ]; then
  echo "::error::Filerna stämmer fortfarande inte på webbplatsen: ${avvikande[*]}"
  exit 1
fi
echo "::notice::Alla filer stämmer nu med repot."
