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
```bash
starky board create "Starknet Events – MVP"
starky board <board-id> add contract <contract_address>
starky ingest
