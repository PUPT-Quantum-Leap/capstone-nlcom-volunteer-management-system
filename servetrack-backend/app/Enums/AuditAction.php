<?php

namespace App\Enums;

enum AuditAction: string
{
    // Auth
    case AUTH_LOGIN = 'auth.login';
    case AUTH_LOGOUT = 'auth.logout';
    case AUTH_LOGIN_FAILED = 'auth.login_failed';
    case AUTH_PASSWORD_RESET = 'auth.password_reset';
    case AUTH_PASSWORD_CHANGED = 'auth.password_changed';

    // Volunteers
    case VOLUNTEER_CREATED = 'volunteer.created';
    case VOLUNTEER_UPDATED = 'volunteer.updated';
    case VOLUNTEER_DELETED = 'volunteer.deleted';
    case VOLUNTEER_ROLE_CHANGED = 'volunteer.role_changed';

    // RSVP
    case RSVP_CREATED = 'rsvp.created';
    case RSVP_UPDATED = 'rsvp.updated';
    case RSVP_CLOSED = 'rsvp.closed';
    case RSVP_DELETED = 'rsvp.deleted';
    case RSVP_VOTED = 'rsvp.voted';

    // Attendance
    case ATTENDANCE_CHECKED_IN = 'attendance.checked_in';
    case ATTENDANCE_CHECKED_OUT = 'attendance.checked_out';
    case ATTENDANCE_MARKED_NO_SHOW = 'attendance.no_show';
    case ATTENDANCE_MANUAL_OVERRIDE = 'attendance.manual_override';

    // ICS
    case ICS_VOLUNTEER_ASSIGNED = 'ics.volunteer_assigned';
    case ICS_VOLUNTEER_REMOVED = 'ics.volunteer_removed';
    case ICS_VOLUNTEER_MOVED = 'ics.volunteer_moved';
    case ICS_ROLE_UPDATED = 'ics.role_updated';
    case ICS_BRANCH_CREATED = 'ics.branch_created';
    case ICS_TEAM_CREATED = 'ics.team_created';

    // System / Backup
    case BACKUP_CREATED = 'backup.created';
    case BACKUP_RESTORED = 'backup.restored';
    case BACKUP_DELETED = 'backup.deleted';
    case BACKUP_DOWNLOADED = 'backup.downloaded';
    case SYSTEM_SETTINGS_CHANGED = 'system.settings_changed';

    // Audit meta
    case AUDIT_EXPORTED = 'audit.exported';

    /**
     * Get the category prefix (e.g. 'auth', 'volunteer', 'rsvp').
     */
    public function category(): string
    {
        return str($this->value)->before('.')->toString();
    }

    /**
     * Get the default severity for this action.
     */
    public function severity(): string
    {
        return match ($this) {
            self::AUTH_LOGIN_FAILED => 'warning',
            self::BACKUP_RESTORED,
            self::BACKUP_DELETED,
            self::VOLUNTEER_DELETED,
            self::RSVP_DELETED => 'critical',
            default => 'info',
        };
    }

    /**
     * Get a human-friendly label for UI display.
     */
    public function label(): string
    {
        return match ($this) {
            self::AUTH_LOGIN => 'User Login',
            self::AUTH_LOGOUT => 'User Logout',
            self::AUTH_LOGIN_FAILED => 'Failed Login Attempt',
            self::AUTH_PASSWORD_RESET => 'Password Reset',
            self::AUTH_PASSWORD_CHANGED => 'Password Changed',
            self::VOLUNTEER_CREATED => 'Volunteer Created',
            self::VOLUNTEER_UPDATED => 'Volunteer Updated',
            self::VOLUNTEER_DELETED => 'Volunteer Deleted',
            self::VOLUNTEER_ROLE_CHANGED => 'Volunteer Role Changed',
            self::RSVP_CREATED => 'RSVP Created',
            self::RSVP_UPDATED => 'RSVP Updated',
            self::RSVP_CLOSED => 'RSVP Closed',
            self::RSVP_DELETED => 'RSVP Deleted',
            self::RSVP_VOTED => 'RSVP Vote Submitted',
            self::ATTENDANCE_CHECKED_IN => 'Checked In',
            self::ATTENDANCE_CHECKED_OUT => 'Checked Out',
            self::ATTENDANCE_MARKED_NO_SHOW => 'Marked No Show',
            self::ATTENDANCE_MANUAL_OVERRIDE => 'Attendance Override',
            self::ICS_VOLUNTEER_ASSIGNED => 'Volunteer Assigned to Team',
            self::ICS_VOLUNTEER_REMOVED => 'Volunteer Removed from Team',
            self::ICS_VOLUNTEER_MOVED => 'Volunteer Moved Between Teams',
            self::ICS_ROLE_UPDATED => 'ICS Role Updated',
            self::ICS_BRANCH_CREATED => 'ICS Branch Created',
            self::ICS_TEAM_CREATED => 'ICS Team Created',
            self::BACKUP_CREATED => 'Backup Created',
            self::BACKUP_RESTORED => 'Backup Restored',
            self::BACKUP_DELETED => 'Backup Deleted',
            self::BACKUP_DOWNLOADED => 'Backup Downloaded',
            self::SYSTEM_SETTINGS_CHANGED => 'System Settings Changed',
            self::AUDIT_EXPORTED => 'Audit Log Exported',
        };
    }
}
