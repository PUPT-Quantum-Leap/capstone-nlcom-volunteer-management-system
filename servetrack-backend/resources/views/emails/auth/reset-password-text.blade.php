Reset Your Password
===================

Hi {{ $user->name }},

We received a request to reset your password.

Click the link below to choose a new password (expires in {{ $expireMinutes }} minutes):

{{ $resetUrl }}

If you did not request a password reset, no further action is needed. Your account remains secure.

Best regards,
The {{ config('app.name') }} Team

--
This is an automated message. Please do not reply to this email.
&copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.
