<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Admin extends Model
{
    use HasFactory;

    protected $table = 'admin';

    protected $fillable = [
        'first_name',
        'last_name',
        'name',
        'password',
        'email',
        'contact_number',
        'user_id',
    ];

    protected $hidden = [
        'password',
    ];
}
