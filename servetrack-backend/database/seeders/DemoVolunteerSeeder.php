<?php

namespace Database\Seeders;

use App\Models\Availability;
use App\Models\Position;
use App\Models\Skill;
use App\Models\Training;
use App\Models\User;
use App\Models\Volunteer;
use Carbon\Carbon;
use Faker\Factory as Faker;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DemoVolunteerSeeder extends Seeder
{
    private \Faker\Generator $faker;

    public function __construct()
    {
        $this->faker = Faker::create();
    }

    private const FAKE_VOLUNTEERS = [
        ['first_name' => 'Juan', 'last_name' => 'Dela Cruz', 'skills' => ['Cooking', 'Food Prep', 'Team Leadership'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Anytime / On Call', 'training' => 'Food Safety & Handling'],
        ['first_name' => 'Maria', 'last_name' => 'Santos', 'skills' => ['Logistics', 'Driving', 'Inventory'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Weekends Only', 'training' => 'Logistics Management'],
        ['first_name' => 'Jose', 'last_name' => 'Reyes', 'skills' => ['Driving', 'Vehicle Maintenance', 'Navigation'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Defensive Driving'],
        ['first_name' => 'Ana', 'last_name' => 'Gonzales', 'skills' => ['Cooking', 'Baking', 'Menu Planning'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekends Only', 'training' => 'Commercial Kitchen Operations'],
        ['first_name' => 'Pedro', 'last_name' => 'Flores', 'skills' => ['First Aid', 'Emergency Response', 'Rescue'], 'position' => 'Safety and Emergency Response', 'availability' => 'Anytime / On Call', 'training' => 'Basic Life Support'],
        ['first_name' => 'Luisa', 'last_name' => 'Mendoza', 'skills' => ['Food Prep', 'Cooking', 'Sanitation'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekdays Only', 'training' => 'Kitchen Safety'],
        ['first_name' => 'Carlos', 'last_name' => 'Villar', 'skills' => ['Driving', 'Heavy Equipment', 'Logistics'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Forklift Operation'],
        ['first_name' => 'Elena', 'last_name' => 'Cruz', 'skills' => ['Team Leadership', 'Event Coordination', 'Communication'], 'position' => 'Purchasing Team', 'availability' => 'Weekends Only', 'training' => 'Project Management'],
        ['first_name' => 'Mark', 'last_name' => 'Dizon', 'skills' => ['Cooking', 'Grilling', 'Food Packaging'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Day Off', 'training' => 'Food Service Operations'],
        ['first_name' => 'Sofia', 'last_name' => 'Ramos', 'skills' => ['Inventory', 'Record Keeping', 'Data Entry'], 'position' => 'Relief Operations', 'availability' => 'Weekdays Only', 'training' => 'Inventory Management'],
        ['first_name' => 'Ben', 'last_name' => 'Torres', 'skills' => ['Heavy Lifting', 'Loading', 'Driving'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Warehouse Operations'],
        ['first_name' => 'Grace', 'last_name' => 'Lopez', 'skills' => ['Cooking', 'Meal Prep', 'Nutrition'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekends Only', 'training' => 'Nutrition and Diet'],
        ['first_name' => 'Rico', 'last_name' => 'Fernandez', 'skills' => ['Logistics', 'Route Planning', 'Driving'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Route Optimization'],
        ['first_name' => 'Tina', 'last_name' => 'Aguilar', 'skills' => ['Sanitation', 'Cleaning', 'Organization'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekdays Only', 'training' => 'WASH Training'],
        ['first_name' => 'Paul', 'last_name' => 'Garcia', 'skills' => ['Team Leadership', 'Communication', 'Conflict Resolution'], 'position' => 'Safety and Emergency Response', 'availability' => 'Anytime / On Call', 'training' => 'Incident Command System'],
        ['first_name' => 'Jean', 'last_name' => 'Martinez', 'skills' => ['Cooking', 'Baking', 'Food Styling'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekends Only', 'training' => 'Advanced Baking'],
        ['first_name' => 'Oscar', 'last_name' => 'Tan', 'skills' => ['Driving', 'Mechanics', 'Fleet Management'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Fleet Management'],
        ['first_name' => 'Nina', 'last_name' => 'Rosales', 'skills' => ['Food Prep', 'Knife Skills', 'Speed Cooking'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Day Off', 'training' => 'Commercial Cooking'],
        ['first_name' => 'Lito', 'last_name' => 'David', 'skills' => ['Heavy Lifting', 'Loading', 'Inventory'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Warehouse Safety'],
        ['first_name' => 'Maya', 'last_name' => 'Sison', 'skills' => ['Coordination', 'Communication', 'Scheduling'], 'position' => 'Relief Operations', 'availability' => 'Weekdays Only', 'training' => 'Operations Management'],
        ['first_name' => 'Ramon', 'last_name' => 'Castro', 'skills' => ['Driving', 'Customer Service', 'Route Planning'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Customer Service Excellence'],
        ['first_name' => 'Liza', 'last_name' => 'Valdez', 'skills' => ['Cooking', 'Food Safety', 'HACCP'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekends Only', 'training' => 'HACCP Certification'],
        ['first_name' => 'Tom', 'last_name' => 'Rivera', 'skills' => ['Logistics', 'Supply Chain', 'Procurement'], 'position' => 'Purchasing Team', 'availability' => 'Anytime / On Call', 'training' => 'Supply Chain Management'],
        ['first_name' => 'Angela', 'last_name' => 'Mercado', 'skills' => ['Cooking', 'Food Prep', 'Packaging'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekends Only', 'training' => 'Food Safety & Handling'],
        ['first_name' => 'Raffy', 'last_name' => 'Tulfo', 'skills' => ['First Aid', 'Rescue', 'Emergency Response'], 'position' => 'Safety and Emergency Response', 'availability' => 'Anytime / On Call', 'training' => 'Basic Life Support'],
        ['first_name' => 'Gina', 'last_name' => 'Loyola', 'skills' => ['Teaching', 'Child Care', 'Communication'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Child Development'],
        ['first_name' => 'Joel', 'last_name' => 'Cuyegkeng', 'skills' => ['Driving', 'Forklift', 'Loading'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Warehouse Operations'],
        ['first_name' => 'Ruby', 'last_name' => 'Gamboa', 'skills' => ['Medical Assessment', 'Vital Signs', 'Patient Care'], 'position' => 'Medical Operations', 'availability' => 'Weekdays Only', 'training' => 'Basic Life Support'],
        ['first_name' => 'Dennis', 'last_name' => 'Padilla', 'skills' => ['Cooking', 'Menu Planning', 'Inventory'], 'position' => 'Mobile Kitchen Operations;Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Commercial Kitchen Operations'],
        ['first_name' => 'Cynthia', 'last_name' => 'Villanueva', 'skills' => ['Digital Marketing', 'Social Media', 'Content Creation'], 'position' => 'Digital Marketing & Promotions', 'availability' => 'Weekends Only', 'training' => 'Social Media Management'],
        ['first_name' => 'Antonio', 'last_name' => 'Alcantara', 'skills' => ['Counseling', 'Active Listening', 'Crisis Intervention'], 'position' => 'Psychological First Aid', 'availability' => 'Anytime / On Call', 'training' => 'Psychological First Aid'],
        ['first_name' => 'Bella', 'last_name' => 'Manaloto', 'skills' => ['Fundraising', 'Partnership Building', 'Communication'], 'position' => 'Individual & Corporate Partnerships', 'availability' => 'Weekdays Only', 'training' => 'Partnership Management'],
        ['first_name' => 'Erwin', 'last_name' => 'Tolentino', 'skills' => ['Photography', 'Videography', 'Editing'], 'position' => 'Digital Marketing & Promotions', 'availability' => 'Weekends Only', 'training' => 'Multimedia Production'],
        ['first_name' => 'Diana', 'last_name' => 'Abad', 'skills' => ['Cooking', 'Baking', 'Food Styling'], 'position' => 'Mobile Kitchen Operations;Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Food Service Operations'],
        ['first_name' => 'Mario', 'last_name' => 'Sotto', 'skills' => ['Emergency Response', 'First Aid', 'Search and Rescue'], 'position' => 'Safety and Emergency Response;Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Incident Command System'],
        ['first_name' => 'Lorna', 'last_name' => 'Regalado', 'skills' => ['Teaching', 'Curriculum Development', 'Storytelling'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Child Development'],
        ['first_name' => 'Robert', 'last_name' => 'Castroverde', 'skills' => ['Logistics', 'Supply Chain', 'Sourcing'], 'position' => 'Purchasing Team', 'availability' => 'Anytime / On Call', 'training' => 'Supply Chain Management'],
        ['first_name' => 'Vivian', 'last_name' => 'Zulueta', 'skills' => ['Nursing', 'First Aid', 'Triage'], 'position' => 'Medical Operations;Relief Operations', 'availability' => 'Weekends Only', 'training' => 'Basic Life Support'],
        ['first_name' => 'Eddie', 'last_name' => 'Gutierrez', 'skills' => ['Driving', 'Navigation', 'Route Planning'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Defensive Driving'],
        ['first_name' => 'Nancy', 'last_name' => 'Ty', 'skills' => ['Cooking', 'Food Prep', 'Sanitation'], 'position' => 'Mobile Kitchen Operations;Relief Operations', 'availability' => 'Weekdays Only', 'training' => 'Kitchen Safety'],
        ['first_name' => 'Rolando', 'last_name' => 'Lazaro', 'skills' => ['Heavy Lifting', 'Warehouse', 'Inventory'], 'position' => 'Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Warehouse Safety'],
        ['first_name' => 'Faye', 'last_name' => 'Dela Vega', 'skills' => ['Social Media', 'Graphic Design', 'Writing'], 'position' => 'Digital Marketing & Promotions', 'availability' => 'Weekends Only', 'training' => 'Digital Marketing'],
        ['first_name' => 'Gilbert', 'last_name' => 'Soriano', 'skills' => ['Event Coordination', 'Logistics', 'Communication'], 'position' => 'Relief Operations;Purchasing Team', 'availability' => 'Anytime / On Call', 'training' => 'Operations Management'],
        ['first_name' => 'Hazel', 'last_name' => 'Paras', 'skills' => ['Counseling', 'Psychology', 'Active Listening'], 'position' => 'Psychological First Aid;Relief Operations', 'availability' => 'Weekdays Only', 'training' => 'Psychological First Aid'],
        ['first_name' => 'Isko', 'last_name' => 'Moreno', 'skills' => ['Team Leadership', 'Public Speaking', 'Organization'], 'position' => 'Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Project Management'],
        ['first_name' => 'Jenny', 'last_name' => 'Roxas', 'skills' => ['Cooking', 'Baking', 'Menu Planning'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekends Only', 'training' => 'Commercial Cooking'],
        ['first_name' => 'Kiko', 'last_name' => 'Pangilinan', 'skills' => ['Advocacy', 'Public Relations', 'Writing'], 'position' => 'Individual & Corporate Partnerships', 'availability' => 'Weekdays Only', 'training' => 'Partnership Management'],
        ['first_name' => 'Lea', 'last_name' => 'Salonga', 'skills' => ['Singing', 'Performing', 'Teaching'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Creative Arts'],
        ['first_name' => 'Manny', 'last_name' => 'Pacquiao', 'skills' => ['Fitness', 'Sports', 'Motivation'], 'position' => 'Safety and Emergency Response', 'availability' => 'Anytime / On Call', 'training' => 'Physical Fitness Training'],
        ['first_name' => 'Nora', 'last_name' => 'Aunor', 'skills' => ['Acting', 'Performing', 'Communication'], 'position' => 'Digital Marketing & Promotions', 'availability' => 'Weekends Only', 'training' => 'Creative Arts'],
        ['first_name' => 'Orly', 'last_name' => 'Mercado', 'skills' => ['Driving', 'Mechanics', 'Fleet Management'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Fleet Management'],
        ['first_name' => 'Pia', 'last_name' => 'Wurtzbach', 'skills' => ['Public Speaking', 'Advocacy', 'Communication'], 'position' => 'Individual & Corporate Partnerships', 'availability' => 'Weekends Only', 'training' => 'Public Relations'],
        ['first_name' => 'Quino', 'last_name' => 'Alcantara', 'skills' => ['Cooking', 'Grilling', 'Food Prep'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Day Off', 'training' => 'Food Service Operations'],
        ['first_name' => 'Risa', 'last_name' => 'Hontiveros', 'skills' => ['Advocacy', 'Research', 'Writing'], 'position' => 'Individual & Corporate Partnerships;Relief Operations', 'availability' => 'Weekdays Only', 'training' => 'Research and Advocacy'],
        ['first_name' => 'Sam', 'last_name' => 'Milby', 'skills' => ['Photography', 'Editing', 'Storytelling'], 'position' => 'Digital Marketing & Promotions', 'availability' => 'Weekends Only', 'training' => 'Multimedia Production'],
        ['first_name' => 'Toni', 'last_name' => 'Gonzaga', 'skills' => ['Hosting', 'Communication', 'Event Management'], 'position' => 'Relief Operations;Digital Marketing & Promotions', 'availability' => 'Anytime / On Call', 'training' => 'Event Management'],
        ['first_name' => 'Vilma', 'last_name' => 'Santos', 'skills' => ['Acting', 'Dancing', 'Choreography'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Creative Arts'],
        ['first_name' => 'Willy', 'last_name' => 'Revillame', 'skills' => ['Hosting', 'Entertainment', 'Crowd Engagement'], 'position' => 'Relief Operations', 'availability' => 'Weekends Only', 'training' => 'Public Engagement'],
        ['first_name' => 'Xyriel', 'last_name' => 'Manabat', 'skills' => ['Acting', 'Singing', 'Dancing'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Creative Arts'],
        ['first_name' => 'Yeng', 'last_name' => 'Constantino', 'skills' => ['Singing', 'Songwriting', 'Performing'], 'position' => 'Digital Marketing & Promotions', 'availability' => 'Anytime / On Call', 'training' => 'Music and Performance'],
        ['first_name' => 'Zsa Zsa', 'last_name' => 'Padilla', 'skills' => ['Fashion', 'Styling', 'Design'], 'position' => 'Digital Marketing & Promotions;Individual & Corporate Partnerships', 'availability' => 'Weekends Only', 'training' => 'Creative Design'],
        ['first_name' => 'Aaron', 'last_name' => 'Villaflor', 'skills' => ['Cooking', 'Pastry', 'Baking'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Anytime / On Call', 'training' => 'Advanced Baking'],
        ['first_name' => 'Bianca', 'last_name' => 'Umali', 'skills' => ['Journalism', 'Writing', 'Research'], 'position' => 'Digital Marketing & Promotions;Relief Operations', 'availability' => 'Weekdays Only', 'training' => 'Journalism and Communications'],
        ['first_name' => 'Coco', 'last_name' => 'Martin', 'skills' => ['Acting', 'Directing', 'Teaching'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Drama and Theater'],
        ['first_name' => 'Dimples', 'last_name' => 'Romana', 'skills' => ['Teaching', 'Child Care', 'Arts and Crafts'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education);Relief Operations', 'availability' => 'Weekends Only', 'training' => 'Child Development'],
        ['first_name' => 'Emilio', 'last_name' => 'Jacinto', 'skills' => ['Cooking', 'Food Safety', 'Team Leadership'], 'position' => 'Mobile Kitchen Operations;Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Food Safety & Handling'],
        ['first_name' => 'Francine', 'last_name' => 'Diaz', 'skills' => ['Nursing', 'Emergency Care', 'Triage'], 'position' => 'Medical Operations;Safety and Emergency Response', 'availability' => 'Weekends Only', 'training' => 'Advanced First Aid'],
        ['first_name' => 'Gabriel', 'last_name' => 'Toledo', 'skills' => ['Driving', 'Logistics', 'Warehouse'], 'position' => 'Transportation & Logistics Team;Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Logistics Management'],
        ['first_name' => 'Heart', 'last_name' => 'Evangelista', 'skills' => ['Design', 'Fashion', 'Creativity'], 'position' => 'Digital Marketing & Promotions', 'availability' => 'Weekends Only', 'training' => 'Creative Design'],
        ['first_name' => 'Iza', 'last_name' => 'Calzado', 'skills' => ['Counseling', 'Psychology', 'Active Listening'], 'position' => 'Psychological First Aid', 'availability' => 'Weekdays Only', 'training' => 'Mental Health First Aid'],
        ['first_name' => 'Jhun', 'last_name' => 'Reyes', 'skills' => ['Cooking', 'Grilling', 'Meat Preparation'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Anytime / On Call', 'training' => 'Commercial Kitchen Operations'],
        ['first_name' => 'Kris', 'last_name' => 'Aquino', 'skills' => ['Hosting', 'Communication', 'Fundraising'], 'position' => 'Individual & Corporate Partnerships;Relief Operations', 'availability' => 'Weekends Only', 'training' => 'Public Relations'],
        ['first_name' => 'Luis', 'last_name' => 'Manzano', 'skills' => ['Hosting', 'Event Coordination', 'Communication'], 'position' => 'Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Event Management'],
        ['first_name' => 'Megan', 'last_name' => 'Young', 'skills' => ['Teaching', 'Dance', 'Choreography'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Dance Instruction'],
        ['first_name' => 'Nonoy', 'last_name' => 'Zuñiga', 'skills' => ['Driving', 'Loading', 'Forklift'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Forklift Operation'],
        ['first_name' => 'Olivia', 'last_name' => 'Hidalgo', 'skills' => ['Medical Assessment', 'Pharmacy', 'Patient Care'], 'position' => 'Medical Operations', 'availability' => 'Weekdays Only', 'training' => 'Pharmacy Assistance'],
        ['first_name' => 'Paolo', 'last_name' => 'Abuel', 'skills' => ['First Aid', 'Rescue', 'Emergency Response'], 'position' => 'Safety and Emergency Response', 'availability' => 'Anytime / On Call', 'training' => 'Basic Life Support'],
        ['first_name' => 'Queenie', 'last_name' => 'Padilla', 'skills' => ['Cooking', 'Baking', 'Menu Planning'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekends Only', 'training' => 'Nutrition and Diet'],
        ['first_name' => 'Ramon', 'last_name' => 'Bautista', 'skills' => ['Logistics', 'Inventory', 'Sourcing'], 'position' => 'Purchasing Team;Relief Operations', 'availability' => 'Weekdays Only', 'training' => 'Supply Chain Management'],
        ['first_name' => 'Sarah', 'last_name' => 'Geronimo', 'skills' => ['Singing', 'Performing', 'Teaching'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Music Education'],
        ['first_name' => 'Tito', 'last_name' => 'Sotto', 'skills' => ['Communication', 'Public Speaking', 'Leadership'], 'position' => 'Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Public Speaking'],
        ['first_name' => 'Ubby', 'last_name' => 'Quintos', 'skills' => ['Cooking', 'Food Prep', 'Sanitation'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Day Off', 'training' => 'Kitchen Safety'],
        ['first_name' => 'Vince', 'last_name' => 'Velasco', 'skills' => ['Photography', 'Videography', 'Editing'], 'position' => 'Digital Marketing & Promotions', 'availability' => 'Weekends Only', 'training' => 'Multimedia Production'],
        ['first_name' => 'Wendy', 'last_name' => 'Valdez', 'skills' => ['Nursing', 'First Aid', 'Health Education'], 'position' => 'Medical Operations;Safety and Emergency Response', 'availability' => 'Weekends Only', 'training' => 'Health Education'],
        ['first_name' => 'Xander', 'last_name' => 'Ford', 'skills' => ['Driving', 'Mechanics', 'Fleet Management'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Automotive Mechanics'],
        ['first_name' => 'Yumi', 'last_name' => 'Lacsamana', 'skills' => ['Cooking', 'Food Styling', 'Photography'], 'position' => 'Mobile Kitchen Operations;Digital Marketing & Promotions', 'availability' => 'Weekends Only', 'training' => 'Food Photography'],
        ['first_name' => 'Zandro', 'last_name' => 'Lim', 'skills' => ['Counseling', 'Crisis Intervention', 'Active Listening'], 'position' => 'Psychological First Aid;Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Crisis Counseling'],
        ['first_name' => 'Aiko', 'last_name' => 'Melo', 'skills' => ['Teaching', 'Arts and Crafts', 'Storytelling'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Early Childhood Education'],
        ['first_name' => 'Bong', 'last_name' => 'Revilla', 'skills' => ['Team Leadership', 'Advocacy', 'Public Speaking'], 'position' => 'Individual & Corporate Partnerships', 'availability' => 'Anytime / On Call', 'training' => 'Public Relations'],
        ['first_name' => 'Cherry', 'last_name' => 'Pie', 'skills' => ['Baking', 'Pastry', 'Dessert Making'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekends Only', 'training' => 'Advanced Baking'],
        ['first_name' => 'Dong', 'last_name' => 'Abad', 'skills' => ['Logistics', 'Warehouse', 'Inventory'], 'position' => 'Relief Operations;Purchasing Team', 'availability' => 'Anytime / On Call', 'training' => 'Warehouse Management'],
        ['first_name' => 'Eunice', 'last_name' => 'Castro', 'skills' => ['Social Media', 'Writing', 'Graphic Design'], 'position' => 'Digital Marketing & Promotions', 'availability' => 'Weekdays Only', 'training' => 'Digital Marketing'],
        ['first_name' => 'Francis', 'last_name' => 'Magalona', 'skills' => ['Music', 'Performing', 'Teaching'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Music Education'],
        ['first_name' => 'Gretchen', 'last_name' => 'Barretto', 'skills' => ['Fashion', 'Styling', 'Design'], 'position' => 'Individual & Corporate Partnerships;Digital Marketing & Promotions', 'availability' => 'Weekends Only', 'training' => 'Brand Management'],
        ['first_name' => 'Hiro', 'last_name' => 'Peralta', 'skills' => ['Cooking', 'Japanese Cuisine', 'Food Prep'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Anytime / On Call', 'training' => 'International Cuisine'],
        ['first_name' => 'Isabel', 'last_name' => 'Oli', 'skills' => ['Medical Assessment', 'Patient Care', 'First Aid'], 'position' => 'Medical Operations', 'availability' => 'Weekdays Only', 'training' => 'Basic Life Support'],
        ['first_name' => 'Jolo', 'last_name' => 'Revilla', 'skills' => ['Driving', 'Loading', 'Heavy Equipment'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Heavy Equipment Operation'],
        ['first_name' => 'Kaye', 'last_name' => 'Abad', 'skills' => ['Teaching', 'Child Care', 'Communication'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education);Relief Operations', 'availability' => 'Weekends Only', 'training' => 'Child Development'],
        ['first_name' => 'Lloyd', 'last_name' => 'Samonte', 'skills' => ['First Aid', 'Rescue', 'Emergency Response'], 'position' => 'Safety and Emergency Response', 'availability' => 'Anytime / On Call', 'training' => 'Search and Rescue'],
        ['first_name' => 'Michelle', 'last_name' => 'Dee', 'skills' => ['Cooking', 'Baking', 'Cake Decorating'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Weekends Only', 'training' => 'Advanced Baking'],
        ['first_name' => 'Nico', 'last_name' => 'David', 'skills' => ['Counseling', 'Psychology', 'Crisis Intervention'], 'position' => 'Psychological First Aid;Medical Operations', 'availability' => 'Weekdays Only', 'training' => 'Mental Health First Aid'],
        ['first_name' => 'Ogie', 'last_name' => 'Alcasid', 'skills' => ['Music', 'Songwriting', 'Performing'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Music and Performance'],
        ['first_name' => 'Polo', 'last_name' => 'Ravales', 'skills' => ['Driving', 'Logistics', 'Navigation'], 'position' => 'Transportation & Logistics Team;Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Defensive Driving'],
        ['first_name' => 'Ruffa', 'last_name' => 'Gutierrez', 'skills' => ['Hosting', 'Advocacy', 'Communication'], 'position' => 'Individual & Corporate Partnerships', 'availability' => 'Weekends Only', 'training' => 'Public Relations'],
        ['first_name' => 'Sid', 'last_name' => 'Lucero', 'skills' => ['Cooking', 'Filipino Cuisine', 'Food Prep'], 'position' => 'Mobile Kitchen Operations;Relief Operations', 'availability' => 'Anytime / On Call', 'training' => 'Filipino Cuisine'],
        ['first_name' => 'Tetchie', 'last_name' => 'Agbayani', 'skills' => ['Teaching', 'Storytelling', 'Arts and Crafts'], 'position' => 'Metro Sidewalk Sunday School (Teaching & Education)', 'availability' => 'Weekends Only', 'training' => 'Early Childhood Education'],
        ['first_name' => 'Uro', 'last_name' => 'Bautista', 'skills' => ['Logistics', 'Procurement', 'Inventory'], 'position' => 'Purchasing Team', 'availability' => 'Weekdays Only', 'training' => 'Procurement Management'],
        ['first_name' => 'Vanessa', 'last_name' => 'Mina', 'skills' => ['Cooking', 'Food Prep', 'Sanitation'], 'position' => 'Mobile Kitchen Operations', 'availability' => 'Day Off', 'training' => 'Kitchen Safety'],
        ['first_name' => 'Wilma', 'last_name' => 'Galvante', 'skills' => ['Nursing', 'Triage', 'Emergency Care'], 'position' => 'Medical Operations;Safety and Emergency Response', 'availability' => 'Weekends Only', 'training' => 'Advanced Cardiac Life Support'],
        ['first_name' => 'Xyza', 'last_name' => 'Cruz', 'skills' => ['Photography', 'Videography', 'Photojournalism'], 'position' => 'Digital Marketing & Promotions', 'availability' => 'Anytime / On Call', 'training' => 'Photojournalism'],
        ['first_name' => 'Yvette', 'last_name' => 'Mendoza', 'skills' => ['Cooking', 'Meal Prep', 'Batch Cooking'], 'position' => 'Mobile Kitchen Operations;Relief Operations', 'availability' => 'Weekends Only', 'training' => 'Volume Cooking'],
        ['first_name' => 'Zaldy', 'last_name' => 'Santos', 'skills' => ['Driving', 'Fleet Management', 'Dispatch'], 'position' => 'Transportation & Logistics Team', 'availability' => 'Anytime / On Call', 'training' => 'Fleet Operations'],
    ];

    public function run(): void
    {
        $this->command?->info('Seeding demo volunteers with fake PII...');

        DB::transaction(function (): void {
            foreach (self::FAKE_VOLUNTEERS as $index => $data) {
                $this->seedDemoVolunteer($data, $index + 1);
            }
        });

        $this->command?->info('Seeded '.count(self::FAKE_VOLUNTEERS).' demo volunteers.');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function seedDemoVolunteer(array $data, int $rowNumber): void
    {
        $firstName = $data['first_name'];
        $lastName = $data['last_name'];
        $email = strtolower($firstName.'.'.$lastName.'@gmail.com');

        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => trim($firstName.' '.$lastName),
                'password' => 'Password123!',
            ]
        );

        $volunteer = Volunteer::updateOrCreate(
            ['user_id' => $user->id],
            [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'facebook_name' => $firstName.' '.$lastName,
                'email' => $email,
                'birthdate' => Carbon::createFromFormat('Y-m-d', $this->faker->dateTimeBetween('-50 years', '-18 years')->format('Y-m-d')),
                'address' => $this->faker->streetAddress().', '.$this->faker->city().', Philippines',
                'mobile_number' => '0917'.str_pad((string) $this->faker->unique()->randomNumber(7, true), 7, '0', STR_PAD_LEFT),
                'educational_attainment' => $this->faker->randomElement(['College Graduate', 'College Undergraduate', 'High School Graduate', 'Vocational']),
                'last_medical_examination' => Carbon::createFromFormat('Y-m-d', $this->faker->dateTimeBetween('-1 year', 'today')->format('Y-m-d')),
            ]
        );

        $this->attachPositions($volunteer, $data['position']);
        $this->attachSkills($volunteer, $data['skills']);
        $this->attachTrainings($volunteer, $data['training']);
        $this->attachAvailabilities($volunteer, $data['availability']);
    }

    private function attachPositions(Volunteer $volunteer, string $positionName): void
    {
        $names = explode(';', $positionName);
        foreach ($names as $name) {
            $trimmed = trim($name);
            if ($trimmed === '') {
                continue;
            }
            $position = Position::firstOrCreate(['name' => $trimmed]);
            $volunteer->positions()->syncWithoutDetaching([$position->position_id]);
        }
    }

    /**
     * @param  array<int, string>  $skills
     */
    private function attachSkills(Volunteer $volunteer, array $skills): void
    {
        foreach ($skills as $skillName) {
            $skill = Skill::firstOrCreate(['name' => $skillName]);
            $volunteer->skills()->syncWithoutDetaching([$skill->skill_id]);
        }
    }

    private function attachTrainings(Volunteer $volunteer, string $trainingName): void
    {
        $names = explode(';', $trainingName);
        foreach ($names as $name) {
            $trimmed = trim($name);
            if ($trimmed === '') {
                continue;
            }
            $training = Training::firstOrCreate(['name' => $trimmed]);
            $volunteer->trainings()->syncWithoutDetaching([$training->training_id]);
        }
    }

    private function attachAvailabilities(Volunteer $volunteer, string $rawAvailability): void
    {
        $canonical = $this->canonicalAvailability($rawAvailability);

        $availability = Availability::firstOrCreate(['name' => $canonical]);

        $custom = null;
        if ($canonical === 'Other') {
            $custom = $rawAvailability;
        }

        $volunteer->availabilities()->syncWithoutDetaching([
            $availability->availability_id => ['custom_description' => $custom],
        ]);
    }

    private function canonicalAvailability(string $value): string
    {
        $normalized = strtolower(trim($value));

        return match (true) {
            Str::contains($normalized, 'weekend') => 'Weekends Only',
            Str::contains($normalized, 'weekday') => 'Weekdays Only',
            Str::contains($normalized, 'anytime'), Str::contains($normalized, 'on call') => 'Anytime / On Call',
            Str::contains($normalized, 'day off') => 'Day Off',
            default => 'Other',
        };
    }
}
