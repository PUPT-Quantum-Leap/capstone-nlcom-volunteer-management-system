<?php

namespace App\Http\Controllers;

use App\Http\Requests\ResetPasswordRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\Admin;
use App\Models\Coordinator;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class UserController extends Controller
{
    /**
     * Display a paginated listing of users.
     * Excludes the current authenticated user from the active list.
     */
    public function index(Request $request): JsonResponse
    {
        $showArchived = $request->query('archived') === 'true';
        $currentUserId = auth()->id();
        $perPage = (int) $request->query('per_page', 20);
        $perPage = min(max($perPage, 5), 100);

        if ($showArchived) {
            $query = User::onlyTrashed();
        } else {
            $query = User::query();
        }

        if ($currentUserId && ! $showArchived) {
            $query->where('id', '!=', $currentUserId);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%');
            });
        }

        if ($role = $request->query('role')) {
            $query->where('role', $role);
        }

        $query->orderBy('created_at', 'desc');

        $users = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $users->items(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * Store a newly created user in storage.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => $request->role,
            ]);

            // Cascade create to volunteer if role is volunteer
            if ($request->role === 'volunteer') {
                $nameParts = explode(' ', $request->name, 2);
                $firstName = $nameParts[0] ?? '';
                $lastName = $nameParts[1] ?? '';

                Volunteer::create([
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'facebook_name' => $firstName,
                    'email' => $request->email,
                    'mobile_number' => '00000000000',
                    'birthdate' => now()
                        ->subYears(20)
                        ->format('Y-m-d'),
                    'address' => '',
                    'educational_attainment' => '',
                    'last_medical_examination' => now()->format('Y-m-d'),
                    'user_id' => $user->id,
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'User created successfully',
                'data' => $user,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('User creation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to create user',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified user.
     */
    public function show(int $id): JsonResponse
    {
        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }

    /**
     * Update the specified user in storage.
     */
    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        if ($id === auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot modify your own account.',
            ], 403);
        }

        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        try {
            $oldRole = $user->role;
            $newRole = $request->role;
            $roleChanged = $oldRole !== $newRole;

            DB::beginTransaction();

            $user->update([
                'name' => $request->name,
                'email' => $request->email,
                'role' => $newRole,
            ]);

            // Cascade update to associated volunteer
            if ($user->volunteer) {
                $nameParts = explode(' ', $request->name, 2);
                $firstName = $nameParts[0] ?? '';
                $lastName = $nameParts[1] ?? '';

                $user->volunteer->update([
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $request->email,
                ]);
            }

            if ($roleChanged) {
                $this->handleRoleChange($user, $oldRole, $newRole);
            }

            DB::commit();

            $message = $roleChanged
                ? 'User updated successfully with role change'
                : 'User updated successfully';

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $user,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('User update failed', [
                'user_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update user',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified user from storage.
     */
    public function destroy(int $id): JsonResponse
    {
        if ($id === auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot delete your own account.',
            ], 403);
        }

        $user = User::withTrashed()->find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        DB::beginTransaction();
        try {
            if ($user->volunteer) {
                $user->volunteer->forceDelete();
            }

            $user->forceDelete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'User deleted successfully',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('User force delete failed', [
                'user_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete user',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Soft delete the specified user.
     */
    public function softDelete(Request $request, int $id): JsonResponse
    {
        if ($id === auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot archive your own account.',
            ], 403);
        }

        $user = User::withTrashed()->find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        DB::beginTransaction();
        try {
            if (! $user->trashed()) {
                $user->delete();
            }

            if ($user->volunteer
                && ! $user->volunteer->trashed()) {
                $user->volunteer->delete();
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'User archived successfully',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('User soft delete failed', [
                'user_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to archive user',
            ], 500);
        }
    }

    /**
     * Restore a soft-deleted user.
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        $user = User::onlyTrashed()->find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Archived user not found',
            ], 404);
        }

        DB::beginTransaction();
        try {
            $user->restore();

            // Cascade restore to associated volunteer (load with trashed)
            $volunteer = Volunteer::withTrashed()
                ->where('user_id', $user->id)
                ->first();
            if ($volunteer && $volunteer->trashed()) {
                $volunteer->restore();
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'User restored successfully',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('User restore failed', [
                'user_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to restore user',
            ], 500);
        }
    }

    /**
     * Reset user password.
     */
    public function resetPassword(ResetPasswordRequest $request, int $id): JsonResponse
    {
        if ($id === auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot reset your own password here. Use the profile settings.',
            ], 403);
        }

        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        try {
            $user->update([
                'password' => Hash::make($request->password),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Password reset successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to reset password',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Handle role change: ensure the target profile exists without destroying old data.
     * The `users.role` column is the source of truth — profile tables are
     * supplementary data stores that should never be deleted on role change
     * (doing so would orphan historical records like attendance, RSVPs, etc.).
     */
    private function handleRoleChange(User $user, string $oldRole, string $newRole): void
    {
        match ($newRole) {
            'volunteer' => $user->volunteer ?? $this->createVolunteerProfile($user),
            'admin' => $user->admin ?? $this->createAdminProfile($user),
            'coordinator' => $user->coordinator ?? $this->createCoordinatorProfile($user),
            default => null,
        };

        Log::info('User role changed', [
            'user_id' => $user->id,
            'old_role' => $oldRole,
            'new_role' => $newRole,
        ]);
    }

    /**
     * Create volunteer profile for existing user.
     */
    private function createVolunteerProfile(User $user): void
    {
        $nameParts = $this->splitName($user->name);

        Volunteer::create([
            'first_name' => $nameParts[0],
            'last_name' => $nameParts[1],
            'email' => $user->email,
            'user_id' => $user->id,
            'facebook_name' => '',
            'birthdate' => now()->subYears(18)->format('Y-m-d'),
            'address' => 'Address to be updated',
            'mobile_number' => '00000000000',
            'educational_attainment' => 'To be specified',
            'last_medical_examination' => now()->format('Y-m-d'),
        ]);

        Log::info('Volunteer profile created for existing user', [
            'user_id' => $user->id,
        ]);
    }

    /**
     * Create admin profile for existing user.
     */
    private function createAdminProfile(User $user): void
    {
        $nameParts = $this->splitName($user->name);

        Admin::create([
            'email' => $user->email,
            'user_id' => $user->id,
            'first_name' => $nameParts[0],
            'last_name' => $nameParts[1],
            'contact_number' => '00000000000',
        ]);

        Log::info('Admin profile created for existing user', [
            'user_id' => $user->id,
        ]);
    }

    /**
     * Create coordinator profile for existing user.
     */
    private function createCoordinatorProfile(User $user): void
    {
        $nameParts = $this->splitName($user->name);

        Coordinator::create([
            'email' => $user->email,
            'user_id' => $user->id,
            'first_name' => $nameParts[0],
            'last_name' => $nameParts[1],
            'contact_number' => '00000000000',
        ]);

        Log::info('Coordinator profile created for existing user', [
            'user_id' => $user->id,
        ]);
    }

    /**
     * Split user name into first and last name.
     */
    private function splitName(string $fullName): array
    {
        $cleanName = trim($fullName);
        $nameParts = explode(' ', $cleanName, 2);

        $firstName = $nameParts[0] ?? '';
        $lastName = $nameParts[1] ?? '';

        return [$firstName, $lastName];
    }
}
