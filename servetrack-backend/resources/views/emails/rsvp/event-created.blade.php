<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New RSVP Event Created</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #e9ecef;">
            <div style="font-size: 24px; font-weight: bold; color: #007bff; margin-bottom: 10px;">{{ config('app.name') }}</div>
            <h1 style="font-size: 20px; font-weight: 600; color: #495057; margin: 0;">New RSVP Event Available</h1>
        </div>

        <div style="padding: 20px 0;">
            <p>Hi {{ $volunteer->first_name }},</p>

            <p>A new volunteer opportunity has been posted! We're excited to invite you to participate in
               <strong>{{ $rsvp->title }}</strong>.</p>

            <div style="background-color: #f8f9fa; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #212529;">Event Details:</h3>
                <div style="margin: 10px 0;">
                    <span style="font-weight: 600; color: #495057;">Event:</span> {{ $rsvp->title }}
                </div>
                <div style="margin: 10px 0;">
                    <span style="font-weight: 600; color: #495057;">Date:</span> {{ $rsvp->date->format('F d, Y') }}
                </div>
                @if ($rsvp->event_location)
                <div style="margin: 10px 0;">
                    <span style="font-weight: 600; color: #495057;">Location:</span> {{ $rsvp->event_location }}
                </div>
                @endif
                <div style="margin: 10px 0;">
                    <span style="font-weight: 600; color: #495057;">RSVP Cutoff:</span> {{ $rsvp->cutoff_day->format('F d, Y') }} at {{ $rsvp->cutoff_time }}
                </div>
                @if ($rsvp->description)
                <div style="margin: 10px 0;">
                    <span style="font-weight: 600; color: #495057;">Description:</span><br>
                    {{ Str::limit($rsvp->description, 200) }}
                </div>
                @endif
            </div>

            <p>Please RSVP at your earliest convenience to secure your spot. Shifts are available on a
               first-come, first-served basis.</p>

            <div style="text-align: center;">
                <a href="{{ $rsvpUrl }}"
                   style="display: inline-block; background-color: #007bff; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 20px 0;">View & RSVP Now</a>
            </div>

            <p>If you have any questions or need assistance, please don't hesitate
               to contact our team.</p>

            <p>Thank you for your continued dedication to serving our community!</p>

            <p>Best regards,<br>
            The {{ config('app.name') }} Team</p>
        </div>

        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d;">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
