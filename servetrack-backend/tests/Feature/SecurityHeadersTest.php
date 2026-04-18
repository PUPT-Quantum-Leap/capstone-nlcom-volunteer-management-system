<?php

test('the application response contains security headers', function () {
    $response = $this->get('/');

    $response->assertStatus(200);

    // Log headers for debugging if needed
    // echo json_encode($response->headers->all(), JSON_PRETTY_PRINT);

    $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('X-XSS-Protection', '1; mode=block');
    $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    $response->assertHeader('Content-Security-Policy');
});
