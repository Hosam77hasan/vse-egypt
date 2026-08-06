# 🚀 CI/CD Setup Documentation

## Overview
This project uses GitHub Actions for Continuous Integration and Continuous Deployment (CI/CD).

## Workflows

### 1. CI - Tests & Lint (`ci.yml`)
**Triggers:** Push to `main`/`develop`, Pull Requests

**Jobs:**
- 🧪 **Test**: Runs unit and integration tests
- 🔍 **Lint**: Checks code formatting and style
- 🔒 **Security**: Audits dependencies for vulnerabilities

**Features:**
- Tests on Node.js 18.x and 20.x
- Coverage reports uploaded to Codecov
- Test results stored as artifacts

### 2. Deploy to GitHub Pages (`deploy.yml`)
**Triggers:** Push to `main`, Manual dispatch

**Jobs:**
- 🔨 **Build**: Builds the landing page
- 🚀 **Deploy**: Deploys to GitHub Pages
- 📢 **Notify**: Sends deployment notifications

**Features:**
- Automatic deployment on push
- PR comments with live site link
- Concurrency control

### 3. Build Backend (`build-backend.yml`)
**Triggers:** Changes in `vse-backend/`

**Jobs:**
- 🔨 **Build**: Runs all test suites
- 🔍 **Lint**: Checks code style
- 🔒 **Security**: Audits dependencies

**Features:**
- Unit, integration, and security tests
- Coverage report generation
- Security audit reports

### 4. Build Payment Portal (`build-payment-portal.yml`)
**Triggers:** Changes in `vse-payment-portal/`

**Jobs:**
- 🔨 **Build**: Builds the payment portal
- 🔍 **Lint**: Checks code style
- 🔒 **Security**: Audits dependencies

**Features:**
- Build artifact upload
- Security audit reports

## Setup Instructions

### Prerequisites
1. GitHub repository (public or private)
2. GitHub Actions enabled
3. (Optional) Codecov token for coverage reports

### Configuration

#### 1. Add Secrets (if needed)
Go to: `Settings → Secrets and variables → Actions`

Add these secrets:
- `SNYK_TOKEN` (optional): For Snyk security scanning
- `CODECOV_TOKEN` (optional): For Codecov coverage reports

#### 2. Enable GitHub Pages
Go to: `Settings → Pages`

- Source: `GitHub Actions`
- Branch: `main`

#### 3. Customization

**Change Node.js versions:**
Edit `.github/workflows/ci.yml`:
```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]  # Add/remove versions
```

**Change test commands:**
Edit the workflow files to match your test setup.

## Usage

### Automatic Triggers
- **Push to main**: Runs tests and deploys
- **Pull Request**: Runs tests only
- **Push to develop**: Runs tests only
- **Manual dispatch**: Deploy manually

### Manual Trigger
1. Go to: `Actions` tab
2. Select workflow
3. Click `Run workflow`

### Viewing Results
1. Go to: `Actions` tab
2. Click on a workflow run
3. View logs and artifacts

## Artifacts

### Test Results
- Location: `Actions → [Run] → Artifacts`
- Retention: 7 days

### Coverage Reports
- Location: `Actions → [Run] → Artifacts`
- Format: LCOV
- Upload to Codecov (if configured)

### Security Audits
- Location: `Actions → [Run] → Artifacts`
- Format: JSON
- Retention: 30 days

## Troubleshooting

### Tests Failing
1. Check the test logs in Actions
2. Run tests locally: `cd vse-backend && npm test`
3. Fix issues and push again

### Deployment Failing
1. Check the deploy logs in Actions
2. Verify GitHub Pages is enabled
3. Check repository permissions

### Build Failing
1. Check Node.js version compatibility
2. Verify dependencies are installed
3. Check for syntax errors

## Best Practices

1. **Always run tests before merging PRs**
2. **Review coverage reports** to improve test coverage
3. **Check security audits** regularly
4. **Keep dependencies updated**
5. **Use meaningful commit messages**

## Monitoring

### GitHub Actions Badge
Add to your README.md:
```markdown
![CI](https://github.com/USERNAME/REPO/actions/workflows/ci.yml/badge.svg)
```

### Codecov Badge
```markdown
[![codecov](https://codecov.io/gh/USERNAME/REPO/branch/main/graph/badge.svg)](https://codecov.io/gh/USERNAME/REPO)
```

## Support
- GitHub Actions Documentation: https://docs.github.com/en/actions
- Codecov Documentation: https://docs.codecov.io
- Snyk Documentation: https://docs.snyk.io