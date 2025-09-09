# Starky (MVP)

A minimal CLI to:
- Create a Datadog dashboard
- Add contracts to watch
- Ingest Starknet events and send them as logs to Datadog

## Install
```bash
npm install
npm run build
npm link
# load envs for this shell
cp .env.example .env && export $(grep -v '^#' .env | xargs)

## Usage
```bash# 
starky board create "grinta-mvp"

# edit starky.config.json -> add `contracts` and `excludeEventNames`
starky ingest --from-block 0