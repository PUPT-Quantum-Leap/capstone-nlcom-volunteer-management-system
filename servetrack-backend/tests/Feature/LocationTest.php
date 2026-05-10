<?php

use App\Models\Location;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

describe('Location Factory & Model', function (): void {
    it('generates a valid location using factory', function (): void {
        $location = Location::factory()->create();

        expect($location->name)->not->toBeEmpty();
        expect($location->address)->not->toBeEmpty();
        expect($location->city)->not->toBeEmpty();
        expect($location->country)->toBe('USA');
    });

    it('has a correct full_address attribute', function (): void {
        $location = Location::factory()->create([
            'address' => '123 Main St',
            'city' => 'Anytown',
            'state' => 'CA',
            'zip_code' => '12345',
            'country' => 'USA',
        ]);

        expect($location->full_address)->toBe('123 Main St, Anytown, CA, 12345, USA');
    });

    it('has a correct display_name attribute', function (): void {
        $location = Location::factory()->create([
            'name' => 'Main Center',
            'city' => 'Anytown',
        ]);

        expect($location->display_name)->toBe('Main Center (Anytown)');
    });
});
