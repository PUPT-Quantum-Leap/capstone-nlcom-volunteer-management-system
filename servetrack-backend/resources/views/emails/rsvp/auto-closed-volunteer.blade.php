<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your RSVP Event Has Closed</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h1 style="color: #198754; margin-bottom: 10px;">✅ Event Registration Closed</h1>
        
        <p>Hello {{ $volunteer->first_name }},</p>
        
        <p>The RSVP event you registered for has been automatically closed. Your registration is confirmed!</p>
        
        <div style="background-color: #fff; padding: 15px; border-radius: 4px; border-left: 4px solid #198754; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; color: #212529;">{{ $rsvp->title }}</h2>
            <p style="margin: 5px 0;"><strong>Event Date:</strong> {{ $rsvp->date->format('F d, Y') }}</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> {{ $rsvp->event_location ?? 'TBA' }}</p>
            <p style="margin: 5px 0;"><strong>Closed At:</strong> {{ $rsvp->auto_closed_at->format('F d, Y g:i A') }}</p>
        </div>
        
        <p>You can view your RSVP details:</p>
        
        <a href="{{ $rsvpUrl }}" style="display: inline-block; background-color: #198754; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View My RSVP</a>
        
        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #6c757d; margin: 0;">
            This is an automated notification from the ServeTrack system. The event cutoff has passed and your registration is now confirmed. Please arrive on time for your scheduled shift.
        </p>
    </div>
</body>
</html>