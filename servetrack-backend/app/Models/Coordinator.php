<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Coordinator extends Model
{
    use HasFactory;

    protected $table = 'coordinator';

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'contact_number',
    ];
}
