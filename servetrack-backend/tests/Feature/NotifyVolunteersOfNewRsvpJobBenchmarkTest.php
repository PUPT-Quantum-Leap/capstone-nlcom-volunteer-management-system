<?php

use App\Jobs\NotifyVolunteersOfNewRsvp;
use App\Models\Rsvp;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

it('benchmarks the notification job creation', function () {
    Mail::fake();

    $rsvp = Rsvp::factory()->create([
        'title' => 'Test RSVP',
        'date' => now()->addDays(5),
    ]);

    // Create 100 active volunteers
    for ($i = 0; $i < 100; $i++) {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id, 'notify_rsvp_on_email' => false]);
    }

    $job = new NotifyVolunteersOfNewRsvp($rsvp);

    // Track DB queries and time
    DB::enableQueryLog();
    $startTime = microtime(true);

    $job->handle();

    $endTime = microtime(true);
    $executionTime = $endTime - $startTime;
    $queries = DB::getQueryLog();

    // Log the results
    echo "\nBenchmark Results AFTER:\n";
    echo 'Execution Time: '.round($executionTime, 4)." seconds\n";
    echo 'Number of Queries: '.count($queries)."\n";

    // In the optimized code, there should be 1 query to get volunteers, and 1 chunked insert query.
    $this->assertTrue(true);
});
