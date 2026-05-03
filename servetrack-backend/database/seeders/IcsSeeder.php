<?php

namespace Database\Seeders;

use App\Models\Ics;
use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\Team;
use App\Models\TimeSlot;
use App\Models\Volunteer;
use Illuminate\Database\Seeder;

class IcsSeeder extends Seeder
{
    /**
     * Seed the ICS table with test data linked to RSVP events.
     */
    public function run(): void
    {
        // Get an existing RSVP or create one if none exists
        $rsvp = Rsvp::query()->first();

        if (! $rsvp) {
            $this->command->info('No RSVP found. Creating test RSVP...');

            // Create time slots first
            $timeSlot = TimeSlot::firstOrCreate(['text' => '8:00 AM - 12:00 PM']);

            // Create an RSVP with explicit cutoff time
            $rsvp = Rsvp::create([
                'title' => 'Community Feeding Program - Champorado',
                'description' => 'Mobile kitchen feeding program for 2400 people',
                'date' => now()->addWeek()->format('Y-m-d'),
                'event_location' => 'Metro Manila',
                'cutoff_day' => now()->addDays(4)->format('Y-m-d'),
                'cutoff_time' => '08:00:00',
                'status' => 'active',
                'share_url' => null,
                'slug' => Rsvp::generateUniqueSlug('Community Feeding Program - Champorado'),
            ]);

            // Attach time slot
            $rsvp->shifts()->attach($timeSlot->time_slot_id, [
                'time_slot' => '8:00 AM - 12:00 PM',
                'capacity' => 50,
            ]);

            $this->command->info("Created RSVP: {$rsvp->title} (ID: {$rsvp->rsvp_id})");

            // Get volunteers and create RSVP responses
            $volunteers = Volunteer::query()->limit(15)->get();

            foreach ($volunteers as $volunteer) {
                RsvpResponse::create([
                    'volunteer_id' => $volunteer->volunteer_id,
                    'rsvp_id' => $rsvp->rsvp_id,
                    'time_slot_id' => $timeSlot->time_slot_id,
                    'voted_at' => now(),
                    'sms_sent' => false,
                    'attendance_status' => 'registered',
                    'edit_count' => 0,
                    'initial_time_slot_id' => $timeSlot->time_slot_id,
                    'edit_history' => [],
                ]);
            }

            $this->command->info("Created {$volunteers->count()} RSVP responses.");
        } else {
            $this->command->info("Using existing RSVP: {$rsvp->title} (ID: {$rsvp->rsvp_id})");
        }

        // Create an ICS linked to this RSVP
        $ics = Ics::firstOrCreate(
            ['rsvp_id' => $rsvp->rsvp_id],
            [
                'name' => 'ICS-2400: Champorado Distribution',
                'description' => 'Mobile kitchen operation for feeding program',
                'date' => $rsvp->date,
                'location' => $rsvp->event_location ?? 'Manila Area',
                'status' => 'active',
            ]
        );

        $this->command->info("Created ICS: {$ics->name} (ID: {$ics->id})");

        // Attach teams to this ICS
        $teams = Team::query()->limit(5)->get();
        if ($teams->isEmpty()) {
            $this->command->warn('No teams found. Run TeamSeeder first.');

            return;
        }
        $ics->teams()->sync($teams->pluck('id'));
        $this->command->info("Attached {$teams->count()} teams to ICS.");

        // Get volunteers who RSVP'd and add them to ICS
        $rsvpResponses = $rsvp->responses()->with('volunteer')->limit(10)->get();
        $volunteerCount = 0;

        foreach ($rsvpResponses as $response) {
            if ($response->volunteer) {
                $team = $teams->random();

                $ics->volunteers()->syncWithoutDetaching([
                    $response->volunteer_id => [
                        'team_id' => $team->id,
                        'role' => $this->getRandomRole(),
                        'assigned_at' => now(),
                    ],
                ]);
                $volunteerCount++;
            }
        }

        $this->command->info("Added {$volunteerCount} volunteers to ICS from RSVP responses.");

        // Store AI suggestions as example
        $aiSuggestions = [];
        $volunteers = Volunteer::query()->limit(5)->get();

        foreach ($volunteers as $volunteer) {
            $aiSuggestions[] = [
                'volunteer_id' => $volunteer->volunteer_id,
                'volunteer_name' => $volunteer->first_name.' '.$volunteer->last_name,
                'team_id' => $teams->random()->id,
                'team_name' => $teams->random()->name,
                'role' => $this->getRandomRole(),
                'skills' => $volunteer->skills->pluck('name')->toArray(),
                'confidence' => rand(70, 95),
            ];
        }

        $ics->update(['ai_suggestions' => $aiSuggestions]);
        $this->command->info('Stored '.count($aiSuggestions).' AI suggestions example.');

        $this->command->info('ICS seeding completed successfully!');
    }

    private function getRandomRole(): string
    {
        $roles = [
            'Team Lead',
            'Medical Officer',
            'Communications Officer',
            'Logistics Officer',
            'Team Member',
            'Driver',
            'Coordinator',
            'Volunteer',
        ];

        return $roles[array_rand($roles)];
    }
}
