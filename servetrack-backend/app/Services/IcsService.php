<?php

namespace App\Services;

use App\Models\Ics;
use App\Models\Skill;
use App\Models\Team;
use App\Models\Volunteer;
use Illuminate\Support\Collection;

class IcsService
{
    public function __construct(
        private GroqService $groqService
    ) {}

    /**
     * Generate AI-based team assignments for volunteers based on their skills.
     * Attempts Groq AI first; falls back to hardcoded skill-to-team mapping on failure.
     */
    public function generateTeamAssignments(Ics $ics): array
    {
        $rsvp = $ics->rsvp;

        if (! $rsvp) {
            \Illuminate\Support\Facades\Log::warning('IcsService: No RSVP associated with ICS', ['ics_id' => $ics->id]);

            return [
                'message' => 'No RSVP associated with this ICS.',
                'total_volunteers' => 0,
                'assignments' => [],
            ];
        }

        $teams = $ics->teams;

        if ($teams->isEmpty()) {
            \Illuminate\Support\Facades\Log::warning('IcsService: No teams assigned to ICS', ['ics_id' => $ics->id]);

            return [
                'message' => 'No teams assigned to this ICS.',
                'total_volunteers' => 0,
                'assignments' => [],
            ];
        }

        $volunteers = Volunteer::query()
            ->whereHas('rsvpResponses', function ($query) use ($rsvp) {
                $query->where('rsvp_id', $rsvp->rsvp_id)
                    ->where('attendance_status', '!=', 'no_show');
            })
            ->with(['skills', 'trainings', 'positions', 'experiences'])
            ->get();

        \Illuminate\Support\Facades\Log::info('IcsService: Volunteers loaded', [
            'ics_id' => $ics->id,
            'rsvp_id' => $rsvp->rsvp_id,
            'volunteer_count' => $volunteers->count(),
            'team_count' => $teams->count(),
        ]);

        if ($volunteers->isEmpty()) {
            \Illuminate\Support\Facades\Log::warning('IcsService: No volunteers RSVP\'d for event', ['rsvp_id' => $rsvp->rsvp_id]);

            return [
                'message' => 'No volunteers have RSVP\'d for this event.',
                'total_volunteers' => 0,
                'assignments' => [],
            ];
        }

        // Attempt Groq AI-powered suggestions
        if ($this->groqService->isConfigured()) {
            \Illuminate\Support\Facades\Log::info('IcsService: Calling GroqService', ['ics_id' => $ics->id]);
            $groqResult = $this->groqService->suggestAssignments(
                $volunteers,
                $teams,
                $rsvp->title,
                $rsvp->description,
            );

            \Illuminate\Support\Facades\Log::info('IcsService: Groq result received', [
                'ics_id' => $ics->id,
                'assignment_count' => count($groqResult['assignments'] ?? []),
                'unassigned_count' => count($groqResult['unassigned'] ?? []),
            ]);

            $assignments = $this->normalizeGroqAssignments(
                $groqResult['assignments'] ?? [],
                $volunteers,
                $teams,
            );

            if (! empty($assignments)) {
                \Illuminate\Support\Facades\Log::info('IcsService: Returning Groq assignments', ['count' => count($assignments)]);

                return [
                    'message' => 'AI-generated team assignments using Groq LLM.',
                    'total_volunteers' => count($assignments),
                    'assignments' => $assignments,
                ];
            }
        }

        // Fallback to hardcoded skill-to-team mapping
        \Illuminate\Support\Facades\Log::info('IcsService: Falling back to hardcoded algorithm', ['ics_id' => $ics->id]);

        return $this->fallbackAssignments($volunteers, $teams);
    }

    /**
     * Normalize Groq API response into the standard assignment format.
     */
    private function normalizeGroqAssignments(
        array $groqAssignments,
        Collection $volunteers,
        Collection $teams,
    ): array {
        $volunteersById = $volunteers->keyBy('volunteer_id');
        $teamsById = $teams->keyBy('id');

        $assignments = [];
        $seenVolunteerIds = [];

        foreach ($groqAssignments as $suggestion) {
            $volunteerId = $suggestion['volunteer_id'] ?? null;
            $teamId = $suggestion['team_id'] ?? null;

            if ($volunteerId === null) {
                continue;
            }

            if (isset($seenVolunteerIds[$volunteerId])) {
                continue;
            }

            $volunteer = $volunteersById->get($volunteerId);
            $team = $teamsById->get($teamId);

            if (! $volunteer || ! $team) {
                continue;
            }

            $seenVolunteerIds[$volunteerId] = true;

            $assignments[] = [
                'volunteer_id' => $volunteer->volunteer_id,
                'volunteer_name' => $volunteer->first_name.' '.$volunteer->last_name,
                'team_id' => $team->id,
                'team_name' => $team->name,
                'role' => $suggestion['role'] ?? 'Team Member',
                'skills' => $volunteer->skills->pluck('name')->toArray(),
                'confidence' => $suggestion['confidence'] ?? 0.5,
                'reasoning' => $suggestion['reasoning'] ?? null,
            ];
        }

        return $assignments;
    }

