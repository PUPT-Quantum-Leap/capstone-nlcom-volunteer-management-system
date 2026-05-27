<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', Password::min(8)->mixedCase()->numbers()->symbols()],
            'role' => ['required', 'in:admin,coordinator,volunteer'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'The user name is required.',
            'email.required' => 'The email address is required.',
            'email.unique' => 'This email is already registered.',
            'password.required' => 'A password is required.',
            'role.required' => 'The user role is required.',
            'role.in' => 'The role must be admin, coordinator, or volunteer.',
        ];
    }
}
