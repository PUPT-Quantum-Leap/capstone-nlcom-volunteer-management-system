# GitHub Actions Node.js 20 Deprecation Fix Plan

## Overview

This document outlines the plan to address the GitHub Actions Node.js 20 deprecation warning that appeared in recent workflow runs. The warning indicates that several actions are running on deprecated Node.js 20 runtime and will be forced to use Node.js 24 starting June 2nd, 2026, with Node.js 20 being completely removed by September 16th, 2026.

## Problem Statement

### Warning Message
```
Node.js 20 actions are deprecated. The following actions are running on Node.js 20 and may not work as expected:
actions/cache@v4, actions/checkout@v4, actions/setup-node@v4.
Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026.
Node.js 20 will be removed from the runner on September 16th, 2026.
```

### Affected Workflows
- `ci.yml` - Frontend/backend CI testing
- `cd.yml` - Production deployment
- `gitleaks.yml` - Security scanning
- `opencode.yml` - Code analysis
- `opencode-review.yml` - Code review

### Impact
- Workflow failures starting June 2nd, 2026
- Complete workflow breakage after September 16th, 2026
- Potential build and deployment interruptions

## Current Action Versions

### Affected Actions (Node.js 20 runtime)
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/cache@v4`

### Already Compatible Actions
- `actions/upload-artifact@v7` ✅
- `actions/github-script@v9` ✅

## Solution Strategy

### Recommended Approach: Update Action Versions

Update all affected actions to their latest versions that support Node.js 24 runtime.

| Action | Current Version | Target Version | Node.js Runtime |
|--------|----------------|----------------|-----------------|
| actions/checkout | v4 | v6.0.2 | node24 |
| actions/setup-node | v4 | v6.3.0 | node24 |
| actions/cache | v4 | v5.0.5 | node24 |
| actions/upload-artifact | v7 | v7.0.1 ✅ | node24 |
| actions/github-script | v9 | v9.0.0 ✅ | node24 |

## Implementation Plan

### Phase 1: Update Core CI/CD Workflows
**Priority**: High
**Files**: `ci.yml`, `cd.yml`
**Actions**:
- Update checkout, setup-node, and cache actions
- Test CI pipeline functionality
- Test CD deployment process

### Phase 2: Update Supporting Workflows
**Priority**: Medium
**Files**: `gitleaks.yml`, `opencode.yml`, `opencode-review.yml`
**Actions**:
- Update checkout actions where used
- Verify security scanning still works
- Confirm code analysis tools function properly

### Phase 3: Testing and Validation
**Priority**: High
**Actions**:
- Run full CI/CD pipeline after updates
- Verify deployment to staging/production
- Monitor for any breaking changes
- Document any required workflow adjustments

### Phase 4: Monitoring and Maintenance
**Priority**: Low
**Actions**:
- Set up alerts for future action deprecations
- Regularly review GitHub Actions changelog
- Maintain update schedule for actions

## Alternative Solutions

### Option 1: Force Node.js 24 Runtime
Add environment variable to workflows:
```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
```
**Pros**: Quick fix without version updates
**Cons**: May not work for all actions, temporary solution

### Option 2: Hybrid Approach
Update major actions to latest versions, use environment variable for remaining actions.

## Risk Assessment

### Low Risk
- Action version updates are backward compatible
- Comprehensive testing will be performed
- Rollback possible if issues arise

### Mitigation Strategies
- Test all workflows in staging environment first
- Maintain backup of working workflow versions
- Monitor workflow runs closely after deployment
- Have manual deployment option available

## Timeline

### Immediate (Next 24 hours)
- Update CI and CD workflows
- Test basic functionality
- Deploy to staging environment

### Short-term (Next week)
- Update remaining workflows
- Full integration testing
- Performance monitoring

### Long-term (Ongoing)
- Regular action version reviews
- Stay updated with GitHub Actions changes
- Proactive deprecation planning

## Success Criteria

- [ ] No Node.js 20 deprecation warnings in workflow logs
- [ ] All workflows pass successfully
- [ ] CI/CD pipeline functions normally
- [ ] Production deployments work correctly
- [ ] No performance regressions

## Rollback Plan

If issues arise after updates:

1. **Immediate**: Use workflow dispatch to manually deploy with previous action versions
2. **Short-term**: Revert to previous action versions in affected workflows
3. **Long-term**: Investigate root cause and apply targeted fixes

## Resources

- [GitHub Actions Changelog](https://github.blog/changelog/label/actions/)
- [Actions Node.js Runtime Documentation](https://docs.github.com/en/actions/creating-actions/about-custom-actions#runtime)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)

## Approval Checklist

- [ ] Product Owner approval for workflow changes
- [ ] DevOps team review of action updates
- [ ] Testing plan approval
- [ ] Rollback plan documented
- [ ] Communication plan for deployment

---

**Document Version**: 1.0
**Date Created**: April 19, 2026
**Last Updated**: April 19, 2026
**Author**: ServeTrack Development Team