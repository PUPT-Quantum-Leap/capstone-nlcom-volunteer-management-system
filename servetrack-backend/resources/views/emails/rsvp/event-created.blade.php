<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New RSVP Event Created</title>
</head>
<body class="font-sans leading-relaxed text-gray-800 max-w-2xl mx-auto p-5 bg-gray-100">
    <div class="bg-white p-8 rounded-lg shadow-lg">
        <div class="text-center pb-5 border-b-2 border-gray-200">
            <div class="text-2xl font-bold text-blue-600 mb-2">{{ config('app.name') }}</div>
            <h1 class="text-xl font-semibold text-gray-700 m-0">New RSVP Event Available</h1>
        </div>

        <div class="py-5">
            <p>Hi {{ $volunteer->first_name }},</p>

            <p>A new volunteer opportunity has been posted! We're excited to invite you to participate in
               <strong>{{ $rsvp->title }}</strong>.</p>

            <div class="bg-gray-100 rounded-md p-4 my-5">
                <h3 class="mb-3 text-gray-900">Event Details:</h3>
                <div class="flex flex-col gap-3">
                    <div>
                        <span class="font-semibold text-gray-700">Event:</span> {{ $rsvp->title }}
                    </div>
                    <div>
                        <span class="font-semibold text-gray-700">Date:</span> {{ $rsvp->date->format('F d, Y') }}
                    </div>
                    @if ($rsvp->event_location)
                    <div>
                        <span class="font-semibold text-gray-700">Location:</span> {{ $rsvp->event_location }}
                    </div>
                    @endif
                    <div>
                        <span class="font-semibold text-gray-700">RSVP Cutoff:</span> {{ $rsvp->cutoff_day->format('F d, Y') }} at {{ $rsvp->cutoff_time }}
                    </div>
                    @if ($rsvp->description)
                    <div>
                        <span class="font-semibold text-gray-700">Description:</span><br>
                        {{ Str::limit($rsvp->description, 200) }}
                    </div>
                    @endif
                </div>
            </div>

            <p>Please RSVP at your earliest convenience to secure your spot. Shifts are available on a
               first-come, first-served basis.</p>

            <div class="text-center">
                <a href="{{ $rsvpUrl }}"
                   class="inline-block bg-blue-600 text-white px-6 py-3 no-underline rounded font-semibold my-5">View & RSVP Now</a>
            </div>

            <p>If you have any questions or need assistance, please don't hesitate
               to contact our team.</p>

            <p>Thank you for your continued dedication to serving our community!</p>

            <p>Best regards,<br>
            The {{ config('app.name') }} Team</p>
        </div>

        <div class="text-center pt-5 border-t border-gray-200 text-sm text-gray-600">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