    /**
     * Fallback: use hardcoded skill-to-team mapping when Groq is unavailable.
     */
    private function fallbackAssignments(Collection $volunteers, Collection $teams): array
    {
        $skillTeamMappings = $this->getSkillTeamMappings();

        $assignments = [];

        foreach ($volunteers as $volunteer) {
            $suggestedTeam = $this->findBestTeamForVolunteer(
                $volunteer,
                $teams,
                $skillTeamMappings
            );

            if ($suggestedTeam) {
                $role = $this->determineRole($volunteer, $suggestedTeam);

                $assignments[] = [
                    'volunteer_id' => $volunteer->volunteer_id,
                    'volunteer_name' => $volunteer->first_name.' '.$volunteer->last_name,
                    'team_id' => $suggestedTeam->id,
                    'team_name' => $suggestedTeam->name,
                    'role' => $role,
                    'skills' => $volunteer->skills->pluck('name')->toArray(),
                    'confidence' => $this->calculateConfidence($volunteer, $suggestedTeam, $skillTeamMappings),
                ];
            }
        }

        usort($assignments, fn ($a, $b) => $b['confidence'] <=> $a['confidence']);

        return [
            'message' => 'AI-generated team assignments based on volunteer skills (fallback).',
            'total_volunteers' => count($assignments),
            'assignments' => $assignments,
        ];
    }

    /**
     * Get skill-to-team mappings.
     * This can be expanded to use AI/ML models in the future.
     */
    private function getSkillTeamMappings(): array
    {
        return [
            'medical' => ['Medical Team', 'Response Team'],
            'first aid' => ['Medical Team', 'Response Team'],
            'nursing' => ['Medical Team'],
            'emergency response' => ['Response Team'],
            'leadership' => ['Command Team', 'Operations Team'],
            'management' => ['Command Team', 'Operations Team'],
            'communication' => ['Communications Team'],
            'radio' => ['Communications Team'],
            'logistics' => ['Logistics Team'],
            'transportation' => ['Logistics Team'],
            'driving' => ['Logistics Team'],
            'cooking' => ['Support Team'],
            'food preparation' => ['Support Team'],
            'construction' => ['Response Team'],
            'engineering' => ['Response Team'],
            'search and rescue' => ['Response Team'],
            'it' => ['Communications Team', 'Support Team'],
            'technical' => ['Communications Team', 'Support Team'],
            'teaching' => ['Support Team'],
            'counseling' => ['Support Team', 'Medical Team'],
        ];
    }

    /**
     * Find the best team for a volunteer based on their skills.
     */
    private function findBestTeamForVolunteer(
        Volunteer $volunteer,
        Collection $teams,
        array $skillTeamMappings
    ): ?Team {
        $volunteerSkills = $volunteer->skills->pluck('name')->map(fn ($skill) => strtolower($skill))->toArray();

        $teamScores = [];

        foreach ($teams as $team) {
            $score = 0;

            foreach ($volunteerSkills as $skill) {
                if (isset($skillTeamMappings[$skill]) && in_array(strtolower($team->name), array_map('strtolower', $skillTeamMappings[$skill]), true)) {
                    $score += 10;
                }
            }

            // Bonus for leadership positions
            if ($volunteer->positions->contains('name', 'Leader')) {
                if (str_contains(strtolower($team->name), 'command') || str_contains(strtolower($team->name), 'operations')) {
                    $score += 5;
                }
            }

            // Bonus for relevant experience
            foreach ($volunteer->experiences as $experience) {
                if (str_contains(strtolower($experience->name), strtolower($team->name))) {
                    $score += 3;
                }
            }

            if ($score > 0) {
                $teamScores[$team->id] = $score;
            }
        }

        if (empty($teamScores)) {
            $supportTeam = $teams->first(fn ($team) => str_contains(strtolower($team->name), 'support'));

            return $supportTeam ?? $teams->first();
        }

        $bestTeamId = array_keys($teamScores, max($teamScores), true)[0];

        return $teams->first(fn ($team) => $team->id === $bestTeamId);
    }

    /**
     * Determine the role for a volunteer in a team.
     */
    private function determineRole(Volunteer $volunteer, Team $team): string
    {
        if ($volunteer->positions->contains('name', 'Leader')) {
            if (str_contains(strtolower($team->name), 'command')) {
                return 'Team Lead';
            }
            if (str_contains(strtolower($team->name), 'operations')) {
                return 'Operations Lead';
            }

            return 'Team Lead';
        }

        $skills = $volunteer->skills->pluck('name')->map(fn ($skill) => strtolower($skill))->toArray();

        if (in_array('medical', $skills, true) || in_array('nursing', $skills, true)) {
            return 'Medical Officer';
        }

        if (in_array('communication', $skills, true) || in_array('radio', $skills, true)) {
            return 'Communications Officer';
        }

        if (in_array('logistics', $skills, true) || in_array('transportation', $skills, true)) {
            return 'Logistics Officer';
        }

        if (in_array('leadership', $skills, true) || in_array('management', $skills, true)) {
            return 'Team Lead';
        }

        return 'Team Member';
    }

    /**
     * Calculate confidence score for a team assignment.
     */
    private function calculateConfidence(
        Volunteer $volunteer,
        Team $team,
        array $skillTeamMappings
    ): float {
        $volunteerSkills = $volunteer->skills->pluck('name')->map(fn ($skill) => strtolower($skill))->toArray();
        $totalSkills = count($volunteerSkills);
        $matchingSkills = 0;

        foreach ($volunteerSkills as $skill) {
            if (isset($skillTeamMappings[$skill]) && in_array(strtolower($team->name), array_map('strtolower', $skillTeamMappings[$skill]), true)) {
                $matchingSkills++;
            }
        }

        if ($totalSkills === 0) {
            return 0.0;
        }

        $baseScore = ($matchingSkills / $totalSkills) * 100;

        // Bonus for leadership
        if ($volunteer->positions->contains('name', 'Leader')) {
            $baseScore += 10;
        }

        // Bonus for experience
        if ($volunteer->experiences->count() > 0) {
            $baseScore += 5;
        }

        return min(100.0, $baseScore);
    }
}
