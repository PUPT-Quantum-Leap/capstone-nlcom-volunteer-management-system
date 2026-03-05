<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Option extends Model
{
    use HasFactory;

    protected $primaryKey = 'option_id';

    protected $fillable = [
        'text',
    ];

    public function polls(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Poll::class, 'poll_option', 'option_id', 'poll_id');
    }
}
