<?php

use App\Console\Commands\CloseExpiredRsvp;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('rsvp:close-expired', function () {
    $this->call(CloseExpiredRsvp::class);
})->purpose('Automatically close RSVP events that have passed their cutoff deadline')->schedule('*/3 * * * *');
