<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/seed-test-voter', function () {
    try {
        // 1. Clean up yaskyeria@gmail.com and onlyyaskyeria@gmail.com users and volunteers
        foreach (['yaskyeria@gmail.com', 'onlyyaskyeria@gmail.com'] as $email) {
            $user = App\Models\User::where('email', $email)->first();
            if ($user) {
                // Delete volunteer profile related to user
                App\Models\Volunteer::where('user_id', $user->id)->forceDelete();
                $user->forceDelete();
            }

            // Delete volunteer by email just in case
            App\Models\Volunteer::where('email', $email)->forceDelete();
        }

        // 2. Create a clean test RSVP active today
        $rsvp = App\Models\Rsvp::firstOrCreate(
            ['title' => 'Active Outreach Today'],
            [
                'description' => 'Active outreach event open today for testing.',
                'date' => now()->toDateString(),
                'event_location' => 'Main Community Hall',
                'cutoff_day' => now()->toDateString(),
                'cutoff_time' => '23:59:59',
                'status' => 'active',
                'slug' => App\Models\Rsvp::generateUniqueSlug('Active Outreach Today'),
                'share_url' => 'http://localhost:4200/rsvp/active-outreach-today',
            ]
        );

        // Ensure at least one shift exists
        if ($rsvp->shifts()->count() === 0) {
            $timeSlot = App\Models\TimeSlot::firstOrCreate(['text' => '8:00 AM - 12:00 PM']);
            $rsvp->shifts()->attach($timeSlot->time_slot_id, [
                'time_slot' => '8:00 AM - 12:00 PM',
                'capacity' => 10,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Cleaned up test accounts and seeded "Active Outreach Today" event successfully!',
            'rsvp' => $rsvp,
        ]);
    } catch (Exception $e) {
        return response()->json([
            'success' => false,
            'message' => $e->getMessage(),
        ], 500);
    }
});
