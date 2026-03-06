# ServeTrack - Volunteer Management System

[![CI](https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/actions/workflows/ci.yml)
[![Gitleaks](https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/actions/workflows/gitleaks.yml)

A comprehensive volunteer management system designed for NLCOM (National League of Cities Operations & Management) to streamline volunteer coordination, event management, and activity tracking.

## 📋 Quick Links

- **[Product Requirements (PRD.md)](./PRD.md)** - Detailed requirements and architecture
- **[Quick Start Guide (GEMINI.md)](./GEMINI.md)** - Fast setup instructions
- **[Development Guidelines (AGENTS.md)](./AGENTS.md)** - Code standards and conventions
- **[CI/CD Documentation](./docs/CI_README.md)** - GitHub Actions workflow details
- **[Laravel + XAMPP Setup](./docs/LARAVEL_XAMPP_SETUP.md)** - Database connection guide

## 🏗️ Architecture

ServeTrack is a **monorepo** containing two main applications:

### Backend - Laravel 12 API
- **Location**: `servetrack-backend/`
- **Tech**: PHP 8.2+, Laravel 12, MySQL
- **Auth**: Laravel Sanctum v4
- **Testing**: Pest v3
- **Styling**: Tailwind CSS v4

### Frontend - Angular 21 SPA
- **Location**: `servetrack-frontend/`
- **Tech**: TypeScript 5.9+, Angular 21
- **Testing**: Vitest v4
- **Build**: Angular CLI

## 🚀 Quick Start

### Prerequisites

- **PHP** 8.2 or higher
- **Composer** 2.x
- **Node.js** 22.x
- **npm** 11.x
- **MySQL** 8.0 or higher

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system.git
   cd capstone-nlcom-volunteer-management-system
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Setup Backend**
   ```bash
   cd servetrack-backend
   composer install
   npm install
   cp .env.example .env
   php artisan key:generate
   php artisan migrate
   ```

4. **Setup Frontend**
   ```bash
   cd ../servetrack-frontend
   npm install
   ```

### Development

Run both applications concurrently:

**Terminal 1 - Backend:**
```bash
cd servetrack-backend
composer run dev  # Starts Laravel server, queue worker, and Vite
```

**Terminal 2 - Frontend:**
```bash
cd servetrack-frontend
npm start  # Starts Angular dev server at http://localhost:4200
```

The backend API runs at `http://localhost:8000`

## 🧪 Testing

### Run All Tests

**Frontend:**
```bash
cd servetrack-frontend
npm test
```

**Backend:**
```bash
cd servetrack-backend
php artisan test
```

### Code Quality

**Format Backend Code:**
```bash
cd servetrack-backend
./vendor/bin/pint
```

**Lint Backend (check only):**
```bash
npm run lint:backend
```

## 📦 Package Manager

This project uses **npm** as the standard package manager across all applications. Lock files (`package-lock.json` and `composer.lock`) are committed to ensure reproducible builds.

## 🔐 Security

- **Gitleaks**: Automatic secret scanning on every push
- **Laravel Sanctum**: Token-based API authentication
- **Dependency Review**: Automated vulnerability checks in PRs

## 🛠️ CI/CD

GitHub Actions automatically run tests on:
- Pull requests to `main`
- Pushes to `main` branch

The CI pipeline includes:
- Frontend testing (Angular + Vitest)
- Backend testing (Laravel + Pest)
- Code style checks (Laravel Pint)
- Dependency vulnerability scanning
- Secret leak detection

See [CI Documentation](./docs/CI_README.md) for details.

## 📚 Project Structure

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
│   └── package.json         # Node dependencies (Vite, Tailwind)
├── .github/workflows/        # CI/CD pipelines
├── docs/                     # Documentation
├── AGENTS.md                 # Development guidelines
├── GEMINI.md                 # Quick start guide
├── PRD.md                    # Product requirements
└── package.json              # Root dependencies (Husky, Gitleaks)
```

## 👥 Development Team

**Organization**: PUPT Quantum Leap
**Project**: Capstone Project for NLCOM

## 📝 License

[Add license information here]

## 🤝 Contributing

Please read [AGENTS.md](./AGENTS.md) for development guidelines and code standards before contributing.

### Development Workflow

1. Create a feature branch
2. Make your changes following the style guide
3. Write/update tests
4. Run linters and tests locally
5. Push and create a pull request
6. Wait for CI checks to pass
7. Request code review

## 📞 Support

For issues, questions, or contributions:
- **Issues**: [GitHub Issues](https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/issues)
- **Documentation**: See `PRD.md` and `AGENTS.md`

---

**Built with ❤️ by the PUPT Quantum Leap Team**
