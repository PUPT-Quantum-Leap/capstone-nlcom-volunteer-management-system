<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Invited to Join {{ $appName }}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #4f46e5;
        }
        h1 {
            color: #1f2937;
            font-size: 24px;
            margin-bottom: 20px;
        }
        .role-badge {
            display: inline-block;
            background-color: #4f46e5;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        .message {
            color: #4b5563;
            font-size: 16px;
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            background-color: #4f46e5;
            color: white;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
        }
        .button:hover {
            background-color: #4338ca;
        }
        .link-fallback {
            background-color: #f3f4f6;
            padding: 15px;
            border-radius: 6px;
            word-break: break-all;
            font-size: 14px;
            color: #6b7280;
            margin-top: 20px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #9ca3af;
            font-size: 14px;
        }
        .expiry-notice {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            margin: 20px 0;
            font-size: 14px;
            color: #92400e;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">{{ $appName }}</div>
        </div>

        <h1>You're Invited!</h1>

        <div style="text-align: center;">
            <span class="role-badge">{{ $roleLabel }} Access</span>
        </div>

        <p class="message">
            @if ($invitedBy)
                <strong>{{ $invitedBy }}</strong> has invited you to join <strong>{{ $appName }}</strong> as a {{ $roleLabel }}.
            @else
                You have been invited to join <strong>{{ $appName }}</strong> as a {{ $roleLabel }}.
            @endif
        </p>

        <p style="text-align: center;">
            <a href="{{ $inviteLink }}" class="button">Accept Invitation</a>
        </p>

        <div class="expiry-notice">
            <strong>Note:</strong> This invitation link will expire in 7 days.
        </div>

        <div class="link-fallback">
            <strong>Can't click the button?</strong><br>
            Copy and paste this link into your browser:<br>
            <a href="{{ $inviteLink }}" style="color: #4f46e5;">{{ $inviteLink }}</a>
        </div>

        <div class="footer">
            <p>If you did not expect this invitation, you can safely ignore this email.</p>
            <p>&copy; {{ date('Y') }} {{ $appName }}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
