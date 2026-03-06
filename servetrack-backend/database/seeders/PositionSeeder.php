<?php

namespace Database\Seeders;

use App\Models\Position;
use Illuminate\Database\Seeder;

class PositionSeeder extends Seeder
{
    /**
     * Seed the position table with team assignments and volunteer deployment positions.
     */
    public function run(): void
    {
        $positions = [
            // Team assignments (Alpha, Bravo, etc.)
            'Alpha Team',
            'Bravo Team',
            'Charlie Team',
            'Delta Team',

            // Volunteer deployment preferences
            'Metro Sidewalk Sunday School (Teaching & Education)',
            'Mobile Kitchen Operations',
            'Relief Operations',
            'Safety and Emergency Response',
            'Medical Operations',
            'Psychological First Aid',
            'Transportation & Logistics Team',
            'Purchasing Team',
            'Individual & Corporate Partnerships',
            'Digital Marketing & Promotions',
            'Creatives (Video / Photos)',
            'Healing',
            'Real Estate & Sports',
            'Anything kitchen-related',
            'Wherever is needed',
            "Don't know yet",
        ];

        foreach ($positions as $name) {
            Position::firstOrCreate(['name' => $name]);
        }
    }
}
