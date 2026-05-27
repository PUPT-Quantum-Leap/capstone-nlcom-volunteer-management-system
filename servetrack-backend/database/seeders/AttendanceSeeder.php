<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Location;
use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\TimeSlot;
use App\Models\User;
use App\Models\Volunteer;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AttendanceSeeder extends Seeder
{
    /**
     * Seed realistic attendance history data.
     *
     * Creates locations, RSVPs (events), RSVP responses, and attendance
     * records for existing volunteers so that the Attendance History view
     * has meaningful data to display.
     */
    public function run(): void
    {
        $volunteers = Volunteer::all();
        if ($volunteers->isEmpty()) {
            $this->command?->warn('No volunteers found. Run VolunteerSeeder first. Skipping AttendanceSeeder.');

            return;
        }

        // Find an admin user to use as created_by, or null
        $adminUser = User::where('role', 'admin')->first();

        DB::transaction(function () use ($volunteers, $adminUser): void {
            $locations = $this->seedLocations();
            $timeSlots = $this->seedTimeSlots();
            $events = $this->seedEvents($locations, $timeSlots);

            $this->seedAttendanceRecords($volunteers, $events, $timeSlots, $adminUser);
        });

        $this->command?->info('Attendance history seeded successfully.');
    }

    /**
     * Create a set of realistic event locations.
     *
     * @return \Illuminate\Support\Collection<int, Location>
     */
    private function seedLocations(): \Illuminate\Support\Collection
    {
        $locationData = [
            [
                'name' => 'NLCOM Relief Center',
                'address' => '123 Relief Avenue',
                'city' => 'Manila',
                'state' => 'Metro Manila',
                'zip_code' => '1000',
                'country' => 'Philippines',
                'latitude' => 14.5995,
                'longitude' => 120.9842,
                'description' => 'Primary relief operations center',
                'contact_person' => 'Admin Office',
                'contact_phone' => '09171234567',
                'is_active' => true,
            ],
            [
                'name' => 'Mobile Kitchen Base',
                'address' => '456 Kitchen Road',
                'city' => 'Quezon City',
                'state' => 'Metro Manila',
                'zip_code' => '1100',
                'country' => 'Philippines',
                'latitude' => 14.6760,
                'longitude' => 121.0437,
                'description' => 'Mobile kitchen staging and preparation area',
                'contact_person' => 'Kitchen Coordinator',
                'contact_phone' => '09182345678',
                'is_active' => true,
            ],
            [
                'name' => 'Community Outreach Hub',
                'address' => '789 Outreach Street',
                'city' => 'Pasig',
                'state' => 'Metro Manila',
                'zip_code' => '1600',
                'country' => 'Philippines',
                'latitude' => 14.5764,
                'longitude' => 121.0851,
                'description' => 'Community center for outreach activities',
                'contact_person' => 'Outreach Lead',
                'contact_phone' => '09193456789',
                'is_active' => true,
            ],
            [
                'name' => 'Disaster Response Staging Area',
                'address' => '321 Emergency Lane',
                'city' => 'Marikina',
                'state' => 'Metro Manila',
                'zip_code' => '1800',
                'country' => 'Philippines',
                'latitude' => 14.6507,
                'longitude' => 121.1029,
                'description' => 'Disaster response and emergency operations staging',
                'contact_person' => 'Emergency Coordinator',
                'contact_phone' => '09204567890',
                'is_active' => true,
            ],
            [
                'name' => 'Training & Education Center',
                'address' => '654 Learning Boulevard',
                'city' => 'Makati',
                'state' => 'Metro Manila',
                'zip_code' => '1200',
                'country' => 'Philippines',
                'latitude' => 14.5547,
                'longitude' => 121.0244,
                'description' => 'Training facility for volunteer development',
                'contact_person' => 'Training Head',
                'contact_phone' => '09215678901',
                'is_active' => true,
            ],
        ];

        $locations = collect();
        foreach ($locationData as $data) {
            $locations->push(Location::firstOrCreate(
                ['name' => $data['name']],
                $data
            ));
        }

        return $locations;
    }

    /**
     * Create time slots used by RSVP events.
     *
     * @return \Illuminate\Support\Collection<int, TimeSlot>
     */
    private function seedTimeSlots(): \Illuminate\Support\Collection
    {
        $slots = [
            '6:00 AM - 10:00 AM',
            '8:00 AM - 12:00 PM',
            '9:00 AM - 1:00 PM',
            '10:00 AM - 2:00 PM',
            '1:00 PM - 5:00 PM',
            '2:00 PM - 6:00 PM',
        ];

        $timeSlots = collect();
        foreach ($slots as $text) {
            $timeSlots->push(TimeSlot::firstOrCreate(['text' => $text]));
        }

        return $timeSlots;
    }

    /**
     * Create RSVP events across the past several months.
     *
     * @param  \Illuminate\Support\Collection<int, Location>  $locations
     * @param  \Illuminate\Support\Collection<int, TimeSlot>  $timeSlots
     * @return array<int, array{rsvp: Rsvp, location: Location}>
     */
    private function seedEvents(\Illuminate\Support\Collection $locations, \Illuminate\Support\Collection $timeSlots): array
    {
        $eventTemplates = [
            [
                'title' => 'Mobile Kitchen Relief Operation',
                'description' => 'Providing hot meals and food supplies to communities in need through our mobile kitchen units.',
                'status' => 'closed',
            ],
            [
                'title' => 'Community Outreach Program',
                'description' => 'Community engagement and support services for underserved neighborhoods.',
                'status' => 'closed',
            ],
            [
                'title' => 'Emergency Response Training',
                'description' => 'Training session for volunteers on emergency response procedures and first aid.',
                'status' => 'closed',
            ],
            [
                'title' => 'Disaster Relief Distribution',
                'description' => 'Distribution of relief goods and supplies to disaster-affected families.',
                'status' => 'closed',
            ],
            [
                'title' => 'Fundraising Charity Event',
                'description' => 'Charity fundraising event to support ongoing relief operations and programs.',
                'status' => 'closed',
            ],
            [
                'title' => 'Medical Mission Outreach',
                'description' => 'Free medical consultations and health services for communities.',
                'status' => 'closed',
            ],
            [
                'title' => 'Volunteer Orientation Day',
                'description' => 'Orientation and onboarding session for new volunteers.',
                'status' => 'closed',
            ],
            [
                'title' => 'Sidewalk Sunday School',
                'description' => 'Educational program for children in Metro Manila communities.',
                'status' => 'closed',
            ],
            [
                'title' => 'Supply Packing & Logistics',
                'description' => 'Packing relief supplies and coordinating logistics for upcoming distributions.',
                'status' => 'closed',
            ],
            [
                'title' => 'Community Clean-up Drive',
                'description' => 'Environmental clean-up initiative in flood-prone areas.',
                'status' => 'closed',
            ],
            [
                'title' => 'Health and Wellness Fair',
                'description' => 'Community health fair with free screenings and wellness workshops.',
                'status' => 'closed',
            ],
            [
                'title' => 'Relief Goods Sorting',
                'description' => 'Sorting and organizing donated relief goods at the warehouse.',
                'status' => 'closed',
            ],
            [
                'title' => 'Youth Leadership Workshop',
                'description' => 'Leadership development workshop for young volunteers.',
                'status' => 'closed',
            ],
            [
                'title' => 'Feeding Program Operation',
                'description' => 'Weekly feeding program for malnourished children in urban poor communities.',
                'status' => 'active',
            ],
            [
                'title' => 'Volunteer Appreciation Day',
                'description' => 'Recognizing and celebrating volunteer contributions and milestones.',
                'status' => 'active',
            ],
        ];

        $events = [];
        $now = Carbon::now();

        foreach ($eventTemplates as $index => $template) {
            // Spread events over the past 6 months, with more recent events
            $daysAgo = match (true) {
                $index < 3 => rand(7, 30),       // Recent (1-4 weeks ago)
                $index < 6 => rand(31, 60),      // 1-2 months ago
                $index < 9 => rand(61, 90),      // 2-3 months ago
                $index < 12 => rand(91, 150),    // 3-5 months ago
                default => rand(0, 7),           // Upcoming / very recent
            };

            $eventDate = $now->copy()->subDays($daysAgo);
            $location = $locations->random();

            // Set cutoff to day before the event
            $cutoffDay = $eventDate->copy()->subDay();

            $rsvp = Rsvp::create([
                'title' => $template['title'],
                'description' => $template['description'],
                'date' => $eventDate->toDateString(),
                'event_location' => $location->name.', '.$location->city,
                'location_id' => $location->location_id,
                'cutoff_day' => $cutoffDay->toDateString(),
                'cutoff_time' => '23:59',
                'status' => $template['status'],
                'slug' => Rsvp::generateUniqueSlug($template['title']),
            ]);

            // Attach time slots to RSVP (pick 2-3 time slots randomly)
            $selectedSlots = $timeSlots->random(rand(2, min(3, $timeSlots->count())));
            foreach ($selectedSlots as $slot) {
                DB::table('rsvp_shift')->insert([
                    'rsvp_id' => $rsvp->rsvp_id,
                    'time_slot_id' => $slot->time_slot_id,
                    'time_slot' => $slot->text,
                    'capacity' => rand(10, 30),
                ]);
            }

            $events[] = [
                'rsvp' => $rsvp,
                'location' => $location,
                'slots' => $selectedSlots,
            ];
        }

        return $events;
    }

    /**
     * Create RSVP responses and attendance records for volunteers.
     *
     * @param  \Illuminate\Support\Collection<int, Volunteer>  $volunteers
     * @param  array<int, array{rsvp: Rsvp, location: Location, slots: \Illuminate\Support\Collection<int, TimeSlot>}>  $events
     * @param  \Illuminate\Support\Collection<int, TimeSlot>  $timeSlots
     */
    private function seedAttendanceRecords(
        \Illuminate\Support\Collection $volunteers,
        array $events,
        \Illuminate\Support\Collection $timeSlots,
        ?User $adminUser
    ): void {
        $totalVolunteers = $volunteers->count();

        // Each event should have 30-70% of volunteers participating
        foreach ($events as $eventData) {
            $rsvp = $eventData['rsvp'];
            $location = $eventData['location'];
            $eventSlots = $eventData['slots'];

            // Select a random subset of volunteers for this event
            $participantCount = (int) round($totalVolunteers * (rand(30, 70) / 100));
            $participants = $volunteers->random(min($participantCount, $totalVolunteers));

            foreach ($participants as $volunteer) {
                $slot = $eventSlots->random();

                // Create RSVP response
                $attendanceStatus = $this->randomAttendanceStatus();
                $checkedInAt = null;
                $checkedOutAt = null;
                $hours = 0;

                if ($attendanceStatus === 'checked_in' || $attendanceStatus === 'checked_out') {
                    $eventDateCarbon = Carbon::parse($rsvp->date);
                    $checkedInAt = $eventDateCarbon->copy()->setHour(rand(6, 10))->setMinute(rand(0, 59));

                    // Calculate hours from time slot text
                    $hours = $this->calculateHoursFromSlot($slot->text);
                    if ($hours === 0) {
                        $hours = rand(2, 6);
                    }

                    if ($attendanceStatus === 'checked_out') {
                        $checkedOutAt = $checkedInAt->copy()->addHours((int) $hours);
                    }
                }

                $rsvpResponse = RsvpResponse::create([
                    'volunteer_id' => $volunteer->volunteer_id,
                    'rsvp_id' => $rsvp->rsvp_id,
                    'time_slot_id' => $slot->time_slot_id,
                    'voted_at' => Carbon::parse($rsvp->date)->subDays(rand(1, 5)),
                    'sms_sent' => (bool) rand(0, 1),
                    'checked_in_at' => $checkedInAt,
                    'checked_out_at' => $checkedOutAt,
                    'attendance_status' => $attendanceStatus,
                    'edit_count' => 0,
                ]);

                // Create corresponding attendance record
                $attendanceDBStatus = match ($attendanceStatus) {
                    'checked_in', 'checked_out' => 'approved',
                    'no_show' => 'rejected',
                    default => 'pending',
                };

                // Descriptions matching the event context
                $description = $rsvp->title;

                Attendance::create([
                    'volunteer_id' => $volunteer->volunteer_id,
                    'date' => $rsvp->date,
                    'hours' => $attendanceDBStatus === 'approved' ? $hours : 0,
                    'description' => $description,
                    'location' => $location->name.', '.$location->city,
                    'location_id' => $location->location_id,
                    'rsvp_id' => $rsvp->rsvp_id,
                    'rsvp_response_id' => $rsvpResponse->rsvp_response_id,
                    'status' => $attendanceDBStatus,
                    'created_by' => $adminUser?->id,
                ]);
            }
        }
    }

    /**
     * Generate a weighted random attendance status.
     * Majority should be checked_out (completed), some checked_in, few no_show.
     */
    private function randomAttendanceStatus(): string
    {
        $roll = rand(1, 100);

        return match (true) {
            $roll <= 60 => 'checked_out',   // 60% fully attended
            $roll <= 80 => 'checked_in',    // 20% checked in (still present or forgot to check out)
            $roll <= 90 => 'no_show',       // 10% no show
            default => 'pending',           // 10% pending review
        };
    }

    /**
     * Parse hours from a time slot string like "8:00 AM - 12:00 PM".
     */
    private function calculateHoursFromSlot(string $text): int
    {
        if (! preg_match('/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i', $text, $matches)) {
            return 0;
        }

        try {
            $start = Carbon::parse($matches[1]);
            $end = Carbon::parse($matches[2]);

            return (int) round($start->diffInMinutes($end) / 60);
        } catch (\Throwable) {
            return 0;
        }
    }
}
