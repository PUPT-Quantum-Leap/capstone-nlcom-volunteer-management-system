<?php

namespace App\Http\Controllers;

use App\Models\AttendancePhoto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
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
            $filename = 'attendance_'.time().'_'.pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME).'.jpg';

            // Resize and compress the photo if GD library is available
            $resizedPath = $this->resizeAndCompressImage($file);

            if ($resizedPath) {
                // Save the compressed photo to storage
                $path = Storage::disk('public')->putFileAs('attendance-photos', new \Illuminate\Http\File($resizedPath), $filename);
                unlink($resizedPath); // Clean up the temp file
            } else {
                // Fallback to saving the original photo if compression failed/not supported
                $filename = 'attendance_'.time().'_'.$file->getClientOriginalName();
                $path = $file->storeAs('attendance-photos', $filename, 'public');
            }

            $photo = AttendancePhoto::create([
                'file_path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'uploaded_at' => now(),
                'uploaded_by' => $request->user()->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Photo uploaded successfully. It will be archived after 30 days.',
                'data' => [
                    'photo' => $photo,
                    'url' => Storage::url($path),
                ],
            ], 201);
        } catch (\Exception $e) {
            Log::error('Attendance photo upload failed', ['error' => $e->getMessage()]);

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
            ->where('uploaded_at', '<', now()->subDays(30))
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

    /**
     * Resize and compress an image using GD library to prevent storing large files.
     */
    private function resizeAndCompressImage($file, int $maxWidth = 1200, int $maxHeight = 1200, int $quality = 75): ?string
    {
        if (! extension_loaded('gd')) {
            Log::warning('GD library is not loaded. Skipping image compression.');

            return null;
        }

        $realPath = $file->getRealPath();
        $imageInfo = getimagesize($realPath);
        if (! $imageInfo) {
            return null;
        }

        [$width, $height, $type] = $imageInfo;

        switch ($type) {
            case IMAGETYPE_JPEG:
                $srcImage = imagecreatefromjpeg($realPath);
                break;
            case IMAGETYPE_PNG:
                $srcImage = imagecreatefrompng($realPath);
                break;
            case IMAGETYPE_WEBP:
                $srcImage = imagecreatefromwebp($realPath);
                break;
            default:
                Log::info('Unsupported image type for compression: '.$type);

                return null;
        }

        if (! $srcImage) {
            return null;
        }

        // Keep aspect ratio
        $ratio = $width / $height;
        if ($width > $maxWidth || $height > $maxHeight) {
            if ($width / $maxWidth > $height / $maxHeight) {
                $newWidth = $maxWidth;
                $newHeight = (int) round($maxWidth / $ratio);
            } else {
                $newHeight = $maxHeight;
                $newWidth = (int) round($maxHeight * $ratio);
            }
        } else {
            $newWidth = $width;
            $newHeight = $height;
        }

        $dstImage = imagecreatetruecolor($newWidth, $newHeight);

        // Retain transparency for PNG/WEBP
        if ($type === IMAGETYPE_PNG || $type === IMAGETYPE_WEBP) {
            imagealphablending($dstImage, false);
            imagesavealpha($dstImage, true);
            $transparent = imagecolorallocatealpha($dstImage, 255, 255, 255, 127);
            imagefilledrectangle($dstImage, 0, 0, $newWidth, $newHeight, $transparent);
        }

        imagecopyresampled($dstImage, $srcImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        $tempPath = tempnam(sys_get_temp_dir(), 'attendance_resized_');

        // Output JPEG at the specified quality
        if (imagejpeg($dstImage, $tempPath, $quality)) {
            imagedestroy($srcImage);
            imagedestroy($dstImage);

            return $tempPath;
        }

        imagedestroy($srcImage);
        imagedestroy($dstImage);

        return null;
    }
}
