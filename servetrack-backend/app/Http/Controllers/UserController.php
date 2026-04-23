<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\Coordinator;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    /**
     * Display a listing of the users.
     */
    public function index(Request $request): JsonResponse
    {
        $showArchived = $request->query('archived') === 'true';

        if ($showArchived) {
            $query = User::onlyTrashed();
        } else {
            $query = User::query();
        }

        // Search by name or email
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%');
            });
        }

        // Filter by role
        if ($role = $request->query('role')) {
            $query->where('role', $role);
        }

        $query->orderBy('created_at', 'desc');

        $users = $query->get();

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * Store a newly created user in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => ['required', 'string', Password::defaults()],
            'role' => 'required|in:admin,coordinator,volunteer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => $request->role,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'User created successfully',
                'data' => $user,
            ], 201);
        } catch (\Exception $e) {
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
    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,'.$id,
            'role' => 'required|in:admin,coordinator,volunteer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
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
        $user = User::withTrashed()->find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        try {
            $user->forceDelete();

            return response()->json([
                'success' => true,
                'message' => 'User deleted successfully',
            ]);
        } catch (\Exception $e) {
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
        $user = User::withTrashed()->find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        if (! $user->trashed()) {
            $user->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'User archived successfully',
        ]);
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

        $user->restore();

        return response()->json([
            'success' => true,
            'message' => 'User restored successfully',
        ]);
    }

    /**
     * Reset user password.
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'password' => ['required', 'string', Password::defaults()],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
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
     * Handle role change and create appropriate profile.
     */
    private function handleRoleChange(User $user, string $oldRole, string $newRole): void
    {
        switch ($newRole) {
            case 'volunteer':
                if (! $user->volunteer) {
                    $this->createVolunteerProfile($user);
                }
                break;
            case 'admin':
                if (! $user->admin) {
                    $this->createAdminProfile($user);
                }
                break;
            case 'coordinator':
                if (! $user->coordinator) {
                    $this->createCoordinatorProfile($user);
                }
                break;
        }

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
