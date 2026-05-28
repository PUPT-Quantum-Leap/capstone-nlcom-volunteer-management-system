<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ForgotPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $emailRule = app()->isProduction() ? 'email:rfc,dns' : 'email:rfc';

        return [
            'email' => ['required', 'string', $emailRule],
        ];
    }
}
