<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RSVP Event Auto-Closed</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h1 style="color: #dc3545; margin-bottom: 10px;">⚠️ RSVP Event Auto-Closed</h1>
        
        <p>Hello {{ $admin->first_name }},</p>
        
        <p>The following RSVP event has been automatically closed because the cutoff deadline has passed:</p>
        
        <div style="background-color: #fff; padding: 15px; border-radius: 4px; border-left: 4px solid #dc3545; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; color: #212529;">{{ $rsvp->title }}</h2>
            <p style="margin: 5px 0;"><strong>Event Date:</strong> {{ $rsvp->date->format('F d, Y') }}</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> {{ $rsvp->event_location ?? 'TBA' }}</p>
            <p style="margin: 5px 0;"><strong>Original Cutoff:</strong> {{ $rsvp->cutoff_day->format('F d, Y') }} at {{ \Carbon\Carbon::parse($rsvp->cutoff_time)->format('g:i A') }}</p>
            <p style="margin: 5px 0;"><strong>Closed At:</strong> {{ $rsvp->auto_closed_at->format('F d, Y g:i A') }}</p>
            <p style="margin: 5px 0;"><strong>Close Reason:</strong> {{ ucfirst($rsvp->auto_closed_reason ?? 'auto closed') }}</p>
        </div>
        
        <p>You can view and manage all RSVP events in the admin dashboard:</p>
        
        <a href="{{ $adminDashboardUrl }}" style="display: inline-block; background-color: #0d6efd; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View RSVP Events</a>
        
        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #6c757d; margin: 0;">
            This is an automated notification sent by the ServeTrack system. The event was automatically closed because the cutoff deadline passed.
        </p>
    </div>
</body>
</html>