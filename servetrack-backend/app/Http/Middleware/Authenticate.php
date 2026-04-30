<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }

    /**
     * Handle an unauthenticated user.
     *
     * @param  Request  $request
     * @param  string[]  $guards
     */
    protected function unauthenticated($request, array $guards): void
    {
        abort(response()->json(['message' => 'Unauthenticated.'], 401));
    }
}
