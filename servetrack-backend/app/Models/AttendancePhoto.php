<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AttendancePhoto extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'file_path',
        'original_filename',
        'uploaded_at',
        'archived_at',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'uploaded_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    public function shouldArchive(): bool
    {
        return $this->archived_at === null && $this->uploaded_at->lt(now()->subDays(30));
    }

    public function archive(): void
    {
        $this->update(['archived_at' => now()]);
    }
}
