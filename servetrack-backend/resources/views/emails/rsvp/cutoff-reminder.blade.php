<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RSVP Cutoff Reminder</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
                     Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        .title {
            font-size: 20px;
            font-weight: 600;
            color: #495057;
            margin: 0;
        }
        .content {
            padding: 20px 0;
        }
        .reminder-box {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
        }
        .reminder-title {
            font-weight: bold;
            color: #856404;
            margin-bottom: 5px;
        }
        .event-details {
            background-color: #f8f9fa;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
        }
        .detail-row {
            margin: 10px 0;
        }
        .detail-label {
            font-weight: 600;
            color: #495057;
        }
        .cta-button {
            display: inline-block;
            background-color: #007bff;
            color: black;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            margin: 20px 0;
        }
        .cta-button:hover {
            background-color: #0056b3;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            font-size: 14px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">{{ config('app.name') }}</div>
            <h1 class="title">RSVP Cutoff Reminder</h1>
        </div>

        <div class="content">
            <p>Hi {{ $volunteer->first_name }},</p>

            <p>This is a friendly reminder that the RSVP cutoff for
               <strong>{{ $rsvp->title }}</strong> is approaching quickly.</p>

            <div class="reminder-box">
                <div class="reminder-title">⏰ Time Remaining: {{ $timeRemaining }}</div>
                <p>You have less than 24 hours to make any changes to your RSVP
                   before the cutoff deadline.</p>
            </div>

            <div class="event-details">
                <h3>Event Details:</h3>
                <div class="detail-row">
                    <span class="detail-label">Event:</span> {{ $rsvp->title }}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date:</span> {{ $eventDate }}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Location:</span> {{ $eventLocation }}
                </div>
                <div class="detail-row">
                    <span class="detail-label">RSVP Cutoff:</span> {{ $cutoffDateTime }}
                </div>
            </div>

            <p>If you need to modify your RSVP or change your time slot, please do so
               before the cutoff deadline. After this time, your RSVP will be
               finalized and no further changes will be permitted.</p>

            <div style="text-align: center;">
                <a href="{{ $rsvpUrl }}"
                   class="cta-button"
                   style="color: white !important;">Manage Your RSVP</a>
            </div>

            <p>If you have any questions or need assistance, please don't hesitate
               to contact our team.</p>

            <p>Thank you for your participation and dedication to serving our
               community!</p>

            <p>Best regards,<br>
            The {{ config('app.name') }} Team</p>
        </div>

        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>© {{ date('Y') }} {{ config('app.name') }}.
               All rights reserved.</p>
        </div>
    </div>
</body>
</html>
