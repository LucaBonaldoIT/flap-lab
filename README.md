# Flap Lab

Flap Lab is a static, browser-based workbench for finite-state, pushdown, and Turing machines, plus Mealy/Moore transducers. It includes a TypeScript core for automata simulation, grammar transformations and parsing, regular expressions, pumping lemmas, L-systems, and JFLAP file interchange.

## Repository layout

- `packages/core/` — TypeScript computational library
- `apps/webapp/` — Vite-powered browser UI

## Development

```sh
npm install
npm test
npm run webapp:check
npm run webapp:dev
```

Create a static web deployment with `npm run webapp:build`; output is in `apps/webapp/dist/`.

The workbench runs locally in the browser. It supports creating/editing automata, simulating inputs, and importing/exporting `.jff` files.

## Licensing and contact

The core is derived from JFLAP 7.0. The full JFLAP license is in `LICENSE-JFLAP` and `packages/core/LICENSE-JFLAP`. Under that license, Flap Lab and other products containing JFLAP-derived material must be distributed without charge. Copies must include the license; changes and source must be provided to the JFLAP maintainer without charge on request. Do not use Susan H. Rodger's name to endorse or promote Flap Lab without permission.

Maintainer contact: [Flap Lab GitHub issues](https://github.com/LucaBonaldoIT/flap-lab/issues). The MIT license in `LICENSE` applies only to portions not covered by the JFLAP license; it does not remove the JFLAP license conditions for the combined project.

The original Lenore-Systems codec was unimplemented in the Java source and is not included. JFLAP 3 text formats are import-only, matching the original codec.
