# User Management Documentation

## Overview

This documentation covers the comprehensive user management system implemented in the ServeTrack volunteer management platform. The system provides full CRUD (Create, Read, Update, Delete) operations for user accounts with role-based permissions and soft delete functionality.

## Key Features

### User Management (CRUD)
- **Create**: Add new users with role assignment (admin, coordinator, volunteer)
- **Read**: View user details with comprehensive information display
- **Update**: Modify user information including roles and permissions
- **Delete**: Soft delete (archive) users for temporary removal
- **Restore**: Recover archived users when needed
- **Search**: Filter users by name, email, or role
- **Password Reset**: Secure password reset functionality

### Role-Based Permissions
- **Admin**: Full system access and management capabilities
- **Coordinator**: Volunteer management and reporting access
- **Volunteer**: Limited access for personal information and assigned tasks

## Technical Implementation

### Backend (Laravel 12)

#### UserController
- **Location**: `servetrack-backend/app/Http/Controllers/UserController.php`
- **Methods**:
  - `index()` - List all users with pagination
  - `store()` - Create new user with validation
  - `show()` - Display specific user details
  - `update()` - Modify user information
  - `destroy()` - Soft delete user
  - `resetPassword()` - Secure password reset

#### Models
- **User Model**: Extended with soft delete functionality
- **Database**: Added `deleted_at` column for soft delete support

#### API Routes
- `GET /api/users` - List users (paginated)
- `POST /api/users` - Create user
- `GET /api/users/{id}` - Get user details
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Soft delete user
- `POST /api/users/{id}/reset-password` - Reset password

### Frontend (Angular 21)

#### UserService
- **Location**: `servetrack-frontend/src/app/services/user.service.ts`
- **Functions**:
  - `getUsers()` - Fetch all users
  - `getUser(id)` - Get specific user
  - `createUser(user)` - Create new user
  - `updateUser(id, user)` - Update user
  - `deleteUser(id)` - Soft delete user
  - `resetPassword(id)` - Reset password

#### Admin Dashboard Integration
- **Location**: `servetrack-frontend/src/app/admin-dashboard/`
- **Features**:
  - User listing with search and filtering
  - Create/edit user forms with validation
  - Role-based badge display
  - Password reset functionality
  - Archive/restore operations

## User Interface Components

### User Listing
- **Pagination**: 5 users per page
- **Search**: Real-time search by name or email
- **Filtering**: Role-based filtering (Admin, Coordinator, Volunteer)
- **Status Indicators**: Active/archived status badges
- **Actions**: Edit, reset password, archive/restore buttons

### User Management Forms
- **Validation**: Comprehensive form validation
- **Role Assignment**: Dropdown for role selection
- **Password Fields**: Secure password handling
- **Error States**: User-friendly error messages

### Password Reset
- **Token-based**: Secure password reset tokens
- **Email Notification**: (Future enhancement)
- **Confirmation**: Success feedback to users

## Database Schema

### Users Table
- **id**: Primary key
- **name**: User's full name
- **email**: Unique email address
- **password**: Hashed password
- **role**: Enum (admin, coordinator, volunteer)
- **deleted_at**: Soft delete timestamp
- **created_at**: Creation timestamp
- **updated_at**: Last update timestamp

### Relationships
- **Volunteers**: One-to-one relationship with volunteer records
- **Notifications**: One-to-many relationship with notifications

## Security Features

### Authentication
- **JWT Tokens**: Secure API authentication
- **Role-based Access**: Permission control based on user roles
- **Input Validation**: Server-side validation for all operations

### Data Protection
- **Password Hashing**: bcrypt password storage
- **SQL Injection Prevention**: Eloquent ORM protection
- **XSS Protection**: Frontend template sanitization
- **CSRF Protection**: Laravel's built-in CSRF protection

## Testing

### Backend Testing
- **UserControllerTest**: Comprehensive feature tests
- **80%+ Code Coverage**: Maintained test coverage
- **Factory-based Tests**: Realistic test data generation
- **Database Transactions**: Test isolation

### Frontend Testing
- **Component Tests**: Admin dashboard user management
- **Service Tests**: UserService functionality
- **Integration Tests**: User management workflows

## Performance Considerations

### Optimization
- **Pagination**: Efficient data loading for large user bases
- **Eager Loading**: Prevent N+1 query problems
- **Database Indexing**: Optimized search performance
- **Caching**: Potential for response caching

### Scalability
- **Database Design**: Normalized schema for performance
- **API Design**: RESTful patterns for scalability
- **Frontend Architecture**: Component-based for maintainability

## Usage Instructions

### Admin Dashboard Access
1. Navigate to Admin Dashboard
2. Select "User Management" from sidebar
3. Use search/filter to find specific users
4. Click "Create User" to add new users
5. Use action buttons for edit, reset password, or archive

### API Usage
```bash
# List users
GET /api/users?page=1

# Create user
POST /api/users
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "role": "volunteer"
}

# Reset password
POST /api/users/1/reset-password
```

## Error Handling

### Common Errors
- **Validation Errors**: 422 Unprocessable Entity
- **Authentication Errors**: 401 Unauthorized
- **Authorization Errors**: 403 Forbidden
- **Resource Not Found**: 404 Not Found

### User Feedback
- **Success Messages**: Operation confirmation
- **Error Messages**: Clear error descriptions
- **Loading States**: Visual feedback during operations

## Future Enhancements

### Planned Features
- **Email Notifications**: User creation and password reset emails
- **Audit Trail**: User activity logging
- **Bulk Operations**: Batch user management
- **Advanced Filtering**: Custom filter combinations
- **Export Functionality**: User data export

### Security Improvements
- **Rate Limiting**: API request throttling
- **Two-Factor Authentication**: Enhanced security
- **Session Management**: Improved session handling

## Deployment Notes

### Requirements
- **PHP 8.2+**: Laravel backend requirements
- **Angular 21+**: Frontend framework
- **MySQL 8.0+**: Database requirements
- **Node.js 18+**: Frontend build tools

### Migration
- **Database Schema**: Migration files included
- **API Compatibility**: No breaking changes
- **Frontend Integration**: Seamless dashboard integration

## Quality Assurance

### Code Standards
- **PSR-12**: PHP coding standards
- **Angular Style Guide**: Frontend best practices
- **TypeScript**: Strict typing throughout
- **Documentation**: Comprehensive inline comments

### Accessibility
- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG compliance
- **Responsive Design**: Mobile-friendly interface

## Related Documentation

- [API Documentation](/docs/api.md)
- [Frontend Architecture](/docs/frontend.md)
- [Database Schema](/docs/database.md)
- [Testing Guidelines](/docs/testing.md)
- [Security Hardening](/docs/security-hardening-plan.md)

---

*Last Updated: March 2026*
*Version: 1.0.0*