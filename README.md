# ServeTrack - Volunteer Management System

[![CI](https://img.shields.io/badge/CI-Passing-green?style=flat-square)](https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/actions/workflows/ci.yml)
[![Gitleaks](https://img.shields.io/badge/Security-Secure-blue?style=flat-square)](https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/actions/workflows/gitleaks.yml)
[![PHP](https://img.shields.io/badge/PHP-8.2+-8892BF?style=flat-square)](https://www.php.net/)
[![Laravel](https://img.shields.io/badge/Laravel-12-FF2D20?style=flat-square)](https://laravel.com/)
[![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=flat-square)](https://angular.io/)
[![Pest](https://img.shields.io/badge/Testing-Pest%20v3-8D8387?style=flat-square)](https://pestphp.com/)

---

<div align="center">

[![Frontend](https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular&logoColor=white)](./servetrack-frontend/)
[![Backend](https://img.shields.io/badge/Laravel-12-FF2D20?style=flat-square&logo=laravel&logoColor=white)](./servetrack-backend/)

A volunteer management system designed for NLCOM (National League of Cities Operations & Management) to coordinate volunteers, manage events, and track activities.

| Documentation | Description |
|---------------|-------------|
| [Product Requirements](./PRD.md) | Detailed requirements and architecture |
| [Quick Start Guide](./GEMINI.md) | Fast setup instructions |
| [Development Guidelines](./AGENTS.md) | Code standards and conventions |
| [CI/CD Documentation](./docs/CI_README.md) | GitHub Actions workflow details |
| [Laravel Setup Guide](./docs/LARAVEL_XAMPP_SETUP.md) | Database connection instructions |

</div>

---

## Architecture

ServeTrack is a monorepo containing two main applications:

### Backend

**Location:** `servetrack-backend/`

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Laravel | 12 |
| PHP | PHP | 8.2+ |
| Database | MySQL | 8.0+ |
| Authentication | Laravel Sanctum | 4 |
| Testing | Pest | 3 |
| Build Tool | Vite | - |
| Styling | Tailwind CSS | 4 |

### Frontend

**Location:** `servetrack-frontend/`

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Angular | 21 |
| TypeScript | TypeScript | 5.9+ |
| Build Tool | Angular CLI | - |
| Testing | Vitest | 4 |
| State Management | Signals | - |
| Styling | Tailwind CSS | 3/4 |

---

## Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| PHP | 8.2+ |
| Composer | 2.x |
| Node.js | 22.x |
| npm | 11.x |
| MySQL | 8.0+ |

### Installation

```bash
# Clone repository
git clone https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system.git
cd capstone-nlcom-volunteer-management-system

# Install root dependencies
npm install

# Setup backend
cd servetrack-backend
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate

# Setup frontend
cd ../servetrack-frontend
npm install
```

### Development

```bash
# Terminal 1 - Backend
cd servetrack-backend
composer run dev

# Terminal 2 - Frontend
cd servetrack-frontend
npm start
```

API runs at `http://localhost:8000`, frontend at `http://localhost:4200`

---

## Testing

```bash
# Frontend tests
cd servetrack-frontend
npm test

# Backend tests
cd servetrack-backend
php artisan test
```

### Code Quality

```bash
# Format backend code
cd servetrack-backend
./vendor/bin/pint
./vendor/bin/pint --dirty

# Lint backend (check only)
npm run lint:backend
```

---

## Package Manager

This project uses npm as the standard package manager across all applications. Lock files (`package-lock.json` and `composer.lock`) are committed for reproducible builds.

---

## Security

| Feature | Status |
|---------|--------|
| Gitleaks | Automatic secret scanning on every push |
| Laravel Sanctum | Token-based API authentication |
| Dependency Review | Automated vulnerability checks in PRs |

---

## CI/CD

GitHub Actions automatically runs tests on pull requests to `main` and pushes to `main`.

### Pipeline Stages

1. Frontend testing (Angular + Vitest)
2. Backend testing (Laravel + Pest)
3. Code style checks (Laravel Pint)
4. Dependency vulnerability scanning
5. Secret leak detection

See [CI Documentation](./docs/CI_README.md) for details.

---

## Project Structure

```
capstone-nlcom-volunteer-management-system/
├── servetrack-frontend/      # Angular 21 SPA
│   ├── src/app/             # Application code
│   ├── angular.json         # Angular configuration
│   └── package.json         # Frontend dependencies
├── servetrack-backend/       # Laravel 12 API
│   ├── app/                 # Laravel application
│   ├── database/            # Migrations, seeders, factories
│   ├── routes/              # API routes
│   ├── composer.json        # PHP dependencies
│   └── package.json         # Node dependencies
├── .github/workflows/        # CI/CD pipelines
├── docs/                     # Documentation
├── AGENTS.md                 # Development guidelines
├── GEMINI.md                 # Quick start guide
├── PRD.md                    # Product requirements
└── package.json              # Root dependencies
```

---

## Development Team

<div align="center">

<table>
  <tr>
    <td align="center" width="33.33%">
      <a href="https://github.com/PUPT-Quantum-Leap">
        <img src="https://github.com/PUPT-Quantum-Leap.png" width="100px;" alt="PUPT Quantum Leap"/><br />
      </a>
      <sub><b>PUPT Quantum Leap</b></sub><br />
      <sup>Organization</sup>
    </td>
    <td align="center" width="33.33%">
      <a href="https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system">
        <img src="https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system.png" width="100px;" alt="ServeTrack Project"/><br />
      </a>
      <sub><b>Capstone Project</b></sub><br />
      <sup>NLCOM</sup>
    </td>
    <td align="center" width="33.33%">
      <a href="https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/issues">
        <img src="https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/issues.png" width="100px;" alt="Issues"/><br />
      </a>
      <sub><b>GitHub</b></sub><br />
      <sup>Repository</sup>
    </td>
  </tr>
</table>

</div>

---

## Contributing

Please read [AGENTS.md](./AGENTS.md) for development guidelines and code standards.

### Workflow

1. Create a feature branch
2. Make changes following the style guide
3. Write/update tests
4. Run linters and tests locally
5. Push and create a pull request
6. Wait for CI checks to pass
7. Request code review

---

## Support

For issues, questions, or contributions:

- **Issues:** [GitHub Issues](https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/issues)
- **Documentation:** See `PRD.md` and `AGENTS.md`

---

## Contributors

<div align="center">

Thanks to all the contributors who made this project possible:

<a href="https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system" width="600" />
</a>

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

</div>

---

**Built by the PUPT Quantum Leap Team**

[⬆ Back to Top](#-servetrack---volunteer-management-system)
