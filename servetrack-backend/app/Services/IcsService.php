<?php

namespace App\Services;

use App\Models\Ics;
use App\Models\Skill;
use App\Models\Team;
use App\Models\Volunteer;
use Illuminate\Support\Collection;

class IcsService
{
    /**
     * Generate AI-based team assignments for volunteers based on their skills.
     */
    public function generateTeamAssignments(Ics $ics): array
    {
        $rsvp = $ics->rsvp;
        $teams = $ics->teams;

        if ($teams->isEmpty()) {
            return [
                'message' => 'No teams assigned to this ICS.',
                'assignments' => [],
            ];
        }

        // Get volunteers who RSVP'd for this event
        $volunteers = Volunteer::query()
            ->whereHas('rsvpResponses', function ($query) use ($rsvp) {
                $query->where('rsvp_id', $rsvp->rsvp_id);
            })
            ->with(['skills', 'positions', 'experiences'])
            ->get();

        // Define skill-to-team mappings (can be customized or AI-generated)
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

        // Sort by confidence score
        usort($assignments, fn ($a, $b) => $b['confidence'] <=> $a['confidence']);

        return [
            'message' => 'AI-generated team assignments based on volunteer skills.',
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
                if (isset($skillTeamMappings[$skill]) && in_array($team->name, $skillTeamMappings[$skill], true)) {
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
            // If no skills match, assign to Support Team as default
            $supportTeam = $teams->first(fn ($team) => str_contains(strtolower($team->name), 'support'));

            return $supportTeam ?? $teams->first();
        }

        // Return team with highest score
        $bestTeamId = array_keys($teamScores, max($teamScores), true)[0];

        return $teams->first(fn ($team) => $team->id === $bestTeamId);
    }

    /**
     * Determine the role for a volunteer in a team.
     */
    private function determineRole(Volunteer $volunteer, Team $team): string
    {
        // Check if volunteer has leadership position
        if ($volunteer->positions->contains('name', 'Leader')) {
            if (str_contains(strtolower($team->name), 'command')) {
                return 'Team Lead';
            }
            if (str_contains(strtolower($team->name), 'operations')) {
                return 'Operations Lead';
            }

            return 'Team Lead';
        }

        // Determine role based on skills
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
            if (isset($skillTeamMappings[$skill]) && in_array($team->name, $skillTeamMappings[$skill], true)) {
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
