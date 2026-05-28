<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ServeTrack Announcement</title>
</head>
<body class="font-sans leading-relaxed text-gray-800 max-w-2xl mx-auto p-5 bg-gray-100">
    <div class="bg-white p-8 rounded-lg shadow-lg">
        <div class="text-center pb-5 border-b-2 border-gray-200">
            <div class="text-2xl font-bold text-blue-600 mb-2">{{ config('app.name') }}</div>
            <h1 class="text-xl font-semibold text-gray-700 m-0">Important Announcement</h1>
        </div>

        <div class="py-5">
            <p>Hi {{ $volunteer->first_name }},</p>

            <div class="my-5 text-gray-800 text-base whitespace-pre-line leading-relaxed">
                {{ $messageBody }}
            </div>

            @if ($rsvp)
            <div class="bg-gray-100 rounded-md p-4 my-5 border-l-4 border-blue-500">
                <h3 class="mb-3 text-gray-900 font-semibold">Related RSVP Event Details:</h3>
                <div class="flex flex-col gap-3">
                    <div>
                        <span class="font-semibold text-gray-700">Event:</span> {{ $rsvp->title }}
                    </div>
                    <div>
                        <span class="font-semibold text-gray-700">Date:</span> {{ $rsvp->date ? $rsvp->date->format('F d, Y') : '' }}
                    </div>
                    @if ($rsvp->event_location)
                    <div>
                        <span class="font-semibold text-gray-700">Location:</span> {{ $rsvp->event_location }}
                    </div>
                    @endif
                </div>
                <div class="text-center mt-4">
                    <a href="{{ config('app.frontend_url') }}/rsvp/{{ $rsvp->slug }}"
                       class="inline-block bg-blue-600 text-white px-5 py-2.5 no-underline rounded font-semibold text-sm">View RSVP Event</a>
                </div>
            </div>
            @endif

            <p>If you have any questions or need assistance, please don't hesitate to reach out.</p>

            <p>Thank you for your service and dedication to our community!</p>

            <p>Best regards,<br>
            The {{ config('app.name') }} Team</p>
        </div>

        <div class="text-center pt-5 border-t border-gray-200 text-sm text-gray-600">
            <p>This is an automated message sent via ServeTrack. Please do not reply directly to this email.</p>
            <p>&copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
