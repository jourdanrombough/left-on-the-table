#!/bin/bash
# Double-click to start the scanner on your Mac. Your DataForSEO login stays in ~/DataForSEO/.env.
cd "$(dirname "$0")"
ENV="${LTT_ENV:-$HOME/DataForSEO/.env}"
[ -f .env ] && ENV=".env"
python3 server.py --env "$ENV"
