<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h1 style="color: #2563eb; margin-bottom: 10px;">Reset Your Password</h1>

        <p>Hi {{ $user->name }},</p>

        <p>We received a request to reset the password for your admin account. Click the button below to choose a new password.</p>

        <div style="background-color: #fff; padding: 15px; border-radius: 4px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <p style="margin: 5px 0;">This password reset link will expire in <strong>{{ $expireMinutes }} minutes</strong>.</p>
        </div>

        <a href="{{ $resetUrl }}" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 10px 0 20px 0;">Reset Password</a>

        <p>If you did not request a password reset, no further action is needed. Your account remains secure.</p>

        <p>If you're having trouble clicking the button, copy and paste the URL below into your web browser:</p>

        <p style="background-color: #e9ecef; padding: 10px; border-radius: 4px; font-size: 12px; word-break: break-all;">{{ $resetUrl }}</p>

        <p>Best regards,<br>
        The {{ config('app.name') }} Team</p>

        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0 20px 0;">

        <p style="font-size: 12px; color: #6c757d; margin: 0;">
            This is an automated message. Please do not reply to this email.
        </p>
        <p style="font-size: 12px; color: #6c757d; margin: 5px 0 0 0;">
            &copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.
        </p>
    </div>
</body>
</html>
