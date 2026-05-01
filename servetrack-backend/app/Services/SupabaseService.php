<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SupabaseService
{
    private function getBaseUrl(): string
    {
        return config('services.supabase.url', '');
    }

    private function getServiceRoleKey(): string
    {
        return config('services.supabase.service_role_key', '');
    }

    private function getFrontendUrl(): string
    {
        return config('app.frontend_url', '');
    }

    /**
     * Generate a Supabase auth link for invite (without sending email)
     *
     * Uses Supabase's admin generate_link endpoint to create an auth link
     * that can be copied and shared directly. The user metadata stores
     * our invite token and role for later retrieval.
     *
     * @param  string  $email  The recipient email address
     * @param  string  $inviteLink  Our internal invite link (contains token)
     * @param  string  $role  The role being invited (admin, coordinator, volunteer)
     * @return array{success: bool, message: string, data?: array}
     */
    public function generateInviteLink(string $email, string $inviteLink, string $role): array
    {
        $baseUrl = $this->getBaseUrl();
        $serviceRoleKey = $this->getServiceRoleKey();
        $frontendUrl = $this->getFrontendUrl();

        if (empty($baseUrl) || empty($serviceRoleKey)) {
            Log::error('Supabase configuration missing', [
                'url_set' => ! empty($baseUrl),
                'key_set' => ! empty($serviceRoleKey),
                'frontend_url' => $frontendUrl,
            ]);

            $missing = [];
            if (empty($baseUrl)) {
                $missing[] = 'SUPABASE_URL';
            }
            if (empty($serviceRoleKey)) {
                $missing[] = 'SUPABASE_SERVICE_ROLE_KEY';
            }
            if (empty($frontendUrl)) {
                $missing[] = 'FRONTEND_URL';
            }

            return [
                'success' => false,
                'message' => 'Supabase configuration incomplete. Missing: '.implode(', ', $missing).'. Please check your .env file.',
            ];
        }

        try {
            // Extract token from our invite link
            $parsedUrl = parse_url($inviteLink);
            $queryString = $parsedUrl['query'] ?? '';
            parse_str($queryString, $queryParams);
            $token = $queryParams['token'] ?? '';

            // Build the full API URL for generate_link
            $apiUrl = rtrim($baseUrl, '/').'/auth/v1/admin/generate_link';
            $redirectTo = $this->buildInviteRedirectUrl($token, $role);

            Log::info('Generating Supabase auth link for invite', [
                'url' => $apiUrl,
                'email' => $email,
                'role' => $role,
                'token' => $token,
                'redirect_to' => $redirectTo,
                'has_service_key' => ! empty($serviceRoleKey),
            ]);

            // Use Supabase Admin API to generate auth link
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$serviceRoleKey,
                'apikey' => $serviceRoleKey,
                'Content-Type' => 'application/json',
            ])
                ->post($apiUrl, [
                    'type' => 'magiclink',
                    'email' => $email,
                    'data' => [
                        'role' => $role,
                        'invite_token' => $token,
                        'app_source' => 'servetrack',
                    ],
                    'redirect_to' => $redirectTo,
                ]);

            Log::info('Supabase generate_link response received', [
                'status' => $response->status(),
                'successful' => $response->successful(),
                'body_preview' => substr($response->body(), 0, 500),
            ]);

            if ($response->successful()) {
                $data = $response->json();

                // Extract the auth link from the response
                $authLink = $data['properties']['action_link'] ?? null;

                if (! $authLink) {
                    Log::error('No action_link found in Supabase generate_link response', [
                        'email' => $email,
                        'response' => $data,
                    ]);

                    return [
                        'success' => false,
                        'message' => 'Failed to generate auth link: no link returned from Supabase',
                    ];
                }

                Log::info('Supabase auth link generated successfully', [
                    'email' => $email,
                    'role' => $role,
                    'invite_token' => $token,
                    'auth_link_generated' => true,
                ]);

                return [
                    'success' => true,
                    'message' => 'Auth link generated successfully',
                    'data' => [
                        'auth_link' => $authLink,
                        'email' => $email,
                        'role' => $role,
                        'invite_token' => $token,
                    ],
                ];
            }

            // Handle specific error cases
            $status = $response->status();
            $errorData = $response->json();
            $error = $errorData['message'] ?? $errorData['msg'] ?? $response->body();

            // User already exists - update their metadata and generate link
            if ($status === 422 && str_contains(strtolower($error), 'already')) {
                Log::info('User already exists in Supabase, updating metadata and generating link', [
                    'email' => $email,
                ]);

                // Update user metadata
                $updateResult = $this->updateUserMetadata($email, $role, $token);
                if (! $updateResult['success']) {
                    Log::warning('Failed to update user metadata for existing user', [
                        'email' => $email,
                        'error' => $updateResult['message'],
                    ]);
                }

                // Try to generate link again
                $response = Http::withHeaders([
                    'Authorization' => 'Bearer '.$serviceRoleKey,
                    'apikey' => $serviceRoleKey,
                    'Content-Type' => 'application/json',
                ])
                    ->post($apiUrl, [
                        'type' => 'magiclink',
                        'email' => $email,
                        'data' => [
                            'role' => $role,
                            'invite_token' => $token,
                            'app_source' => 'servetrack',
                        ],
                        'redirect_to' => $redirectTo,
                    ]);

                if ($response->successful()) {
                    $data = $response->json();
                    $authLink = $data['properties']['action_link'] ?? null;

                    if ($authLink) {
                        return [
                            'success' => true,
                            'message' => 'Auth link generated successfully for existing user',
                            'data' => [
                                'auth_link' => $authLink,
                                'email' => $email,
                                'role' => $role,
                                'invite_token' => $token,
                            ],
                        ];
                    }
                }

                Log::error('Failed to generate auth link for existing user', [
                    'email' => $email,
                    'status' => $response->status(),
                    'error' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'message' => 'Failed to generate auth link for existing user',
                ];
            }

            // Provide helpful error messages for common issues
            $helpMessage = '';
            if ($status === 400) {
                $helpMessage = ' Redirect URL may not be configured in Supabase dashboard. Add '.$redirectTo.' to Authentication > URL Configuration > Redirect URLs.';
            } elseif ($status === 401 || $status === 403) {
                $helpMessage = ' Invalid Supabase service role key. Check SUPABASE_SERVICE_ROLE_KEY in .env file.';
            } elseif ($status === 404) {
                $helpMessage = ' Supabase Auth API not found. Check SUPABASE_URL in .env file.';
            }

            Log::error('Supabase generate_link failed', [
                'email' => $email,
                'status' => $status,
                'error' => $error,
                'redirect_to' => $redirectTo,
                'response' => $errorData,
            ]);

            return [
                'success' => false,
                'message' => 'Failed to generate auth link: '.$error.$helpMessage,
            ];
        } catch (\Exception $e) {
            Log::error('Supabase generate_link exception', [
                'email' => $email,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'message' => 'Exception while generating auth link: '.$e->getMessage(),
            ];
        }
    }

    public function sendInviteEmail(string $email, string $inviteLink, string $role): array
    {
        $baseUrl = $this->getBaseUrl();
        $serviceRoleKey = $this->getServiceRoleKey();
        $frontendUrl = $this->getFrontendUrl();

        if (empty($baseUrl) || empty($serviceRoleKey)) {
            Log::error('Supabase configuration missing', [
                'url_set' => ! empty($baseUrl),
                'key_set' => ! empty($serviceRoleKey),
                'frontend_url' => $frontendUrl,
            ]);

            $missing = [];
            if (empty($baseUrl)) {
                $missing[] = 'SUPABASE_URL';
            }
            if (empty($serviceRoleKey)) {
                $missing[] = 'SUPABASE_SERVICE_ROLE_KEY';
            }
            if (empty($frontendUrl)) {
                $missing[] = 'FRONTEND_URL';
            }

            return [
                'success' => false,
                'message' => 'Supabase configuration incomplete. Missing: '.implode(', ', $missing).'. Please check your .env file.',
            ];
        }

        try {
            // Extract token from our invite link
            $parsedUrl = parse_url($inviteLink);
            $queryString = $parsedUrl['query'] ?? '';
            parse_str($queryString, $queryParams);
            $token = $queryParams['token'] ?? '';

            // Build the full API URL
            $apiUrl = rtrim($baseUrl, '/').'/auth/v1/admin/invite';
            $redirectTo = $this->buildInviteRedirectUrl($token, $role);

            Log::info('Sending Supabase admin invite request', [
                'url' => $apiUrl,
                'email' => $email,
                'role' => $role,
                'token' => $token,
                'redirect_to' => $redirectTo,
                'has_service_key' => ! empty($serviceRoleKey),
            ]);

            // Use Supabase Admin API to send invite email
            // This creates a user and sends them an email with a confirmation link
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$serviceRoleKey,
                'apikey' => $serviceRoleKey,
                'Content-Type' => 'application/json',
            ])
                ->post($apiUrl, [
                    'email' => $email,
                    'data' => [
                        'role' => $role,
                        'invite_token' => $token,
                        'app_source' => 'servetrack',
                    ],
                    'redirect_to' => $redirectTo,
                ]);

            Log::info('Supabase admin invite response received', [
                'status' => $response->status(),
                'successful' => $response->successful(),
                'body_preview' => substr($response->body(), 0, 500),
            ]);

            if ($response->successful()) {
                $data = $response->json();
                Log::info('Supabase invite email API call succeeded', [
                    'email' => $email,
                    'role' => $role,
                    'invite_token' => $token,
                    'supabase_user_id' => $data['id'] ?? null,
                    'user_metadata' => $data['user_metadata'] ?? null,
                    'identities' => $data['identities'] ?? null,
                    'email_confirmed_at' => $data['email_confirmed_at'] ?? null,
                    'confirmation_sent_at' => $data['confirmation_sent_at'] ?? null,
                ]);

                return [
                    'success' => true,
                    'message' => 'Invite email sent successfully via Supabase',
                    'data' => $data,
                ];
            }

            // Handle specific error cases
            $status = $response->status();
            $errorData = $response->json();
            $error = $errorData['message'] ?? $errorData['msg'] ?? $response->body();

            // User already exists - use magiclink to send email instead of invite
            if ($status === 422 && str_contains(strtolower($error), 'already')) {
                Log::info('User already exists in Supabase, using magiclink instead of invite', [
                    'email' => $email,
                ]);

                // Update user metadata first
                $updateResult = $this->updateUserMetadata($email, $role, $token);
                if (! $updateResult['success']) {
                    Log::warning('Failed to update user metadata for existing user', [
                        'email' => $email,
                        'error' => $updateResult['message'],
                    ]);
                }

                // For existing users, use OTP endpoint to send magiclink email
                // This actually sends the email to existing users
                $otpUrl = rtrim($baseUrl, '/').'/auth/v1/otp';

                Log::info('Sending OTP magiclink for existing user', [
                    'email' => $email,
                    'api_url' => $otpUrl,
                ]);

                // Note: OTP endpoint uses service role key to send on behalf of user
                $otpResponse = Http::withHeaders([
                    'Authorization' => 'Bearer '.$serviceRoleKey,
                    'apikey' => $serviceRoleKey,
                    'Content-Type' => 'application/json',
                ])
                    ->post($otpUrl, [
                        'email' => $email,
                        'data' => [
                            'role' => $role,
                            'invite_token' => $token,
                            'app_source' => 'servetrack',
                        ],
                        'redirect_to' => $redirectTo,
                    ]);

                Log::info('OTP magiclink response', [
                    'status' => $otpResponse->status(),
                    'successful' => $otpResponse->successful(),
                    'body' => $otpResponse->body(),
                ]);

                // OTP returns 200 even if rate limited - check the response
                if ($otpResponse->successful()) {
                    Log::info('OTP magiclink sent for existing user', [
                        'email' => $email,
                        'role' => $role,
                        'invite_token' => $token,
                    ]);

                    return [
                        'success' => true,
                        'message' => 'Invite email sent successfully via Supabase (OTP)',
                        'data' => ['email' => $email],
                    ];
                }

                // If OTP also fails, try generate_link as fallback and return the link
                Log::warning('OTP failed, falling back to generate_link for existing user', [
                    'email' => $email,
                    'status' => $otpResponse->status(),
                    'error' => $otpResponse->body(),
                ]);

                // Last resort: generate link and return it (frontend can show it)
                $linkResult = $this->generateInviteLink($email, $internalInviteLink, $role);
                if ($linkResult['success']) {
                    return [
                        'success' => true,
                        'message' => 'User already exists. Email may not have been sent - check Supabase email provider settings. Generated link available.',
                        'data' => $linkResult['data'],
                    ];
                }

                return [
                    'success' => false,
                    'message' => 'User already exists and all email methods failed: '.($otpResponse->json()['message'] ?? 'Unknown error'),
                ];
            }

            // Provide helpful error messages for common issues
            $helpMessage = '';
            if ($status === 400) {
                $helpMessage = ' Redirect URL may not be configured in Supabase dashboard. Add '.$redirectTo.' to Authentication > URL Configuration > Redirect URLs.';
            } elseif ($status === 401 || $status === 403) {
                $helpMessage = ' Invalid Supabase service role key. Check SUPABASE_SERVICE_ROLE_KEY in .env file.';
            } elseif ($status === 404) {
                $helpMessage = ' Supabase Auth API not found. Check SUPABASE_URL in .env file.';
            }

            Log::error('Supabase invite email failed', [
                'email' => $email,
                'status' => $status,
                'error' => $error,
                'redirect_to' => $redirectTo,
                'response' => $errorData,
            ]);

            return [
                'success' => false,
                'message' => 'Failed to send invite email: '.$error.$helpMessage,
            ];
        } catch (\Exception $e) {
            Log::error('Supabase invite email exception', [
                'email' => $email,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'message' => 'Exception while sending invite email: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Update user metadata for existing users
     */
    private function updateUserMetadata(string $email, string $role, string $token): array
    {
        $baseUrl = $this->getBaseUrl();
        $serviceRoleKey = $this->getServiceRoleKey();

        if (empty($baseUrl) || empty($serviceRoleKey)) {
            return [
                'success' => false,
                'message' => 'Supabase configuration incomplete',
            ];
        }

        try {
            // First, find the user by email
            $usersUrl = rtrim($baseUrl, '/').'/auth/v1/admin/users';
            $usersResponse = Http::withHeaders([
                'Authorization' => 'Bearer '.$serviceRoleKey,
                'apikey' => $serviceRoleKey,
            ])->get($usersUrl);

            if (! $usersResponse->successful()) {
                return [
                    'success' => false,
                    'message' => 'Failed to fetch users from Supabase',
                ];
            }

            $users = $usersResponse->json();
            $user = collect($users)->firstWhere('email', $email);

            if (! $user) {
                return [
                    'success' => false,
                    'message' => 'User not found in Supabase',
                ];
            }

            $userId = $user['id'];

            // Update user metadata
            $updateUrl = rtrim($baseUrl, '/').'/auth/v1/admin/users/'.$userId;
            $updateResponse = Http::withHeaders([
                'Authorization' => 'Bearer '.$serviceRoleKey,
                'apikey' => $serviceRoleKey,
                'Content-Type' => 'application/json',
            ])->put($updateUrl, [
                'user_metadata' => [
                    'role' => $role,
                    'invite_token' => $token,
                    'app_source' => 'servetrack',
                ],
            ]);

            if ($updateResponse->successful()) {
                return [
                    'success' => true,
                    'message' => 'User metadata updated successfully',
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Failed to update user metadata: '.$updateResponse->body(),
                ];
            }
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Exception updating user metadata: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Send a custom email using Supabase Edge Function or REST API
     * Alternative method using direct email sending
     *
     * @param  string  $to  The recipient email address
     * @param  string  $subject  The email subject
     * @param  string  $htmlContent  The HTML content of the email
     * @return array{success: bool, message: string}
     */
    public function sendCustomEmail(string $to, string $subject, string $htmlContent): array
    {
        $baseUrl = $this->getBaseUrl();
        $serviceRoleKey = $this->getServiceRoleKey();

        if (empty($baseUrl) || empty($serviceRoleKey)) {
            return [
                'success' => false,
                'message' => 'Supabase configuration is incomplete',
            ];
        }

        try {
            // Try to use Supabase's built-in email capabilities
            // Note: This requires enabling email provider in Supabase dashboard
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$serviceRoleKey,
                'apikey' => $serviceRoleKey,
                'Content-Type' => 'application/json',
            ])
                ->post($baseUrl.'/rest/v1/rpc/send_email', [
                    'to_email' => $to,
                    'subject' => $subject,
                    'html_content' => $htmlContent,
                ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'Email sent successfully',
                ];
            }

            return [
                'success' => false,
                'message' => 'Failed to send email: '.($response->json()['message'] ?? $response->body()),
            ];
        } catch (\Exception $e) {
            Log::error('Supabase custom email exception', [
                'to' => $to,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Exception while sending email: '.$e->getMessage(),
            ];
        }
    }

    private function buildInviteRedirectUrl(string $token, string $role): string
    {
        $baseFrontendUrl = rtrim($this->getFrontendUrl(), '/');

        if ($baseFrontendUrl === '') {
            return '';
        }

        // Always redirect to the auth callback component first
        // The callback component will then redirect to the appropriate signup form
        return $baseFrontendUrl.'/auth/callback?'.http_build_query([
            'token' => $token,
            'role' => $role,
        ]);
    }
}
