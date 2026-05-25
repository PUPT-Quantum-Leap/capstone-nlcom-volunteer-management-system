<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AnalyticsReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'dateRange' => ['nullable', 'string', 'in:all,month,quarter,year'],
            'departmentId' => ['nullable', 'integer', 'exists:positions,position_id'],
            'department' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'dateRange.in' => 'The date range must be one of: all, month, quarter, year.',
            'departmentId.exists' => 'The selected department does not exist.',
            'department.max' => 'The department name must not exceed 255 characters.',
        ];
    }
}
