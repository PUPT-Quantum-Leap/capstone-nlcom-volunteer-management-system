<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class IcsTeamSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $operations = [
            // TEAM ALPHA
            [
                'team' => 'TEAM ALPHA',
                'departure_note' => 'NL Las Pinas Leaves base at 7:30am',
                'location' => 'Golden Acres (Talon 1)',
                'time' => '8:00am - 9:30am',
                'no_of_pax' => 100,
                'details' => 'Team Alpha: drop off GA team before proceeding to VP. GA team to wait after feeding for pick up.',
            ],
            [
                'team' => 'TEAM ALPHA',
                'departure_note' => 'NL Las Pinas Leaves base at 7:30am',
                'location' => 'Villa Pangarap (Talon 5)',
                'time' => '8:00am - 9:30am',
                'no_of_pax' => 150,
                'details' => 'Team Alpha: Park vehicle in VP. After feeding, pick up GA team and go directly to Annex.',
            ],
            [
                'team' => 'TEAM ALPHA',
                'departure_note' => 'NL Las Pinas Leaves base at 7:30am',
                'location' => 'Annex (Talon 5)',
                'time' => '09:00am-12:00n',
                'no_of_pax' => 150,
                'details' => 'Team Alpha: Whole team will proceed to Annex after the 2 sites before heading back to base.',
            ],
            // TEAM BRAVO
            [
                'team' => 'TEAM BRAVO',
                'departure_note' => 'Tondo AM Leave base at 7:30am',
                'location' => 'Market 3',
                'time' => '8:30am - 10:00am',
                'no_of_pax' => 200,
                'details' => 'Team Bravo: Whole team to proceed to M3 until feeding. The same team will be going to the second site (NBBN) after M3 before heading back to base.',
            ],
            [
                'team' => 'TEAM BRAVO',
                'departure_note' => 'Tondo AM Leave base at 7:30am',
                'location' => 'NBBN',
                'time' => '11:00am - 12:30pm',
                'no_of_pax' => 170,
                'details' => 'Team Bravo: NBBN site operations',
            ],
            // TEAM CHARLIE
            [
                'team' => 'TEAM CHARLIE',
                'departure_note' => 'GIAWH AM Leaves base at 8:30am',
                'location' => 'Masville',
                'time' => '09:00am-12:00nn',
                'no_of_pax' => 350,
                'details' => 'Team Charlie1: whole team to proceed to Masville',
            ],
            [
                'team' => 'TEAM CHARLIE',
                'departure_note' => 'GIAWH AM Leaves base at 8:30am',
                'location' => 'Banal',
                'time' => '09:00am-10:30am',
                'no_of_pax' => 250,
                'details' => 'Team Charlie2: whole team to proceed to Banal',
            ],
            // TEAM DELTA
            [
                'team' => 'TEAM DELTA',
                'departure_note' => 'GIAWH PM Leaves base at 2:00pm',
                'location' => 'Sitio Pagkakaisa Zone',
                'time' => '2:00pm-3:30pm',
                'no_of_pax' => 300,
                'details' => 'Team Delta1: whole team to transport food via pedicab to reach Sitio Pagkakaisa',
            ],
            [
                'team' => 'TEAM DELTA',
                'departure_note' => 'GIAWH PM Leaves base at 2:00pm',
                'location' => 'Sucat Highway',
                'time' => '3:30pm-4:30pm',
                'no_of_pax' => 300,
                'details' => 'Team Delta2: whole team to proceed to Sucat Highway',
            ],
            // TEAM ECHO
            [
                'team' => 'TEAM ECHO',
                'departure_note' => 'Tondo PM Leaves base at 2:00pm',
                'location' => 'Delpan',
                'time' => '3:30pm-4:30pm',
                'no_of_pax' => 220,
                'details' => 'Team Echo: whole team to proceed to Delpan',
            ],
            // TEAM FOXTROT
            [
                'team' => 'TEAM FOXTROT',
                'departure_note' => 'NL Muntinlupa Leaves New Life at 2:00pm',
                'location' => 'Paraiso (Alabang)',
                'time' => '2:00pm - 4:00pm',
                'no_of_pax' => 100,
                'details' => 'Team Foxtrot: drop off Paraiso team before proceeding to Sunrise. Paraiso to wait after feeding for pick up',
            ],
            [
                'team' => 'TEAM FOXTROT',
                'departure_note' => 'NL Muntinlupa Leaves New Life at 2:00pm',
                'location' => 'Sunrise (Bayananan)',
                'time' => '2:00pm - 4:00pm',
                'no_of_pax' => 100,
                'details' => 'Team Foxtrot: Park vehicle in Sunrise. After feeding, pick up Paraiso team and head back to base.',
            ],
        ];

        foreach ($operations as $operation) {
            \App\Models\IcsTeam::create($operation);
        }
    }
}
