<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\TransformsRequest;

class StripTags extends TransformsRequest
{
    /**
     * The attributes that should not be stripped of tags.
     *
     * @var array<int, string>
     */
    protected $except = [
        'password',
        'password_confirmation',
        'currentPassword',
        'newPassword',
        'newPassword_confirmation',
        'confirmPassword',
        'description',
    ];

    /**
     * Transform the given value.
     *
     * @param  string  $key
     * @param  mixed  $value
     * @return mixed
     */
    protected function transform($key, $value)
    {
        if (in_array($key, $this->except, true)) {
            return $value;
        }

        return is_string($value) ? strip_tags($value) : $value;
    }
}
