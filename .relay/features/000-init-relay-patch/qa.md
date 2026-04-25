# 000-init-relay-patch — QA Checklist

## Structural

- [ ] `.relay/README.md` exists and describes the relay directory
- [ ] `.relay/registry.json` is valid JSON with the initial feature entry
- [ ] `.relay/features/000-init-relay-patch/spec.md` exists
- [ ] `.relay/features/000-init-relay-patch/qa.md` exists

## SDK Core

- [ ] `src/types.ts` exports all message types, options, and error classes
- [ ] `src/client.ts` implements `query()` as an async generator
- [ ] `src/index.ts` re-exports all public API surface
- [ ] `package.json` has correct name, main, types, and exports fields
- [ ] `tsconfig.json` compiles without errors (`tsc --noEmit`)

## Functional

- [ ] `resolveForgePath()` searches FORGE_PATH, config, PATH, ~/.local/bin/forge
- [ ] `query()` yields SystemMessage with session_id first
- [ ] `query()` yields AssistantMessage with raw stdout text
- [ ] `query()` yields ResultMessage with final output
- [ ] `query()` yields ErrorMessage on non-zero exit codes
- [ ] `extractJsonFromText()` handles ```json fences, generic fences, and bare JSON
