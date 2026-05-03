<?php

namespace Database\Seeders;

use App\Models\Team;
use Illuminate\Database\Seeder;

class TeamSeeder extends Seeder
{
    /**
     * Seed the teams table with ICS operational teams.
     */
    public function run(): void
    {
        $teams = [
            'Command Team',
            'Operations Team',
            'Planning Team',
            'Logistics Team',
            'Medical Team',
            'Communications Team',
            'Safety & Emergency Team',
            'Mobile Kitchen Team',
            'AM Distribution Team',
            'PM Distribution Team',
            'Support Team',
            'Volunteer Care Team',
            'Inventory Team',
            'Food Prep Team',
            'Wash & Clean Up Team',
        ];

        foreach ($teams as $name) {
            Team::firstOrCreate(['name' => $name]);
        }

        $this->command->info('Created '.count($teams).' teams.');
    }
}
