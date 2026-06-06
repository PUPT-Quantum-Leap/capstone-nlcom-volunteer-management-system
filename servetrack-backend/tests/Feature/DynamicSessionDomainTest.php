<?php

use Illuminate\Support\Facades\Config;

describe('DynamicSessionDomain middleware', function (): void {
    beforeEach(function (): void {
        Config::set('session.domain', '.quantumapp.tech');
    });

    it('nulls the session domain when the request Origin is a Vercel preview', function (): void {
        $response = $this->withHeaders([
            'Origin' => 'https://servetrack-git-feat-abc123.vercel.app',
        ])->get('/sanctum/csrf-cookie');

        $response->assertNoContent();
        expect(Config::get('session.domain'))->toBeNull();
    });

    it('nulls the session domain for any subdomain of vercel.app', function (): void {
        $this->withHeaders([
            'Origin' => 'https://servetrack-preview-xyz.vercel.app',
        ])->get('/sanctum/csrf-cookie')->assertNoContent();

        expect(Config::get('session.domain'))->toBeNull();
    });

    it('omits the Domain attribute on the XSRF-TOKEN cookie for Vercel origins', function (): void {
        $response = $this->withHeaders([
            'Origin' => 'https://servetrack-git-feat-abc123.vercel.app',
        ])->get('/sanctum/csrf-cookie');

        $response->assertNoContent();

        $xsrfCookie = collect($response->headers->getCookies())
            ->first(fn ($cookie) => $cookie->getName() === 'XSRF-TOKEN');

        expect($xsrfCookie)->not->toBeNull();
        expect($xsrfCookie->getDomain())->toBeNull();
    });

    it('keeps the session domain for production origins', function (): void {
        $this->withHeaders([
            'Origin' => 'https://servetrack.quantumapp.tech',
        ])->get('/sanctum/csrf-cookie')->assertNoContent();

        expect(Config::get('session.domain'))->toBe('.quantumapp.tech');
    });

    it('keeps the session domain for localhost origins', function (): void {
        $this->withHeaders([
            'Origin' => 'http://localhost:4200',
        ])->get('/sanctum/csrf-cookie')->assertNoContent();

        expect(Config::get('session.domain'))->toBe('.quantumapp.tech');
    });

    it('keeps the session domain when the request has no Origin header', function (): void {
        $this->get('/sanctum/csrf-cookie')->assertNoContent();

        expect(Config::get('session.domain'))->toBe('.quantumapp.tech');
    });

    it('keeps the session domain for non-Vercel https origins', function (): void {
        $this->withHeaders([
            'Origin' => 'https://malicious-site.example.com',
        ])->get('/sanctum/csrf-cookie')->assertNoContent();

        expect(Config::get('session.domain'))->toBe('.quantumapp.tech');
    });
});
