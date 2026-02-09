# ServeTrack - Volunteer Management System

**Project Type:** Full-Stack Web Application (Laravel + Angular)
**Organization:** NLCOM (National League of Cities Operations & Management)
**Documentation:** See `PRD.md` for detailed requirements and architecture.

## Project Overview

ServeTrack is a volunteer management system designed to streamline volunteer coordination, event management, and activity tracking. It consists of a secure RESTful API backend and a responsive Single-Page Application (SPA) frontend.

## Architecture

The project is divided into two main directories:

*   **`servetrack-backend/`**: Laravel 12 API.
    *   **Language:** PHP 8.2+
    *   **Framework:** Laravel 12
    *   **Authentication:** Laravel Sanctum v4
    *   **Database:** MySQL
    *   **Testing:** Pest v3
    *   **Styling (Views/Emails):** Tailwind CSS v4
*   **`servetrack-frontend/`**: Angular 21 SPA.
    *   **Language:** TypeScript 5.9+
    *   **Framework:** Angular 21
    *   **Build Tool:** Angular CLI
    *   **Testing:** Vitest v4 (via `ng test`)

## Getting Started

### Backend (`servetrack-backend/`)

1.  **Install PHP Dependencies:**
    ```bash
    composer install
    ```
2.  **Install Node Dependencies (for Vite/Tailwind):**
    ```bash
    npm install
    ```
3.  **Environment Setup:**
    ```bash
    cp .env.example .env
    php artisan key:generate
    ```
4.  **Database Setup:**
    *   Configure your database credentials in `.env`.
    *   Run migrations:
        ```bash
        php artisan migrate
        ```
5.  **Run Development Server:**
    ```bash
    # Runs Laravel server, Queue worker, and Vite concurrently
    composer run dev
    ```
    *   Or run individually: `php artisan serve`, `npm run dev`

### Frontend (`servetrack-frontend/`)

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Run Development Server:**
    ```bash
    ng serve
    ```
    *   Access the app at `http://localhost:4200`.

## Testing

*   **Backend:**
    ```bash
    php artisan test
    ```
*   **Frontend:**
    ```bash
    ng test
    ```

## Development Conventions

*   **Code Style:**
    *   **PHP:** Follows PSR-12 standards. Use `laravel/pint` for formatting.
    *   **TypeScript:** Follows standard Angular style guide.
*   **CSS:** Utility-first approach using Tailwind CSS v4.
*   **Version Control:** Git.
*   **Branching:** Follow standard git-flow or feature-branch workflows.
