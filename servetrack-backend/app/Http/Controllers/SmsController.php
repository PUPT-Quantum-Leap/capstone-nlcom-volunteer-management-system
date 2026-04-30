<?php

namespace App\Http\Controllers;

use App\Services\SmsService;
use Illuminate\Http\JsonResponse;

class SmsController extends Controller
{
    public function configStatus(): JsonResponse
    {
        $smsService = app(SmsService::class);

        $isConfigured = $smsService->isConfigured();

        if (! $isConfigured) {
            return response()->json([
                'configured' => false,
                'message' => 'No Configuration',
            ]);
        }

        return response()->json([
            'configured' => true,
            'message' => 'SMS service is properly configured.',
        ]);
    }
}
