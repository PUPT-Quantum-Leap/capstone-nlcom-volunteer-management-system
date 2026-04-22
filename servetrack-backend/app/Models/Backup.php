<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Backup extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'file_path',
        'size_bytes',
        'type',
        'status',
        'description',
        'completed_at',
        'error_message',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function getSizeFormattedAttribute(): string
    {
        $bytes = $this->size_bytes;
        $units = ['B', 'KB', 'MB', 'GB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, 1).' '.$units[$i];
    }

    public function getStatusFormattedAttribute(): string
    {
        return match ($this->status) {
            'pending' => 'Pending',
            'in_progress' => 'In Progress',
            'completed' => 'Completed',
            'failed' => 'Failed',
            default => 'Unknown',
        };
    }

    public function getTypeFormattedAttribute(): string
    {
        return match ($this->type) {
            'automatic' => 'Automatic',
            'manual' => 'Manual',
            default => 'Unknown',
        };
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    public function isInProgress(): bool
    {
        return $this->status === 'in_progress';
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeManual($query)
    {
        return $query->where('type', 'manual');
    }

    public function scopeAutomatic($query)
    {
        return $query->where('type', 'automatic');
    }

    public function scopeLatest($query)
    {
        return $query->orderBy('created_at', 'desc');
    }
}
