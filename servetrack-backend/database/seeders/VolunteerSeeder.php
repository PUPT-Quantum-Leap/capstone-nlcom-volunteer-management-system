<?php

namespace Database\Seeders;

use App\Models\Availability;
use App\Models\Experience;
use App\Models\Lifegroup;
use App\Models\Position;
use App\Models\Skill;
use App\Models\Training;
use App\Models\User;
use App\Models\Volunteer;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class VolunteerSeeder extends Seeder
{
    /**
     * Import volunteers from a TSV export.
     *
     * Put your full table export in:
     * database/seeders/data/volunteers.tsv
     *
     * Required headers (case-insensitive):
     * - COMPLETE NAME
     * - FACEBOOK NAME
     * - BIRTHDATE
     * - HOME ADDRESS
     * - MOBILE NUMBER
     * - EDUCATIONAL ATTAINMENT
     * - RELEVANT TRAINING AND EXPERIENCE
     * - SKILLS OR HOBBIES
     * - DATE OF LAST MEDICAL EXAMINATION OR EVALUTAION (e.g. Annual Physical Exam or seen by Medical Doctor)
     * - WHERE DO YOU WANT TO VOLUNTEER?
     * - VOLUNTEER AVAILABILITY
     * - ARE YOU PART OF A LIFEGROUP? IF YES, TYPE THE NAME OF YOUR LEADER
     * - ARE YOU LEADING A LIFEGROUP?
     * - CLASSES AND TRAININGS ATTENDED?
     * - Email (optional; synthetic email is generated if missing/anonymous)
     */
    public function run(): void
    {
        $path = database_path('seeders/data/volunteers.tsv');

        if (! File::exists($path)) {
            $this->command?->warn('volunteers.tsv not found. Skipping VolunteerSeeder.');

            return;
        }

        $rows = $this->readTsv($path);
        if ($rows === []) {
            $this->command?->warn('volunteers.tsv is empty or unreadable. Skipping VolunteerSeeder.');

            return;
        }

        DB::transaction(function () use ($rows): void {
            foreach ($rows as $index => $row) {
                $this->seedVolunteerRow($row, $index + 1);
            }
        });
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function readTsv(string $path): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            return [];
        }

        $headers = fgetcsv($handle, 0, "\t");
        if (! is_array($headers)) {
            fclose($handle);

            return [];
        }

        $headers = array_map(
            static fn ($header) => strtoupper(trim((string) $header)),
            $headers
        );

        $rows = [];
        while (($data = fgetcsv($handle, 0, "\t")) !== false) {
            if (! is_array($data)) {
                continue;
            }

            if (count(array_filter($data, static fn ($value) => trim((string) $value) !== '')) === 0) {
                continue;
            }

            $row = [];
            foreach ($headers as $i => $header) {
                $row[$header] = trim((string) ($data[$i] ?? ''));
            }

            $rows[] = $row;
        }

        fclose($handle);

        return $rows;
    }

    /**
     * @param  array<string, string>  $row
     */
    private function seedVolunteerRow(array $row, int $rowNumber): void
    {
        $completeName = $this->pick($row, ['COMPLETE NAME', 'NAME']);
        if ($completeName === '') {
            $completeName = 'Volunteer '.$rowNumber;
        }

        [$firstName, $lastName] = $this->splitName($completeName);
        $facebookName = $this->pick($row, ['FACEBOOK NAME']);
        $mobileNumber = $this->sanitizePhone($this->pick($row, ['MOBILE NUMBER']));
        $address = $this->pick($row, ['HOME ADDRESS']);
        $educationalAttainment = $this->pick($row, ['EDUCATIONAL ATTAINMENT']);
        $birthdate = $this->parseDate($this->pick($row, ['BIRTHDATE']), '1990-01-01');
        $lastMedicalExam = $this->parseDate(
            $this->pick($row, ['DATE OF LAST MEDICAL EXAMINATION OR EVALUTAION (E.G. ANNUAL PHYSICAL EXAM OR SEEN BY MEDICAL DOCTOR)']),
            now()->subYear()->toDateString()
        );

        $emailRaw = $this->pick($row, ['EMAIL']);
        $email = $this->normalizeEmail($emailRaw, $firstName, $lastName, $rowNumber);

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
                'first_name' => Str::limit($firstName, 50, ''),
                'last_name' => Str::limit($lastName, 50, ''),
                'facebook_name' => Str::limit($facebookName !== '' ? $facebookName : trim($firstName.' '.$lastName), 100, ''),
                'email' => $email,
                'birthdate' => $birthdate,
                'address' => Str::limit($address !== '' ? $address : 'N/A', 255, ''),
                'mobile_number' => Str::limit($mobileNumber !== '' ? $mobileNumber : '0000000000', 15, ''),
                'educational_attainment' => Str::limit($educationalAttainment !== '' ? $educationalAttainment : 'N/A', 100, ''),
                'last_medical_examination' => $lastMedicalExam,
            ]
        );

        $this->attachPositions($volunteer, $this->pick($row, ['WHERE DO YOU WANT TO VOLUNTEER?']));
        $this->attachAvailabilities($volunteer, $this->pick($row, ['VOLUNTEER AVAILABILITY']));
        $this->attachLifegroup(
            $volunteer,
            $this->pick($row, ['ARE YOU PART OF A LIFEGROUP? IF YES, TYPE THE NAME OF YOUR LEADER']),
            $this->pick($row, ['ARE YOU LEADING A LIFEGROUP?'])
        );
        $this->attachExperiences($volunteer, $this->pick($row, ['RELEVANT TRAINING AND EXPERIENCE']));
        $this->attachSkills($volunteer, $this->pick($row, ['SKILLS OR HOBBIES']));
        $this->attachTrainings($volunteer, $this->pick($row, ['CLASSES AND TRAININGS ATTENDED?']));
    }

    /**
     * @param  array<string, string>  $row
     * @param  array<int, string>  $keys
     */
    private function pick(array $row, array $keys): string
    {
        foreach ($keys as $key) {
            $value = $row[strtoupper($key)] ?? '';
            if (trim($value) !== '') {
                return trim($value);
            }
        }

        return '';
    }

    /**
     * @return array{0:string,1:string}
     */
    private function splitName(string $name): array
    {
        $clean = trim(preg_replace('/\s+/', ' ', $name) ?? $name);
        if ($clean === '') {
            return ['Volunteer', 'Unknown'];
        }

        $parts = explode(' ', $clean);
        if (count($parts) === 1) {
            return [$parts[0], 'Unknown'];
        }

        $first = array_shift($parts) ?? 'Volunteer';
        $last = implode(' ', $parts);

        return [$first, $last !== '' ? $last : 'Unknown'];
    }

    private function normalizeEmail(string $email, string $firstName, string $lastName, int $rowNumber): string
    {
        $email = trim($email);
        if ($email !== '' && strtolower($email) !== 'anonymous' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return strtolower($email);
        }

        $slug = Str::slug(trim($firstName.' '.$lastName), '.');
        if ($slug === '') {
            $slug = 'volunteer';
        }

        return strtolower($slug.'.'.$rowNumber.'@servetrack.local');
    }

    private function sanitizePhone(string $mobileNumber): string
    {
        $mobileNumber = preg_replace('/[^\d+]/', '', $mobileNumber) ?? '';

        if (Str::startsWith($mobileNumber, '+63')) {
            $mobileNumber = '0'.substr($mobileNumber, 3);
        }

        return trim($mobileNumber);
    }

    private function parseDate(string $value, string $fallback): string
    {
        $value = trim($value);
        if ($value === '' || preg_match('/^(n\/a|na|none|unknown|i don\'?t remember|cannot remember|last year|3 months ago|6 months ago)$/i', $value)) {
            return $fallback;
        }

        $value = preg_replace('/\s+/', ' ', $value) ?? $value;

        // Common malformed "May2024" -> "May 2024"
        $value = preg_replace('/([A-Za-z]+)(\d{4})/', '$1 $2', $value) ?? $value;

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            // Month + year only fallback to first day of month.
            if (preg_match('/^([A-Za-z]{3,9})\s+(\d{4})$/', $value, $m) === 1) {
                try {
                    return Carbon::createFromFormat('F Y', $m[1].' '.$m[2])->startOfMonth()->toDateString();
                } catch (\Throwable) {
                    try {
                        return Carbon::createFromFormat('M Y', $m[1].' '.$m[2])->startOfMonth()->toDateString();
                    } catch (\Throwable) {
                        return $fallback;
                    }
                }
            }

            return $fallback;
        }
    }

    private function isNegative(string $value): bool
    {
        return preg_match('/^(no|none|n\/a|na|not yet|not\syet|couples|yes|n\/a\.)$/i', trim($value)) === 1;
    }

    /**
     * @return array<int, string>
     */
    private function splitValues(string $value): array
    {
        if (trim($value) === '') {
            return [];
        }

        $parts = preg_split('/[;\n|]+/', $value) ?: [];
        $parts = array_map(static fn ($item) => trim((string) $item), $parts);
        $parts = array_filter($parts, static fn ($item) => $item !== '');

        return array_values(array_unique($parts));
    }

    private function attachPositions(Volunteer $volunteer, string $positionValue): void
    {
        $normalizedMap = [
            'Creatives (video/photos)' => 'Creatives (Video / Photos)',
            'Dont know yet' => "Don't know yet",
            'Whereever is needed.' => 'Wherever is needed',
        ];

        foreach ($this->splitValues($positionValue) as $rawPosition) {
            $positionName = $normalizedMap[$rawPosition] ?? $rawPosition;
            $position = Position::firstOrCreate(['name' => Str::limit($positionName, 50, '')]);
            $volunteer->positions()->syncWithoutDetaching([$position->position_id]);
        }
    }

    private function attachAvailabilities(Volunteer $volunteer, string $availabilityValue): void
    {
        foreach ($this->splitValues($availabilityValue) as $rawAvailability) {
            $canonical = $this->canonicalAvailability($rawAvailability);
            $availability = Availability::firstOrCreate(['name' => $canonical]);

            $custom = null;
            if ($canonical === 'Other') {
                $custom = Str::limit($rawAvailability, 100, '');
            }

            $volunteer->availabilities()->syncWithoutDetaching([
                $availability->availability_id => ['custom_description' => $custom],
            ]);
        }
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

    private function attachLifegroup(Volunteer $volunteer, string $lifegroupValue, string $isLeaderValue): void
    {
        if ($lifegroupValue === '' || $this->isNegative($lifegroupValue)) {
            return;
        }

        $lifegroup = Lifegroup::firstOrCreate([
            'name' => Str::limit($lifegroupValue, 100, ''),
        ]);

        $isLeader = preg_match('/^yes$/i', trim($isLeaderValue)) === 1;

        $volunteer->lifegroups()->syncWithoutDetaching([
            $lifegroup->lifegroup_id => ['is_leader' => $isLeader],
        ]);
    }

    private function attachExperiences(Volunteer $volunteer, string $experienceValue): void
    {
        foreach ($this->splitValues($experienceValue) as $raw) {
            if ($this->isNegative($raw)) {
                continue;
            }

            $experience = Experience::firstOrCreate([
                'name' => Str::limit($raw, 100, ''),
            ]);

            $volunteer->experiences()->syncWithoutDetaching([$experience->experience_id]);
        }
    }

    private function attachSkills(Volunteer $volunteer, string $skillsValue): void
    {
        foreach ($this->splitValues($skillsValue) as $raw) {
            if ($this->isNegative($raw)) {
                continue;
            }

            $skill = Skill::firstOrCreate([
                'name' => Str::limit($raw, 100, ''),
            ]);

            $volunteer->skills()->syncWithoutDetaching([$skill->skill_id]);
        }
    }

    private function attachTrainings(Volunteer $volunteer, string $trainingsValue): void
    {
        foreach ($this->splitValues($trainingsValue) as $raw) {
            if ($this->isNegative($raw)) {
                continue;
            }

            $training = Training::firstOrCreate([
                'name' => Str::limit($raw, 100, ''),
            ]);

            $volunteer->trainings()->syncWithoutDetaching([$training->training_id]);
        }
    }
}
