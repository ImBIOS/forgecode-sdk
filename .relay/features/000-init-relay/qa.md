# QA: 000-init-relay

## Test Plan

### 1. Directory Structure Verification

- [ ] `.relay/` directory exists
- [ ] `.relay/README.md` is present
- [ ] `.relay/registry.json` is present and valid JSON
- [ ] `.relay/upstream.json` is present
- [ ] `.relay/features/` directory exists

### 2. Feature Registration Verification

1. Verify `.relay/features/000-init-relay/spec.md` exists
2. Verify `.relay/features/000-init-relay/qa.md` exists (this file)
3. Verify `.relay/features/000-init-relay/patch.md` exists (fork customizations)
4. Verify the `000-init-relay` feature is present in the `features` array of `registry.json`
5. Verify the `slug` field in the registry matches the folder name `000-init-relay`

### 3. Content Verification

- [ ] `spec.md` has valid markdown structure
- [ ] `qa.md` has at least one test case
- [ ] `registry.json` has a valid schema (passes JSON Schema validation)
