<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePollRequest;
use App\Http\Requests\UpdatePollRequest;
use App\Http\Resources\PollResource;
use App\Models\Option;
use App\Models\Poll;
use App\Models\PollVote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class PollController extends Controller
{
    /**
     * List all polls.
     *
     * Admins see all polls regardless of status.
     * Volunteers only see active polls.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Poll::query()->with('options');

        if ($request->user()->role !== 'admin') {
            $query->where('status', 'active');
        }

        $polls = $query->latest()->get();

        return PollResource::collection($polls);
    }

    /**
     * Show a single poll with its options and per-option vote counts.
     */
    public function show(int $id): PollResource|JsonResponse
    {
        $poll = Poll::query()->with('options')->find($id);

        if (! $poll) {
            return response()->json(['message' => 'Poll not found.'], 404);
        }

        return new PollResource($poll);
    }

    /**
     * Create a new poll with options.
     * Admin only.
     */
    public function store(StorePollRequest $request): JsonResponse
    {
        $poll = DB::transaction(function () use ($request): Poll {
            $poll = Poll::query()->create([
                'title' => $request->input('title'),
                'description' => $request->input('description'),
                'date' => $request->input('date'),
                'cutoff_day' => $request->input('cutoff_day'),
                'cutoff_time' => $request->input('cutoff_time'),
                'status' => $request->input('status', 'draft'),
                'share_url' => $request->input('share_url'),
            ]);

            foreach ($request->input('options') as $optionData) {
                // Find existing option or create new one
                $option = Option::query()->firstOrCreate(['text' => $optionData['text']]);

                $poll->options()->attach($option->option_id, [
                    'time_slot' => $optionData['time_slot'],
                    'capacity' => $optionData['capacity'],
                ]);
            }

            return $poll->load('options');
        });

        return (new PollResource($poll))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Update a poll and sync its options.
     * Admin only.
     */
    public function update(UpdatePollRequest $request, int $id): PollResource|JsonResponse
    {
        $poll = Poll::query()->with('options')->find($id);

        if (! $poll) {
            return response()->json(['message' => 'Poll not found.'], 404);
        }

        DB::transaction(function () use ($request, $poll): void {
            $poll->update(array_filter([
                'title' => $request->input('title'),
                'description' => $request->input('description'),
                'date' => $request->input('date'),
                'cutoff_day' => $request->input('cutoff_day'),
                'cutoff_time' => $request->input('cutoff_time'),
                'status' => $request->input('status'),
                'share_url' => $request->input('share_url'),
            ], fn ($value) => $value !== null));

            if ($request->has('options')) {
                // Detach and delete old options that no longer have any votes
                foreach ($poll->options as $option) {
                    $hasVotes = PollVote::query()
                        ->where('poll_id', $poll->poll_id)
                        ->where('option_id', $option->option_id)
                        ->exists();

                    if (! $hasVotes) {
                        $poll->options()->detach($option->option_id);
                        $option->delete();
                    }
                }

                // Create and attach new options
                foreach ($request->input('options') as $optionData) {
                    // Find existing option or create new one
                    $option = Option::query()->firstOrCreate(['text' => $optionData['text']]);

                    $poll->options()->attach($option->option_id, [
                        'time_slot' => $optionData['time_slot'],
                        'capacity' => $optionData['capacity'],
                    ]);
                }
            }
        });

        return new PollResource($poll->fresh('options'));
    }

    /**
     * Delete a poll (cascades to poll_option and poll_vote).
     * Admin only.
     */
    public function destroy(int $id): JsonResponse
    {
        $poll = Poll::query()->find($id);

        if (! $poll) {
            return response()->json(['message' => 'Poll not found.'], 404);
        }

        $poll->delete();

        return response()->json(['message' => 'Poll deleted successfully.']);
    }

    /**
     * Update only the status of a poll.
     * Admin only.
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'in:draft,active,closed'],
        ]);

        $poll = Poll::query()->find($id);
        if (! $poll) {
            return response()->json(['message' => 'Poll not found.'], 404);
        }

        $poll->update(['status' => $request->input('status')]);
        $poll->refresh();

        return response()->json(['message' => 'Poll status updated.', 'status' => $poll->status]);
    }

    /**
     * Cast a vote on a poll option.
     * Authenticated volunteers only. One vote per volunteer per poll.
     */
    public function vote(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'option_id' => ['required', 'integer'],
        ]);

        $poll = Poll::query()->with('options')->find($id);

        if (! $poll) {
            return response()->json(['message' => 'Poll not found.'], 404);
        }

        if ($poll->status !== 'active') {
            return response()->json(['message' => 'This poll is not accepting votes.'], 422);
        }

        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            return response()->json(['message' => 'Volunteer profile not found.'], 403);
        }

        // Enforce one vote per volunteer per poll
        $existingVote = PollVote::query()
            ->where('volunteer_id', $volunteer->volunteer_id)
            ->where('poll_id', $poll->poll_id)
            ->first();

        if ($existingVote) {
            return response()->json(['message' => 'You have already voted on this poll.'], 422);
        }

        // Ensure the option belongs to this poll
        $option = $poll->options->firstWhere('option_id', $request->input('option_id'));

        if (! $option) {
            return response()->json(['message' => 'Invalid option for this poll.'], 422);
        }

        // Enforce capacity limit
        $currentVotes = PollVote::query()
            ->where('poll_id', $poll->poll_id)
            ->where('option_id', $option->option_id)
            ->count();

        if ($currentVotes >= $option->pivot->capacity) {
            return response()->json(['message' => 'This time slot is already at full capacity.'], 422);
        }

        PollVote::query()->create([
            'volunteer_id' => $volunteer->volunteer_id,
            'poll_id' => $poll->poll_id,
            'option_id' => $option->option_id,
            'voted_at' => now(),
            'sms_sent' => false,
        ]);

        return response()->json(['message' => 'Vote recorded successfully.']);
    }
}
