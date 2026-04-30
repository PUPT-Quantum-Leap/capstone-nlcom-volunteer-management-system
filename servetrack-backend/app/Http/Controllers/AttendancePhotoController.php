<?php

namespace App\Http\Controllers;

use App\Models\AttendancePhoto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class AttendancePhotoController extends Controller
{
    /**
     * Upload attendance photo.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'photo' => 'required|image|max:10240',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $file = $request->file('photo');
            $filename = 'attendance_'.time().'_'.$file->getClientOriginalName();
            $path = $file->storeAs('attendance-photos', $filename, 'public');

            $photo = AttendancePhoto::create([
                'file_path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'uploaded_at' => now(),
                'uploaded_by' => $request->user()->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Photo uploaded successfully. It will be archived after 5 days.',
                'data' => [
                    'photo' => $photo,
                    'url' => Storage::url($path),
                ],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload photo',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * List attendance photos (admin only).
     */
    public function index(Request $request): JsonResponse
    {
        $query = AttendancePhoto::with('uploadedBy')->orderBy('uploaded_at', 'desc');

        if ($request->query('archived') === 'true') {
            $query->whereNotNull('archived_at');
        } else {
            $query->whereNull('archived_at');
        }

        $photos = $query->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $photos,
        ]);
    }

    /**
     * Archive old photos (should be run via scheduled command).
     */
    public function archiveOldPhotos(): JsonResponse
    {
        $photosToArchive = AttendancePhoto::whereNull('archived_at')
            ->where('uploaded_at', '<', now()->subDays(5))
            ->get();

        foreach ($photosToArchive as $photo) {
            $photo->archive();
        }

        return response()->json([
            'success' => true,
            'message' => "Archived {$photosToArchive->count()} photos",
            'data' => [
                'archived_count' => $photosToArchive->count(),
            ],
        ]);
    }

    /**
     * Delete a photo.
     */
    public function destroy(int $id): JsonResponse
    {
        $photo = AttendancePhoto::find($id);

        if (! $photo) {
            return response()->json([
                'success' => false,
                'message' => 'Photo not found',
            ], 404);
        }

        Storage::disk('public')->delete($photo->file_path);
        $photo->delete();

        return response()->json([
            'success' => true,
            'message' => 'Photo deleted successfully',
        ]);
    }
}
